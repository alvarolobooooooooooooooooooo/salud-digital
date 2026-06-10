// web/citas.jsx — Citas (desktop): upcoming cards + history table
(function () {
  const Icon = window.Icon;
  const { DocAvatar, Pill, Btn, IconTile } = window;

  function WebCitas() {
    const app = window.useApp();
    const web = window.useWeb();
    const { DB, go } = app;
    const filter = (who) => web.person === 'all' || web.person === who;
    const appts = app.appts.filter(a => filter(a.who));
    const past = DB.past.filter(p => filter(p.who));

    return (
      <div className="web-scroll">
        <div className="web-page">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="web-h">Próximas citas</h3>
            <Btn variant="primary" icon="calendar-plus" onClick={() => go('agendar')}>Agendar cita</Btn>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 32 }}>
            {appts.map(a => {
              const doc = DB.doctorById(a.doctor); const person = DB.personById(a.who);
              const needPre = a.preconsulta && !app.preDone[a.id];
              return (
                <button key={a.id} className="wcard lift" style={{ padding: 0, overflow: 'hidden', textAlign: 'left' }} onClick={() => go('cita', { apptId: a.id })}>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ width: 84, background: 'var(--sd-blue-50)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-soft)' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', color: 'var(--sd-navy-700)', lineHeight: 1 }}>{a.day.split(' ')[1]}</div>
                      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{a.day.split(' ')[2]}</div>
                      <div style={{ marginTop: 8, fontSize: 'var(--t-13)', fontWeight: 700, color: 'var(--sd-blue-600)' }}>{a.time}</div>
                    </div>
                    <div style={{ flex: 1, padding: '18px 20px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <DocAvatar doctor={doc} size={44} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                          <div className="muted" style={{ fontSize: 'var(--t-13)' }}>{doc.specName} · {person.short}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {a.mode === 'video' ? <Pill tone="blue"><Icon name="video" size={12} color="currentColor" />Video</Pill> : <Pill tone="gray"><Icon name="map-pin" size={12} color="currentColor" />Presencial</Pill>}
                        {needPre && <Pill tone="amber"><Icon name="clipboard" size={12} color="currentColor" />Pre-consulta</Pill>}
                        {!needPre && a.preconsulta && <Pill tone="green" dot>Listo</Pill>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {appts.length === 0 && <div className="wcard muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32 }}>No hay citas próximas para esta vista.</div>}
          </div>

          <h3 className="web-h" style={{ marginBottom: 16 }}>Historial</h3>
          <div className="wcard wcard-flush">
            <table className="wtable">
              <thead><tr><th>Fecha</th><th>Especialidad</th><th>Médico</th><th>Paciente</th><th>Modalidad</th><th></th></tr></thead>
              <tbody>
                {past.map(p => {
                  const doc = DB.doctorById(p.doctor); const person = DB.personById(p.who);
                  return (
                    <tr key={p.id} onClick={() => { const s = DB.resumenes.find(s => s.who === p.who); if (s) go('resumen', { id: s.id }); }}>
                      <td style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{p.day}</td>
                      <td>{p.specName}</td>
                      <td>{doc.name}</td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><window.Avatar person={person} size={24} />{person.short}</span></td>
                      <td><span className="muted">{p.mode === 'video' ? 'Videoconsulta' : 'Presencial'}</span></td>
                      <td style={{ textAlign: 'right' }}><Icon name="chevron-right" size={18} color="var(--sd-ink-300)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  window.WebCitas = WebCitas;
})();
