// ============================================================
// Render de mensajes — variantes clínicas (datos reales de la API)
// ============================================================
const { useState } = React;

// ---- Estudio / imagen (archivo real subido a Cloudinary) ----
function StudyCard({ study }) {
  const isImage = study.kind === 'image' && study.url;
  const href = window.chatHelpers.safeUrl(study.url);
  return (
    <div className="sd-study sd-attach">
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={'sd-study-preview ' + (isImage ? 'img' : 'doc')}>
          <div className="sd-study-type"><Pill tone="blue">{study.type || (isImage ? 'Imagen' : 'Documento')}</Pill></div>
          {isImage
            ? <img src={href} alt={study.label || 'Estudio'} className="sd-study-img" />
            : <Icon name="file-text" size={42} style={{ color: 'var(--sd-ink-300)' }} />}
        </div>
      </a>
      <div className="sd-study-foot">
        <div className="ic"><Icon name={isImage ? 'image' : 'file-text'} size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sd-study-label">{study.label || 'Estudio adjunto'}</div>
          <div className="sd-study-meta">{study.meta || ''}</div>
        </div>
        <a className="sd-study-dl" title="Abrir / descargar" href={href} target="_blank" rel="noopener noreferrer">
          <Icon name="download" size={18} />
        </a>
      </div>
    </div>
  );
}

