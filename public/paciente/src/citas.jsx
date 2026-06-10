// citas.jsx — Citas list + appointment detail
(function () {
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, SectionTitle, Btn, TopBar, IconTile, Empty } = window;

  function modePill(mode) {
    return mode === 'video'
      ? <Pill tone="blue"><Icon name="video" size={13} color="currentColor" />Video</Pill>
      : <Pill tone="gray"><Icon name="map-pin" size={13} color="currentColor" />Presencial</Pill>;
  }

  function ApptCard({ a, onClick, app }) {
    const { DB } = app;
    const doc = DB.doctorById(a.doctor);
    const person = DB.personById(a.who);
    const needPre = a.preconsulta && !app.preDone[a.id];
    return (
      <button className="card selectable" onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: 64, background: 'var(--sd-blue-50)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-soft)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--sd-navy-700)', lineHeight: 1 }}>{a.day.split(' ')[1]}</div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{a.day.split(' ')[2]}</div>
          </div>
          <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="clock" size={14} color="var(--fg-muted)" />
              <span style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)' }}>{a.time}</span>
              <span style={{ marginLeft: 'auto' }}>{modePill(a.mode)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
            <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{doc.specName} · {person.short}</div>
            {needPre && (
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--sd-alert-100)', color: 'var(--sd-alert-600)', borderRadius: 8, padding: '5px 9px', fontSize: 'var(--t-12)', fontWeight: 600 }}>
                <Icon name="clipboard" size={13} color="currentColor" /> Pre-consulta pendiente
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }

  function CitasScreen() {
    const app = window.useApp();
    const { DB, go } = app;
    return (
      <div className="scroll">
        <TopBar title="Citas" large subtitle="Agenda de toda la familia" trailing={
          <button className="focusable" onClick={() => go('agendar')} aria-label="Agendar" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--sd-blue-600)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <Icon name="plus" size={22} color="#fff" />
          </button>} />
        <div className="pad" style={{ paddingTop: 16, paddingBottom: 28 }}>
          <SectionTitle>Próximas</SectionTitle>
          <div className="stack">
            {app.appts.map(a => <ApptCard key={a.id} a={a} app={app} onClick={() => go('cita', { apptId: a.id })} />)}
          </div>

          <div style={{ height: 24 }} />
          <SectionTitle>Anteriores</SectionTitle>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {DB.past.map((p, i) => {
              const doc = DB.doctorById(p.doctor);
              const person = DB.personById(p.who);
              return (
                <button key={p.id} className="row focusable" onClick={() => { const s = DB.resumenes.find(s => s.who === p.who); if (s) go('resumen', { id: s.id }); else app.setTab('salud'); }} style={{}}>
                  <DocAvatar doctor={doc} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{p.specName}</div>
                    <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{doc.name.replace('Dra. ', '').replace('Dr. ', '')} · {person.short}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ fontSize: 'var(--t-13)' }}>{p.day}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function CitaDetail() {
    const app = window.useApp();
    const { DB, cur, go, back } = app;
    const a = app.appts.find(x => x.id === cur.params.apptId);
    if (!a) return <div className="scroll"><TopBar title="Cita" onBack={back} /></div>;
    const doc = DB.doctorById(a.doctor);
    const clinic = DB.clinicById(a.clinic);
    const person = DB.personById(a.who);
    const needPre = a.preconsulta && !app.preDone[a.id];
    const preReady = a.preconsulta && app.preDone[a.id];

    return (
      <div className="scroll">
        <TopBar title="Detalle de la cita" onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          {/* hero */}
          <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <DocAvatar doctor={doc} size={68} style={{ margin: '0 auto' }} />
            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', color: 'var(--fg-strong)' }}>{doc.name}</h2>
            <div className="muted" style={{ fontSize: 'var(--t-14)' }}>{doc.specName}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
              <Pill tone="green" dot>{a.status === 'confirmada' ? 'Confirmada' : a.status}</Pill>
              {modePillStatic(a.mode)}
            </div>
          </div>

          {/* who / when / where */}
          <div className="card" style={{ marginTop: 14, padding: 0 }}>
            <Row icon="user" k="Paciente" v={person.name + (person.rel !== 'Titular' ? ' · ' + person.rel : '')} />
            <Row icon="calendar" k="Fecha" v={a.day} />
            <Row icon="clock" k="Hora" v={a.time + ' h'} />
            <Row icon={a.mode === 'video' ? 'video' : 'map-pin'} k={a.mode === 'video' ? 'Modalidad' : 'Lugar'} v={a.mode === 'video' ? 'Videoconsulta' : clinic.name} sub={a.mode === 'video' ? 'Reciba el enlace 10 min antes' : clinic.zone} last />
          </div>

          {/* pre-consulta status */}
          {a.preconsulta && (
            <div className="card" style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'center', background: needPre ? 'var(--sd-alert-100)' : 'var(--sd-vital-100)', borderColor: 'transparent' }}>
              <IconTile name={needPre ? 'clipboard' : 'check-circle'} color={needPre ? '#C7811C' : '#198754'} bg="#fff" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: needPre ? 'var(--sd-alert-600)' : 'var(--sd-vital-600)' }}>{needPre ? 'Pre-consulta pendiente' : 'Pre-consulta enviada'}</div>
                <div style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', marginTop: 2, lineHeight: 1.4 }}>{needPre ? 'Cuéntele al doctor sus síntomas antes de llegar. Toma 2 minutos.' : 'El doctor ya tiene su información. Gracias.'}</div>
              </div>
              {needPre && <Btn variant="navy" onClick={() => go('preconsulta', { apptId: a.id })} style={{ height: 40, padding: '0 14px' }}>Llenar</Btn>}
            </div>
          )}

          {/* actions */}
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {a.mode === 'video' && <Btn variant="primary" size="lg" block icon="video" onClick={() => go('video', { apptId: a.id })}>Entrar a la videoconsulta</Btn>}
            {a.mode !== 'video' && <Btn variant="primary" size="lg" block icon="map" onClick={() => go('ruta', { apptId: a.id })}>Cómo llegar</Btn>}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" block icon="message" onClick={() => { const c = DB.chats.find(c => c.doctor === a.doctor); go('chat', { id: c ? c.id : DB.chats[0].id }); }}>Escribir</Btn>
              <Btn variant="ghost" block icon="calendar" onClick={() => go('agendar')}>Reagendar</Btn>
            </div>
            <button className="focusable" onClick={back} style={{ marginTop: 4, color: 'var(--sd-critical-600)', fontWeight: 600, fontSize: 'var(--t-14)', padding: 10 }}>Cancelar cita</button>
          </div>
        </div>
      </div>
    );
  }

  function modePillStatic(mode) {
    return mode === 'video'
      ? <Pill tone="blue"><Icon name="video" size={13} color="currentColor" />Video</Pill>
      : <Pill tone="gray"><Icon name="map-pin" size={13} color="currentColor" />Presencial</Pill>;
  }

  function Row({ icon, k, v, sub, last }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--border-soft)' }}>
        <Icon name={icon} size={20} color="var(--sd-blue-600)" />
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 'var(--t-12)' }}>{k}</div>
          <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)', marginTop: 1 }}>{v}</div>
          {sub && <div className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
    );
  }

  window.CitasScreen = CitasScreen;
  window.CitaDetail = CitaDetail;
})();
