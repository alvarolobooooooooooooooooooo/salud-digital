// onboarding.jsx — intro + registro del paciente
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Btn, Field } = window;

  const slides = [
    { icon: 'calendar-check', color: '#0080B0', bg: 'var(--sd-blue-100)', title: 'Toda su salud, en un solo lugar',
      body: 'Agende citas, hable con sus médicos y lleve el control de su familia desde su teléfono.' },
    { icon: 'users', color: '#198754', bg: 'var(--sd-vital-100)', title: 'Cuide a quienes ama',
      body: 'Gestione las citas, recordatorios y resultados de sus hijos y sus padres, todo desde su cuenta.' },
    { icon: 'shield-check', color: '#103A78', bg: 'var(--sd-blue-100)', title: 'Lo que su médico comparte',
      body: 'Reciba resultados, recetas y resúmenes de sus visitas, explicados de forma clara y siempre disponibles.' },
  ];

  function Onboarding() {
    const app = window.useApp();
    const [phase, setPhase] = useState('intro'); // intro | registro | verify | done
    const [slide, setSlide] = useState(0);
    const [name, setName] = useState('');
    const [id, setId] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState(['', '', '', '']);

    // ---- intro carousel ----
    if (phase === 'intro') {
      const s = slides[slide];
      return (
        <div className="app" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #fff, var(--sd-blue-50))' }}>
          <div style={{ padding: '60px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="assets/logo-lockup.svg" alt="Salud Digital" style={{ height: 30 }} onError={(e) => { e.target.style.display = 'none'; }} />
            <button className="focusable" onClick={() => setPhase('registro')} style={{ color: 'var(--fg-muted)', fontWeight: 600, fontSize: 'var(--t-14)' }}>Saltar</button>
          </div>
          <div className="pageIn" key={slide} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 36px' }}>
            <div style={{ width: 132, height: 132, borderRadius: 40, background: s.bg, display: 'grid', placeItems: 'center', marginBottom: 36 }}>
              <Icon name={s.icon} size={60} color={s.color} strokeWidth={1.6} />
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', letterSpacing: 'var(--ls-tight)', color: 'var(--sd-navy-700)', lineHeight: 1.2 }}>{s.title}</h1>
            <p className="muted" style={{ margin: '14px 0 0', fontSize: 'var(--t-16)', lineHeight: 1.55, maxWidth: 320 }}>{s.body}</p>
          </div>
          <div style={{ padding: '0 24px calc(36px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 26 }}>
              {slides.map((_, i) => <span key={i} style={{ width: i === slide ? 22 : 8, height: 8, borderRadius: 999, background: i === slide ? 'var(--sd-blue-600)' : 'var(--sd-ink-200)', transition: 'all var(--dur-2) var(--ease-out)' }} />)}
            </div>
            <Btn variant="primary" size="lg" block iconRight="arrow-right" onClick={() => slide < slides.length - 1 ? setSlide(slide + 1) : setPhase('registro')}>
              {slide < slides.length - 1 ? 'Siguiente' : 'Crear mi cuenta'}
            </Btn>
            {slide === slides.length - 1 && <button className="focusable" onClick={() => setPhase('registro')} style={{ width: '100%', marginTop: 14, color: 'var(--sd-navy-700)', fontWeight: 600, fontSize: 'var(--t-14)' }}>Ya tengo cuenta</button>}
          </div>
        </div>
      );
    }

    // ---- registro ----
    if (phase === 'registro') {
      const valid = name.trim().length > 3 && id.length >= 13 && phone.length >= 8;
      return (
        <div className="app" style={{ position: 'absolute', inset: 0 }}>
          <div className="topbar topbar-flat" style={{ paddingBottom: 8 }}>
            <button className="focusable" onClick={() => setPhase('intro')} aria-label="Atrás" style={{ width: 38, height: 38, borderRadius: 999, marginLeft: -6, display: 'grid', placeItems: 'center', background: 'var(--bg-subtle)' }}><Icon name="chevron-left" size={22} color="var(--sd-navy-700)" /></button>
          </div>
          <div className="scroll pad" style={{ paddingTop: 4 }}>
            <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', color: 'var(--sd-navy-700)', letterSpacing: 'var(--ls-tight)' }}>Cree su cuenta</h1>
            <p className="muted" style={{ margin: '0 0 24px', fontSize: 'var(--t-15)' }}>Solo necesitamos unos datos para empezar.</p>
            <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nombre completo" value={name} onChange={setName} placeholder="Ana Ruiz Mejía" icon="user" />
              <Field label="Número de identidad" value={id} onChange={v => setId(v.replace(/[^0-9]/g, '').slice(0, 13))} placeholder="0801-1992-00000" icon="fingerprint" />
              <Field label="Teléfono celular" value={phone} onChange={v => setPhone(v.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="9999-9999" icon="phone" type="tel" />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 20, padding: '12px 14px', background: 'var(--sd-blue-50)', borderRadius: 'var(--r-md)' }}>
              <Icon name="lock" size={18} color="var(--sd-blue-600)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>Sus datos están protegidos. Solo usted y su equipo médico tienen acceso.</span>
            </div>
          </div>
          <div className="pad" style={{ paddingTop: 12, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-soft)' }}>
            <Btn variant="primary" size="lg" block disabled={!valid} onClick={() => setPhase('verify')}>Continuar</Btn>
          </div>
        </div>
      );
    }

    // ---- verify ----
    if (phase === 'verify') {
      const full = code.join('').length === 4;
      const setDigit = (i, v) => {
        const d = v.replace(/[^0-9]/g, '').slice(-1);
        setCode(c => { const n = [...c]; n[i] = d; return n; });
        if (d && i < 3) { const el = document.getElementById('code-' + (i + 1)); if (el) el.focus(); }
      };
      return (
        <div className="app" style={{ position: 'absolute', inset: 0 }}>
          <div className="topbar topbar-flat" style={{ paddingBottom: 8 }}>
            <button className="focusable" onClick={() => setPhase('registro')} aria-label="Atrás" style={{ width: 38, height: 38, borderRadius: 999, marginLeft: -6, display: 'grid', placeItems: 'center', background: 'var(--bg-subtle)' }}><Icon name="chevron-left" size={22} color="var(--sd-navy-700)" /></button>
          </div>
          <div className="scroll pad" style={{ paddingTop: 4 }}>
            <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', color: 'var(--sd-navy-700)', letterSpacing: 'var(--ls-tight)' }}>Verifique su número</h1>
            <p className="muted" style={{ margin: '0 0 28px', fontSize: 'var(--t-15)', lineHeight: 1.5 }}>Enviamos un código por SMS al <strong style={{ color: 'var(--fg-strong)' }}>{phone ? phone.replace(/(\d{4})(\d{4})/, '$1-$2') : '9999-9999'}</strong>.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              {code.map((d, i) => (
                <input key={i} id={'code-' + i} value={d} onChange={e => setDigit(i, e.target.value)} inputMode="numeric" maxLength={1} className="focusable t-mono"
                  style={{ width: 60, height: 72, textAlign: 'center', fontSize: 'var(--t-32)', fontWeight: 700, borderRadius: 'var(--r-md)', border: '1px solid ' + (d ? 'var(--sd-blue-600)' : 'var(--border-default)'), outline: 'none', color: 'var(--fg-strong)', background: '#fff' }} />
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="focusable" onClick={() => setCode(['1', '2', '3', '4'])} style={{ color: 'var(--sd-blue-600)', fontWeight: 600, fontSize: 'var(--t-14)' }}>Reenviar código</button>
            </div>
          </div>
          <div className="pad" style={{ paddingTop: 12, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-soft)' }}>
            <Btn variant="primary" size="lg" block disabled={!full} onClick={() => setPhase('done')}>Verificar</Btn>
          </div>
        </div>
      );
    }

    // ---- done / welcome ----
    return (
      <div className="app" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 0%, #06b6d4 0%, transparent 55%), linear-gradient(180deg, #0891b2 0%, #0369a1 60%, #075985 100%)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 36 }}>
          <div style={{ width: 100, height: 100, borderRadius: 999, background: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center', animation: 'popIn var(--dur-4) var(--ease-out)' }}>
            <div style={{ width: 76, height: 76, borderRadius: 999, background: 'var(--sd-vital-500)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={42} color="#fff" strokeWidth={2.4} /></div>
          </div>
          <h1 style={{ margin: '26px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', color: '#fff' }}>¡Bienvenida, {name ? name.split(' ')[0] : 'Ana'}!</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 'var(--t-16)', lineHeight: 1.55, maxWidth: 320 }}>Su cuenta está lista. Estamos aquí para acompañarle a usted y a su familia.</p>
        </div>
        <div className="pad" style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom))' }}>
          <Btn variant="primary" size="lg" block style={{ background: '#fff', color: 'var(--sd-navy-700)' }} onClick={app.finishOnboarding}>Entrar a Salud Digital</Btn>
        </div>
      </div>
    );
  }

  window.Onboarding = Onboarding;
})();
