// video.jsx — Videoconsulta (pre-join + in-call)
(function () {
  const { useState, useEffect } = React;
  const Icon = window.Icon;
  const { DocAvatar, Btn } = window;

  function Video() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const a = app.appts.find(x => x.id === cur.params.apptId);
    const doc = a && DB.doctorById(a.doctor);
    const person = a && DB.personById(a.who);
    const [joined, setJoined] = useState(false);
    const [mic, setMic] = useState(true);
    const [cam, setCam] = useState(true);
    const [secs, setSecs] = useState(0);
    const [ended, setEnded] = useState(false);

    useEffect(() => {
      if (!joined || ended) return;
      const t = setInterval(() => setSecs(s => s + 1), 1000);
      return () => clearInterval(t);
    }, [joined, ended]);

    if (!a) return null;
    const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

    if (ended) {
      return (
        <div className="app" style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
            <div style={{ width: 88, height: 88, borderRadius: 999, background: 'var(--sd-vital-100)', display: 'grid', placeItems: 'center', animation: 'popIn var(--dur-4) var(--ease-out)' }}>
              <Icon name="check-circle" size={54} color="var(--sd-vital-500)" />
            </div>
            <h2 style={{ margin: '20px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--sd-navy-700)' }}>Consulta finalizada</h2>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--t-15)', lineHeight: 1.5, maxWidth: 300 }}>Duró {mmss}. {doc.name} le enviará el resumen y la receta a esta app.</p>
          </div>
          <div className="pad" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            <Btn variant="primary" size="lg" block onClick={() => app.setTab('home')}>Volver al inicio</Btn>
          </div>
        </div>
      );
    }

    // ---- in-call ----
    if (joined) {
      return (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg, #0B1424, #002050)', overflow: 'hidden' }}>
          {/* doctor "video" */}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', opacity: 0.96 }}>
              <DocAvatar doctor={doc} size={120} style={{ borderRadius: 36, margin: '0 auto' }} />
              <div style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', marginTop: 16 }}>{doc.name}</div>
              <div style={{ color: 'var(--sd-blue-300)', fontSize: 'var(--t-14)', marginTop: 2 }}>{doc.specName}</div>
            </div>
          </div>

          {/* top status */}
          <div style={{ position: 'absolute', top: 58, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: 999, padding: '8px 16px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--sd-vital-500)' }} />
              <span className="t-mono" style={{ color: '#fff', fontSize: 'var(--t-14)', fontWeight: 600 }}>{mmss}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--t-13)' }}>· {person.short}</span>
            </div>
          </div>

          {/* self PiP */}
          <div style={{ position: 'absolute', top: 110, right: 16, width: 96, height: 132, borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', zIndex: 2 }}>
            {cam ? (
              <div className="photo" style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #25579E, #103A78)' }}>
                <span style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700 }}>AR</span>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#0B1424', display: 'grid', placeItems: 'center' }}><Icon name="video-off" size={24} color="rgba(255,255,255,0.5)" /></div>
            )}
          </div>

          {/* controls */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 24px calc(32px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', gap: 18, zIndex: 2 }}>
            <CallBtn on={mic} iconOn="mic" iconOff="mic-off" onClick={() => setMic(v => !v)} />
            <CallBtn on={cam} iconOn="video" iconOff="video-off" onClick={() => setCam(v => !v)} />
            <button className="focusable" onClick={() => setEnded(true)} aria-label="Colgar" style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--sd-critical-500)', display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(218,69,58,0.4)' }}>
              <Icon name="phone" size={26} color="#fff" style={{ transform: 'rotate(135deg)' }} />
            </button>
          </div>
        </div>
      );
    }

    // ---- pre-join lobby ----
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg, #0B1424, #002050)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '54px 20px 0' }}>
          <button className="focusable" onClick={back} aria-label="Atrás" style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center' }}><Icon name="chevron-left" size={22} color="#fff" /></button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <DocAvatar doctor={doc} size={96} style={{ borderRadius: 30 }} />
          <h2 style={{ margin: '18px 0 4px', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-24)' }}>{doc.name}</h2>
          <div style={{ color: 'var(--sd-blue-300)', fontSize: 'var(--t-15)' }}>{doc.specName} · {a.day} · {a.time}</div>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(43,168,106,0.2)', borderRadius: 999, padding: '8px 14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--sd-vital-500)' }} />
            <span style={{ color: '#fff', fontSize: 'var(--t-13)', fontWeight: 600 }}>El médico está listo para atenderle</span>
          </div>

          {/* device preview */}
          <div style={{ width: 200, height: 150, borderRadius: 20, marginTop: 28, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', position: 'relative', background: cam ? 'linear-gradient(145deg, #25579E, #103A78)' : '#0B1424', display: 'grid', placeItems: 'center' }}>
            {cam ? <span style={{ width: 60, height: 60, borderRadius: 999, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>AR</span>
              : <Icon name="video-off" size={32} color="rgba(255,255,255,0.5)" />}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
            <CallBtn on={mic} iconOn="mic" iconOff="mic-off" onClick={() => setMic(v => !v)} small />
            <CallBtn on={cam} iconOn="video" iconOff="video-off" onClick={() => setCam(v => !v)} small />
          </div>
        </div>
        <div className="pad" style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}>
          <Btn variant="primary" size="lg" block icon="video" onClick={() => setJoined(true)}>Entrar a la consulta</Btn>
        </div>
      </div>
    );
  }

  function CallBtn({ on, iconOn, iconOff, onClick, small }) {
    const s = small ? 52 : 60;
    return (
      <button className="focusable" onClick={onClick} aria-label="control" style={{
        width: s, height: s, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: on ? 'rgba(255,255,255,0.16)' : '#fff', transition: 'background var(--dur-1)',
      }}>
        <Icon name={on ? iconOn : iconOff} size={small ? 22 : 24} color={on ? '#fff' : 'var(--sd-navy-800)'} />
      </button>
    );
  }

  window.Video = Video;
})();
