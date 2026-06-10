// salud.jsx — Mi salud hub: "Compartido por tu médico" vs "Mi espacio"
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, SectionTitle, Btn, TopBar, IconTile, Ring, Sheet } = window;

  function statusPill(status) {
    if (status === 'normal') return <Pill tone="green" dot>Normal</Pill>;
    if (status === 'atencion') return <Pill tone="amber" dot>Atención</Pill>;
    return <Pill tone="gray" dot>Listo</Pill>;
  }

  function SaludScreen() {
    const app = window.useApp();
    const { DB, go } = app;
    const initial = app.cur.params.seg || 'medico';
    const [seg, setSeg] = useState(initial);

    return (
      <div className="scroll">
        <TopBar title="Mi salud" large subtitle="Ana y su familia" />
        <div className="pad" style={{ paddingTop: 4, paddingBottom: 6 }}>
          <div className="seg">
            <button className={seg === 'medico' ? 'on' : ''} onClick={() => setSeg('medico')}>Tu médico comparte</button>
            <button className={seg === 'mio' ? 'on' : ''} onClick={() => setSeg('mio')}>Mi espacio</button>
          </div>
        </div>

        <div className="pad pageIn" key={seg} style={{ paddingTop: 14, paddingBottom: 28 }}>
          {seg === 'medico' ? <MedicoTab app={app} /> : <MioTab app={app} />}
        </div>
      </div>
    );
  }

  function MedicoTab({ app }) {
    const { DB, go } = app;
    return (
      <React.Fragment>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--sd-blue-50)', borderRadius: 'var(--r-md)', marginBottom: 20 }}>
          <Icon name="shield-check" size={18} color="var(--sd-blue-600)" style={{ marginTop: 1 }} />
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>Su expediente clínico es resguardado por la clínica. Aquí ve <strong>lo que su médico decide compartirle</strong>, siempre disponible para usted.</div>
        </div>

        {/* Resultados */}
        <SectionTitle>Resultados de laboratorio</SectionTitle>
        <div className="stack" style={{ marginBottom: 26 }}>
          {DB.results.map(r => {
            const unread = !app.readIds[r.id];
            const person = DB.personById(r.who);
            return (
              <button key={r.id} className="card selectable focusable" onClick={() => go('resultado', { id: r.id })} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <IconTile name="flask" color="#0080B0" bg="var(--sd-blue-100)" size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                      {unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--sd-blue-600)', flexShrink: 0 }} />}
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.short} · {r.date}</div>
                  </div>
                  {statusPill(r.status)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Recetas */}
        <SectionTitle>Recetas</SectionTitle>
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 26 }}>
          {DB.recetas.map(rx => {
            const doc = DB.doctorById(rx.doctor);
            const person = DB.personById(rx.who);
            return (
              <button key={rx.id} className="row focusable" onClick={() => go('receta', { id: rx.id })}>
                <IconTile name="file-text" color="#103A78" bg="var(--sd-blue-100)" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{rx.items.length === 1 ? rx.items[0].name : rx.items.length + ' medicamentos'}</div>
                  <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{person.short} · {doc.name.replace(/Dra?\. /, '')} · {rx.date}</div>
                </div>
                <Icon name="chevron-right" size={20} color="var(--sd-ink-300)" />
              </button>
            );
          })}
        </div>

        {/* Resumenes */}
        <SectionTitle>Resúmenes de visita</SectionTitle>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {DB.resumenes.map(s => {
            const doc = DB.doctorById(s.doctor);
            const person = DB.personById(s.who);
            return (
              <button key={s.id} className="row focusable" onClick={() => go('resumen', { id: s.id })}>
                <IconTile name="clipboard" color="#198754" bg="var(--sd-vital-100)" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{s.specName}</div>
                  <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{person.short} · {s.date}</div>
                </div>
                <Icon name="chevron-right" size={20} color="var(--sd-ink-300)" />
              </button>
            );
          })}
        </div>
      </React.Fragment>
    );
  }

  function MioTab({ app }) {
    const { DB, go } = app;
    const [sheet, setSheet] = useState(false);
    const adherence = app.totalMeds ? app.takenCount / app.totalMeds : 1;

    return (
      <React.Fragment>
        {/* Medicamentos */}
        <SectionTitle action="Detalle" onAction={() => go('medicamento', { id: DB.meds[0].id })}>Mis medicamentos</SectionTitle>
        <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring value={adherence} size={72} stroke={8} color="var(--sd-vital-500)">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-18)', color: 'var(--sd-vital-600)', lineHeight: 1 }}>{app.takenCount}/{app.totalMeds}</div>
          </Ring>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>Tomas de hoy</div>
            <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3, lineHeight: 1.45 }}>Marque cada medicamento al tomarlo. Le avisamos a la hora indicada.</div>
          </div>
        </div>
        <div className="stack" style={{ marginBottom: 26 }}>
          {DB.meds.map(m => <MedRow key={m.id} m={m} app={app} />)}
        </div>

        {/* Diario */}
        <SectionTitle action="Registrar" onAction={() => setSheet(true)}>Mi diario de salud</SectionTitle>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {app.diary.map((d, i) => {
            const person = DB.personById(d.who);
            return (
              <div key={d.id} className="row" style={{ cursor: 'default' }}>
                <IconTile name={d.icon} color={d.color} bg="var(--bg-subtle)" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{d.label}</div>
                  <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{person.short} · {d.date}</div>
                </div>
                <div className="t-mono" style={{ fontWeight: 600, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{d.value}<span className="muted" style={{ fontSize: 'var(--t-12)', marginLeft: 3 }}>{d.u}</span></div>
              </div>
            );
          })}
        </div>
        <button className="focusable" onClick={() => setSheet(true)} style={{ marginTop: 12, width: '100%', height: 52, borderRadius: 'var(--r-md)', border: '1px dashed var(--border-strong)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--sd-navy-700)', fontWeight: 600, fontSize: 'var(--t-14)' }}>
          <Icon name="plus" size={18} color="var(--sd-navy-700)" />Registrar una medición
        </button>

        <DiarioSheet open={sheet} onClose={() => setSheet(false)} app={app} />
      </React.Fragment>
    );
  }

  function MedRow({ m, app }) {
    const { DB } = app;
    const taken = app.taken[m.id];
    const person = DB.personById(m.who);
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: m.color + '1A', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="pill" size={22} color={m.color} />
        </span>
        <button className="focusable" onClick={() => app.go('medicamento', { id: m.id })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none' }}>
          <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-15)' }}>{m.name} <span className="muted" style={{ fontWeight: 500 }}>{m.dose}</span></div>
          <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{person.short} · {m.schedule}</div>
        </button>
        <button className="focusable" onClick={() => app.actions.toggleMed(m.id)} aria-label="Marcar tomado">
          <span className={'check' + (taken ? ' on' : '')}>{taken && <Icon name="check" size={16} color="#fff" strokeWidth={2.6} />}</span>
        </button>
      </div>
    );
  }

  const diarioTypes = [
    { type: 'presion', label: 'Presión arterial', u: 'mmHg', icon: 'heart-pulse', color: '#0080B0', ph: '120/80' },
    { type: 'peso', label: 'Peso', u: 'kg', icon: 'scale', color: '#103A78', ph: '64.0' },
    { type: 'glucosa', label: 'Glucosa', u: 'mg/dL', icon: 'droplet', color: '#C2362C', ph: '95' },
    { type: 'animo', label: 'Ánimo', u: '', icon: 'smile', color: '#2BA86A', ph: '' },
  ];

  function DiarioSheet({ open, onClose, app }) {
    const { DB } = app;
    const [t, setT] = useState(diarioTypes[0]);
    const [who, setWho] = useState('carmen');
    const [val, setVal] = useState('');
    const [animo, setAnimo] = useState('Bien');
    const value = t.type === 'animo' ? animo : val;
    const canSave = t.type === 'animo' ? true : val.trim().length > 0;

    function save() {
      app.actions.addDiary({ who, type: t.type, label: t.label, value, u: t.u, date: 'Ahora', icon: t.icon, color: t.color });
      setVal(''); onClose();
    }

    return (
      <Sheet open={open} onClose={onClose} title="Registrar medición">
        <div className="eyebrow" style={{ marginBottom: 10 }}>¿Para quién?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {DB.family.map(p => (
            <button key={p.id} onClick={() => setWho(p.id)} className="focusable" style={{ flex: 1, padding: '8px 4px', borderRadius: 'var(--r-md)', background: who === p.id ? 'var(--sd-blue-100)' : '#fff', border: '1px solid ' + (who === p.id ? 'var(--sd-blue-300)' : 'var(--border-default)'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Avatar person={p} size={32} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-strong)' }}>{p.short}</span>
            </button>
          ))}
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>¿Qué desea registrar?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {diarioTypes.map(x => (
            <button key={x.type} onClick={() => setT(x)} className="focusable" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 'var(--r-md)', background: t.type === x.type ? '#fff' : '#fff', border: '1px solid ' + (t.type === x.type ? x.color : 'var(--border-default)'), boxShadow: t.type === x.type ? '0 0 0 1px ' + x.color : 'none' }}>
              <Icon name={x.icon} size={20} color={x.color} />
              <span style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)' }}>{x.label}</span>
            </button>
          ))}
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Valor</div>
        {t.type === 'animo' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {[['Mal', 'frown', '#DA453A'], ['Regular', 'meh', '#E0992E'], ['Bien', 'smile', '#2BA86A']].map(([l, ic, col]) => (
              <button key={l} onClick={() => setAnimo(l)} className="focusable" style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--r-md)', background: animo === l ? col + '1A' : '#fff', border: '1px solid ' + (animo === l ? col : 'var(--border-default)'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Icon name={ic} size={26} color={col} />
                <span style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)' }}>{l}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={t.ph} inputMode="decimal" className="focusable t-mono"
              style={{ width: '100%', height: 64, borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)', fontSize: 'var(--t-28)', fontWeight: 700, textAlign: 'center', color: 'var(--fg-strong)', outline: 'none' }} />
            {t.u && <span className="muted" style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--t-15)', fontWeight: 600 }}>{t.u}</span>}
          </div>
        )}
        <Btn variant="primary" size="lg" block disabled={!canSave} onClick={save}>Guardar en mi diario</Btn>
      </Sheet>
    );
  }

  window.SaludScreen = SaludScreen;
})();
