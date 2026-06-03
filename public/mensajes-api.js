// ============================================================
// Salud Digital · Mensajería clínica — cliente de API + helpers
// Reemplaza los datos mock: todo se sirve desde /api/messaging.
// Usa el helper global api() (common.js) para auth por cookie/JWT.
// ============================================================

const ChatAPI = {
  me:            ()              => api('/api/messaging/me'),
  members:       ()              => api('/api/messaging/members'),
  conversations: ()              => api('/api/messaging/conversations'),
  messages:      (id, after)     => api(`/api/messaging/conversations/${id}/messages` + (after ? `?after=${after}` : '')),
  send:          (id, msg)       => api(`/api/messaging/conversations/${id}/messages`, { method: 'POST', body: msg }),
  createConversation: (data)     => api('/api/messaging/conversations', { method: 'POST', body: data }),
  markRead:      (id)            => api(`/api/messaging/conversations/${id}/read`, { method: 'POST' }),
  toggleTask:    (msgId)         => api(`/api/messaging/messages/${msgId}/task`, { method: 'PATCH' }),
  searchPatients:(q)             => api('/api/messaging/patients?q=' + encodeURIComponent(q || '')),
  patient:       (id)            => api('/api/messaging/patients/' + id),

  // Subida de estudios/imágenes: multipart, fuera del helper JSON.
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const headers = {};
    const token = localStorage.getItem('sd_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api/messaging/upload', {
      method: 'POST', body: fd, credentials: 'same-origin', headers,
    });
    if (!res.ok) {
      let msg = 'No se pudo subir el archivo';
      try { msg = (await res.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  },
};

// Estado compartido entre componentes (id del usuario actual para "own").
const ChatState = { meId: null, me: null };

// ── Helpers de presentación ──
const AVATAR_COLORS = ['#0891b2', '#0e7490', '#15803d', '#be123c', '#b45309', '#2b6aa3', '#7c3aed', '#0369a1'];
function colorForId(id) {
  const s = String(id == null ? '0' : id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initialsOf(name) {
  if (!name) return '?';
  const p = String(name).replace(/^(dr|dra)\.?\s+/i, '').trim().split(/\s+/);
  return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase() || '?';
}
// Hora de Honduras siempre, sin importar la zona horaria del navegador.
const TZ = 'America/Tegucigalpa';
// "Hoy/Ayer" se decide comparando la fecha-calendario en Honduras, no la del navegador.
function hnDateStr(d) { return d.toLocaleDateString('en-CA', { timeZone: TZ }); } // YYYY-MM-DD

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtListTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (hnDateStr(d) === hnDateStr(now)) return fmtTime(iso);
  const y = new Date(now.getTime() - 86400000);
  if (hnDateStr(d) === hnDateStr(y)) return 'Ayer';
  if ((now - d) / 86400000 < 7) return d.toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'short' });
  return d.toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' });
}
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (hnDateStr(d) === hnDateStr(now)) return 'Hoy';
  const y = new Date(now.getTime() - 86400000);
  if (hnDateStr(d) === hnDateStr(y)) return 'Ayer';
  return d.toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
}
function roleLabel(r) {
  return { doctor: 'Médico/a', clinic_admin: 'Administración', receptionist: 'Recepción', super_admin: 'Administración' }[r] || '';
}
function dateKey(iso) { return iso ? hnDateStr(new Date(iso)) : ''; }

// Seguridad: solo permite http(s) o rutas relativas same-origin en href/src.
// Bloquea javascript:, data:, etc. (los payloads de mensaje vienen de usuarios).
function safeUrl(url) {
  if (!url) return '#';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return '#';
}
// Para backgroundImage: además de validar el esquema, neutraliza caracteres que
// permitirían romper el contexto CSS url("...").
function safeCssUrl(url) {
  const u = safeUrl(url);
  if (u === '#') return '';
  return u.replace(/["'()\\\s<>]/g, '');
}

const GROUPS = [
  { id: 'directos',       label: 'Directos',          icon: 'user' },
  { id: 'equipos',        label: 'Equipos',           icon: 'users' },
  { id: 'casos',          label: 'Casos · Pacientes', icon: 'folder' },
  { id: 'interconsultas', label: 'Interconsultas',    icon: 'stethoscope' },
  { id: 'anuncios',       label: 'Anuncios',          icon: 'megaphone' },
];

const chatHelpers = { colorForId, initialsOf, fmtTime, fmtListTime, dayLabel, roleLabel, dateKey, safeUrl, safeCssUrl };

Object.assign(window, { ChatAPI, ChatState, chatHelpers, GROUPS });
