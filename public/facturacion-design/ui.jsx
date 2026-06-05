/* =========================================================
   ui.jsx — primitivos compartidos
   ========================================================= */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Iconos (Lucide, stroke 1.75, rounded) ---------- */
const ICONS = {
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z|M8 7h8|M8 11h8|M8 15h5',
  plus: 'M5 12h14|M12 5v14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z|M21 21l-4.3-4.3',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18|M6 6l12 12',
  printer: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
  ban: 'M4.9 4.9a10 10 0 1 0 14.2 14.2M4.9 4.9a10 10 0 0 1 14.2 14.2M4.9 4.9 19.1 19.1',
  card: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z|M2 10h20',
  cash: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z|M6 8v0|M18 16v0',
  bank: 'M3 21h18|M5 21V10|M19 21V10|M9 21v-6h6v6|M12 3 21 9H3z',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5|M18 12h.01',
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z|M12 9v4|M12 17h.01',
  checkCircle: 'M22 11.1V12a10 10 0 1 1-5.9-9.1|M22 4 12 14.5l-3-3',
  trending: 'M22 7 13.5 15.5l-5-5L2 17|M16 7h6v6',
  user: 'M20 21a8 8 0 0 0-16 0|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  calendar: 'M8 2v4|M16 2v4|M3 10h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  arrowL: 'M19 12H5|M12 19l-7-7 7-7',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z|M12 6v6l4 2',
  percent: 'M19 5 5 19|M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z|M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  coins: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z|M18.1 6.8a6 6 0 1 1-9.3 9.2|M7 6h1v4|M16.7 16h.01',
  trash: 'M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6',
  send: 'M22 2 11 13|M22 2 15 22l-4-9-9-4 20-7Z',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3Z',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z|M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2|M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2|M10 6h4|M10 10h4|M10 14h4|M10 18h4',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z|M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z|M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  edit: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5|M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5',
  stethoscope: 'M4 3v6a5 5 0 0 0 10 0V3|M4 3H2|M14 3h2|M9 18a4 4 0 0 0 8 0v-3|M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
};
function Icon({ name, size = 20, className, style }) {
  const d = ICONS[name] || '';
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

/* ---------- Pill de estado ---------- */
const ESTADO_META = {
  pagada:     { label: 'Pagada', cls: 'vital' },
  pendiente:  { label: 'Pendiente', cls: 'alert' },
  parcial:    { label: 'Abono parcial', cls: 'info' },
  vencida:    { label: 'Vencida', cls: 'critical' },
  anulada:    { label: 'Anulada', cls: 'neutral' },
};
function EstadoPill({ estado }) {
  const m = ESTADO_META[estado] || ESTADO_META.pendiente;
  return <span className={'pill pill--' + m.cls}><span className="pill__dot" />{m.label}</span>;
}

/* ---------- Botón ---------- */
function Btn({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, disabled, type, full }) {
  const cls = ['btn', 'btn--' + variant, 'btn--' + size, full ? 'btn--full' : ''].join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type || 'button'}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

/* ---------- Campo etiquetado ---------- */
function Field({ label, children, hint, required }) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}{required && <span className="field__req"> *</span>}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/* ---------- Modal / Drawer overlay ---------- */
function Overlay({ children, onClose, wide, drawer }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div
        className={'overlay ' + (drawer ? 'overlay--drawer' : 'overlay--modal') + (wide ? ' overlay--wide' : '')}
        onMouseDown={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Tarjeta KPI ---------- */
function StatCard({ icon, label, value, delta, deltaDir, tint, sub }) {
  return (
    <div className="stat">
      <div className={'stat__icon stat__icon--' + (tint || 'blue')}><Icon name={icon} size={20} /></div>
      <div className="stat__body">
        <div className="stat__label">{label}</div>
        <div className="stat__value">{value}</div>
        {(delta || sub) && (
          <div className="stat__foot">
            {delta && <span className={'stat__delta stat__delta--' + (deltaDir || 'up')}>{delta}</span>}
            {sub && <span className="stat__sub">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Avatar con iniciales ---------- */
function Avatar({ nombre, size = 36 }) {
  const ini = nombre.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const palette = ['#0080B0', '#103A78', '#198754', '#C7811C', '#25579E', '#00638A'];
  const idx = nombre.charCodeAt(0) % palette.length;
  return (
    <span className="avatar" style={{ width: size, height: size, background: palette[idx], fontSize: size * 0.36 }}>{ini}</span>
  );
}

/* ---------- Toast ---------- */
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  if (!msg) return null;
  return (
    <div className="toast">
      <Icon name="checkCircle" size={18} />
      <span>{msg}</span>
    </div>
  );
}

Object.assign(window, {
  useState, useEffect, useRef, useMemo,
  Icon, ICONS, EstadoPill, ESTADO_META, Btn, Field, Overlay, StatCard, Avatar, Toast,
});
