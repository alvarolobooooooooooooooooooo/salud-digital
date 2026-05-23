/* App shell — topbar, sidebar, patient header, tabs */

const TABS = [
  { id: 'resumen',       label: 'Resumen',         icon: 'grid' },
  { id: 'historia',      label: 'Historia clínica', icon: 'clipboard' },
  { id: 'antropometria', label: 'Antropometría',   icon: 'scale' },
  { id: 'estilo',        label: 'Estilo de vida',  icon: 'activity' },
  { id: 'dieta',         label: 'Evaluación dietética', icon: 'list' },
  { id: 'plan',          label: 'Plan nutricional', icon: 'utensils', highlight: true },
  { id: 'seguimiento',   label: 'Seguimiento y receta', icon: 'history' },
];

const SIDEBAR_NAV = [
  { group: null, items: [
    { id: 'dashboard', label: 'Inicio', icon: 'grid' },
    { id: 'pacientes', label: 'Pacientes', icon: 'users', count: '128' },
    { id: 'agenda', label: 'Agenda', icon: 'calendar', count: '6' },
    { id: 'planes', label: 'Plantillas de plan', icon: 'bookmark' },
    { id: 'alimentos', label: 'Biblioteca alimentos', icon: 'apple' },
  ]},
  { group: 'Expediente actual', items: [
    { id: 'expediente', label: 'Ana Lucía Cruz', icon: 'user', active: true },
  ]},
  { group: 'Operación', items: [
    { id: 'facturas', label: 'Cobros e ingresos', icon: 'fileText' },
    { id: 'reportes', label: 'Reportes', icon: 'chart' },
    { id: 'ajustes', label: 'Ajustes', icon: 'settings' },
  ]},
];

const App = () => {
  const [activeTab, setActiveTab] = React.useState('resumen');

  React.useEffect(() => {
    // Scroll tab body to top when tab changes
    const tb = document.querySelector('.tab-body');
    if (tb) tb.scrollTop = 0;
  }, [activeTab]);

  const patient = {
    name: 'Ana Lucía Cruz Mejía',
    age: 34,
    sex: 'F',
    id: '0501-1991-04321',
    expediente: 'EXP-2026-04321',
    initials: 'AC',
    location: 'San Pedro Sula, Cortés',
    plan: 'IHSS',
  };

  const goTo = (tab) => setActiveTab(tab);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Topbar/>
        <Sidebar/>
        <main className="main">
          <PatientHeader patient={patient}/>
          <div className="tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                data-screen-label={`${t.id} · ${t.label}`}
                className={`tab ${activeTab === t.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon name={t.icon} size={15}/>
                <span>{t.label}</span>
                {t.highlight && activeTab !== t.id && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--sd-blue-600)' }}/>}
              </button>
            ))}
          </div>
          <div className="tab-body" data-screen-label={`tab-${activeTab}`}>
            {activeTab === 'resumen'        && <TabResumen patient={patient} goTo={goTo}/>}
            {activeTab === 'historia'       && <TabHistoria/>}
            {activeTab === 'antropometria'  && <TabAntropometria/>}
            {activeTab === 'estilo'         && <TabEstiloVida/>}
            {activeTab === 'dieta'          && <TabDieta/>}
            {activeTab === 'plan'           && <TabPlan/>}
            {activeTab === 'seguimiento'    && <TabSeguimiento/>}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
};

const Topbar = () => (
  <header className="topbar">
    <div className="topbar__brand">
      <img src="assets/logomark.svg" alt="Salud Digital" style={{ height: 28 }}/>
      <div>
        <div className="topbar__brand-name">Salud Digital</div>
        <div className="topbar__brand-sub">Nutrición</div>
      </div>
    </div>
    <div className="topbar__search">
      <Icon name="search" size={16}/>
      <input placeholder="Buscar paciente, expediente, alimento o plan…"/>
    </div>
    <nav className="topbar__nav">
      <button className="topbar__nav-btn" title="Notificaciones"><Icon name="bell" size={18}/><span className="dot"/></button>
      <button className="topbar__nav-btn" title="Ayuda"><Icon name="info" size={18}/></button>
      <button className="topbar__nav-btn" title="Ajustes"><Icon name="settings" size={18}/></button>
    </nav>
    <div className="topbar__user">
      <div className="topbar__user-avatar">MJ</div>
      <div className="topbar__user-meta">
        <div className="topbar__user-name">Lic. María José Andino</div>
        <div className="topbar__user-role">Nutricionista clínica</div>
      </div>
    </div>
  </header>
);

const Sidebar = () => (
  <aside className="sidebar">
    {SIDEBAR_NAV.map((s, gi) => (
      <React.Fragment key={gi}>
        {s.group && <div className="sidebar__group-label">{s.group}</div>}
        {s.items.map(it => (
          <button key={it.id} className={`sidebar__item ${it.active ? 'is-active' : ''}`}>
            <Icon name={it.icon} size={18}/>
            <span>{it.label}</span>
            {it.count && <span className="count">{it.count}</span>}
          </button>
        ))}
      </React.Fragment>
    ))}
    <div style={{ marginTop: 'auto', padding: '14px 12px 4px' }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--sd-navy-700), var(--sd-navy-900))',
        color: '#fff',
        padding: 14,
        borderRadius: 'var(--r-md)',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="sparkles" size={14} style={{ color: 'var(--sd-blue-300)' }}/>
          <span style={{ fontWeight: 700 }}>Plan Profesional</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 10 }}>
          Use IA para sugerir planes a partir del recordatorio 24h.
        </div>
        <button className="btn btn-inverse sm" style={{ height: 28, fontSize: 12, background: '#fff', color: 'var(--sd-navy-800)' }}>Explorar</button>
      </div>
    </div>
  </aside>
);

const PatientHeader = ({ patient }) => (
  <header className="patient-header">
    <div className="patient-photo">{patient.initials}</div>
    <div className="patient-header__info">
      <div className="patient-header__name">
        {patient.name}
        <Chip kind="active">Activa</Chip>
        <Chip kind="alert">Riesgo metabólico</Chip>
      </div>
      <div className="patient-header__meta">
        <span><Icon name="user" size={13}/> {patient.age} años · F</span>
        <span className="sep">·</span>
        <span><Icon name="mapPin" size={13}/> {patient.location}</span>
        <span className="sep">·</span>
        <span><Icon name="shield" size={13}/> Seguro: {patient.plan}</span>
        <span className="sep">·</span>
        <span className="expediente-id">{patient.expediente}</span>
        <span className="sep">·</span>
        <span><Icon name="phone" size={13}/> +504 9876-5432</span>
      </div>
    </div>
    <div className="patient-header__actions">
      <button className="btn btn-secondary"><Icon name="phone" size={14}/></button>
      <button className="btn btn-secondary"><Icon name="mail" size={14}/></button>
      <button className="btn btn-secondary"><Icon name="more" size={14}/></button>
      <button className="btn btn-navy"><Icon name="calendar" size={14}/> Agendar próxima cita</button>
    </div>
  </header>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
