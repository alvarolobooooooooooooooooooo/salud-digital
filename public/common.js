// Auth = cookie HttpOnly. localStorage se mantiene solo para metadata no sensible
// (sd_role, sd_clinic_id) que las páginas usan para decidir UI. El token también
// queda en localStorage como fallback para sesiones que existieran antes del cambio.
function getToken() { return localStorage.getItem('sd_token'); }
function getRole()  { return localStorage.getItem('sd_role'); }

function logout() {
  try {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
  localStorage.clear();
  window.location.href = '/';
}

function requireAuth(allowedRoles) {
  if (!getToken()) { window.location.href = '/'; return; }
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
