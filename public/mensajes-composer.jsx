// ============================================================
// Composer + menú de adjuntos + grabación + modales
// ============================================================
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

const SPECIALTIES = ['Cardiología', 'Radiología', 'Traumatología', 'Pediatría', 'Medicina interna', 'Medicina general', 'Urgencias', 'Ginecología', 'Dermatología', 'Odontología'];

// ---- Modal de interconsulta ----
function InterconsultaModal({ conv, onClose, onSubmit }) {
  const [to, setTo] = useStateC('Cardiología');
  const [patientName, setPatientName] = useStateC(conv.patientName || '');
  const [motivo, setMotivo] = useStateC('');
  const [priority, setPriority] = useStateC('Media');
  return (
    <div className="sd-scrim" onClick={onClose}>
      <div className="sd-modal" onClick={e => e.stopPropagation()}>
        <div className="sd-modal-head">
          <div className="ic" style={{ background: 'var(--sd-vital-100)', color: 'var(--sd-vital-600)' }}><Icon name="stethoscope" size={20} /></div>
          <div>
            <h3>Crear interconsulta</h3>
            <p>Se publicará en la conversación como solicitud formal.</p>
          </div>
          <button className="sd-modal-x" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="sd-modal-body">
          <div className="sd-field">
            <label>Dirigida a</label>
            <select value={to} onChange={e => setTo(e.target.value)}>
              {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sd-field">
            <label>Paciente</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nombre del paciente" />
          </div>
          <div className="sd-field">
            <label>Motivo de la interconsulta</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Describa el motivo clínico y lo que solicita del especialista." />
          </div>
          <div className="sd-field">
            <label>Prioridad</label>
            <div className="sd-prio">
              {['Baja', 'Media', 'Alta'].map(p => (
                <button key={p} className={(priority === p ? 'active ' : '') + p.toLowerCase()} onClick={() => setPriority(p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="sd-modal-foot">
          <button className="sd-btn ghost" onClick={onClose}>Cancelar</button>
          <button className="sd-btn primary" disabled={!motivo.trim()}
            onClick={() => onSubmit({ to, from: window.ChatState.me?.specialty || 'Medicina general', patient: patientName || '—', motivo: motivo.trim(), priority, status: 'Pendiente' })}>
            <Icon name="send" size={16} />Enviar interconsulta
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal de tarea ----
function TaskModal({ conv, onClose, onSubmit }) {
  const [title, setTitle] = useStateC('');
  const [due, setDue] = useStateC('Hoy');
  const [assignee, setAssignee] = useStateC('Para mí');
  const assignees = ['Para mí', ...(conv.members || []).filter(m => m.id !== window.ChatState.meId).map(m => m.name)];
  return (
    <div className="sd-scrim" onClick={onClose}>
      <div className="sd-modal" onClick={e => e.stopPropagation()}>
        <div className="sd-modal-head">
          <div className="ic" style={{ background: 'var(--sd-alert-100)', color: 'var(--sd-alert-600)' }}><Icon name="check-square" size={20} /></div>
          <div>
            <h3>Convertir en tarea</h3>
            <p>Crea un pendiente a partir de esta conversación.</p>
          </div>
          <button className="sd-modal-x" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="sd-modal-body">
          <div className="sd-field">
            <label>Tarea</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Monitorear TA cada 30 minutos" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="sd-field" style={{ flex: 1 }}>
              <label>Vencimiento</label>
              <select value={due} onChange={e => setDue(e.target.value)}>
                <option>Hoy</option><option>Hoy · hasta el alta</option><option>Mañana</option><option>Esta semana</option>
              </select>
            </div>
            <div className="sd-field" style={{ flex: 1 }}>
              <label>Asignar a</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}>
                {assignees.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="sd-modal-foot">
          <button className="sd-btn ghost" onClick={onClose}>Cancelar</button>
          <button className="sd-btn primary" disabled={!title.trim()}
            onClick={() => onSubmit({ title: title.trim(), due, assignee, done: false })}>
            <Icon name="check" size={16} />Crear tarea
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Composer ----
function Composer({ conv, onSend, onOpenModal, onError }) {
  const [text, setText] = useStateC('');
  const [focused, setFocused] = useStateC(false);
  const [urgent, setUrgent] = useStateC(false);
  const [menuOpen, setMenuOpen] = useStateC(false);
  const [recording, setRecording] = useStateC(false);
  const [recSec, setRecSec] = useStateC(0);
  const [mentionOpen, setMentionOpen] = useStateC(false);
  const [uploading, setUploading] = useStateC(false);
  const [sending, setSending] = useStateC(false);
  const taRef = useRefC(null);
  const fileRef = useRefC(null);
  const recTimer = useRefC(null);

  useEffectC(() => {
    if (recording) {
      recTimer.current = setInterval(() => setRecSec(s => s + 1), 1000);
    } else {
      clearInterval(recTimer.current); setRecSec(0);
    }
    return () => clearInterval(recTimer.current);
  }, [recording]);

  const autosize = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; };

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    autosize(e.target);
    const lastWord = v.slice(0, e.target.selectionStart).split(/\s/).pop();
    setMentionOpen(lastWord === '@' || (lastWord && lastWord.startsWith('@') && lastWord.length < 16 && !v.endsWith(' ')));
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    const kind = urgent ? 'urgent-text' : 'text';
    setText(''); setUrgent(false); setMentionOpen(false);
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);
    try { await onSend({ kind, body }); } finally { setSending(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const insertMention = (member) => {
    const short = String(member.name || '').replace(/^(Dra?\.)\s+/, '$1 ');
    setText(t => t.replace(/@[A-Za-zÀ-ÿ.]*$/, '@' + short + ' '));
    setMentionOpen(false);
    if (taRef.current) taRef.current.focus();
  };

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const up = await window.ChatAPI.upload(file);
      const meta = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
      await onSend({
        kind: 'study',
        payload: { type: up.kind === 'doc' ? 'Documento' : 'Imagen', label: up.original || file.name || 'Estudio', meta, kind: up.kind, url: up.url },
      });
    } catch (err) {
      if (onError) onError(err.message || 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  if (conv.readOnly) {
    return (
      <div className="sd-composer">
        <div className="sd-composer-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', background: 'var(--sd-ink-50)', color: 'var(--fg-muted)', fontSize: 13.5 }}>
            <Icon name="lock" size={16} />Solo la administración puede publicar en este canal.
          </div>
        </div>
      </div>
    );
  }

  const mentionables = (conv.members || []).filter(m => m.id !== window.ChatState.meId);

  const attachItems = [
    { id: 'expediente', icon: 'folder', bg: 'var(--sd-blue-100)', fg: 'var(--fg-link)', t: 'Expediente de paciente', d: 'Adjuntar ficha clínica' },
    { id: 'estudio', icon: 'image', bg: 'var(--sd-vital-100)', fg: 'var(--sd-vital-600)', t: 'Estudio o imagen', d: 'Rayos X, laboratorio, PDF' },
    { id: 'interconsulta', icon: 'stethoscope', bg: 'var(--sd-blue-100)', fg: 'var(--fg-link)', t: 'Crear interconsulta', d: 'Solicitud formal a especialista' },
    { id: 'tarea', icon: 'check-square', bg: 'var(--sd-alert-100)', fg: 'var(--sd-alert-600)', t: 'Convertir en tarea', d: 'Crear un pendiente' },
  ];

  const handleAttach = (id) => {
    setMenuOpen(false);
    if (id === 'interconsulta') onOpenModal('interconsulta');
    else if (id === 'tarea') onOpenModal('tarea');
    else if (id === 'expediente') onOpenModal('paciente');
    else if (id === 'estudio') fileRef.current && fileRef.current.click();
  };

  return (
    <div className="sd-composer">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onPickFile} />
      <div className="sd-composer-inner">
        <div className={'sd-comp-box' + (focused ? ' focused' : '') + (urgent ? ' urgent' : '')} style={{ position: 'relative' }}>
          {urgent && !recording && (
            <div className="sd-comp-urgentbar">
              <Icon name="alert-triangle" size={15} stroke={2.2} />Este mensaje se enviará marcado como urgente
              <span className="x" onClick={() => setUrgent(false)}><Icon name="x" size={15} /></span>
            </div>
          )}

          {uploading && (
            <div className="sd-comp-urgentbar" style={{ background: 'var(--sd-blue-100)', color: 'var(--fg-link)', borderColor: 'var(--sd-blue-200)' }}>
              <span className="sd-spinner" />Subiendo archivo…
            </div>
          )}

          {recording ? (
            <div className="sd-recording">
              <span className="sd-rec-dot" />
              <span className="sd-rec-time">{`0:${String(recSec).padStart(2, '0')}`}</span>
              <div className="sd-rec-wave">
                {Array.from({ length: 32 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />)}
              </div>
              <button className="sd-rec-cancel" onClick={() => setRecording(false)}>Cancelar</button>
              <button className="sd-rec-send" onClick={() => { onSend({ kind: 'voice', payload: { duration: `0:${String(recSec || 3).padStart(2, '0')}`, transcript: null } }); setRecording(false); }}>
                <Icon name="send" size={15} />Enviar
              </button>
            </div>
          ) : (
            <>
              <div className="sd-comp-textwrap">
                <textarea ref={taRef} className="sd-comp-input" rows={1}
                  placeholder={`Mensaje a ${conv.kind === 'directo' ? conv.title : '#' + conv.title}…`}
                  value={text} onChange={handleChange} onKeyDown={onKeyDown}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
              </div>
              {mentionOpen && mentionables.length > 0 && (
                <div className="sd-mention-pop">
                  {mentionables.map(d => (
                    <div key={d.id} className="sd-mention-item" onMouseDown={(e) => { e.preventDefault(); insertMention(d); }}>
                      <MemberAvatar member={d} size={28} />
                      <div><div className="mn">{d.name}</div><div className="mr">{d.specialty || window.chatHelpers.roleLabel(d.role)}</div></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="sd-comp-tools">
                <div style={{ position: 'relative' }}>
                  <button className="sd-tool" title="Adjuntar" onClick={() => setMenuOpen(o => !o)}><Icon name="plus" size={20} /></button>
                  {menuOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setMenuOpen(false)} />
                      <div className="sd-popover">
                        {attachItems.map(it => (
                          <div key={it.id} className="sd-pop-item" onClick={() => handleAttach(it.id)}>
                            <div className="ic" style={{ background: it.bg, color: it.fg }}><Icon name={it.icon} size={18} /></div>
                            <div><div className="t">{it.t}</div><div className="d">{it.d}</div></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button className="sd-tool" title="Nota de voz" onClick={() => setRecording(true)}><Icon name="mic" size={20} /></button>
                <button className="sd-tool" title="Mencionar" onClick={() => { setText(t => t + (t && !t.endsWith(' ') ? ' @' : '@')); setMentionOpen(true); taRef.current && taRef.current.focus(); }}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>@</span></button>
                <button className={'sd-tool' + (urgent ? ' urgent-on' : '')} title="Marcar urgente" onClick={() => setUrgent(u => !u)}><Icon name="alert-triangle" size={19} /></button>
                <div className="sd-tool-spacer" />
                <button className="sd-send" disabled={!text.trim() || sending} onClick={send}><Icon name="send" size={17} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Composer, InterconsultaModal, TaskModal });
