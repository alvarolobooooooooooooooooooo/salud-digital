// ui.jsx — shared primitives. Exports to window.
(function () {
  const { useState, useRef, useEffect } = React;
  const Icon = window.Icon;

  // ---- Avatar (initials or photo placeholder) ----
  function Avatar({ person, size = 40, style = {} }) {
    const p = person || {};
    return (
      <span className="avatar" style={{
        width: size, height: size, fontSize: size * 0.4,
        background: p.bg || 'var(--sd-blue-100)', color: p.color || 'var(--sd-blue-700)',
        ...style,
      }}>{p.initials || '?'}</span>
    );
  }

  // ---- Doctor avatar (square-ish rounded, monogram) ----
  function DocAvatar({ doctor, size = 48, style = {} }) {
    const d = doctor || {};
    return (
      <span style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.36,
        color: '#fff', background: `linear-gradient(150deg, ${d.color || '#0080B0'}, ${shade(d.color || '#0080B0', -18)})`,
        ...style,
      }}>{d.initials}</span>
    );
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  // ---- Pill ----
  function Pill({ tone = 'gray', dot, children, style = {} }) {
    return <span className={'pill pill-' + tone} style={style}>{dot && <i className="dot" />}{children}</span>;
  }

  // ---- Section title row ----
  function SectionTitle({ children, action, onAction }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)', letterSpacing: 'var(--ls-tight)' }}>{children}</h3>
        {action && <button className="focusable" onClick={onAction} style={{ color: 'var(--sd-blue-600)', fontWeight: 600, fontSize: 'var(--t-14)' }}>{action}</button>}
      </div>
    );
  }

  // ---- Button ----
  function Btn({ variant = 'primary', size, block, icon, iconRight, children, onClick, disabled, style = {} }) {
    const cls = ['btn', 'btn-' + variant, 'focusable'];
    if (block) cls.push('btn-block');
    if (size === 'lg') cls.push('btn-lg');
    return (
      <button className={cls.join(' ')} onClick={onClick} disabled={disabled} style={style}>
        {icon && <Icon name={icon} size={18} color="currentColor" />}
        {children}
        {iconRight && <Icon name={iconRight} size={18} color="currentColor" />}
      </button>
    );
  }

  // ---- Top bar with optional back + title + trailing ----
  function TopBar({ title, subtitle, onBack, trailing, flat, large, eyebrow }) {
    return (
      <div className={'topbar' + (flat ? ' topbar-flat' : '')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>
          {onBack && (
            <button className="focusable" onClick={onBack} aria-label="Atrás" style={{
              width: 38, height: 38, borderRadius: 999, marginLeft: -6,
              display: 'grid', placeItems: 'center', background: 'var(--bg-subtle)', flexShrink: 0,
            }}><Icon name="chevron-left" size={22} color="var(--sd-navy-700)" /></button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <div className="eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>}
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 'var(--ls-tight)',
              fontSize: large ? 'var(--t-28)' : 'var(--t-20)', color: 'var(--fg-strong)', lineHeight: 1.15,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 'var(--t-13)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {trailing}
        </div>
      </div>
    );
  }

  // ---- Bottom sheet (controlled) ----
  function Sheet({ open, onClose, children, title }) {
    if (!open) return null;
    return (
      <React.Fragment>
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog">
          <div className="sheet-grip" />
          {title && <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: 'var(--t-20)', fontWeight: 700, color: 'var(--fg-strong)' }}>{title}</h3>}
          {children}
        </div>
      </React.Fragment>
    );
  }

  // ---- Ring progress (SVG) ----
  function Ring({ value = 0, size = 88, stroke = 9, color = 'var(--sd-blue-500)', track = 'var(--sd-ink-150)', children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(1, value)));
    return (
      <div className="ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
            style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }} />
        </svg>
        <div className="ring-label">{children}</div>
      </div>
    );
  }

  // ---- Specialty / mini icon tile ----
  function IconTile({ name, color = '#0080B0', bg = 'var(--sd-blue-100)', size = 44, iconSize = 22, radius = 12, style = {} }) {
    return (
      <span style={{ width: size, height: size, borderRadius: radius, background: bg, display: 'inline-grid', placeItems: 'center', flexShrink: 0, ...style }}>
        <Icon name={name} size={iconSize} color={color} />
      </span>
    );
  }

  // ---- Text field ----
  function Field({ label, value, onChange, placeholder, type = 'text', icon, suffix, onFocus, readOnly, multiline, rows = 3 }) {
    return (
      <label style={{ display: 'block' }}>
        {label && <span className="sd-label" style={{ display: 'block', marginBottom: 7, color: 'var(--fg-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--t-13)', fontWeight: 600 }}>{label}</span>}
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon && <span style={{ position: 'absolute', left: 14, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><Icon name={icon} size={18} color="var(--sd-ink-400)" /></span>}
          {multiline ? (
            <textarea className="focusable" value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} rows={rows} onFocus={onFocus} readOnly={readOnly}
              style={fieldStyle(icon, false)} />
          ) : (
            <input className="focusable" type={type} value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} onFocus={onFocus} readOnly={readOnly}
              style={fieldStyle(icon, !!suffix)} />
          )}
          {suffix && <span style={{ position: 'absolute', right: 14, color: 'var(--fg-muted)', fontSize: 'var(--t-14)', fontWeight: 600 }}>{suffix}</span>}
        </span>
      </label>
    );
  }
  function fieldStyle(icon, suffix) {
    return {
      width: '100%', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)',
      padding: '0 14px', paddingLeft: icon ? 42 : 14, paddingRight: suffix ? 56 : 14,
      height: 50, fontSize: 'var(--t-15)', color: 'var(--fg-strong)', background: '#fff',
      outline: 'none', fontFamily: 'var(--font-body)', resize: 'none',
      ...(suffix === undefined ? {} : {}),
    };
  }
  // textarea needs height auto
  const _origFieldStyle = fieldStyle;

  // ---- Empty state ----
  function Empty({ icon, title, hint, action, onAction }) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--sd-blue-50)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <Icon name={icon} size={28} color="var(--sd-blue-400)" />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-18)', color: 'var(--fg-strong)' }}>{title}</div>
        {hint && <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 6, maxWidth: 260, marginInline: 'auto', lineHeight: 1.5 }}>{hint}</div>}
        {action && <div style={{ marginTop: 18 }}><Btn variant="primary" onClick={onAction}>{action}</Btn></div>}
      </div>
    );
  }

  // ---- Toast (simple, auto-dismiss) ----
  function Toast({ msg, onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
    return (
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 70, animation: 'riseIn var(--dur-3) var(--ease-out)' }}>
        <div style={{ background: 'var(--sd-navy-800)', color: '#fff', borderRadius: 'var(--r-md)', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)', fontSize: 'var(--t-14)', fontWeight: 500 }}>
          <Icon name="check-circle" size={20} color="var(--sd-vital-500)" />
          <span>{msg}</span>
        </div>
      </div>
    );
  }

  Object.assign(window, { Avatar, DocAvatar, Pill, SectionTitle, Btn, TopBar, Sheet, Ring, IconTile, Field, Empty, Toast, shade });
})();
