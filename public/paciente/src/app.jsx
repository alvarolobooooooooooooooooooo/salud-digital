// app.jsx — mobile shell: router + bottom nav. Exports window.MobileShell.
// Adaptado del prototipo: se quitó el marco de dispositivo (IOSDevice) y el
// auto-mount; ahora paciente-root.jsx monta MobileShell o WebShell según el ancho.
(function () {
  const Icon = window.Icon;
  const { TopBar, IconTile, DocAvatar, Btn, Pill, Empty } = window;

  // ---- extra small screens ----
  function Notificaciones() {
    const app = window.useApp();
    const { DB, back, go } = app;
    const items = [
      { icon: 'flask', color: '#0080B0', bg: 'var(--sd-blue-100)', title: 'Resultado disponible', body: 'Su hemograma completo ya fue compartido por la Dra. López.', time: 'Hace 1 h', onClick: () => go('resultado', { id: 'r1' }) },
      { icon: 'message', color: '#198754', bg: 'var(--sd-vital-100)', title: 'Dra. Sofía Mendoza', body: 'Perfecto, la espero mañana entonces.', time: '8:32', onClick: () => go('chat', { id: 'c-sofia' }) },
      { icon: 'pill', color: '#C7811C', bg: 'var(--sd-alert-100)', title: 'Hora de su medicamento', body: 'Doña Carmen: Losartán 50 mg · 8:00', time: '8:00', onClick: () => go('medicamento', { id: 'm1' }) },
      { icon: 'calendar-check', color: '#103A78', bg: 'var(--sd-blue-100)', title: 'Recordatorio de cita', body: 'Dermatología mañana a las 14:30 con la Dra. Mendoza.', time: 'Ayer', onClick: () => go('cita', { apptId: 'a1' }) },
    ];
    return (
      <div className="scroll">
        <TopBar title="Avisos" onBack={back} />
        <div style={{ paddingBottom: 28 }}>
          {items.map((it, i) => (
            <button key={i} className="row focusable" onClick={it.onClick} style={{ alignItems: 'flex-start', padding: '16px 20px' }}>
              <IconTile name={it.icon} color={it.color} bg={it.bg} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{it.title}</span>
                  <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{it.time}</span>
                </div>
                <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3, lineHeight: 1.45 }}>{it.body}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function Ruta() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const a = app.appts.find(x => x.id === cur.params.apptId);
    const clinic = a && DB.clinicById(a.clinic);
    if (!clinic) return <div className="scroll"><TopBar title="Cómo llegar" onBack={back} /></div>;
    return (
      <div className="scroll">
        <TopBar title="Cómo llegar" onBack={back} />
        {/* map placeholder */}
        <div style={{ height: 240, margin: '8px 20px 0', borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #E8ECF2, #D2E9F5)', border: '1px solid var(--border-default)' }}>
          <svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
            <g stroke="#BDC4D0" strokeWidth="2" fill="none" opacity="0.7">
              <path d="M-10 60 H370 M-10 140 H370 M-10 200 H370 M60 -10 V250 M180 -10 V250 M280 -10 V250" />
            </g>
            <path d="M60 240 L60 140 L180 140 L180 60" stroke="#0080B0" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="2 10" />
            <circle cx="60" cy="232" r="7" fill="#103A78" />
            <g transform="translate(180,60)"><circle r="13" fill="#0080B0" /><circle r="5" fill="#fff" /></g>
          </svg>
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: '#fff', borderRadius: 999, padding: '7px 13px', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--sd-navy-700)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="map-pin" size={14} color="var(--sd-blue-600)" />{clinic.km} km · 9 min
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 18, paddingBottom: 28 }}>
          <div className="card">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)' }}>{clinic.name}</div>
            <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="map-pin" size={15} color="var(--fg-muted)" />{clinic.zone}</div>
            <div className="hr" style={{ margin: '16px 0' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="primary" block icon="map">Abrir en mapas</Btn>
              <Btn variant="ghost" block icon="phone">Llamar</Btn>
            </div>
          </div>
          <div className="card" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', background: 'var(--sd-blue-50)', borderColor: 'transparent' }}>
            <Icon name="clock" size={20} color="var(--sd-blue-600)" />
            <span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.45 }}>Su cita es a las <strong>{a.time}</strong>. Le sugerimos salir <strong>20 minutos antes</strong>.</span>
          </div>
        </div>
      </div>
    );
  }

  // ---- router map ----
  const ROUTES = {
    home: () => window.HomeScreen,
    citas: () => window.CitasScreen,
    salud: () => window.SaludScreen,
    chat: () => window.ChatScreen,
    perfil: () => window.PerfilScreen,
    agendar: () => window.Booking,
    preconsulta: () => window.Preconsulta,
    cita: () => window.CitaDetail,
    resultado: () => window.ResultadoDetail,
    receta: () => window.RecetaDetail,
    resumen: () => window.ResumenDetail,
    medicamento: () => window.MedicamentoDetail,
    'chat-thread': () => window.ChatThread,
    video: () => window.Video,
    facturas: () => window.FacturasScreen,
    factura: () => window.FacturaDetail,
    familiar: () => window.FamiliarDetail,
    notificaciones: () => Notificaciones,
    ruta: () => Ruta,
  };
  // chat detail uses name 'chat' with params.id; distinguish
  function resolve(cur) {
    if (cur.name === 'chat' && cur.params && cur.params.id) return window.ChatThread;
    const f = ROUTES[cur.name];
    return f ? f() : window.HomeScreen;
  }

  const TABS = [
    { id: 'home', icon: 'home', label: 'Inicio' },
    { id: 'citas', icon: 'calendar', label: 'Citas' },
    { id: 'salud', icon: 'heart-pulse', label: 'Mi salud' },
    { id: 'chat', icon: 'message', label: 'Chat' },
    { id: 'perfil', icon: 'user', label: 'Perfil' },
  ];

  function TabBar() {
    const app = window.useApp();
    const cur = app.cur;
    const unread = app.chats.reduce((s, c) => s + (c.unread || 0), 0);
    return (
      <div className="tabbar">
        {TABS.map(t => {
          const on = cur.name === t.id;
          return (
            <button key={t.id} className={on ? 'on' : ''} onClick={() => app.setTab(t.id)} style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Icon name={t.icon} size={24} color={on ? 'var(--sd-blue-600)' : 'var(--sd-ink-400)'} strokeWidth={on ? 2.1 : 1.75} />
                {t.id === 'chat' && unread > 0 && <span className="tab-badge">{unread}</span>}
              </div>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function Shell() {
    const app = window.useApp();
    if (!app.onboarded) return <window.Onboarding />;
    const cur = app.cur;
    const Screen = resolve(cur);
    const isTab = TABS.some(t => t.id === cur.name) && !(cur.name === 'chat' && cur.params && cur.params.id);
    return (
      <div className="app">
        <div key={cur.name + JSON.stringify(cur.params)} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Screen />
        </div>
        {isTab && <TabBar />}
      </div>
    );
  }

  window.MobileShell = Shell;
})();
