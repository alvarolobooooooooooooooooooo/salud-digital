function getToken() { return localStorage.getItem('sd_token'); }
function getRole()  { return localStorage.getItem('sd_role'); }

function logout() {
  const token = getToken();
  if (token) {
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }
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

  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
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

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str ?? ''));
  return d.innerHTML;
}

function msg(id, text, isErr) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (isErr ? 'err' : 'ok');
  if (text) setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 3500);
}
