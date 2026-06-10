// perfil.jsx — Perfil, Familia, Facturas
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, SectionTitle, Btn, TopBar, IconTile, Sheet, Toast } = window;

  function PerfilScreen() {
    const app = window.useApp();
    const { DB, go } = app;
    const me = DB.personById('ana');
    const pendientes = app.facturas.filter(f => f.status === 'pendiente');
    const totalPend = pendientes.reduce((s, f) => s + f.amount, 0);

    const SettingRow = ({ icon, label, detail, onClick, danger, last }) => (
      <button className="row focusable" onClick={onClick} style={{ borderBottom: last ? 'none' : undefined }}>
        <IconTile name={icon} color={danger ? '#C2362C' : '#103A78'} bg={danger ? 'var(--sd-critical-100)' : 'var(--bg-subtle)'} size={38} iconSize={19} radius={10} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--t-14)', color: danger ? 'var(--sd-critical-600)' : 'var(--fg-strong)' }}>{label}</span>
        {detail && <span className="muted" style={{ fontSize: 'var(--t-13)' }}>{detail}</span>}
        <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
      </button>
    );

    return (
      <div className="scroll">
        <TopBar title="Perfil" large />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          {/* identity card */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar person={me} size={64} style={{ fontSize: 24 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)' }}>{me.name}</div>
              <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{me.age} años · Tipo de sangre {me.blood}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Pill tone="blue"><Icon name="shield-check" size={12} color="currentColor" />Identidad verificada</Pill>
              </div>
            </div>
          </div>

          {/* facturas summary */}
          <div style={{ marginTop: 22 }}>
            <SectionTitle action="Ver todas" onAction={() => go('facturas')}>Facturas</SectionTitle>
            <button className="card selectable focusable" onClick={() => go('facturas')} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 16, textAlign: 'left' }}>
              <IconTile name="receipt" color={totalPend ? '#C7811C' : '#198754'} bg={totalPend ? 'var(--sd-alert-100)' : 'var(--sd-vital-100)'} size={48} iconSize={24} />
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 'var(--t-13)' }}>{totalPend ? `${pendientes.length} factura${pendientes.length > 1 ? 's' : ''} pendiente${pendientes.length > 1 ? 's' : ''}` : 'Sin pagos pendientes'}</div>
                <div className="t-mono" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: totalPend ? 'var(--sd-alert-600)' : 'var(--sd-vital-600)', marginTop: 2 }}>{DB.L(totalPend)}</div>
              </div>
              <Icon name="chevron-right" size={20} color="var(--sd-ink-300)" />
            </button>
          </div>

          {/* family */}
          <div style={{ marginTop: 22 }}>
            <SectionTitle>Mi familia</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {DB.family.map((p, i) => (
                <button key={p.id} className="row focusable" onClick={() => go('familiar', { id: p.id })} style={{ borderBottom: i < DB.family.length ? undefined : 'none' }}>
                  <Avatar person={p} size={42} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{p.rel} · {p.age} años{p.note ? ' · ' + p.note : ''}</div>
                  </div>
                  <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                </button>
              ))}
              <button className="row focusable" onClick={() => go('familiar', { id: 'ana' })}>
                <span style={{ width: 42, height: 42, borderRadius: 999, border: '1.5px dashed var(--border-strong)', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={20} color="var(--sd-blue-600)" /></span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--sd-blue-600)' }}>Agregar familiar</span>
              </button>
            </div>
          </div>

          {/* settings */}
          <div style={{ marginTop: 22 }}>
            <SectionTitle>Cuenta</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <SettingRow icon="user" label="Mis datos" />
              <SettingRow icon="shield" label="Privacidad y permisos" />
              <SettingRow icon="bell" label="Notificaciones y recordatorios" detail="Activos" />
              <SettingRow icon="map" label="Clínicas vinculadas" detail="2" />
              <SettingRow icon="headphones" label="Ayuda y soporte" last />
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <SettingRow icon="refresh" label="Ver introducción de nuevo" onClick={app.restartOnboarding} last />
          </div>
          <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <SettingRow icon="log-out" label="Cerrar sesión" danger last onClick={() => window.sdLogout && window.sdLogout()} />
          </div>

          <p className="muted" style={{ textAlign: 'center', fontSize: 'var(--t-12)', marginTop: 20 }}>Salud Digital · Paciente · v1.0</p>
        </div>
      </div>
    );
  }

  function FamiliarDetail() {
    const app = window.useApp();
    const { DB, cur, back, go } = app;
    const p = DB.personById(cur.params.id);
    if (!p) return <div className="scroll"><TopBar title="Familiar" onBack={back} /></div>;
    const meds = DB.meds.filter(m => m.who === p.id);
    const results = DB.results.filter(r => r.who === p.id);
    const appts = app.appts.filter(a => a.who === p.id);

    return (
      <div className="scroll">
        <TopBar title={p.short} onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <Avatar person={p} size={72} style={{ fontSize: 26, margin: '0 auto' }} />
            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', color: 'var(--fg-strong)' }}>{p.name}</h2>
            <div className="muted" style={{ fontSize: 'var(--t-14)' }}>{p.rel} · {p.age} años · {p.sex === 'F' ? 'Femenino' : 'Masculino'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
              <Stat k="Sangre" v={p.blood} />
              <div style={{ width: 1, background: 'var(--border-soft)' }} />
              <Stat k="Nacimiento" v={p.dob} />
              {p.note && <React.Fragment><div style={{ width: 1, background: 'var(--border-soft)' }} /><Stat k="Condición" v={p.note} /></React.Fragment>}
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <Btn variant="primary" block icon="calendar-plus" onClick={() => go('agendar')}>Agendar cita</Btn>
          </div>

          {appts.length > 0 && <React.Fragment>
            <SectionTitle action="Ver" onAction={() => app.setTab('citas')} >Próximas citas</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
              {appts.map(a => { const d = DB.doctorById(a.doctor); return (
                <button key={a.id} className="row focusable" onClick={() => go('cita', { apptId: a.id })}>
                  <IconTile name="calendar" color="#0080B0" bg="var(--sd-blue-100)" size={38} iconSize={19} radius={10} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{d.specName}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{a.day} · {a.time}</div></div>
                  <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                </button>); })}
            </div>
          </React.Fragment>}

          {meds.length > 0 && <React.Fragment>
            <SectionTitle>Medicamentos</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
              {meds.map(m => (
                <button key={m.id} className="row focusable" onClick={() => go('medicamento', { id: m.id })}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: m.color + '1A', display: 'grid', placeItems: 'center' }}><Icon name="pill" size={19} color={m.color} /></span>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{m.name} {m.dose}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{m.schedule}</div></div>
                  <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                </button>
              ))}
            </div>
          </React.Fragment>}

          {results.length > 0 && <React.Fragment>
            <SectionTitle>Resultados compartidos</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {results.map(r => (
                <button key={r.id} className="row focusable" onClick={() => go('resultado', { id: r.id })}>
                  <IconTile name="flask" color="#0080B0" bg="var(--sd-blue-100)" size={38} iconSize={19} radius={10} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{r.title}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{r.date}</div></div>
                  <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                </button>
              ))}
            </div>
          </React.Fragment>}
        </div>
      </div>
    );
  }

  function Stat({ k, v }) {
    return <div style={{ textAlign: 'center' }}><div className="t-mono strong" style={{ fontWeight: 700, fontSize: 'var(--t-14)' }}>{v}</div><div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{k}</div></div>;
  }

  function FacturasScreen() {
    const app = window.useApp();
    const { DB, go, back } = app;
    const pend = app.facturas.filter(f => f.status === 'pendiente');
    const paid = app.facturas.filter(f => f.status === 'pagada');
    const FacRow = (f) => {
      const person = DB.personById(f.who);
      return (
        <button key={f.id} className="row focusable" onClick={() => go('factura', { id: f.id })}>
          <IconTile name="receipt" color={f.status === 'pendiente' ? '#C7811C' : '#8A93A4'} bg="var(--bg-subtle)" size={40} iconSize={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.concept}</div>
            <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{person.short} · {f.date}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="t-mono" style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', whiteSpace: 'nowrap' }}>{DB.L(f.amount)}</div>
            {f.status === 'pagada' && <span style={{ fontSize: 11, color: 'var(--sd-vital-600)', fontWeight: 600 }}>Pagada</span>}
          </div>
        </button>
      );
    };
    return (
      <div className="scroll">
        <TopBar title="Facturas" onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          {pend.length > 0 && <React.Fragment>
            <SectionTitle>Pendientes</SectionTitle>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>{pend.map(FacRow)}</div>
          </React.Fragment>}
          <SectionTitle>Historial</SectionTitle>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{paid.map(FacRow)}</div>
        </div>
      </div>
    );
  }

  function FacturaDetail() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const f = app.facturas.find(x => x.id === cur.params.id);
    const [sheet, setSheet] = useState(false);
    const [toast, setToast] = useState(false);
    if (!f) return <div className="scroll"><TopBar title="Factura" onBack={back} /></div>;
    const person = DB.personById(f.who);
    const clinic = DB.clinicById(f.clinic);
    const doc = f.doctor && DB.doctorById(f.doctor);
    const isr = 0.16; // ISV Honduras 15%? use 15
    const sub = f.amount / 1.15;
    const isv = f.amount - sub;

    return (
      <div className="scroll">
        <TopBar title="Factura" onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 20, textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{f.status === 'pendiente' ? 'Por pagar' : 'Pagada'}</div>
              <div className="t-mono" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-40)', color: 'var(--fg-strong)', letterSpacing: '-0.02em' }}>{DB.L(f.amount)}</div>
              <div style={{ marginTop: 10 }}>{f.status === 'pendiente' ? <Pill tone="amber" dot>Pendiente</Pill> : <Pill tone="green" dot>Pagada</Pill>}</div>
            </div>
            <Line k="Concepto" v={f.concept} />
            {doc && <Line k="Médico" v={doc.name} />}
            <Line k="Paciente" v={person.name} />
            <Line k="Clínica" v={clinic.name} />
            <Line k="Fecha" v={f.date} />
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
              <div className="kv" style={{ marginBottom: 6 }}><span className="k">Subtotal</span><span className="v t-mono">{DB.L(sub)}</span></div>
              <div className="kv"><span className="k">ISV (15%)</span><span className="v t-mono">{DB.L(isv)}</span></div>
            </div>
          </div>

          {f.status === 'pendiente' ? (
            <div style={{ marginTop: 18 }}>
              <Btn variant="primary" size="lg" block icon="credit-card" onClick={() => setSheet(true)}>Pagar factura</Btn>
              <p className="muted" style={{ fontSize: 'var(--t-12)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>También puede pagar en la recepción de {clinic.name}.</p>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <Btn variant="ghost" block icon="download">Descargar comprobante</Btn>
            </div>
          )}
        </div>

        <PaySheet open={sheet} onClose={() => setSheet(false)} f={f} app={app} onPaid={() => { setSheet(false); app.actions.payFactura(f.id); setToast(true); }} />
        {toast && <Toast msg="Pago registrado. Gracias." onDone={() => setToast(false)} />}
      </div>
    );
  }

  function Line({ k, v }) {
    return <div className="kv" style={{ padding: '13px 18px', borderTop: '1px solid var(--border-soft)' }}><span className="k">{k}</span><span className="v" style={{ textAlign: 'right' }}>{v}</span></div>;
  }

  function PaySheet({ open, onClose, f, app, onPaid }) {
    const { DB } = app;
    const [method, setMethod] = useState('card');
    const [paying, setPaying] = useState(false);
    const methods = [
      { id: 'card', icon: 'credit-card', label: 'Tarjeta', detail: 'Visa •••• 4421' },
      { id: 'transfer', icon: 'refresh', label: 'Transferencia', detail: 'Banco Atlántida' },
    ];
    function pay() { setPaying(true); setTimeout(onPaid, 1400); }
    return (
      <Sheet open={open} onClose={onClose} title="Pagar factura">
        <div className="kv" style={{ marginBottom: 16 }}><span className="muted">Total a pagar</span><span className="t-mono" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--fg-strong)' }}>{DB.L(f.amount)}</span></div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Método de pago</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {methods.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)} className="focusable" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 'var(--r-md)', background: '#fff', border: '1px solid ' + (method === m.id ? 'var(--sd-blue-600)' : 'var(--border-default)'), boxShadow: method === m.id ? '0 0 0 1px var(--sd-blue-600)' : 'none', textAlign: 'left' }}>
              <IconTile name={m.icon} color="#103A78" bg="var(--bg-subtle)" size={42} iconSize={20} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{m.label}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{m.detail}</div></div>
              <span className={'check' + (method === m.id ? ' on' : '')} style={{ width: 24, height: 24 }}>{method === m.id && <Icon name="check" size={15} color="#fff" strokeWidth={2.6} />}</span>
            </button>
          ))}
        </div>
        <Btn variant="primary" size="lg" block disabled={paying} icon={paying ? null : 'lock'} onClick={pay}>{paying ? 'Procesando…' : 'Pagar ' + DB.L(f.amount)}</Btn>
        <p className="muted" style={{ fontSize: 'var(--t-12)', textAlign: 'center', marginTop: 12 }}>Pago protegido y cifrado.</p>
      </Sheet>
    );
  }

  Object.assign(window, { PerfilScreen, FamiliarDetail, FacturasScreen, FacturaDetail });
})();
