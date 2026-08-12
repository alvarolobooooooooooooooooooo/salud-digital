// Auth = cookie HttpOnly. localStorage se mantiene solo para metadata no sensible
// (sd_role, sd_clinic_id) que las páginas usan para decidir UI. El token también
// queda en localStorage como fallback para sesiones que existieran antes del cambio.
function getToken() { return localStorage.getItem('sd_token'); }
function getRole()  { return localStorage.getItem('sd_role'); }

function logout() {
  // Vamos a /login.html (no a la landing). Como login.html comprueba la sesión
  // al cargar (/api/auth/me) y redirige a la plataforma si la cookie sigue viva,
  // ESPERAMOS a que el logout del servidor borre la cookie ANTES de navegar; si
  // no, habría una carrera y login.html nos rebotaría de vuelta al dashboard.
  const go = () => {
    localStorage.clear();
    // replace(): "atrás" no debe volver a la pantalla autenticada.
    window.location.replace('/login.html');
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000); // red de seguridad si cuelga
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal
    })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); go(); });
  } catch (_) { go(); }
}

function requireAuth(allowedRoles) {
  // La sesión vive en la cookie HttpOnly (fuente de verdad). El token en localStorage
  // es un fallback legacy; algunos navegadores limpian el storage manteniendo cookies.
  // Si tenemos cualquiera de los dos, asumimos sesión y dejamos que las llamadas a la
  // API confirmen: un 401 dispara logout() en api() y limpia ambos.
  if (!getToken() && !getRole()) { window.location.href = '/login.html'; return; }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    const role = getRole();
    const redirects = {
      'super_admin': '/admin.html',
      'receptionist': '/recepcion-inicio.html'
    };
    window.location.href = redirects[role] || '/dashboard.html';
  }
}

async function api(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 45000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  // Bearer header solo como fallback para sesiones legacy (pre-cookie). El servidor
  // prefiere la cookie HttpOnly cuando existe, así que esto es redundante en sesiones
  // nuevas pero no rompe nada.
  const legacyToken = getToken();
  if (legacyToken) headers['Authorization'] = `Bearer ${legacyToken}`;

  const config = {
    method: options.method || 'GET',
    headers,
    credentials: 'same-origin', // envía la cookie sd_token en peticiones a este origen
    signal: controller.signal
  };
  if (options.body) config.body = JSON.stringify(options.body);

  let res;
  try {
    res = await fetch(url, config);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const err = new Error('La solicitud tardó demasiado. Revisa tu conexión e intenta de nuevo.');
      err.code = 'TIMEOUT';
      throw err;
    }
    const err = new Error('No hay conexión con el servidor. Verifica tu internet e intenta de nuevo.');
    err.code = 'NETWORK';
    throw err;
  }
  clearTimeout(timer);

  if (res.status === 401) {
    // Sesión expirada: no redirigir silenciosamente — tirar error para que el caller
    // resetee el estado de "Guardando…" y muestre mensaje, luego logout en 1.5s
    setTimeout(() => logout(), 1500);
    const err = new Error('Tu sesión ha expirado. Serás redirigido al login.');
    err.status = 401;
    throw err;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { error: text.slice(0, 200) }; }
  }
  if (!res.ok) {
    // 402 = suscripción inactiva. El servidor cierra la API entera, así que no
    // tiene sentido dejar la página a medio cargar: se manda a la pantalla de
    // suscripción (salvo que ya estemos en ella, o sería un bucle).
    if (res.status === 402 && data && data.code === 'subscription_required') {
      if (window.location.pathname !== '/plan.html') {
        window.location.replace('/plan.html?bloqueo=1');
      }
      const err = new Error(data.error || 'Tu suscripción no está activa.');
      err.status = 402;
      err.code = 'subscription_required';
      throw err;
    }
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Escape estricto: además de < > &, escapa " ' / ` para que el resultado sea seguro
// usado en atributos HTML (onclick="...('${esc(x)}')"), no solo en text nodes.
function esc(str) {
  return String(str ?? '').replace(/[&<>"'`\/]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '/': '&#47;'
  }[ch]));
}

function msg(id, text, isErr) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (isErr ? 'err' : 'ok');
  if (text) setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 3500);
}
