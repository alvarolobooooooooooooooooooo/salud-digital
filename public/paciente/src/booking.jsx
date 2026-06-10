// booking.jsx — Agendar cita (multi-step)
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, Btn, TopBar, IconTile } = window;

  function Booking() {
    const app = window.useApp();
    const { DB, back, resetTo } = app;
    const [step, setStep] = useState(0);
    const [who, setWho] = useState('ana');
    const [spec, setSpec] = useState(null);
    const [doc, setDoc] = useState(null);
    const [mode, setMode] = useState('presencial');
    const [day, setDay] = useState(null);
    const [slot, setSlot] = useState(null);

    const steps = ['Paciente y especialidad', 'Elegir médico', 'Día y hora', 'Confirmar'];
    const docs = DB.doctors.filter(d => d.spec === spec);

    const next = () => setStep(s => s + 1);
    const prev = () => (step === 0 ? back() : setStep(s => s - 1));

    const canNext =
      step === 0 ? (who && spec) :
      step === 1 ? !!doc :
      step === 2 ? (day && slot) : true;

    function confirm() {
      const d = DB.bookDays.find(x => x.id === day);
      app.actions.addAppt({
        who, doctor: doc.id, date: '2026-05-' + d.dom.padStart(2, '0'),
        day: d.dow + ' ' + d.dom + ' ' + d.mon, time: slot,
        mode, clinic: doc.clinic, status: 'confirmada',
        preconsulta: true,
      });
      setStep(4);
    }

    if (step === 4) return <Done app={app} doc={doc} day={DB.bookDays.find(x => x.id === day)} slot={slot} who={who} mode={mode} />;

    return (
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <TopBar title="Agendar cita" subtitle={steps[step]} onBack={prev} />
        {/* progress */}
        <div className="pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} className="track" style={{ flex: 1 }}><i style={{ width: i <= step ? '100%' : '0%' }} /></div>
            ))}
          </div>
        </div>

        <div className="pad pageIn" key={step} style={{ flex: 1, paddingTop: 12, paddingBottom: 120 }}>
          {step === 0 && (
            <React.Fragment>
              <div className="eyebrow" style={{ marginBottom: 10 }}>¿Para quién es la cita?</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 22 }}>
                {DB.family.map(p => (
                  <button key={p.id} onClick={() => setWho(p.id)} className="focusable" style={{
                    flex: '0 0 auto', padding: '12px 14px 12px 12px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10,
                    background: who === p.id ? 'var(--sd-blue-600)' : '#fff', border: '1px solid ' + (who === p.id ? 'var(--sd-blue-600)' : 'var(--border-default)'),
                  }}>
                    <Avatar person={p} size={34} style={who === p.id ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: who === p.id ? '#fff' : 'var(--fg-strong)' }}>{p.short}</div>
                      <div style={{ fontSize: 11, color: who === p.id ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}>{p.rel}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>¿Qué especialidad necesita?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {DB.specialties.map(s => (
                  <button key={s.id} onClick={() => setSpec(s.id)} className={'card selectable focusable' + (spec === s.id ? ' sel' : '')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left' }}>
                    <IconTile name={s.icon} color="#0080B0" bg="var(--sd-blue-100)" size={40} iconSize={20} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--t-13)', color: 'var(--fg-strong)', lineHeight: 1.2 }}>{s.name}</div>
                      <div className="muted t-mono" style={{ fontSize: 11, marginTop: 3 }}>{DB.L(s.from)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </React.Fragment>
          )}

          {step === 1 && (
            <React.Fragment>
              <div className="muted" style={{ fontSize: 'var(--t-14)', marginBottom: 14 }}>{docs.length} médicos en {DB.specialties.find(s => s.id === spec).name}</div>
              <div className="stack">
                {docs.map(d => (
                  <button key={d.id} onClick={() => setDoc(d)} className={'card selectable focusable' + (doc && doc.id === d.id ? ' sel' : '')} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <DocAvatar doctor={d} size={56} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{d.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--sd-alert-600)' }}>
                            <Icon name="star" size={13} color="var(--sd-alert-500)" fill="var(--sd-alert-500)" />{d.rating}
                          </span>
                          <span className="muted" style={{ fontSize: 'var(--t-12)' }}>· {d.reviews} opiniones · {d.years} años</span>
                        </div>
                        <div className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Icon name="map-pin" size={12} color="var(--fg-muted)" />{DB.clinicById(d.clinic).name}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {d.tags.map(t => <span key={t} className="pill" style={{ fontSize: 11, padding: '4px 9px' }}>{t}</span>)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
                      <span className="muted" style={{ fontSize: 'var(--t-13)' }}>Próximo: <strong style={{ color: 'var(--sd-vital-600)' }}>{d.next}</strong></span>
                      <span className="t-mono strong" style={{ fontWeight: 600, fontSize: 'var(--t-14)', whiteSpace: 'nowrap' }}>{DB.L(d.fee)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </React.Fragment>
          )}

          {step === 2 && (
            <React.Fragment>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Modalidad</div>
              <div className="seg" style={{ marginBottom: 22 }}>
                <button className={mode === 'presencial' ? 'on' : ''} onClick={() => setMode('presencial')}>Presencial</button>
                <button className={mode === 'video' ? 'on' : ''} onClick={() => setMode('video')}>Videoconsulta</button>
              </div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Elija el día</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 22 }}>
                {DB.bookDays.map(d => (
                  <button key={d.id} onClick={() => { setDay(d.id); setSlot(null); }} className="focusable" style={{
                    flex: '0 0 auto', width: 60, padding: '12px 0', borderRadius: 'var(--r-md)', textAlign: 'center',
                    background: day === d.id ? 'var(--sd-blue-600)' : '#fff', border: '1px solid ' + (day === d.id ? 'var(--sd-blue-600)' : 'var(--border-default)'),
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: day === d.id ? 'rgba(255,255,255,0.85)' : 'var(--fg-muted)' }}>{d.dow}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-20)', color: day === d.id ? '#fff' : 'var(--fg-strong)', margin: '2px 0' }}>{d.dom}</div>
                    <div style={{ fontSize: 10, color: day === d.id ? 'rgba(255,255,255,0.85)' : 'var(--sd-vital-600)' }}>{d.open} libres</div>
                  </button>
                ))}
              </div>
              {day && (
                <React.Fragment>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Horarios disponibles</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {DB.slots.map(s => (
                      <button key={s} onClick={() => setSlot(s)} className="focusable t-mono" style={{
                        height: 46, borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: 'var(--t-14)',
                        background: slot === s ? 'var(--sd-navy-700)' : '#fff', color: slot === s ? '#fff' : 'var(--fg-strong)',
                        border: '1px solid ' + (slot === s ? 'var(--sd-navy-700)' : 'var(--border-default)'),
                      }}>{s}</button>
                    ))}
                  </div>
                </React.Fragment>
              )}
            </React.Fragment>
          )}

          {step === 3 && (
            <React.Fragment>
              <div className="card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', gap: 14, padding: 18, alignItems: 'center' }}>
                  <DocAvatar doctor={doc} size={56} />
                  <div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{doc.name}</div>
                  <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{doc.specName}</div></div>
                </div>
                <Sum k="Paciente" v={DB.personById(who).name} />
                <Sum k="Fecha" v={(() => { const d = DB.bookDays.find(x => x.id === day); return d.dow + ' ' + d.dom + ' ' + d.mon; })()} />
                <Sum k="Hora" v={slot + ' h'} />
                <Sum k="Modalidad" v={mode === 'video' ? 'Videoconsulta' : 'Presencial · ' + DB.clinicById(doc.clinic).name} />
                <Sum k="Costo estimado" v={DB.L(doc.fee)} mono last />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, padding: '14px', background: 'var(--sd-blue-50)', borderRadius: 'var(--r-md)', alignItems: 'flex-start' }}>
                <Icon name="info" size={18} color="var(--sd-blue-600)" style={{ marginTop: 1 }} />
                <div style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>Después de confirmar le pediremos una breve <strong>pre-consulta</strong> para que el médico llegue preparado.</div>
              </div>
            </React.Fragment>
          )}
        </div>

        {/* sticky CTA */}
        <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', background: 'linear-gradient(180deg, rgba(255,255,255,0), #fff 28%)', borderTop: '1px solid var(--border-soft)' }}>
          {step < 3
            ? <Btn variant="primary" size="lg" block disabled={!canNext} iconRight="arrow-right" onClick={next}>Continuar</Btn>
            : <Btn variant="primary" size="lg" block icon="calendar-check" onClick={confirm}>Confirmar cita</Btn>}
        </div>
      </div>
    );
  }

  function Sum({ k, v, mono, last }) {
    return (
      <div className="kv" style={{ padding: '13px 18px', borderTop: '1px solid var(--border-soft)' }}>
        <span className="k">{k}</span>
        <span className={'v' + (mono ? ' t-mono' : '')}>{v}</span>
      </div>
    );
  }

  function Done({ app, doc, day, slot, who, mode }) {
    const { DB } = app;
    const newAppt = app.appts.find(a => a.doctor === doc.id && a.time === slot);
    return (
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 80, paddingBottom: 40 }}>
          <div style={{ width: 96, height: 96, borderRadius: 999, background: 'var(--sd-vital-100)', display: 'grid', placeItems: 'center', animation: 'popIn var(--dur-4) var(--ease-out)' }}>
            <div style={{ width: 70, height: 70, borderRadius: 999, background: 'var(--sd-vital-500)', display: 'grid', placeItems: 'center' }}>
              <Icon name="check" size={38} color="#fff" strokeWidth={2.4} />
            </div>
          </div>
          <h2 style={{ margin: '22px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--sd-navy-700)' }}>Cita confirmada</h2>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--t-15)', lineHeight: 1.5, maxWidth: 300 }}>
            {day.dow} {day.dom} {day.mon} a las {slot} con {doc.name}. Le enviaremos un recordatorio.
          </p>
        </div>
        <div className="pad" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn variant="primary" size="lg" block icon="clipboard" onClick={() => app.resetTo('citas') || app.go('preconsulta', { apptId: newAppt.id })}>Hacer la pre-consulta ahora</Btn>
          <Btn variant="ghost" block onClick={() => app.setTab('citas')}>Ver mis citas</Btn>
        </div>
      </div>
    );
  }

  window.Booking = Booking;
})();
