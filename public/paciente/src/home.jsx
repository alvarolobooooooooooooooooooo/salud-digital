// home.jsx — Inicio: "Tu día de salud"
(function () {
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, SectionTitle, Btn, Ring, IconTile } = window;

  const pendingMeta = {
    result: { icon: 'flask', color: '#0080B0', bg: 'var(--sd-blue-100)' },
    pre:    { icon: 'clipboard', color: '#C7811C', bg: 'var(--sd-alert-100)' },
    med:    { icon: 'pill', color: '#198754', bg: 'var(--sd-vital-100)' },
  };

  function HomeScreen() {
    const app = window.useApp();
    const { DB, pending, totalMeds, takenCount, go } = app;
    const me = DB.personById('ana');
    const adherence = totalMeds ? takenCount / totalMeds : 1;
    const nextAppt = app.appts[0];
    const doc = nextAppt && DB.doctorById(nextAppt.doctor);
    const apptPerson = nextAppt && DB.personById(nextAppt.who);

    const quick = [
      { icon: 'calendar-plus', label: 'Agendar', color: '#0080B0', bg: 'var(--sd-blue-100)', onClick: () => go('agendar') },
      { icon: 'heart-pulse', label: 'Mi salud', color: '#C2362C', bg: 'var(--sd-critical-100)', onClick: () => app.setTab('salud') },
      { icon: 'message', label: 'Chat', color: '#198754', bg: 'var(--sd-vital-100)', onClick: () => app.setTab('chat') },
      { icon: 'file-text', label: 'Recetas', color: '#103A78', bg: 'var(--sd-blue-100)', onClick: () => app.setTab('salud') },
    ];

    return (
      <div className="scroll" style={{ background: 'var(--bg-app)' }}>
        {/* greeting header */}
        <div style={{ padding: '54px 20px 18px', background: 'linear-gradient(180deg, #fff, var(--sd-blue-50))', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="muted" style={{ fontSize: 'var(--t-13)', fontWeight: 500 }}>Jueves, 8 de mayo</div>
              <h1 style={{ margin: '2px 0 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-28)', letterSpacing: 'var(--ls-tight)', color: 'var(--sd-navy-700)' }}>Buenos días, Ana</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="focusable" onClick={() => go('notificaciones')} aria-label="Avisos" style={{ width: 42, height: 42, borderRadius: 999, background: '#fff', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', position: 'relative' }}>
                <Icon name="bell" size={20} color="var(--sd-navy-700)" />
                <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 999, background: 'var(--sd-critical-500)', border: '2px solid #fff' }} />
              </button>
              <button className="focusable" onClick={() => app.setTab('perfil')} aria-label="Perfil"><Avatar person={me} size={42} /></button>
            </div>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 18, paddingBottom: 28 }}>
          {/* día de salud card */}
          <div className="card rise" style={{ padding: 0, overflow: 'hidden', borderColor: 'transparent', background: 'linear-gradient(155deg, var(--sd-navy-700), var(--sd-navy-800))', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 22px' }}>
              <Ring value={adherence} size={86} stroke={9} color="var(--sd-blue-300)" track="rgba(255,255,255,0.16)">
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-20)', color: '#fff', lineHeight: 1 }}>{takenCount}/{totalMeds}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sd-blue-300)', marginTop: 3 }}>tomas</div>
              </Ring>
              <div style={{ flex: 1 }}>
                <div className="eyebrow" style={{ color: 'var(--sd-blue-300)' }}>Tu día de salud</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-20)', marginTop: 4, lineHeight: 1.2 }}>
                  {pending.length ? `${pending.length} ${pending.length === 1 ? 'cosa' : 'cosas'} por hacer` : 'Todo al día'}
                </div>
                <div style={{ fontSize: 'var(--t-13)', color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 1.45 }}>
                  {pending.length ? 'Aquí está lo importante de hoy para usted y su familia.' : 'No tiene pendientes. Que tenga un buen día.'}
                </div>
              </div>
            </div>
          </div>

          {/* pending list */}
          {pending.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <SectionTitle>Para hoy</SectionTitle>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {pending.slice(0, 4).map((p, i) => {
                  const m = pendingMeta[p.kind];
                  const person = DB.personById(p.who);
                  return (
                    <button key={p.kind + p.id} className="row focusable rise" style={{ animationDelay: (i * 40) + 'ms' }}
                      onClick={() => {
                        if (p.kind === 'result') go('resultado', { id: p.id });
                        else if (p.kind === 'pre') go('preconsulta', { apptId: p.id });
                        else if (p.kind === 'med') go('medicamento', { id: p.id });
                      }}>
                      <IconTile name={m.icon} color={m.color} bg={m.bg} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                        <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>
                          {person.short}{p.sub ? ' · ' + p.sub : ''}
                        </div>
                      </div>
                      <Icon name="chevron-right" size={20} color="var(--sd-ink-300)" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* next appointment */}
          {nextAppt && (
            <div style={{ marginTop: 22 }}>
              <SectionTitle action="Ver todas" onAction={() => app.setTab('citas')}>Próxima cita</SectionTitle>
              <button className="card selectable rise" onClick={() => go('cita', { apptId: nextAppt.id })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <DocAvatar doctor={doc} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{doc.name}</div>
                    <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{doc.specName} · {apptPerson.rel === 'Titular' ? 'Para usted' : 'Para ' + apptPerson.short}</div>
                  </div>
                  {nextAppt.mode === 'video' && <Pill tone="blue"><Icon name="video" size={13} color="currentColor" />Video</Pill>}
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid var(--border-soft)', background: 'var(--sd-blue-50)' }}>
                  <div style={{ flex: 1, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="calendar" size={16} color="var(--sd-blue-600)" />
                    <span style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--sd-navy-700)' }}>{nextAppt.day}</span>
                  </div>
                  <div style={{ width: 1, background: 'var(--border-soft)' }} />
                  <div style={{ flex: 1, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="clock" size={16} color="var(--sd-blue-600)" />
                    <span style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--sd-navy-700)' }}>{nextAppt.time}</span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* quick actions */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {quick.map(q => (
                <button key={q.label} className="focusable" onClick={q.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <IconTile name={q.icon} color={q.color} bg={q.bg} size={58} iconSize={24} radius={16} />
                  <span style={{ fontSize: 'var(--t-12)', fontWeight: 600, color: 'var(--fg-default)' }}>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* family strip */}
          <div style={{ marginTop: 26 }}>
            <SectionTitle action="Gestionar" onAction={() => app.setTab('perfil')}>Mi familia</SectionTitle>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {DB.family.map(p => (
                <button key={p.id} className="focusable" onClick={() => go('familiar', { id: p.id })} style={{ flex: '0 0 auto', width: 96, background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Avatar person={p} size={48} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-strong)', lineHeight: 1.1 }}>{p.short}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{p.rel}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* gentle wellness note (restrained, human) */}
          <div className="card" style={{ marginTop: 22, background: 'var(--sd-vital-100)', borderColor: 'transparent', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <IconTile name="leaf" color="#198754" bg="#fff" size={40} iconSize={20} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--sd-vital-600)', fontSize: 'var(--t-14)' }}>Recordatorio amable</div>
              <div style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', marginTop: 3, lineHeight: 1.5 }}>Doña Carmen registró su presión esta mañana. Tomar agua y caminar 20 minutos le ayuda a mantenerla estable.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.HomeScreen = HomeScreen;
})();
