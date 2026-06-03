// ============================================================
// App principal — mensajería clínica conectada a la API real
// 3 zonas (lista · hilo · ficha) dentro del shell de Salud Digital.
// Polling cada 5 s para tiempo casi-real.
// ============================================================
const { useState: useS, useRef: useR, useEffect: useE } = React;
const { fmtListTime, dayLabel, dateKey, roleLabel, colorForId, initialsOf } = window.chatHelpers;

// ---- Lista de conversaciones ----
function ConversationList({ convs, activeId, onSelect, filter, setFilter, query, setQuery, onNew }) {
  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'urgentes', label: 'Urgentes', icon: 'alert-triangle' },
    { id: 'directos', label: 'Directos' },
    { id: 'casos', label: 'Casos' },
  ];
  const visible = convs.filter(c => {
    if (query && !(c.title || '').toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'urgentes') return c.urgent;
    if (filter === 'directos') return c.group === 'directos';
    if (filter === 'casos') return c.group === 'casos';
    return true;
  });
  return (
    <div className="sd-list">
      <div className="sd-list-head">
        <div className="sd-list-titlerow">
          <div className="sd-list-title">Mensajes</div>
          <button className="sd-iconbtn primary" title="Nueva conversación" onClick={onNew}><Icon name="edit" size={17} /></button>
        </div>
        <div className="sd-search">
          <span className="sd-search-ic"><Icon name="search" size={16} /></span>
          <input placeholder="Buscar médico, equipo o paciente" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="sd-filters">
        {filters.map(f => (
          <button key={f.id} className={'sd-filter' + (filter === f.id ? ' active' : '')} onClick={() => setFilter(f.id)}>
            {f.icon && <Icon name={f.icon} size={12} stroke={2.2} />}{f.label}
          </button>
        ))}
      </div>
      <div className="sd-list-scroll sd-scroll">
        {window.GROUPS.map(g => {
          const items = visible.filter(c => c.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id}>
              <div className="sd-group-label"><Icon name={g.icon} size={13} />{g.label}</div>
              {items.map(c => (
                <div key={c.id} className={'sd-conv' + (c.id === activeId ? ' active' : '') + (c.unread ? ' unread' : '')} onClick={() => onSelect(c.id)}>
                  <GroupAvatar conv={c} size={42} />
                  <div className="sd-conv-body">
                    <div className="sd-conv-row1">
                      {c.urgent && <span className="sd-conv-urgentdot" title="Urgente" />}
                      <span className="sd-conv-name">{c.title}</span>
                      <span className="sd-conv-time">{fmtListTime(c.time)}</span>
                    </div>
                    <div className="sd-conv-row1" style={{ marginTop: 2 }}>
                      <span className="sd-conv-prev">{c.preview || 'Sin mensajes aún'}</span>
                      {c.unread > 0 && <span className={'sd-conv-badge' + (c.urgent ? ' urgent' : '')}>{c.unread}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="sd-list-empty">
            <Icon name="message-square" size={30} style={{ color: 'var(--sd-ink-300)' }} />
            <div>{convs.length ? 'Sin conversaciones que coincidan.' : 'Aún no tienes conversaciones.'}</div>
            {!convs.length && <button className="sd-btn primary" onClick={onNew}><Icon name="plus" size={16} />Iniciar conversación</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Cabecera del hilo ----
function ThreadHead({ conv, panelOpen, setPanelOpen, onBack, onAction }) {
  return (
    <div className="sd-thread-head">
      <button className="sd-th-act sd-th-back" title="Volver" onClick={onBack}><Icon name="chevron-left" size={20} /></button>
      <GroupAvatar conv={conv} size={40} />
      <div className="sd-th-titlewrap">
        <div className="sd-th-title">
          {conv.title}
          {conv.urgent && <Pill tone="urgent" icon="alert-triangle">Urgente</Pill>}
        </div>
        <div className="sd-th-sub">
          {conv.kind === 'directo' && conv.online
            ? <span style={{ color: 'var(--sd-vital-600)', fontWeight: 600 }}>● En línea</span>
            : <span>{conv.subtitle || (conv.members && conv.members.length ? conv.members.length + ' miembros' : '')}</span>}
          {conv.patientName && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="user" size={12} />{conv.patientName}</span></>}
        </div>
      </div>
      <div className="sd-th-actions">
        <button className="sd-th-act" title="Llamar" onClick={() => onAction('Las llamadas estarán disponibles próximamente.')}><Icon name="phone" size={19} /></button>
        <button className="sd-th-act" title="Videollamada" onClick={() => onAction('La videollamada estará disponible próximamente.')}><Icon name="video" size={19} /></button>
        {conv.patientId && (
          <button className={'sd-th-act' + (panelOpen ? ' active' : '')} title="Ficha del paciente" onClick={() => setPanelOpen(o => !o)}>
            <Icon name="clipboard-list" size={19} />
          </button>
        )}
        <button className="sd-th-act" title="Más" onClick={() => onAction('Más opciones próximamente.')}><Icon name="more-horizontal" size={19} /></button>
      </div>
    </div>
  );
}

// ---- Panel de ficha del paciente (datos reales) ----
function PatientPanel({ patient, loading, onClose }) {
  if (loading || !patient) {
    return (
      <div className="sd-panel">
        <div className="sd-panel-head"><div className="sd-panel-eyebrow"><span className="lbl">Ficha del paciente</span>
          <button className="sd-th-act" style={{ width: 34, height: 34 }} onClick={onClose}><Icon name="chevron-right" size={18} /></button></div></div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}><span className="sd-spinner" /></div>
      </div>
    );
  }
  const meta = [patient.age ? patient.age + ' años' : '', patient.gender].filter(Boolean).join(' · ');
  return (
    <div className="sd-panel">
      <div className="sd-panel-head">
        <div className="sd-panel-eyebrow">
          <span className="lbl">Ficha del paciente</span>
          <button className="sd-th-act" style={{ width: 34, height: 34 }} onClick={onClose}><Icon name="chevron-right" size={18} /></button>
        </div>
        <div className="sd-panel-pname">
          <div className="sd-panel-av">{initialsOf(patient.name)}</div>
          <div>
            <h3>{patient.name}</h3>
            {meta && <div className="meta">{meta}</div>}
            {patient.identity_number && <div className="meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2 }}>{patient.identity_number}</div>}
          </div>
        </div>
      </div>
      <div className="sd-panel-scroll sd-scroll">
        {patient.alerts && patient.alerts.length > 0 && (
          <div className="sd-panel-sec">
            <div className="sd-alert-row"><Icon name="alert-triangle" size={16} stroke={2.2} />{patient.alerts.join(' · ')}</div>
          </div>
        )}
        {patient.motivo && (
          <div className="sd-panel-sec">
            <h4><Icon name="file-text" size={13} />Motivo de consulta</h4>
            <div style={{ fontSize: 13.5, color: 'var(--fg-default)', lineHeight: 1.5 }}>{patient.motivo}</div>
          </div>
        )}
        <div className="sd-panel-sec">
          <h4><Icon name="clipboard-list" size={13} />Padecimientos</h4>
          {patient.conditions && patient.conditions.length
            ? <div className="sd-taglist">{patient.conditions.map(d => <div key={d} className="sd-tagline"><span className="dot" />{d}</div>)}</div>
            : <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Sin registros.</div>}
        </div>
        <div className="sd-panel-sec">
          <h4><Icon name="pill" size={13} />Medicación</h4>
          {patient.medications && patient.medications.length
            ? <div className="sd-taglist">{patient.medications.map(m => <div key={m} className="sd-tagline"><span className="dot" style={{ background: 'var(--sd-vital-500)' }} />{m}</div>)}</div>
            : <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Sin registros.</div>}
        </div>
        {patient.phone && (
          <div className="sd-panel-sec">
            <h4><Icon name="phone" size={13} />Contacto</h4>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{patient.phone}</div>
          </div>
        )}
        {patient.lastVisit && (
          <div className="sd-panel-sec" style={{ borderBottom: 'none' }}>
            <h4><Icon name="clock" size={13} />Última visita</h4>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
              {new Date(patient.lastVisit).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              {patient.lastVisitDoctor ? ' · ' + patient.lastVisitDoctor : ''}
            </div>
          </div>
        )}
      </div>
      <div className="sd-panel-foot">
        <a className="sd-panel-btn primary" href={`/patient.html?id=${patient.id}`}><Icon name="folder" size={17} />Abrir expediente completo</a>
      </div>
    </div>
  );
}

// ---- Modal: nueva conversación ----
function NewConversationModal({ members, meRole, onClose, onCreate }) {
  const kinds = [
    { id: 'directo', label: 'Directo' },
    { id: 'equipo', label: 'Equipo' },
    { id: 'caso', label: 'Caso' },
    { id: 'interconsulta', label: 'Interconsulta' },
  ];
  if (meRole === 'clinic_admin') kinds.push({ id: 'anuncio', label: 'Anuncio' });
  const [kind, setKind] = useS('directo');
  const [selected, setSelected] = useS([]);
  const [title, setTitle] = useS('');
  const [patientQ, setPatientQ] = useS('');
  const [patientResults, setPatientResults] = useS([]);
  const [patient, setPatient] = useS(null);
  const [busy, setBusy] = useS(false);

  const toggleMember = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : (kind === 'directo' ? [id] : [...s, id]));

  useE(() => {
    if (kind === 'directo' && selected.length > 1) setSelected(selected.slice(0, 1));
    // Al salir de caso/interconsulta, limpia la búsqueda de paciente para no arrastrar estado.
    if (kind !== 'caso' && kind !== 'interconsulta') { setPatient(null); setPatientQ(''); setPatientResults([]); }
  }, [kind]);

  const searchPatients = async (q) => {
    setPatientQ(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    try { setPatientResults(await window.ChatAPI.searchPatients(q)); } catch (_) {}
  };

  const needsTitle = kind !== 'directo' && kind !== 'caso';
  const canCreate = kind === 'directo'
    ? selected.length === 1
    : (kind === 'anuncio' ? !!title.trim() : (needsTitle ? !!title.trim() : (!!title.trim() || !!patient)));

  const submit = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await onCreate({
        kind,
        memberIds: kind === 'anuncio' ? [] : selected,
        title: title.trim() || (patient ? patient.name : ''),
        patientId: patient ? patient.id : null,
      });
    } finally { setBusy(false); }
  };

  return (
    <div className="sd-scrim" onClick={onClose}>
      <div className="sd-modal" onClick={e => e.stopPropagation()}>
        <div className="sd-modal-head">
          <div className="ic" style={{ background: 'var(--sd-blue-100)', color: 'var(--fg-link)' }}><Icon name="edit" size={20} /></div>
          <div>
            <h3>Nueva conversación</h3>
            <p>Inicia un mensaje con colegas de tu clínica.</p>
          </div>
          <button className="sd-modal-x" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="sd-modal-body">
          <div className="sd-field">
            <label>Tipo</label>
            <div className="sd-prio">
              {kinds.map(k => (
                <button key={k.id} className={kind === k.id ? 'active baja' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>
          </div>
          {(kind !== 'directo') && (
            <div className="sd-field">
              <label>{kind === 'anuncio' ? 'Título del anuncio' : 'Nombre de la conversación'}{kind === 'caso' ? ' (opcional si eliges paciente)' : ''}</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'caso' ? 'Ej. Caso · seguimiento posquirúrgico' : 'Ej. Cardiología · guardia'} />
            </div>
          )}
          {(kind === 'caso' || kind === 'interconsulta') && (
            <div className="sd-field">
              <label>Paciente {kind === 'caso' ? '' : '(opcional)'}</label>
              {patient ? (
                <div className="sd-picked-patient">
                  <span><Icon name="user" size={14} />{patient.name}{patient.identity_number ? ' · ' + patient.identity_number : ''}</span>
                  <button onClick={() => { setPatient(null); setPatientQ(''); }}><Icon name="x" size={14} /></button>
                </div>
              ) : (
                <>
                  <input value={patientQ} onChange={e => searchPatients(e.target.value)} placeholder="Buscar paciente por nombre o documento" />
                  {patientResults.length > 0 && (
                    <div className="sd-result-list">
                      {patientResults.map(p => (
                        <div key={p.id} className="sd-result-item" onClick={() => { setPatient(p); setPatientResults([]); }}>
                          <div className="sd-result-av">{initialsOf(p.name)}</div>
                          <div><div className="rn">{p.name}</div><div className="rm">{[p.age ? p.age + ' años' : '', p.identity_number].filter(Boolean).join(' · ')}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {kind !== 'anuncio' && (
            <div className="sd-field">
              <label>{kind === 'directo' ? 'Destinatario' : 'Participantes'}</label>
              <div className="sd-member-list">
                {members.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-subtle)', padding: '8px 2px' }}>No hay colegas en tu clínica todavía.</div>}
                {members.map(m => (
                  <div key={m.id} className={'sd-member-item' + (selected.includes(m.id) ? ' selected' : '')} onClick={() => toggleMember(m.id)}>
                    <MemberAvatar member={m} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mn">{m.name}</div>
                      <div className="mr">{m.specialty || roleLabel(m.role)}</div>
                    </div>
                    {selected.includes(m.id) && <Icon name="check" size={16} stroke={2.4} style={{ color: 'var(--sd-blue-600)' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sd-modal-foot">
          <button className="sd-btn ghost" onClick={onClose}>Cancelar</button>
          <button className="sd-btn primary" disabled={!canCreate || busy} onClick={submit}>
            <Icon name="send" size={16} />Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal: adjuntar expediente de paciente ----
function PatientPickerModal({ onClose, onPick }) {
  const [q, setQ] = useS('');
  const [results, setResults] = useS([]);
  const [busy, setBusy] = useS(false);
  const search = async (val) => {
    setQ(val);
    if (val.trim().length < 2) { setResults([]); return; }
    try { setResults(await window.ChatAPI.searchPatients(val)); } catch (_) {}
  };
  const pick = async (p) => {
    if (busy) return;
    setBusy(true);
    try { await onPick(p.id); } finally { setBusy(false); }
  };
  return (
    <div className="sd-scrim" onClick={onClose}>
      <div className="sd-modal" onClick={e => e.stopPropagation()}>
        <div className="sd-modal-head">
          <div className="ic" style={{ background: 'var(--sd-blue-100)', color: 'var(--fg-link)' }}><Icon name="folder" size={20} /></div>
          <div>
            <h3>Adjuntar expediente</h3>
            <p>Comparte la ficha de un paciente en la conversación.</p>
          </div>
          <button className="sd-modal-x" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="sd-modal-body">
          <div className="sd-field">
            <input autoFocus value={q} onChange={e => search(e.target.value)} placeholder="Buscar paciente por nombre o documento" />
          </div>
          <div className="sd-result-list" style={{ maxHeight: 320 }}>
            {results.map(p => (
              <div key={p.id} className="sd-result-item" onClick={() => pick(p)}>
                <div className="sd-result-av">{initialsOf(p.name)}</div>
                <div><div className="rn">{p.name}</div><div className="rm">{[p.age ? p.age + ' años' : '', p.identity_number].filter(Boolean).join(' · ')}</div></div>
              </div>
            ))}
            {q.trim().length >= 2 && results.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-subtle)', padding: 12 }}>Sin resultados.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Toast ----
function Toast({ toast }) {
  if (!toast) return null;
  return <div className="sd-toast">{toast}</div>;
}

// ---- App raíz ----
function App() {
  const [me, setMe] = useS(null);
  const [convs, setConvs] = useS([]);
  const [activeId, setActiveId] = useS(null);
  const [messages, setMessages] = useS([]);
  const [members, setMembers] = useS([]);
  const [filter, setFilter] = useS('todos');
  const [query, setQuery] = useS('');
  const [panelOpen, setPanelOpen] = useS(true);
  const [patient, setPatient] = useS(null);
  const [patientLoading, setPatientLoading] = useS(false);
  const [modal, setModal] = useS(null);
  const [showUrgentBanner, setShowUrgentBanner] = useS(true);
  const [mobileThread, setMobileThread] = useS(false);
  const [booting, setBooting] = useS(true);
  const [toast, setToast] = useS(null);

  const msgsRef = useR(null);
  const activeIdRef = useR(null);
  const lastMsgIdRef = useR(0);
  const convsRef = useR([]);
  const toastTimer = useR(null);

  useE(() => { convsRef.current = convs; }, [convs]);
  // Cierra cualquier modal al cambiar de conversación: nunca debe enviarse una
  // interconsulta/tarea/expediente al hilo equivocado por un cambio a mitad de modal.
  useE(() => { setModal(null); }, [activeId]);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // force=true siempre baja (al abrir hilo o enviar mensaje propio); si no, solo
  // baja cuando el usuario ya está cerca del fondo, para no robarle el scroll al leer.
  const scrollBottom = (force) => {
    const el = msgsRef.current; if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  };

  const refreshConvs = async () => {
    try {
      const list = await window.ChatAPI.conversations();
      // El hilo abierto se ve como leído al instante (sin parpadeo de "no leído").
      setConvs(list.map(c => c.id === activeIdRef.current ? { ...c, unread: 0 } : c));
      return list;
    } catch (_) { return convsRef.current; }
  };

  const loadPatient = async (pid) => {
    setPatient(null); setPatientLoading(true);
    try { setPatient(await window.ChatAPI.patient(pid)); }
    catch (_) { setPatient(null); }
    finally { setPatientLoading(false); }
  };

  const openConv = async (id) => {
    setActiveId(id); activeIdRef.current = id;
    setMobileThread(true);
    setShowUrgentBanner(true);
    setMessages([]); lastMsgIdRef.current = 0;
    try {
      const msgs = await window.ChatAPI.messages(id);
      if (activeIdRef.current !== id) return;
      setMessages(msgs);
      lastMsgIdRef.current = msgs.length ? msgs[msgs.length - 1].id : 0;
      setTimeout(() => scrollBottom(true), 60);
    } catch (_) {}
    window.ChatAPI.markRead(id).then(refreshConvs).catch(() => {});
    const c = convsRef.current.find(x => x.id === id);
    if (c && c.patientId) { setPanelOpen(true); loadPatient(c.patientId); }
    else { setPanelOpen(false); setPatient(null); }
  };

  // Arranque
  useE(() => {
    (async () => {
      try {
        const meData = await window.ChatAPI.me();
        window.ChatState.meId = meData.id; window.ChatState.me = meData;
        setMe(meData);
      } catch (_) {}
      window.ChatAPI.members().then(setMembers).catch(() => {});
      const list = await refreshConvs();
      if (list && list.length) openConv(list[0].id);
      setBooting(false);
    })();
    return () => clearTimeout(toastTimer.current);
  }, []);

  // Polling cada 5 s: lista + mensajes nuevos del hilo activo
  useE(() => {
    const poll = async () => {
      await refreshConvs();
      const aid = activeIdRef.current;
      if (!aid) return;
      try {
        const after = lastMsgIdRef.current;
        const incoming = await window.ChatAPI.messages(aid, after || undefined);
        if (activeIdRef.current !== aid || !incoming.length) return;
        setMessages(prev => {
          const have = new Set(prev.map(m => m.id));
          const fresh = incoming.filter(m => !have.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        lastMsgIdRef.current = Math.max(after, incoming[incoming.length - 1].id);
        setTimeout(() => scrollBottom(false), 40);
        // Marca leído en el servidor; el refresco directo del próximo poll (arriba)
        // ya actualiza la lista, así que no encadenamos otra llamada aquí.
        window.ChatAPI.markRead(aid).catch(() => {});
      } catch (_) {}
    };
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  const sendMessage = async (msg) => {
    const id = activeIdRef.current;
    if (!id) return;
    try {
      const created = await window.ChatAPI.send(id, msg);
      setMessages(prev => prev.some(m => m.id === created.id) ? prev : [...prev, created]);
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, created.id);
      setTimeout(() => scrollBottom(true), 40);
      refreshConvs();
    } catch (e) {
      showToast(e.message || 'No se pudo enviar el mensaje');
      throw e;
    }
  };

  const toggleTask = async (msgId) => {
    try {
      const r = await window.ChatAPI.toggleTask(msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, payload: { ...m.payload, done: r.done } } : m));
    } catch (_) { showToast('No se pudo actualizar la tarea'); }
  };

  const createConversation = async (data) => {
    try {
      const conv = await window.ChatAPI.createConversation(data);
      setModal(null);
      await refreshConvs();
      openConv(conv.id);
    } catch (e) { showToast(e.message || 'No se pudo crear la conversación'); }
  };

  const attachPatient = async (patientId) => {
    try {
      const p = await window.ChatAPI.patient(patientId);
      setModal(null);
      await sendMessage({
        kind: 'patient-card',
        payload: {
          patientId: p.id, name: p.name, age: p.age, gender: p.gender,
          identity_number: p.identity_number, motivo: p.motivo,
          dx: p.conditions || [], alerts: p.alerts || [],
        },
      });
    } catch (e) { showToast(e.message || 'No se pudo adjuntar el expediente'); }
  };

  const active = convs.find(c => c.id === activeId) || null;
  const hasUrgent = messages.some(m => m.kind === 'urgent-text');

  // Lista de render con separadores de día
  const renderItems = [];
  let lastDay = null;
  messages.forEach((m, i) => {
    const dk = dateKey(m.createdAt);
    if (m.createdAt && dk && dk !== lastDay) {
      renderItems.push({ _divider: true, id: 'd' + i, label: dayLabel(m.createdAt) });
      lastDay = dk;
    }
    renderItems.push(m);
  });

  return (
    <div className="chat-shell">
      <div className={'sd-app ' + (mobileThread ? 'm-thread' : 'm-list')}>
        <ConversationList convs={convs} activeId={activeId} onSelect={openConv}
          filter={filter} setFilter={setFilter} query={query} setQuery={setQuery}
          onNew={() => setModal('nueva')} />

        <div className="sd-thread">
          {active ? (
            <>
              <ThreadHead conv={active} panelOpen={panelOpen} setPanelOpen={setPanelOpen}
                onBack={() => setMobileThread(false)} onAction={showToast} />
              {hasUrgent && showUrgentBanner && (
                <div className="sd-urgent-banner">
                  <Icon name="alert-triangle" size={17} stroke={2.2} />
                  Esta conversación contiene mensajes marcados como urgentes.
                  <span className="sd-ub-spacer" />
                  <button onClick={() => { const el = msgsRef.current; if (!el) return; const u = el.querySelector('.sd-msg.urgent'); if (u && u.offsetParent) el.scrollTop = u.offsetTop - 80; }}>Ir al urgente</button>
                  <span style={{ cursor: 'pointer', display: 'flex', marginLeft: 4 }} onClick={() => setShowUrgentBanner(false)}><Icon name="x" size={16} /></span>
                </div>
              )}
              <div className="sd-msgs sd-scroll" ref={msgsRef}>
                <div className="sd-msgs-inner">
                  {renderItems.map(it => it._divider
                    ? <Message key={it.id} msg={{ kind: 'divider', label: it.label }} />
                    : <Message key={'m' + it.id} msg={it} othersReadAt={active.othersReadAt} onToggleTask={() => toggleTask(it.id)} />)}
                </div>
              </div>
              <Composer conv={active} onSend={sendMessage} onOpenModal={setModal} onError={showToast} />
            </>
          ) : (
            <div className="sd-thread-empty">
              {booting
                ? <span className="sd-spinner sd-spinner-lg" />
                : <><Icon name="message-square" size={44} style={{ color: 'var(--sd-ink-300)' }} />
                    <div className="t">Tu mensajería clínica</div>
                    <div className="d">Selecciona una conversación o inicia una nueva con tus colegas.</div>
                    <button className="sd-btn primary" onClick={() => setModal('nueva')}><Icon name="plus" size={16} />Nueva conversación</button></>}
            </div>
          )}
        </div>

        {active && active.patientId && panelOpen && (
          <>
            <div className="sd-panel-backdrop" onClick={() => setPanelOpen(false)} />
            <PatientPanel patient={patient} loading={patientLoading} onClose={() => setPanelOpen(false)} />
          </>
        )}

        {modal === 'interconsulta' && active && (
          <InterconsultaModal conv={active} onClose={() => setModal(null)}
            onSubmit={(ic) => { setModal(null); sendMessage({ kind: 'interconsulta', payload: ic }); }} />
        )}
        {modal === 'tarea' && active && (
          <TaskModal conv={active} onClose={() => setModal(null)}
            onSubmit={(task) => { setModal(null); sendMessage({ kind: 'task', payload: task }); }} />
        )}
        {modal === 'paciente' && active && (
          <PatientPickerModal onClose={() => setModal(null)} onPick={attachPatient} />
        )}
        {modal === 'nueva' && (
          <NewConversationModal members={members} meRole={me ? me.role : ''} onClose={() => setModal(null)} onCreate={createConversation} />
        )}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('chatRoot')).render(<App />);