function PatientCard({ p }) {
  if (!p) return null;
  const init = window.chatHelpers.initialsOf(p.name);
  return (
    <div className="sd-pcard sd-attach">
      <div className="sd-pcard-top">
        <div className="sd-pcard-av">{init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sd-pcard-name">{p.name}</div>
          <div className="sd-pcard-meta">{[p.age ? p.age + ' años' : '', p.gender].filter(Boolean).join(' · ')}</div>
        </div>
        {p.identity_number && <div className="sd-pcard-exp">{p.identity_number}</div>}
      </div>
      <div className="sd-pcard-body">
        {p.motivo && <div className="sd-pcard-line"><span className="k">Motivo</span><span className="v">{p.motivo}</span></div>}
        {p.dx && p.dx.length > 0 && <div className="sd-pcard-line"><span className="k">Dx</span><span className="v">{p.dx.join(' · ')}</span></div>}
        {p.alerts && p.alerts.length > 0 && (
          <div className="sd-pcard-line"><span className="k">Alerta</span><span className="v" style={{ color: 'var(--sd-critical-600)' }}>{p.alerts.join(', ')}</span></div>
        )}
      </div>
      {p.patientId && (
        <div className="sd-pcard-foot">
          <a className="sd-cardbtn" href={`/patient.html?id=${p.patientId}`}><Icon name="folder" size={16} />Abrir expediente</a>
        </div>
      )}
    </div>
  );
}

function InterconsultaCard({ ic }) {
  const statusTone = ic.status === 'Aceptada' ? 'vital' : ic.status === 'Pendiente' ? 'alert' : 'default';
  const prioTone = ic.priority === 'Alta' ? 'urgent' : ic.priority === 'Media' ? 'alert' : 'blue';
  return (
    <div className="sd-ic sd-attach">
      <div className="sd-ic-head">
        <div className="ic"><Icon name="stethoscope" size={17} /></div>
        <div>
          <div className="sd-ic-kicker">Interconsulta</div>
          <div className="sd-ic-route">{ic.from}<Icon name="arrow-right" size={13} style={{ color: 'var(--fg-subtle)' }} />{ic.to}</div>
        </div>
      </div>
      <div className="sd-ic-body">
        {ic.patient && <div className="sd-ic-field"><div className="k">Paciente</div><div className="v">{ic.patient}</div></div>}
        <div className="sd-ic-field"><div className="k">Motivo</div><div className="v">{ic.motivo}</div></div>
      </div>
      <div className="sd-ic-foot">
        <Pill tone={prioTone} icon={ic.priority === 'Alta' ? 'alert-triangle' : undefined}>Prioridad {String(ic.priority || '').toLowerCase()}</Pill>
        <Pill tone={statusTone} icon={ic.status === 'Aceptada' ? 'check' : 'clock'}>{ic.status}</Pill>
      </div>
    </div>
  );
}

function VoiceNote({ voice }) {
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const bars = 38;
  return (
    <div className="sd-voice">
      <div className="sd-voice-row">
        <button className="sd-voice-play" onClick={() => setPlaying(p => !p)}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <div className="sd-wave">
          {Array.from({ length: bars }).map((_, i) => (
            <span key={i} className={playing && i < bars * 0.45 ? 'on' : ''}
              style={{ height: `${20 + Math.abs(Math.sin(i * 0.9)) * 70}%` }} />
          ))}
        </div>
        <div className="sd-voice-dur">{voice.duration}</div>
      </div>
      {voice.transcript && (
        <div className="sd-voice-tx" style={{ display: open ? 'block' : 'none' }}>
          <span className="lbl">Transcripción</span>{voice.transcript}
        </div>
      )}
      {voice.transcript && (
        <div style={{ marginTop: 7 }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--fg-link)', font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="file-text" size={13} />{open ? 'Ocultar transcripción' : 'Ver transcripción'}
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle }) {
  return (
    <div className="sd-task">
      <div className="sd-task-head">
        <Icon name="check-square" size={15} style={{ color: 'var(--sd-alert-600)' }} />
        <span className="sd-task-kicker">Tarea</span>
      </div>
      <div className="sd-task-row">
        <div className={'sd-task-check' + (task.done ? ' done' : '')} onClick={onToggle}>
          {task.done && <Icon name="check" size={13} stroke={3} />}
        </div>
        <div style={{ flex: 1 }}>
          <div className={'sd-task-title' + (task.done ? ' done' : '')}>{task.title}</div>
          <div className="sd-task-meta">
            {task.due && <span><Icon name="clock" size={13} />{task.due}</span>}
            {task.assignee && <span><Icon name="user" size={13} />{task.assignee}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Switch principal de mensaje ----
function Message({ msg, onToggleTask }) {
  if (msg.kind === 'divider') return <div className="sd-divider"><span>{msg.label}</span></div>;
  if (msg.kind === 'system') return <div className="sd-system">{msg.body}</div>;

  const own = msg.senderId != null && msg.senderId === window.ChatState.meId;
  const isUrgent = msg.kind === 'urgent-text';
  const color = window.chatHelpers.colorForId(msg.senderId);
  const roleText = msg.senderSpecialty || window.chatHelpers.roleLabel(msg.senderRole);
  const time = window.chatHelpers.fmtTime(msg.createdAt);
  const payload = msg.payload || {};

  const attachment =
    msg.kind === 'patient-card' ? <PatientCard p={payload} /> :
    msg.kind === 'study' ? <StudyCard study={payload} /> :
    msg.kind === 'interconsulta' ? <InterconsultaCard ic={payload} /> :
    msg.kind === 'voice' ? <VoiceNote voice={payload} /> :
    msg.kind === 'task' ? <TaskCard task={payload} onToggle={onToggleTask} /> :
    null;

  return (
    <div className={'sd-msg' + (own ? ' own' : '') + (isUrgent ? ' urgent' : '')}>
      <div className="sd-msg-avatar">{!own && <Avatar name={msg.senderName} photo={msg.senderPhoto} color={color} size={34} />}</div>
      <div className="sd-msg-col">
        {!own && (
          <div className="sd-msg-meta">
            <span className="sd-msg-name">{msg.senderName || 'Sin nombre'}</span>
            {roleText && <span className="sd-msg-role">{roleText}</span>}
            <span className="sd-msg-time">{time}</span>
          </div>
        )}
        {attachment ? attachment : (
          <div className="sd-bubble">
            {isUrgent && <span className="sd-urgent-tag"><Icon name="alert-triangle" size={12} stroke={2.4} />Urgente</span>}
            <RichText text={msg.body} />
          </div>
        )}
        {own && (
          <div className="sd-receipt">
            <span className="sd-msg-time" style={{ color: 'inherit' }}>{time}</span>
            <Icon name="check-check" size={13} />
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Message, PatientCard, StudyCard, InterconsultaCard, VoiceNote, TaskCard });
