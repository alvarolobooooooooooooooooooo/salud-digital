// web/dashboard.jsx — Inicio (desktop)
(function () {
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, Btn, Ring, IconTile } = window;

  const pmeta = {
    result: { icon: 'flask', color: '#0080B0', bg: 'var(--sd-blue-100)' },
    pre: { icon: 'clipboard', color: '#C7811C', bg: 'var(--sd-alert-100)' },
    med: { icon: 'pill', color: '#198754', bg: 'var(--sd-vital-100)' },
  };

  function WebDashboard() {
    const app = window.useApp();
    const web = window.useWeb();
    const { DB, go } = app;
    const filter = (who) => web.person === 'all' || web.person === who;

    const pending = app.pending.filter(p => filter(p.who));
    const appts = app.appts.filter(a => filter(a.who));
    const next = appts[0];
    const doc = next && DB.doctorById(next.doctor);
    const nextP = next && DB.personById(next.who);
    const meds = DB.meds.filter(m => filter(m.who));
    const takenCount = meds.filter(m => app.taken[m.id]).length;
    const adherence = meds.length ? takenCount / meds.length : 1;
    const pendFac = app.facturas.filter(f => f.status === 'pendiente' && filter(f.who));
    const totalPend = pendFac.reduce((s, f) => s + f.amount, 0);
    const diary = app.diary.filter(d => filter(d.who)).slice(0, 4);

    return (
      <div className="web-scroll">
        <div className="web-page">
          {/* greeting hero */}
          <div className="wcard rise" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 0, overflow: 'hidden', border: 'none', background: 'linear-gradient(120deg, var(--sd-navy-700), var(--sd-navy-800))', color: '#fff', marginBottom: 22 }}>
            <div style={{ flex: 1, padding: '28px 0 28px 30px' }}>
              <div className="eyebrow" style={{ color: 'var(--sd-blue-300)' }}>Jueves, 8 de mayo</div>
              <h2 style={{ margin: '6px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-32)', letterSpacing: 'var(--ls-tight)' }}>Buenos días, Ana</h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: 'var(--t-15)', maxWidth: 520, lineHeight: 1.5 }}>
                {pending.length ? `Tiene ${pending.length} ${pending.length === 1 ? 'cosa' : 'cosas'} por atender hoy para ${web.person === 'all' ? 'usted y su familia' : DB.personById(web.person).short}.` : 'No tiene pendientes para hoy. Que tenga un buen día.'}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--sd-navy-700)' }} onClick={() => go('agendar')}><Icon name="calendar-plus" size={18} color="currentColor" />Agendar cita</button>
                <button className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }} onClick={() => app.setTab('chat')}><Icon name="message" size={18} color="currentColor" />Escribir a mi médico</button>
              </div>
            </div>
            <div style={{ padding: '0 36px 0 0', display: 'flex', alignItems: 'center', gap: 18 }}>
              <Ring value={adherence} size={120} stroke={11} color="var(--sd-blue-300)" track="rgba(255,255,255,0.16)">
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', color: '#fff', lineHeight: 1 }}>{takenCount}/{meds.length}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sd-blue-300)', marginTop: 4 }}>tomas hoy</div>
              </Ring>
            </div>
          </div>

          {/* stat row */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 22 }}>
            <button className="wcard lift stat rise s1" style={{ textAlign: 'left' }} onClick={() => next ? go('cita', { apptId: next.id }) : go('agendar')}>
              <IconTile name="calendar-check" color="#0080B0" bg="var(--sd-blue-100)" size={52} iconSize={26} radius={14} />
              <div>
                <div className="muted" style={{ fontSize: 'var(--t-13)' }}>Próxima cita</div>
                <div className="num" style={{ fontSize: 'var(--t-20)', marginTop: 3 }}>{next ? next.day.replace(/^\w+\s/, '') + ' · ' + next.time : 'Agendar'}</div>
                {next && <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{doc.specName} · {nextP.short}</div>}
              </div>
            </button>
            <button className="wcard lift stat rise s2" style={{ textAlign: 'left' }} onClick={() => app.setTab('salud')}>
              <IconTile name="heart-pulse" color="#198754" bg="var(--sd-vital-100)" size={52} iconSize={26} radius={14} />
              <div>
                <div className="muted" style={{ fontSize: 'var(--t-13)' }}>Tomas de hoy</div>
                <div className="num" style={{ marginTop: 3 }}>{takenCount}<span className="muted" style={{ fontSize: 'var(--t-18)', fontWeight: 600 }}>/{meds.length}</span></div>
                <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{takenCount === meds.length ? 'Todo al día' : (meds.length - takenCount) + ' pendientes'}</div>
              </div>
            </button>
            <button className="wcard lift stat rise s3" style={{ textAlign: 'left' }} onClick={() => app.setTab('facturas')}>
              <IconTile name="receipt" color={totalPend ? '#C7811C' : '#198754'} bg={totalPend ? 'var(--sd-alert-100)' : 'var(--sd-vital-100)'} size={52} iconSize={26} radius={14} />
              <div>
                <div className="muted" style={{ fontSize: 'var(--t-13)' }}>Por pagar</div>
                <div className="num t-mono" style={{ marginTop: 3, color: totalPend ? 'var(--sd-alert-600)' : 'var(--fg-strong)' }}>{DB.L(totalPend)}</div>
                <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{pendFac.length ? pendFac.length + ' factura' + (pendFac.length > 1 ? 's' : '') : 'Sin pendientes'}</div>
              </div>
            </button>
          </div>

          {/* two columns */}
          <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
            {/* left */}
            <div className="grid">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 className="web-h">Para hoy</h3>
                  <span className="web-chip">{pending.length} pendientes</span>
                </div>
                <div className="wcard wcard-flush">
                  {pending.length === 0 && <div style={{ padding: 28, textAlign: 'center' }} className="muted">Sin pendientes. Todo en orden.</div>}
                  {pending.map((p, i) => {
                    const m = pmeta[p.kind]; const person = DB.personById(p.who);
                    return (
                      <button key={p.kind + p.id} className="wrow" onClick={() => {
                        if (p.kind === 'result') go('resultado', { id: p.id });
                        else if (p.kind === 'pre') go('preconsulta', { apptId: p.id });
                        else go('medicamento', { id: p.id });
                      }}>
                        <IconTile name={m.icon} color={m.color} bg={m.bg} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-15)' }}>{p.title}</div>
                          <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{person.short}{p.sub ? ' · ' + p.sub : ''}</div>
                        </div>
                        <span className="web-chip" style={{ background: 'transparent', color: 'var(--sd-blue-600)' }}>Abrir<Icon name="arrow-right" size={15} color="currentColor" /></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* próxima cita big */}
              {next && (
                <div>
                  <h3 className="web-h" style={{ marginBottom: 12 }}>Próxima cita</h3>
                  <div className="wcard" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 16, padding: 22, alignItems: 'center' }}>
                      <DocAvatar doctor={doc} size={60} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)' }}>{doc.name}</div>
                        <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 2 }}>{doc.specName} · {nextP.rel === 'Titular' ? 'Para usted' : 'Para ' + nextP.short}</div>
                      </div>
                      {next.mode === 'video' ? <Pill tone="blue"><Icon name="video" size={13} color="currentColor" />Videoconsulta</Pill> : <Pill tone="gray"><Icon name="map-pin" size={13} color="currentColor" />Presencial</Pill>}
                    </div>
                    <div style={{ display: 'flex', borderTop: '1px solid var(--border-soft)', background: 'var(--sd-blue-50)' }}>
                      <Meta icon="calendar" v={next.day} />
                      <Meta icon="clock" v={next.time + ' h'} />
                      <Meta icon={next.mode === 'video' ? 'video' : 'map-pin'} v={next.mode === 'video' ? 'En línea' : DB.clinicById(next.clinic).name.split(' ').slice(-2).join(' ')} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, padding: 18 }}>
                      {next.mode === 'video'
                        ? <Btn variant="primary" icon="video" onClick={() => go('video', { apptId: next.id })}>Entrar a la consulta</Btn>
                        : <Btn variant="primary" icon="map" onClick={() => go('ruta', { apptId: next.id })}>Cómo llegar</Btn>}
                      <Btn variant="ghost" icon="message" onClick={() => app.setTab('chat')}>Escribir</Btn>
                      <Btn variant="ghost" onClick={() => go('cita', { apptId: next.id })}>Ver detalle</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* right */}
            <div className="grid">
              {/* medicamentos hoy */}
              <div>
                <h3 className="web-h" style={{ marginBottom: 12 }}>Medicamentos de hoy</h3>
                <div className="wcard wcard-flush">
                  {meds.map(m => {
                    const taken = app.taken[m.id]; const person = DB.personById(m.who);
                    return (
                      <div key={m.id} className="wrow" style={{ cursor: 'default' }}>
                        <span style={{ width: 44, height: 44, borderRadius: 12, background: m.color + '1A', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={22} color={m.color} /></span>
                        <button onClick={() => go('medicamento', { id: m.id })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none' }}>
                          <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{m.name} <span className="muted" style={{ fontWeight: 500 }}>{m.dose}</span></div>
                          <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{person.short} · {m.schedule}</div>
                        </button>
                        <button onClick={() => app.actions.toggleMed(m.id)} aria-label="Marcar"><span className={'check' + (taken ? ' on' : '')}>{taken && <Icon name="check" size={16} color="#fff" strokeWidth={2.6} />}</span></button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* diario */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 className="web-h">Diario de salud</h3>
                  <button onClick={() => app.setTab('salud')} style={{ color: 'var(--sd-blue-600)', fontWeight: 600, fontSize: 'var(--t-13)', background: 'none' }}>Ver todo</button>
                </div>
                <div className="wcard wcard-flush">
                  {diary.map(d => {
                    const person = DB.personById(d.who);
                    return (
                      <div key={d.id} className="wrow" style={{ cursor: 'default' }}>
                        <IconTile name={d.icon} color={d.color} bg="var(--bg-subtle)" size={40} iconSize={20} />
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{d.label}</div><div className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 1 }}>{person.short} · {d.date}</div></div>
                        <div className="t-mono" style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{d.value}<span className="muted" style={{ fontSize: 'var(--t-12)', marginLeft: 3 }}>{d.u}</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* wellness note */}
              <div className="wcard" style={{ background: 'var(--sd-vital-100)', borderColor: 'transparent', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <IconTile name="leaf" color="#198754" bg="#fff" size={42} iconSize={21} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--sd-vital-600)', fontSize: 'var(--t-14)' }}>Recordatorio amable</div>
                  <div style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', marginTop: 3, lineHeight: 1.5 }}>Doña Carmen registró su presión esta mañana. Tomar agua y caminar 20 minutos le ayuda a mantenerla estable.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Meta({ icon, v }) {
    return (
      <div style={{ flex: 1, padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 9, borderRight: '1px solid var(--border-soft)' }}>
        <Icon name={icon} size={16} color="var(--sd-blue-600)" />
        <span style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--sd-navy-700)' }}>{v}</span>
      </div>
    );
  }

  window.WebDashboard = WebDashboard;
})();
