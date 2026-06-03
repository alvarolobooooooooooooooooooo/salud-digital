// Átomos de UI compartidos (alimentados por datos reales de la API)
const { colorForId, initialsOf, roleLabel } = window.chatHelpers;

// Avatar por props: pinta foto si existe, si no iniciales sobre color por id.
function Avatar({ name, photo, color, size = 36, ring = false, title }) {
  const bg = color || '#0891b2';
  const safePhoto = photo ? window.chatHelpers.safeCssUrl(photo) : '';
  if (safePhoto) {
    return (
      <div className="sd-avatar" title={title || name} style={{
        width: size, height: size, backgroundImage: `url("${safePhoto}")`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        boxShadow: ring ? '0 0 0 2px var(--bg-surface), 0 0 0 4px ' + bg : 'none',
      }} />
    );
  }
  return (
    <div className="sd-avatar" title={title || name} style={{
      width: size, height: size, background: bg, fontSize: size * 0.38,
      boxShadow: ring ? '0 0 0 2px var(--bg-surface), 0 0 0 4px ' + bg : 'none',
    }}>{initialsOf(name)}</div>
  );
}

// Avatar a partir de un miembro {id,name,photo}
function MemberAvatar({ member, size = 36, ring = false }) {
  if (!member) return null;
  return <Avatar name={member.name} photo={member.photo} color={colorForId(member.id)} size={size} ring={ring} />;
}

function GroupAvatar({ conv, size = 40 }) {
  if (conv.kind === 'directo') {
    const other = (conv.members || []).find(m => m.id !== window.ChatState.meId) || (conv.members || [])[0];
    return (
      <div style={{ position: 'relative' }}>
        <MemberAvatar member={other} size={size} />
        {conv.online && <span className="sd-presence" title="En línea" />}
      </div>
    );
  }
  const tone = {
    caso: { bg: 'var(--sd-blue-100)', fg: 'var(--fg-link)' },
    equipo: { bg: 'var(--sd-ink-100)', fg: 'var(--sd-navy-600)' },
    interconsulta: { bg: 'var(--sd-vital-100)', fg: 'var(--sd-vital-600)' },
    anuncio: { bg: 'var(--sd-alert-100)', fg: 'var(--sd-alert-600)' },
  }[conv.kind] || { bg: 'var(--sd-ink-100)', fg: 'var(--sd-navy-600)' };
  return (
    <div className="sd-tile" style={{ width: size, height: size, background: tone.bg, color: tone.fg }}>
      <Icon name={conv.icon || 'message-square'} size={size * 0.5} />
    </div>
  );
}

function Pill({ children, tone = 'default', icon }) {
  return (
    <span className={'sd-pill sd-pill-' + tone}>
      {icon && <Icon name={icon} size={12} stroke={2.2} />}
      {children}
    </span>
  );
}

// Renderiza texto con @menciones resaltadas
function RichText({ text }) {
  const parts = String(text || '').split(/(@[A-Za-zÀ-ÿ.]+(?:\s[A-Za-zÀ-ÿ.]+)?)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@')
          ? <span key={i} className="sd-mention">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

Object.assign(window, { Avatar, MemberAvatar, GroupAvatar, Pill, RichText });
