function getToken() { return localStorage.getItem('sd_token'); }
function getRole()  { return localStorage.getItem('sd_role'); }

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

function requireAuth(allowedRoles) {
  if (!getToken()) { window.location.href = '/'; return; }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    const role = getRole();
    const redirects = {
      'super_admin': '/admin.html',
      'receptionist': '/reception.html'
    };
    window.location.href = redirects[role] || '/dashboard.html';
  }
}

async function api(url, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
  };
  if (options.body) config.body = JSON.stringify(options.body);

  const res = await fetch(url, config);
  if (res.status === 401) { logout(); return; }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
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
