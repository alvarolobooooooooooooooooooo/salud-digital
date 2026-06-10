// preconsulta.jsx — symptom intake before the visit
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { DocAvatar, Btn, TopBar, IconTile } = window;

  function Preconsulta() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const a = app.appts.find(x => x.id === cur.params.apptId);
    const doc = a && DB.doctorById(a.doctor);
    const person = a && DB.personById(a.who);

    const [chips, setChips] = useState([]);
    const [days, setDays] = useState(null);
    const [sev, setSev] = useState(0);
    const [notes, setNotes] = useState('');
    const [done, setDone] = useState(false);

    if (!a) return <div className="scroll"><TopBar title="Pre-consulta" onBack={back} /></div>;

    const toggle = (c) => setChips(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
    const sevLabels = ['Leve', 'Moderado', 'Fuerte', 'Muy fuerte'];
    const canSend = chips.length > 0 && days;

    function send() { app.actions.completePre(a.id); setDone(true); }

    if (done) {
      return (
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 80 }}>
            <div style={{ width: 88, height: 88, borderRadius: 999, background: 'var(--sd-vital-100)', display: 'grid', placeItems: 'center', animation: 'popIn var(--dur-4) var(--ease-out)' }}>
              <Icon name="check-circle" size={56} color="var(--sd-vital-500)" />
            </div>
            <h2 style={{ margin: '20px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--sd-navy-700)' }}>Enviado al médico</h2>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--t-15)', lineHeight: 1.5, maxWidth: 300 }}>
              {doc.name} revisará su información antes de la cita. Así aprovechan mejor el tiempo juntos.
            </p>
          </div>
          <div className="pad" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            <Btn variant="primary" size="lg" block onClick={back}>Listo</Btn>
          </div>
        </div>
      );
    }

    return (
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <TopBar title="Pre-consulta" subtitle={person.short + ' · ' + doc.specName} onBack={back} />
        <div className="pad" style={{ flex: 1, paddingTop: 8, paddingBottom: 120 }}>
          {/* intro */}
          <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--sd-blue-50)', borderColor: 'transparent', marginBottom: 22 }}>
            <DocAvatar doctor={doc} size={48} />
            <div style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>
              Cuénteme qué le pasa. Lo leeré antes de su cita del <strong>{a.day}</strong>.
            </div>
          </div>

          {/* symptoms */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>¿Qué síntomas tiene?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {DB.symptomChips.map(c => {
              const on = chips.includes(c);
              return (
                <button key={c} onClick={() => toggle(c)} className="focusable" style={{
                  padding: '9px 14px', borderRadius: 999, fontSize: 'var(--t-14)', fontWeight: 600,
                  background: on ? 'var(--sd-blue-600)' : '#fff', color: on ? '#fff' : 'var(--fg-default)',
                  border: '1px solid ' + (on ? 'var(--sd-blue-600)' : 'var(--border-default)'),
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>{on && <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />}{c}</button>
              );
            })}
          </div>

          {/* duration */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>¿Desde cuándo?</div>
          <div className="seg" style={{ marginBottom: 24 }}>
            {['Hoy', '2-3 días', 'Una semana', 'Más tiempo'].map(d => (
              <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}</button>
            ))}
          </div>

          {/* severity */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>¿Qué tan intenso es? <span style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>· {sevLabels[sev]}</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {sevLabels.map((l, i) => (
              <button key={l} onClick={() => setSev(i)} className="focusable" style={{
                flex: 1, height: 52, borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 'var(--t-18)',
                background: i <= sev ? sevColor(i) : '#fff', color: i <= sev ? '#fff' : 'var(--fg-subtle)',
                border: '1px solid ' + (i <= sev ? sevColor(i) : 'var(--border-default)'),
                transition: 'all var(--dur-1) var(--ease-out)',
              }}>{i + 1}</button>
            ))}
          </div>

          {/* free notes */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>Algo más que quiera contarle</div>
          <textarea className="focusable" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Opcional. Ej: empeora por las noches, ya tomé un antialérgico…"
            style={{ width: '100%', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', padding: 14, fontSize: 'var(--t-15)', resize: 'none', outline: 'none', color: 'var(--fg-strong)' }} />

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="focusable" style={{ flex: 1, height: 52, borderRadius: 'var(--r-md)', border: '1px dashed var(--border-strong)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--sd-navy-700)', fontWeight: 600, fontSize: 'var(--t-14)' }}>
              <Icon name="camera" size={18} color="var(--sd-navy-700)" />Adjuntar foto
            </button>
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', background: 'linear-gradient(180deg, rgba(255,255,255,0), #fff 28%)', borderTop: '1px solid var(--border-soft)' }}>
          <Btn variant="primary" size="lg" block icon="send" disabled={!canSend} onClick={send}>Enviar al médico</Btn>
        </div>
      </div>
    );
  }

  function sevColor(i) { return ['#2BA86A', '#E0992E', '#E0992E', '#DA453A'][i]; }

  window.Preconsulta = Preconsulta;
})();
