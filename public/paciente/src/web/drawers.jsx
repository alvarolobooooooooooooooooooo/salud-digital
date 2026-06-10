// web/drawers.jsx — right-side drawer host for record/detail views (desktop)
(function () {
  const { useState, useEffect } = React;
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, Btn, IconTile, Toast } = window;

  const flagColor = { ok: '#198754', high: '#C2362C', low: '#C7811C' };
  const flagLabel = { ok: 'Normal', high: 'Alto', low: 'Bajo' };

  function WebDrawer({ name, params }) {
    const app = window.useApp();
    const close = app.back;
    const C = {
      resultado: Resultado, receta: Receta, resumen: Resumen, medicamento: Medicamento,
      cita: Cita, familiar: Familiar, factura: Factura, ruta: Ruta, notificaciones: Avisos,
    }[name];
    const wide = name === 'familiar' || name === 'ruta' || name === 'resultado';
    return (
      <React.Fragment>
        <div className="drawer-scrim" onClick={close} />
        <div className="drawer" style={wide ? { width: 540 } : {}}>
          {C ? <C app={app} params={params} close={close} /> : null}
        </div>
      </React.Fragment>
    );
  }

  function Head({ title, sub, close, trailing }) {
    return (
      <div className="drawer-head">
        <button className="icon-btn" onClick={close} aria-label="Cerrar" style={{ width: 38, height: 38 }}><Icon name="x" size={20} color="var(--sd-navy-700)" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-17)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {sub && <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{sub}</div>}
        </div>
        {trailing}
      </div>
    );
  }

  // ---------- Resultado ----------
  function Resultado({ app, params, close }) {
    const { DB } = app;
    const r = DB.results.find(x => x.id === params.id);
    useEffect(() => { if (r) app.actions.markRead(r.id); }, []);
    if (!r) return null;
    const doc = DB.doctorById(r.sharedBy); const person = DB.personById(r.who);
    return (
      <React.Fragment>
        <Head title={r.title} sub={person.name + ' · ' + r.date} close={close}
          trailing={<button className="icon-btn" aria-label="Descargar" style={{ width: 38, height: 38 }}><Icon name="download" size={19} color="var(--sd-navy-700)" /></button>} />
        <div className="drawer-body">
          <div className="wcard" style={{ background: 'var(--sd-blue-50)', borderColor: 'transparent', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <DocAvatar doctor={doc} size={40} /><div><div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>Nota de {doc.name}</div><div className="muted" style={{ fontSize: 'var(--t-12)' }}>{doc.specName} · {r.lab}</div></div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{r.note}</p>
          </div>
          <div className="wcard wcard-flush">
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', fontFamily: 'var(--font-display)' }}>Valores</span><span className="muted" style={{ fontSize: 'var(--t-12)' }}>Referencia</span></div>
            {r.items.map((it, i) => (
              <div key={it.k} style={{ padding: '14px 18px', borderBottom: i < r.items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 'var(--t-14)', color: 'var(--fg-default)' }}>{it.k}</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="t-mono" style={{ fontWeight: 700, fontSize: 'var(--t-16)', color: flagColor[it.flag] }}>{it.v}</span><span className="muted t-mono" style={{ fontSize: 'var(--t-12)' }}>{it.u}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--sd-ink-150)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: it.flag === 'low' ? 0 : '30%', right: it.flag === 'high' ? 0 : '30%', top: 0, bottom: 0, background: it.flag === 'ok' ? 'var(--sd-vital-100)' : 'transparent' }} />
                    <div style={{ position: 'absolute', top: -1, bottom: -1, width: 8, borderRadius: 999, background: flagColor[it.flag], left: it.flag === 'high' ? '82%' : it.flag === 'low' ? '12%' : '50%', transform: 'translateX(-50%)' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: flagColor[it.flag], minWidth: 44, textAlign: 'right' }}>{flagLabel[it.flag]}</span>
                </div>
                <div className="muted t-mono" style={{ fontSize: 11, marginTop: 4 }}>Ref: {it.ref} {it.u}</div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 'var(--t-12)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>Documento compartido por su médico. El expediente original es resguardado por la clínica.</p>
        </div>
        <div className="drawer-foot"><Btn variant="primary" block icon="message" onClick={() => app.setTab('chat')}>Preguntar al médico</Btn></div>
      </React.Fragment>
    );
  }

  // ---------- Receta ----------
  function Receta({ app, params, close }) {
    const { DB } = app;
    const rx = DB.recetas.find(x => x.id === params.id);
    if (!rx) return null;
    const doc = DB.doctorById(rx.doctor); const person = DB.personById(rx.who);
    return (
      <React.Fragment>
        <Head title="Receta médica" sub={rx.folio} close={close} />
        <div className="drawer-body">
          <div className="wcard wcard-flush" style={{ marginBottom: 14 }}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <DocAvatar doctor={doc} size={48} /><div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{doc.name}</div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{doc.specName} · {rx.date}</div></div>
            </div>
            <div style={{ padding: '12px 18px', background: 'var(--sd-blue-50)', borderBottom: '1px solid var(--border-soft)' }}><span className="muted" style={{ fontSize: 'var(--t-13)' }}>Paciente: <strong style={{ color: 'var(--fg-strong)' }}>{person.name}</strong></span></div>
            {rx.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: 18, borderBottom: i < rx.items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--sd-blue-100)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={20} color="#0080B0" /></span>
                <div><div style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{it.name}</div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3 }}>{it.instr}</div></div>
              </div>
            ))}
          </div>
          <div className="wcard" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 12, background: '#fff', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="qr" size={40} color="var(--sd-navy-700)" /></span>
            <div><div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>Muestre este código en la farmacia</div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2, lineHeight: 1.45 }}>Receta verificada con firma digital del médico.</div></div>
          </div>
        </div>
        <div className="drawer-foot"><Btn variant="ghost" block icon="download">Descargar</Btn><Btn variant="ghost" block icon="share">Compartir</Btn></div>
      </React.Fragment>
    );
  }

  // ---------- Resumen ----------
  function Resumen({ app, params, close }) {
    const { DB } = app;
    const s = DB.resumenes.find(x => x.id === params.id);
    if (!s) return null;
    const doc = DB.doctorById(s.doctor); const person = DB.personById(s.who);
    const Block = ({ icon, title, children }) => (
      <div className="wcard" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><Icon name={icon} size={18} color="var(--sd-blue-600)" /><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{title}</span></div>
        {children}
      </div>
    );
    return (
      <React.Fragment>
        <Head title="Resumen de visita" sub={s.specName + ' · ' + s.date} close={close} />
        <div className="drawer-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}><DocAvatar doctor={doc} size={44} /><div><div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{doc.name}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>Paciente: {person.name}</div></div></div>
          <Block icon="message" title="Motivo de consulta"><p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{s.motivo}</p></Block>
          <Block icon="stethoscope" title="Hallazgos"><p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{s.hallazgos}</p></Block>
          <Block icon="clipboard" title="Indicaciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{s.indicaciones.map((x, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon name="check-circle" size={18} color="var(--sd-vital-500)" style={{ marginTop: 1, flexShrink: 0 }} /><span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>{x}</span></div>)}</div>
          </Block>
          <div className="wcard" style={{ background: 'var(--sd-blue-50)', borderColor: 'transparent', display: 'flex', gap: 12, alignItems: 'center' }}><Icon name="calendar-check" size={20} color="var(--sd-blue-600)" /><span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.45 }}>{s.proxima}</span></div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- Medicamento ----------
  function Medicamento({ app, params, close }) {
    const { DB } = app;
    const m = DB.meds.find(x => x.id === params.id);
    if (!m) return null;
    const taken = app.taken[m.id]; const doc = DB.doctorById(m.doctor); const person = DB.personById(m.who);
    const progress = (m.of - m.left) / m.of;
    return (
      <React.Fragment>
        <Head title={m.name + ' ' + m.dose} sub={person.name} close={close} />
        <div className="drawer-body">
          <div className="wcard" style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
            <span style={{ width: 72, height: 72, borderRadius: 20, background: m.color + '1A', display: 'inline-grid', placeItems: 'center' }}><Icon name="pill" size={36} color={m.color} /></span>
            <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 12 }}>{m.form} · {m.schedule}</div>
          </div>
          <button onClick={() => app.actions.toggleMed(m.id)} style={{ width: '100%', marginBottom: 14, padding: 18, borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 14, background: taken ? 'var(--sd-vital-100)' : '#fff', border: '1px solid ' + (taken ? 'var(--sd-vital-500)' : 'var(--border-default)') }}>
            <span className={'check' + (taken ? ' on' : '')} style={{ width: 32, height: 32 }}>{taken && <Icon name="check" size={20} color="#fff" strokeWidth={2.6} />}</span>
            <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: taken ? 'var(--sd-vital-600)' : 'var(--fg-strong)' }}>{taken ? 'Tomado hoy' : 'Marcar como tomado'}</div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{taken ? 'Siguiente toma mañana ' + m.times[0] : 'Haga clic cuando lo tome'}</div></div>
          </button>
          <div className="wcard" style={{ marginBottom: 14 }}>
            <div className="kv" style={{ marginBottom: 10 }}><span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', fontFamily: 'var(--font-display)' }}>Tratamiento</span><span className="muted" style={{ fontSize: 'var(--t-13)' }}>Quedan <strong style={{ color: 'var(--fg-strong)' }}>{m.left}</strong> de {m.of}</span></div>
            <div className="track"><i style={{ width: (progress * 100) + '%', background: m.color }} /></div>
          </div>
          <div className="wcard wcard-flush">
            <InfoRow icon="heart-pulse" k="Para" v={m.reason} />
            <InfoRow icon="stethoscope" k="Indicado por" v={doc.name} />
            <InfoRow icon="bell" k="Recordatorio" v={'Activo · ' + m.schedule.split('· ')[1]} last />
          </div>
        </div>
        <div className="drawer-foot"><Btn variant="ghost" block icon="message" onClick={() => app.setTab('chat')}>Consultar al médico</Btn></div>
      </React.Fragment>
    );
  }

  function InfoRow({ icon, k, v, last }) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--border-soft)' }}><Icon name={icon} size={20} color="var(--sd-blue-600)" /><span className="muted" style={{ fontSize: 'var(--t-14)' }}>{k}</span><span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{v}</span></div>;
  }

  // ---------- Cita ----------
  function Cita({ app, params, close }) {
    const { DB } = app;
    const a = app.appts.find(x => x.id === params.apptId);
    if (!a) return null;
    const doc = DB.doctorById(a.doctor); const clinic = DB.clinicById(a.clinic); const person = DB.personById(a.who);
    const needPre = a.preconsulta && !app.preDone[a.id];
    const R = ({ icon, k, v, sub, last }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--border-soft)' }}><Icon name={icon} size={20} color="var(--sd-blue-600)" /><div style={{ flex: 1 }}><div className="muted" style={{ fontSize: 'var(--t-12)' }}>{k}</div><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)', marginTop: 1 }}>{v}</div>{sub && <div className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 1 }}>{sub}</div>}</div></div>
    );
    return (
      <React.Fragment>
        <Head title="Detalle de la cita" close={close} />
        <div className="drawer-body">
          <div className="wcard" style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
            <DocAvatar doctor={doc} size={68} style={{ margin: '0 auto' }} />
            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', color: 'var(--fg-strong)' }}>{doc.name}</h2>
            <div className="muted" style={{ fontSize: 'var(--t-14)' }}>{doc.specName}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}><Pill tone="green" dot>Confirmada</Pill>{a.mode === 'video' ? <Pill tone="blue"><Icon name="video" size={13} color="currentColor" />Video</Pill> : <Pill tone="gray"><Icon name="map-pin" size={13} color="currentColor" />Presencial</Pill>}</div>
          </div>
          <div className="wcard wcard-flush" style={{ marginBottom: 14 }}>
            <R icon="user" k="Paciente" v={person.name + (person.rel !== 'Titular' ? ' · ' + person.rel : '')} />
            <R icon="calendar" k="Fecha" v={a.day} />
            <R icon="clock" k="Hora" v={a.time + ' h'} />
            <R icon={a.mode === 'video' ? 'video' : 'map-pin'} k={a.mode === 'video' ? 'Modalidad' : 'Lugar'} v={a.mode === 'video' ? 'Videoconsulta' : clinic.name} sub={a.mode === 'video' ? 'Reciba el enlace 10 min antes' : clinic.zone} last />
          </div>
          {a.preconsulta && (
            <div className="wcard" style={{ display: 'flex', gap: 14, alignItems: 'center', background: needPre ? 'var(--sd-alert-100)' : 'var(--sd-vital-100)', borderColor: 'transparent' }}>
              <IconTile name={needPre ? 'clipboard' : 'check-circle'} color={needPre ? '#C7811C' : '#198754'} bg="#fff" />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: needPre ? 'var(--sd-alert-600)' : 'var(--sd-vital-600)' }}>{needPre ? 'Pre-consulta pendiente' : 'Pre-consulta enviada'}</div><div style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', marginTop: 2, lineHeight: 1.4 }}>{needPre ? 'Cuéntele al doctor sus síntomas antes de llegar.' : 'El doctor ya tiene su información.'}</div></div>
              {needPre && <Btn variant="navy" onClick={() => app.go('preconsulta', { apptId: a.id })} style={{ height: 40, padding: '0 14px' }}>Llenar</Btn>}
            </div>
          )}
        </div>
        <div className="drawer-foot" style={{ flexDirection: 'column' }}>
          {a.mode === 'video'
            ? <Btn variant="primary" block icon="video" onClick={() => app.go('video', { apptId: a.id })}>Entrar a la videoconsulta</Btn>
            : <Btn variant="primary" block icon="map" onClick={() => app.go('ruta', { apptId: a.id })}>Cómo llegar</Btn>}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <Btn variant="ghost" block icon="message" onClick={() => app.setTab('chat')}>Escribir</Btn>
            <Btn variant="ghost" block icon="calendar" onClick={() => { close(); app.go('agendar'); }}>Reagendar</Btn>
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- Familiar ----------
  function Familiar({ app, params, close }) {
    const { DB } = app;
    const p = DB.personById(params.id);
    if (!p) return null;
    const meds = DB.meds.filter(m => m.who === p.id);
    const results = DB.results.filter(r => r.who === p.id);
    const appts = app.appts.filter(a => a.who === p.id);
    const Stat = ({ k, v }) => <div style={{ textAlign: 'center' }}><div className="t-mono strong" style={{ fontWeight: 700, fontSize: 'var(--t-14)' }}>{v}</div><div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{k}</div></div>;
    return (
      <React.Fragment>
        <Head title={p.name} sub={p.rel} close={close} />
        <div className="drawer-body">
          <div className="wcard" style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
            <Avatar person={p} size={72} style={{ fontSize: 26, margin: '0 auto' }} />
            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', color: 'var(--fg-strong)' }}>{p.name}</h2>
            <div className="muted" style={{ fontSize: 'var(--t-14)' }}>{p.age} años · {p.sex === 'F' ? 'Femenino' : 'Masculino'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 16 }}>
              <Stat k="Sangre" v={p.blood} /><div style={{ width: 1, background: 'var(--border-soft)' }} /><Stat k="Nacimiento" v={p.dob} />
              {p.note && <React.Fragment><div style={{ width: 1, background: 'var(--border-soft)' }} /><Stat k="Condición" v={p.note} /></React.Fragment>}
            </div>
          </div>
          {appts.length > 0 && <Sec title="Próximas citas">{appts.map(a => { const d = DB.doctorById(a.doctor); return <button key={a.id} className="wrow" onClick={() => app.go('cita', { apptId: a.id })}><IconTile name="calendar" color="#0080B0" bg="var(--sd-blue-100)" size={38} iconSize={19} radius={10} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{d.specName}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{a.day} · {a.time}</div></div><Icon name="chevron-right" size={18} color="var(--sd-ink-300)" /></button>; })}</Sec>}
          {meds.length > 0 && <Sec title="Medicamentos">{meds.map(m => <button key={m.id} className="wrow" onClick={() => app.go('medicamento', { id: m.id })}><span style={{ width: 38, height: 38, borderRadius: 10, background: m.color + '1A', display: 'grid', placeItems: 'center' }}><Icon name="pill" size={19} color={m.color} /></span><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{m.name} {m.dose}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{m.schedule}</div></div><Icon name="chevron-right" size={18} color="var(--sd-ink-300)" /></button>)}</Sec>}
          {results.length > 0 && <Sec title="Resultados compartidos">{results.map(r => <button key={r.id} className="wrow" onClick={() => app.go('resultado', { id: r.id })}><IconTile name="flask" color="#0080B0" bg="var(--sd-blue-100)" size={38} iconSize={19} radius={10} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{r.title}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{r.date}</div></div><Icon name="chevron-right" size={18} color="var(--sd-ink-300)" /></button>)}</Sec>}
        </div>
        <div className="drawer-foot"><Btn variant="primary" block icon="calendar-plus" onClick={() => { close(); app.go('agendar'); }}>Agendar cita</Btn></div>
      </React.Fragment>
    );
  }

  function Sec({ title, children }) {
    return <div style={{ marginBottom: 16 }}><div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div><div className="wcard wcard-flush">{children}</div></div>;
  }

  // ---------- Factura ----------
  function Factura({ app, params, close }) {
    const { DB } = app;
    const f = app.facturas.find(x => x.id === params.id);
    const [pay, setPay] = useState(false);
    const [toast, setToast] = useState(false);
    if (!f) return null;
    const person = DB.personById(f.who); const clinic = DB.clinicById(f.clinic); const doc = f.doctor && DB.doctorById(f.doctor);
    const sub = f.amount / 1.15; const isv = f.amount - sub;
    const L = ({ k, v }) => <div className="kv" style={{ padding: '13px 18px', borderTop: '1px solid var(--border-soft)' }}><span className="k">{k}</span><span className="v" style={{ textAlign: 'right' }}>{v}</span></div>;
    return (
      <React.Fragment>
        <Head title="Factura" sub={f.concept} close={close} />
        <div className="drawer-body">
          <div className="wcard wcard-flush">
            <div style={{ padding: 22, textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{f.status === 'pendiente' ? 'Por pagar' : 'Pagada'}</div>
              <div className="t-mono" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-40)', color: 'var(--fg-strong)', letterSpacing: '-0.02em' }}>{DB.L(f.amount)}</div>
              <div style={{ marginTop: 10 }}>{f.status === 'pendiente' ? <Pill tone="amber" dot>Pendiente</Pill> : <Pill tone="green" dot>Pagada</Pill>}</div>
            </div>
            <L k="Concepto" v={f.concept} />{doc && <L k="Médico" v={doc.name} />}<L k="Paciente" v={person.name} /><L k="Clínica" v={clinic.name} /><L k="Fecha" v={f.date} />
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
              <div className="kv" style={{ marginBottom: 6 }}><span className="k">Subtotal</span><span className="v t-mono">{DB.L(sub)}</span></div>
              <div className="kv"><span className="k">ISV (15%)</span><span className="v t-mono">{DB.L(isv)}</span></div>
            </div>
          </div>
          {f.status === 'pendiente' && <p className="muted" style={{ fontSize: 'var(--t-12)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>También puede pagar en la recepción de {clinic.name}.</p>}
        </div>
        <div className="drawer-foot">
          {f.status === 'pendiente'
            ? <Btn variant="primary" block icon="credit-card" onClick={() => setPay(true)}>Pagar factura</Btn>
            : <Btn variant="ghost" block icon="download">Descargar comprobante</Btn>}
        </div>
        {pay && <PayModal f={f} app={app} onClose={() => setPay(false)} onPaid={() => { setPay(false); app.actions.payFactura(f.id); setToast(true); }} />}
        {toast && <Toast msg="Pago registrado. Gracias." onDone={() => setToast(false)} />}
      </React.Fragment>
    );
  }

  function PayModal({ f, app, onClose, onPaid }) {
    const { DB } = app;
    const [method, setMethod] = useState('card');
    const [paying, setPaying] = useState(false);
    const methods = [{ id: 'card', icon: 'credit-card', label: 'Tarjeta', detail: 'Visa •••• 4421' }, { id: 'transfer', icon: 'refresh', label: 'Transferencia', detail: 'Banco Atlántida' }];
    return (
      <div className="web-scrim" style={{ zIndex: 90 }} onClick={(e) => { if (e.target.classList.contains('web-scrim')) onClose(); }}>
        <div style={{ width: 440, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', padding: 24, boxShadow: 'var(--shadow-xl)', animation: 'popIn var(--dur-3) var(--ease-out)' }}>
          <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 'var(--t-20)', fontWeight: 700, color: 'var(--fg-strong)' }}>Pagar factura</h3>
          <div className="kv" style={{ marginBottom: 16 }}><span className="muted">Total a pagar</span><span className="t-mono" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--fg-strong)' }}>{DB.L(f.amount)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 'var(--r-md)', background: '#fff', border: '1px solid ' + (method === m.id ? 'var(--sd-blue-600)' : 'var(--border-default)'), boxShadow: method === m.id ? '0 0 0 1px var(--sd-blue-600)' : 'none', textAlign: 'left' }}>
                <IconTile name={m.icon} color="#103A78" bg="var(--bg-subtle)" size={42} iconSize={20} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{m.label}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{m.detail}</div></div>
                <span className={'check' + (method === m.id ? ' on' : '')} style={{ width: 24, height: 24 }}>{method === m.id && <Icon name="check" size={15} color="#fff" strokeWidth={2.6} />}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" block onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" block disabled={paying} icon={paying ? null : 'lock'} onClick={() => { setPaying(true); setTimeout(onPaid, 1300); }}>{paying ? 'Procesando…' : 'Pagar'}</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ruta ----------
  function Ruta({ app, params, close }) {
    const { DB } = app;
    const a = app.appts.find(x => x.id === params.apptId);
    const clinic = a && DB.clinicById(a.clinic);
    if (!clinic) return null;
    return (
      <React.Fragment>
        <Head title="Cómo llegar" sub={clinic.name} close={close} />
        <div className="drawer-body">
          <div style={{ height: 260, borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #E8ECF2, #D2E9F5)', border: '1px solid var(--border-default)', marginBottom: 18 }}>
            <svg width="100%" height="100%" viewBox="0 0 480 260" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
              <g stroke="#BDC4D0" strokeWidth="2" fill="none" opacity="0.7"><path d="M-10 70 H490 M-10 160 H490 M-10 220 H490 M80 -10 V270 M240 -10 V270 M370 -10 V270" /></g>
              <path d="M80 260 L80 160 L240 160 L240 70" stroke="#0080B0" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="2 11" />
              <circle cx="80" cy="252" r="7" fill="#103A78" /><g transform="translate(240,70)"><circle r="13" fill="#0080B0" /><circle r="5" fill="#fff" /></g>
            </svg>
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: '#fff', borderRadius: 999, padding: '7px 13px', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--sd-navy-700)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="map-pin" size={14} color="var(--sd-blue-600)" />{clinic.km} km · 9 min</div>
          </div>
          <div className="wcard">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)' }}>{clinic.name}</div>
            <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="map-pin" size={15} color="var(--fg-muted)" />{clinic.zone}</div>
            <div className="hr" style={{ margin: '16px 0' }} />
            <div style={{ display: 'flex', gap: 10 }}><Btn variant="primary" block icon="map">Abrir en mapas</Btn><Btn variant="ghost" block icon="phone">Llamar</Btn></div>
          </div>
          <div className="wcard" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', background: 'var(--sd-blue-50)', borderColor: 'transparent' }}><Icon name="clock" size={20} color="var(--sd-blue-600)" /><span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.45 }}>Su cita es a las <strong>{a.time}</strong>. Le sugerimos salir <strong>20 minutos antes</strong>.</span></div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- Avisos ----------
  function Avisos({ app, close }) {
    const { DB } = app;
    const items = [
      { icon: 'flask', color: '#0080B0', bg: 'var(--sd-blue-100)', title: 'Resultado disponible', body: 'Su hemograma completo ya fue compartido por la Dra. López.', time: 'Hace 1 h', go: () => app.go('resultado', { id: 'r1' }) },
      { icon: 'message', color: '#198754', bg: 'var(--sd-vital-100)', title: 'Dra. Sofía Mendoza', body: 'Perfecto, la espero mañana entonces.', time: '8:32', go: () => app.setTab('chat') },
      { icon: 'pill', color: '#C7811C', bg: 'var(--sd-alert-100)', title: 'Hora de su medicamento', body: 'Doña Carmen: Losartán 50 mg · 8:00', time: '8:00', go: () => app.go('medicamento', { id: 'm1' }) },
      { icon: 'calendar-check', color: '#103A78', bg: 'var(--sd-blue-100)', title: 'Recordatorio de cita', body: 'Dermatología mañana a las 14:30 con la Dra. Mendoza.', time: 'Ayer', go: () => app.go('cita', { apptId: 'a1' }) },
    ];
    return (
      <React.Fragment>
        <Head title="Avisos" close={close} />
        <div className="drawer-body" style={{ padding: 0 }}>
          {items.map((it, i) => (
            <button key={i} className="wrow" style={{ alignItems: 'flex-start', padding: '16px 20px' }} onClick={it.go}>
              <IconTile name={it.icon} color={it.color} bg={it.bg} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{it.title}</span><span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{it.time}</span></div><div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3, lineHeight: 1.45 }}>{it.body}</div></div>
            </button>
          ))}
        </div>
      </React.Fragment>
    );
  }

  window.WebDrawer = WebDrawer;
})();
