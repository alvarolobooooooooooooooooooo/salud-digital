// web/shell.jsx — desktop shell: sidebar + topbar + router + overlay host. Exports WebRoot.
(function () {
  const { useState, useEffect, useRef, createContext, useContext } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill } = window;

  // ---- web-only context (family filter) ----
  const WebCtx = createContext(null);
  window.useWeb = () => useContext(WebCtx);

  const NAV = [
    { id: 'home', icon: 'home', label: 'Inicio' },
    { id: 'citas', icon: 'calendar', label: 'Citas' },
    { id: 'salud', icon: 'heart-pulse', label: 'Mi salud' },
    { id: 'chat', icon: 'message', label: 'Mensajes' },
    { id: 'facturas', icon: 'receipt', label: 'Facturas' },
  ];
  const TITLES = {
    home: ['Inicio', 'Su resumen de salud de hoy'],
    citas: ['Citas', 'Agenda de toda la familia'],
    salud: ['Mi salud', 'Lo que su médico comparte y su propio espacio'],
    chat: ['Mensajes', 'Hable directo con su equipo médico'],
    facturas: ['Facturas', 'Saldos y comprobantes'],
    perfil: ['Mi perfil', 'Cuenta y familia'],
  };

  // ---- overlay router: which pushed screens are modal vs drawer ----
  const MODAL = { agendar: 1, preconsulta: 1 };
  const FULL = { video: 1 };
  const DRAWER = { resultado: 1, receta: 1, resumen: 1, medicamento: 1, cita: 1, familiar: 1, factura: 1, ruta: 1, notificaciones: 1 };

  function Sidebar({ app }) {
    const { DB } = app;
    const tab = app.cur.name;
    const baseTab = app.stack[0].name;
    const unread = app.chats.reduce((s, c) => s + (c.unread || 0), 0);
    const pendFac = app.facturas.filter(f => f.status === 'pendiente').length;
    const me = DB.personById('ana');
    return (
      <aside className="side">
        <div className="side-logo">
          <svg className="mark" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="78" y="6" width="64" height="92" rx="28" fill="#0080B0"/>
            <rect x="102" y="78" width="92" height="64" rx="28" fill="#0080B0"/>
            <rect x="78" y="102" width="64" height="92" rx="28" fill="#0080B0"/>
            <rect x="6" y="78" width="92" height="64" rx="28" fill="#54B0DD"/>
            <rect x="86" y="86" width="28" height="28" fill="#fff"/>
          </svg>
          <div className="wm">Salud Digital<small>Paciente</small></div>
        </div>

        {NAV.map(n => {
          const on = baseTab === n.id;
          const badge = n.id === 'chat' ? unread : n.id === 'facturas' ? pendFac : 0;
          return (
            <button key={n.id} className={'nav-item' + (on ? ' on' : '')} onClick={() => app.setTab(n.id)}>
              <Icon name={n.icon} size={20} color="currentColor" strokeWidth={on ? 2.1 : 1.75} />
              <span className="lbl">{n.label}</span>
              {badge > 0 && <span className="nav-badge">{badge}</span>}
            </button>
          );
        })}

        <div className="side-label">Mi familia</div>
        <div className="side-fam">
          {DB.family.map(p => (
            <button key={p.id} className="fam-item" onClick={() => app.go('familiar', { id: p.id })}>
              <Avatar person={p} size={30} />
              <div className="col">
                <div className="nm">{p.short}</div>
                <div className="rl">{p.rel}{p.note ? ' · ' + p.note : ''}</div>
              </div>
            </button>
          ))}
          <button className="fam-item" onClick={() => app.go('familiar', { id: 'ana' })}>
            <span style={{ width: 30, height: 30, borderRadius: 999, border: '1.5px dashed rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={16} color="rgba(255,255,255,0.6)" /></span>
            <div className="col"><div className="nm" style={{ color: 'var(--sd-blue-300)' }}>Agregar</div></div>
          </button>
        </div>

        <button className="side-account" onClick={() => app.setTab('perfil')}>
          <Avatar person={me} size={38} />
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <div className="nm">{me.name.split(' ').slice(0, 2).join(' ')}</div>
            <div className="em">Cuenta verificada</div>
          </div>
          <Icon name="settings" size={17} color="rgba(255,255,255,0.5)" />
        </button>
      </aside>
    );
  }

  function TopBar({ app, web }) {
    const { DB } = app;
    const baseTab = app.stack[0].name;
    const [t, st] = TITLES[baseTab] || TITLES.home;
    const [open, setOpen] = useState(false);
    const person = web.person === 'all' ? null : DB.personById(web.person);
    return (
      <header className="web-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{t}</h1>
          <div className="sub">{st}</div>
        </div>
        <div className="web-search">
          <Icon name="search" size={18} color="var(--fg-muted)" />
          <input placeholder="Buscar médico, especialidad…" />
        </div>
        {/* family switcher */}
        <div style={{ position: 'relative' }}>
          <button className="fam-switch" onClick={() => setOpen(o => !o)}>
            {person ? <Avatar person={person} size={26} /> : <span style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--sd-blue-100)', display: 'grid', placeItems: 'center' }}><Icon name="users" size={15} color="var(--sd-blue-600)" /></span>}
            <span>{person ? person.short : 'Toda la familia'}</span>
            <Icon name="chevron-down" size={16} color="var(--fg-muted)" />
          </button>
          {open && (
            <React.Fragment>
              <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
              <div style={{ position: 'absolute', top: 50, right: 0, width: 240, background: 'var(--bg-surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-soft)', padding: 6, zIndex: 31 }}>
                <button className="wrow" style={{ borderRadius: 8, padding: '10px 12px' }} onClick={() => { web.setPerson('all'); setOpen(false); }}>
                  <span style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--sd-blue-100)', display: 'grid', placeItems: 'center' }}><Icon name="users" size={17} color="var(--sd-blue-600)" /></span>
                  <span style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>Toda la familia</span>
                  {web.person === 'all' && <Icon name="check" size={18} color="var(--sd-blue-600)" style={{ marginLeft: 'auto' }} />}
                </button>
                {DB.family.map(p => (
                  <button key={p.id} className="wrow" style={{ borderRadius: 8, padding: '10px 12px', borderTop: 'none' }} onClick={() => { web.setPerson(p.id); setOpen(false); }}>
                    <Avatar person={p} size={32} />
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{p.short}</div><div className="muted" style={{ fontSize: 11 }}>{p.rel}</div></div>
                    {web.person === p.id && <Icon name="check" size={18} color="var(--sd-blue-600)" style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            </React.Fragment>
          )}
        </div>
        <button className="icon-btn" onClick={() => app.go('notificaciones')} aria-label="Avisos">
          <Icon name="bell" size={20} color="var(--sd-navy-700)" />
          <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 999, background: 'var(--sd-critical-500)', border: '2px solid var(--bg-surface)' }} />
        </button>
      </header>
    );
  }

  function MainRouter({ app }) {
    const base = app.stack[0];
    const map = {
      home: window.WebDashboard,
      citas: window.WebCitas,
      salud: window.WebSalud,
      chat: window.WebMensajes,
      facturas: window.WebFacturas,
      perfil: window.WebPerfil,
    };
    const Screen = map[base.name] || window.WebDashboard;
    return <Screen key={base.name} baseName={base.name} />;
  }

  function OverlayHost({ app }) {
    if (app.stack.length < 2) return null;
    const top = app.stack[app.stack.length - 1];
    const name = top.name === 'chat' ? 'chat' : top.name;

    // video → fullscreen within content
    if (FULL[name]) {
      return <div className="video-full"><window.Video /></div>;
    }
    // booking / preconsulta → phone modal
    if (MODAL[name]) {
      const Cmp = name === 'agendar' ? window.Booking : window.Preconsulta;
      return (
        <div className="web-scrim" onClick={(e) => { if (e.target.classList.contains('web-scrim')) app.back(); }}>
          <div className="modal-phone">
            <button className="modal-close" onClick={app.back} aria-label="Cerrar"><Icon name="x" size={20} color="var(--sd-navy-700)" /></button>
            <div className="app" style={{ position: 'absolute', inset: 0 }}><Cmp /></div>
          </div>
        </div>
      );
    }
    // drawers
    if (DRAWER[name]) {
      return <window.WebDrawer name={name} params={top.params} />;
    }
    return null;
  }

  function WebShell() {
    const app = window.useApp();
    const [person, setPerson] = useState('all');
    const web = { person, setPerson };
    return (
      <WebCtx.Provider value={web}>
        <div className="web-root">
          <Sidebar app={app} />
          <div className="web-main">
            <TopBar app={app} web={web} />
            <MainRouter app={app} />
          </div>
          <OverlayHost app={app} />
        </div>
      </WebCtx.Provider>
    );
  }

  // ---- device-free stage: browser window, scaled to fit ----
  function WebStage() {
    const ref = useRef(null);
    const W = 1320, H = 860;
    useEffect(() => {
      function fit() {
        const pad = 36;
        const s = Math.min((window.innerWidth - pad) / W, (window.innerHeight - pad) / H, 1);
        if (ref.current) ref.current.style.transform = `scale(${s})`;
      }
      fit(); window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }, []);
    return (
      <div className="stage">
        <div className="scaler" ref={ref}>
          <window.ChromeWindow width={W} height={H} url="salud-digital.hn/paciente" tabs={[{ title: 'Salud Digital · Paciente' }]}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <WebShell />
            </div>
          </window.ChromeWindow>
        </div>
      </div>
    );
  }

  function WebRoot() {
    return (
      <window.AppProvider>
        <WebStage />
      </window.AppProvider>
    );
  }

  window.WebRoot = WebRoot;
  window.WebShell = WebShell;
})();
