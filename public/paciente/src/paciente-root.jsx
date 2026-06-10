// paciente-root.jsx — punto de entrada de la plataforma del paciente.
// 1) Compuerta de sesión: exige una cuenta con rol 'patient' (mismo login).
// 2) Personaliza al titular con el usuario real autenticado.
// 3) Monta una sola app RESPONSIVA: WebShell en escritorio, MobileShell en
//    celular (sin marco de dispositivo: ocupa toda la pantalla / contenedor).
(function () {
  const { useState, useEffect } = React;
  const DESKTOP_MQ = '(min-width: 860px)';

  function authHeaders() {
    // La cookie HttpOnly es la fuente de verdad; el Bearer queda como fallback
    // de compatibilidad, igual que en login.html.
    const t = (function () { try { return localStorage.getItem('sd_token'); } catch (e) { return null; } })();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  // Logout real contra el backend (revoca la sesión y limpia el fallback).
  window.sdLogout = async function () {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: authHeaders() });
    } catch (e) {}
    try { localStorage.removeItem('sd_token'); localStorage.removeItem('sd_role'); localStorage.removeItem('sd_clinic_id'); } catch (e) {}
    window.location.replace('/login.html');
  };

  function personalize(me) {
    try {
      const fam = window.DB && window.DB.family && window.DB.family[0];
      if (fam && me && me.name && me.name.trim()) {
        const parts = me.name.trim().split(/\s+/);
        fam.name = me.name.trim();
        fam.short = parts[0];
        fam.initials = (parts.slice(0, 2).map(s => s[0]).join('') || parts[0][0]).toUpperCase();
      }
      window.SD_USER = me;
    } catch (e) {}
  }

  // ---- Responsive root ----
  function PatientRoot() {
    const [desktop, setDesktop] = useState(() => {
      try { return window.matchMedia(DESKTOP_MQ).matches; } catch (e) { return true; }
    });
    useEffect(() => {
      const mq = window.matchMedia(DESKTOP_MQ);
      const onChange = (e) => setDesktop(e.matches);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else mq.removeListener(onChange);
      };
    }, []);
    const Inner = desktop ? window.WebShell : window.MobileShell;
    return (
      <window.AppProvider>
        <Inner />
      </window.AppProvider>
    );
  }

  function mount() {
    const el = document.getElementById('root');
    const needed = ['DB', 'AppProvider', 'WebShell', 'MobileShell', 'Icon'];
    const missing = needed.filter((k) => typeof window[k] === 'undefined');
    if (missing.length) {
      el.innerHTML = '<pre style="padding:24px;font:13px monospace;color:#C2362C">Faltan módulos: ' + missing.join(', ') + '</pre>';
      return;
    }
    ReactDOM.createRoot(el).render(<PatientRoot />);
  }

  // ---- Auth gate, then mount ----
  (async function () {
    let me = null;
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include', headers: authHeaders() });
      if (r.ok) me = await r.json();
    } catch (e) {}

    if (!me) { window.location.replace('/login.html'); return; }
    if (me.role !== 'patient') {
      // Sesión válida pero NO es paciente → mándalo a su panel correspondiente.
      const dest = me.role === 'super_admin' ? '/admin.html'
        : me.role === 'receptionist' ? '/recepcion-inicio.html'
        : '/dashboard.html';
      window.location.replace(dest);
      return;
    }
    personalize(me);
    mount();
  })();
})();
