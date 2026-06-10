// salud_detail.jsx — Resultado, Receta, Resumen, Medicamento detail screens
(function () {
  const { useEffect } = React;
  const Icon = window.Icon;
  const { DocAvatar, Pill, Btn, TopBar, IconTile, Ring } = window;

  const flagColor = { ok: '#198754', high: '#C2362C', low: '#C7811C' };
  const flagLabel = { ok: 'Normal', high: 'Alto', low: 'Bajo' };

  function ResultadoDetail() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const r = DB.results.find(x => x.id === cur.params.id);
    useEffect(() => { if (r) app.actions.markRead(r.id); }, []);
    if (!r) return <div className="scroll"><TopBar title="Resultado" onBack={back} /></div>;
    const doc = DB.doctorById(r.sharedBy);
    const person = DB.personById(r.who);

    return (
      <div className="scroll">
        <TopBar title={r.title} onBack={back} trailing={
          <button className="focusable" aria-label="Descargar" style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center' }}><Icon name="download" size={20} color="var(--sd-navy-700)" /></button>} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Pill tone="gray"><Icon name="user" size={13} color="currentColor" />{person.name}</Pill>
            <Pill tone="gray">{r.lab}</Pill>
            <span className="muted" style={{ fontSize: 'var(--t-13)', marginLeft: 'auto' }}>{r.date}</span>
          </div>

          {/* doctor's note — the human layer */}
          <div className="card" style={{ background: 'var(--sd-blue-50)', borderColor: 'transparent', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <DocAvatar doctor={doc} size={40} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>Nota de {doc.name}</div>
                <div className="muted" style={{ fontSize: 'var(--t-12)' }}>{doc.specName}</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{r.note}</p>
          </div>

          {/* values */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', fontFamily: 'var(--font-display)' }}>Valores</span>
              <span className="muted" style={{ fontSize: 'var(--t-12)' }}>Referencia</span>
            </div>
            {r.items.map((it, i) => (
              <div key={it.k} style={{ padding: '14px 18px', borderBottom: i < r.items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 'var(--t-14)', color: 'var(--fg-default)' }}>{it.k}</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="t-mono" style={{ fontWeight: 700, fontSize: 'var(--t-16)', color: flagColor[it.flag] }}>{it.v}</span>
                    <span className="muted t-mono" style={{ fontSize: 'var(--t-12)' }}>{it.u}</span>
                  </span>
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

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <Btn variant="primary" block icon="message" onClick={() => { const c = DB.chats.find(c => c.doctor === r.sharedBy); app.go('chat', { id: c ? c.id : DB.chats[0].id }); }}>Preguntar al médico</Btn>
          </div>
          <p className="muted" style={{ fontSize: 'var(--t-12)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>Documento compartido por su médico. El expediente original es resguardado por la clínica.</p>
        </div>
      </div>
    );
  }

  function RecetaDetail() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const rx = DB.recetas.find(x => x.id === cur.params.id);
    if (!rx) return <div className="scroll"><TopBar title="Receta" onBack={back} /></div>;
    const doc = DB.doctorById(rx.doctor);
    const person = DB.personById(rx.who);
    return (
      <div className="scroll">
        <TopBar title="Receta médica" onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <DocAvatar doctor={doc} size={48} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{doc.name}</div>
                <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{doc.specName} · {rx.date}</div>
              </div>
            </div>
            <div style={{ padding: '12px 18px', background: 'var(--sd-blue-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)' }}>
              <span className="muted" style={{ fontSize: 'var(--t-13)' }}>Paciente: <strong style={{ color: 'var(--fg-strong)' }}>{person.name}</strong></span>
              <span className="t-mono" style={{ fontSize: 'var(--t-12)', color: 'var(--fg-muted)' }}>{rx.folio}</span>
            </div>
            {rx.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: 18, borderBottom: i < rx.items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--sd-blue-100)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="pill" size={20} color="#0080B0" /></span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{it.name}</div>
                  <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 3, lineHeight: 1.45 }}>{it.instr}</div>
                </div>
              </div>
            ))}
          </div>

          {/* QR for pharmacy */}
          <div className="card" style={{ marginTop: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 12, background: '#fff', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="qr" size={40} color="var(--sd-navy-700)" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>Muestre este código en la farmacia</div>
              <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2, lineHeight: 1.45 }}>Receta verificada con firma digital del médico.</div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <Btn variant="ghost" block icon="download">Descargar</Btn>
            <Btn variant="ghost" block icon="share">Compartir</Btn>
          </div>
        </div>
      </div>
    );
  }

  function ResumenDetail() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const s = DB.resumenes.find(x => x.id === cur.params.id);
    if (!s) return <div className="scroll"><TopBar title="Resumen" onBack={back} /></div>;
    const doc = DB.doctorById(s.doctor);
    const person = DB.personById(s.who);
    const Block = ({ icon, title, children }) => (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name={icon} size={18} color="var(--sd-blue-600)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{title}</span>
        </div>
        {children}
      </div>
    );
    return (
      <div className="scroll">
        <TopBar title="Resumen de visita" subtitle={s.specName + ' · ' + s.date} onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <DocAvatar doctor={doc} size={44} />
            <div><div style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{doc.name}</div>
            <div className="muted" style={{ fontSize: 'var(--t-13)' }}>Paciente: {person.name}</div></div>
          </div>
          <Block icon="message" title="Motivo de consulta"><p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{s.motivo}</p></Block>
          <Block icon="stethoscope" title="Hallazgos"><p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--sd-ink-700)', lineHeight: 1.55 }}>{s.hallazgos}</p></Block>
          <Block icon="clipboard" title="Indicaciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.indicaciones.map((x, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="check-circle" size={18} color="var(--sd-vital-500)" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.5 }}>{x}</span>
                </div>
              ))}
            </div>
          </Block>
          <div className="card" style={{ background: 'var(--sd-blue-50)', borderColor: 'transparent', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name="calendar-check" size={20} color="var(--sd-blue-600)" />
            <span style={{ fontSize: 'var(--t-14)', color: 'var(--sd-ink-700)', lineHeight: 1.45 }}>{s.proxima}</span>
          </div>
        </div>
      </div>
    );
  }

  function MedicamentoDetail() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const m = DB.meds.find(x => x.id === cur.params.id);
    if (!m) return <div className="scroll"><TopBar title="Medicamento" onBack={back} /></div>;
    const taken = app.taken[m.id];
    const doc = DB.doctorById(m.doctor);
    const person = DB.personById(m.who);
    const progress = (m.of - m.left) / m.of;
    return (
      <div className="scroll">
        <TopBar title={m.name} subtitle={person.name} onBack={back} />
        <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
          {/* hero */}
          <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <span style={{ width: 72, height: 72, borderRadius: 20, background: m.color + '1A', display: 'inline-grid', placeItems: 'center' }}><Icon name="pill" size={36} color={m.color} /></span>
            <h2 style={{ margin: '14px 0 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-24)', color: 'var(--fg-strong)' }}>{m.name} {m.dose}</h2>
            <div className="muted" style={{ fontSize: 'var(--t-14)' }}>{m.form} · {m.schedule}</div>
          </div>

          {/* take action */}
          <button className="focusable" onClick={() => app.actions.toggleMed(m.id)} style={{
            width: '100%', marginTop: 14, padding: 18, borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 14,
            background: taken ? 'var(--sd-vital-100)' : '#fff', border: '1px solid ' + (taken ? 'var(--sd-vital-500)' : 'var(--border-default)'),
          }}>
            <span className={'check' + (taken ? ' on' : '')} style={{ width: 32, height: 32 }}>{taken && <Icon name="check" size={20} color="#fff" strokeWidth={2.6} />}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--t-15)', color: taken ? 'var(--sd-vital-600)' : 'var(--fg-strong)' }}>{taken ? 'Tomado hoy' : 'Marcar como tomado'}</div>
              <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 1 }}>{taken ? 'Buen trabajo. Siguiente toma mañana ' + m.times[0] : 'Toca aquí cuando lo tome'}</div>
            </div>
          </button>

          {/* progress */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="kv" style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', fontFamily: 'var(--font-display)' }}>Tratamiento</span>
              <span className="muted" style={{ fontSize: 'var(--t-13)' }}>Quedan <strong style={{ color: 'var(--fg-strong)' }}>{m.left}</strong> de {m.of}</span>
            </div>
            <div className="track"><i style={{ width: (progress * 100) + '%', background: m.color }} /></div>
          </div>

          {/* info */}
          <div className="card" style={{ marginTop: 14, padding: 0 }}>
            <InfoRow icon="heart-pulse" k="Para" v={m.reason} />
            <InfoRow icon="stethoscope" k="Indicado por" v={doc.name} />
            <InfoRow icon="bell" k="Recordatorio" v={'Activo · ' + m.schedule.split('· ')[1]} last />
          </div>

          <div style={{ marginTop: 18 }}>
            <Btn variant="ghost" block icon="message" onClick={() => { const c = DB.chats.find(c => c.doctor === m.doctor); app.go('chat', { id: c ? c.id : DB.chats[0].id }); }}>Consultar al médico</Btn>
          </div>
        </div>
      </div>
    );
  }

  function InfoRow({ icon, k, v, last }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--border-soft)' }}>
        <Icon name={icon} size={20} color="var(--sd-blue-600)" />
        <span className="muted" style={{ fontSize: 'var(--t-14)' }}>{k}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{v}</span>
      </div>
    );
  }

  Object.assign(window, { ResultadoDetail, RecetaDetail, ResumenDetail, MedicamentoDetail });
})();
