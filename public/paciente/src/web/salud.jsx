// web/salud.jsx — Mi salud (desktop): shared-by-doctor vs my space
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, Btn, IconTile, Ring, Sheet } = window;

  function statusPill(s) {
    if (s === 'normal') return <Pill tone="green" dot>Normal</Pill>;
    if (s === 'atencion') return <Pill tone="amber" dot>Atención</Pill>;
    return <Pill tone="gray" dot>Listo</Pill>;
  }

  function WebSalud() {
    const app = window.useApp();
    const web = window.useWeb();
    const { DB, go } = app;
    const [seg, setSeg] = useState('medico');
    const filter = (who) => web.person === 'all' || web.person === who;

    return (
      <div className="web-scroll">
        <div className="web-page">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div className="seg" style={{ width: 420 }}>
              <button className={seg === 'medico' ? 'on' : ''} onClick={() => setSeg('medico')}>Tu médico comparte</button>
              <button className={seg === 'mio' ? 'on' : ''} onClick={() => setSeg('mio')}>Mi espacio</button>
            </div>
          </div>
          <div className="pageIn" key={seg}>
            {seg === 'medico' ? <Medico app={app} filter={filter} /> : <Mio app={app} filter={filter} />}
          </div>
        </div>
      </div>
    );
  }

  function Medico({ app, filter }) {
    const { DB, go } = app;
    const results = DB.results.filter(r => filter(r.who));
    const recetas = DB.recetas.filter(r => filter(r.who));
    const resumenes = DB.resumenes.filter(r => filter(r.who));
    return (
      <React.Fragment>
        <div className="wcard" style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--sd-blue-50)', borderColor: 'transparent', marginBottom: 24, padding: '16px 20px' }}>
          <Icon name="shield-check" size={22} color="var(--sd-blue-600)" />
          <div style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>Su expediente clínico es resguardado por la clínica conforme a la ley. Aquí encuentra <strong>lo que su médico decide compartirle</strong> — siempre disponible, explicado de forma clara.</div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
          <div>
            <h3 className="web-h" style={{ marginBottom: 14 }}>Resultados de laboratorio</h3>
            <div className="grid" style={{ marginBottom: 28 }}>
              {results.map(r => {
                const unread = !app.readIds[r.id]; const person = DB.personById(r.who);
                return (
                  <button key={r.id} className="wcard lift" style={{ display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }} onClick={() => go('resultado', { id: r.id })}>
                    <IconTile name="flask" color="#0080B0" bg="var(--sd-blue-100)" size={50} iconSize={25} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{r.title}</span>{unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--sd-blue-600)' }} />}</div>
                      <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{person.short} · {r.lab} · {r.date}</div>
                    </div>
                    {statusPill(r.status)}
                  </button>
                );
              })}
              {results.length === 0 && <div className="wcard muted" style={{ textAlign: 'center', padding: 24 }}>Sin resultados para esta vista.</div>}
            </div>

            <h3 className="web-h" style={{ marginBottom: 14 }}>Resúmenes de visita</h3>
            <div className="wcard wcard-flush">
              {resumenes.map(s => {
                const doc = DB.doctorById(s.doctor); const person = DB.personById(s.who);
                return (
                  <button key={s.id} className="wrow" onClick={() => go('resumen', { id: s.id })}>
                    <IconTile name="clipboard" color="#198754" bg="var(--sd-vital-100)" size={42} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{s.specName}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{doc.name} · {person.short} · {s.date}</div></div>
                    <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                  </button>
                );
              })}
              {resumenes.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin resúmenes para esta vista.</div>}
            </div>
          </div>

          <div>
            <h3 className="web-h" style={{ marginBottom: 14 }}>Recetas</h3>
            <div className="wcard wcard-flush">
              {recetas.map(rx => {
                const doc = DB.doctorById(rx.doctor); const person = DB.personById(rx.who);
                return (
                  <button key={rx.id} className="wrow" onClick={() => go('receta', { id: rx.id })}>
                    <IconTile name="file-text" color="#103A78" bg="var(--sd-blue-100)" size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{rx.items.length === 1 ? rx.items[0].name : rx.items.length + ' medicamentos'}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{person.short} · {rx.date}</div></div>
                    <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                  </button>
                );
              })}
              {recetas.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin recetas para esta vista.</div>}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  function Mio({ app, filter }) {
    const { DB, go } = app;
    const [sheet, setSheet] = useState(false);
    const meds = DB.meds.filter(m => filter(m.who));
    const diary = app.diary.filter(d => filter(d.who));
    const takenCount = meds.filter(m => app.taken[m.id]).length;
    const adherence = meds.length ? takenCount / meds.length : 1;

    return (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div>
          <h3 className="web-h" style={{ marginBottom: 14 }}>Mis medicamentos</h3>
          <div className="wcard" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring value={adherence} size={76} stroke={8} color="var(--sd-vital-500)"><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-18)', color: 'var(--sd-vital-600)', lineHeight: 1 }}>{takenCount}/{meds.length}</div></Ring>
            <div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>Tomas de hoy</div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3, lineHeight: 1.45 }}>Marque cada medicamento al tomarlo. Le avisamos a la hora indicada.</div></div>
          </div>
          <div className="wcard wcard-flush">
            {meds.map(m => {
              const taken = app.taken[m.id]; const person = DB.personById(m.who);
              return (
                <div key={m.id} className="wrow" style={{ cursor: 'default' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: m.color + '1A', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={22} color={m.color} /></span>
                  <button onClick={() => go('medicamento', { id: m.id })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none' }}><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-15)' }}>{m.name} <span className="muted" style={{ fontWeight: 500 }}>{m.dose}</span></div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{person.short} · {m.schedule}</div></button>
                  <button onClick={() => app.actions.toggleMed(m.id)} aria-label="Marcar"><span className={'check' + (taken ? ' on' : '')}>{taken && <Icon name="check" size={16} color="#fff" strokeWidth={2.6} />}</span></button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 className="web-h">Mi diario de salud</h3>
            <Btn variant="ghost" icon="plus" onClick={() => setSheet(true)} style={{ height: 40 }}>Registrar</Btn>
          </div>
          <div className="wcard wcard-flush">
            {diary.map(d => {
              const person = DB.personById(d.who);
              return (
                <div key={d.id} className="wrow" style={{ cursor: 'default' }}>
                  <IconTile name={d.icon} color={d.color} bg="var(--bg-subtle)" size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{d.label}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{person.short} · {d.date}</div></div>
                  <div className="t-mono" style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{d.value}<span className="muted" style={{ fontSize: 'var(--t-12)', marginLeft: 3 }}>{d.u}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        {window.DiarioSheetWeb && <window.DiarioSheetWeb open={sheet} onClose={() => setSheet(false)} app={app} />}
      </div>
    );
  }

  // reuse mobile diario sheet logic via a small web wrapper
  function DiarioSheetWeb({ open, onClose, app }) {
    const { DB } = app;
    const types = [
      { type: 'presion', label: 'Presión arterial', u: 'mmHg', icon: 'heart-pulse', color: '#0080B0', ph: '120/80' },
      { type: 'peso', label: 'Peso', u: 'kg', icon: 'scale', color: '#103A78', ph: '64.0' },
      { type: 'glucosa', label: 'Glucosa', u: 'mg/dL', icon: 'droplet', color: '#C2362C', ph: '95' },
      { type: 'animo', label: 'Ánimo', u: '', icon: 'smile', color: '#2BA86A', ph: '' },
    ];
    const [t, setT] = useState(types[0]);
    const [who, setWho] = useState('carmen');
    const [val, setVal] = useState('');
    const [animo, setAnimo] = useState('Bien');
    if (!open) return null;
    const value = t.type === 'animo' ? animo : val;
    const canSave = t.type === 'animo' ? true : val.trim().length > 0;
    function save() { app.actions.addDiary({ who, type: t.type, label: t.label, value, u: t.u, date: 'Ahora', icon: t.icon, color: t.color }); setVal(''); onClose(); }
    return (
      <div className="web-scrim" onClick={(e) => { if (e.target.classList.contains('web-scrim')) onClose(); }}>
        <div style={{ width: 460, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', padding: 24, boxShadow: 'var(--shadow-xl)', animation: 'popIn var(--dur-3) var(--ease-out)' }}>
          <h3 style={{ margin: '0 0 18px', fontFamily: 'var(--font-display)', fontSize: 'var(--t-20)', fontWeight: 700, color: 'var(--fg-strong)' }}>Registrar medición</h3>
          <div className="eyebrow" style={{ marginBottom: 10 }}>¿Para quién?</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {DB.family.map(p => (
              <button key={p.id} onClick={() => setWho(p.id)} style={{ flex: 1, padding: '8px 4px', borderRadius: 'var(--r-md)', background: who === p.id ? 'var(--sd-blue-100)' : '#fff', border: '1px solid ' + (who === p.id ? 'var(--sd-blue-300)' : 'var(--border-default)'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Avatar person={p} size={32} /><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-strong)' }}>{p.short}</span>
              </button>
            ))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>¿Qué desea registrar?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {types.map(x => (
              <button key={x.type} onClick={() => setT(x)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 'var(--r-md)', background: '#fff', border: '1px solid ' + (t.type === x.type ? x.color : 'var(--border-default)'), boxShadow: t.type === x.type ? '0 0 0 1px ' + x.color : 'none' }}>
                <Icon name={x.icon} size={20} color={x.color} /><span style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)' }}>{x.label}</span>
              </button>
            ))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Valor</div>
          {t.type === 'animo' ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              {[['Mal', 'frown', '#DA453A'], ['Regular', 'meh', '#E0992E'], ['Bien', 'smile', '#2BA86A']].map(([l, ic, col]) => (
                <button key={l} onClick={() => setAnimo(l)} style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--r-md)', background: animo === l ? col + '1A' : '#fff', border: '1px solid ' + (animo === l ? col : 'var(--border-default)'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Icon name={ic} size={26} color={col} /><span style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)' }}>{l}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 22 }}>
              <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={t.ph} className="t-mono" style={{ width: '100%', height: 60, borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)', fontSize: 'var(--t-24)', fontWeight: 700, textAlign: 'center', color: 'var(--fg-strong)', outline: 'none' }} />
              {t.u && <span className="muted" style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--t-14)', fontWeight: 600 }}>{t.u}</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" block onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" block disabled={!canSave} onClick={save}>Guardar</Btn>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { WebSalud, DiarioSheetWeb });
})();
