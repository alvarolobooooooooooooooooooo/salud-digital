/* global React, ArchToothV2, CrownDefs, UPPER_FDI, LOWER_FDI, fdiToType */
// ============================================================
// evolucion-v2.jsx — Treatment evolution view (redesigned)
// Clean before/after slider, clinical metrics, milestone timeline,
// summary cards, evolution-focused right panel.
//
// Timeline data is now driven by a persisted `treatment` object
// (start date, milestones, metrics, text lists) that rides inside
// the orthodontics state blob and saves with "Guardar Consulta".
// Dates and progress % are COMPUTED live from `startDate` + today;
// milestones / metrics / lists are editable ("Editar plan").
// ============================================================

const { useState: useStateE, useRef: useRefE, useMemo: useMemoE } = React;

// =============================================================
// Date helpers (all relative to "today", computed in the browser)
// =============================================================
const MESES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function parseDate(s) {
  if (!s) return null;
  const parts = String(s).slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function addMonths(date, n) {
  if (!date) return null;
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + Math.round(n));
  return d;
}
function fmtDMY(date) {
  return date ? `${date.getDate()} ${MESES_ABBR[date.getMonth()]} ${date.getFullYear()}` : '—';
}
function fmtMY(date) {
  return date ? `${MESES_ABBR[date.getMonth()]} ${date.getFullYear()}` : '—';
}
// Fractional months between a → b (positive when b is later than a)
function monthsBetween(a, b) {
  if (!a || !b) return 0;
  return (b.getFullYear() - a.getFullYear()) * 12
    + (b.getMonth() - a.getMonth())
    + (b.getDate() - a.getDate()) / 30;
}
// Human relative label for a date vs today: "hace 4 meses" / "en 2 sem" / "hoy"
function relLabel(date, today) {
  if (!date) return '';
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'hoy';
  const fut = days > 0;
  if (Math.abs(days) <= 6) {
    const n = Math.abs(days);
    return `${fut ? 'en' : 'hace'} ${n} día${n > 1 ? 's' : ''}`;
  }
  const months = Math.round(monthsBetween(today, date));
  if (months === 0) {
    const wk = Math.max(1, Math.round(Math.abs(days) / 7));
    return `${fut ? 'en' : 'hace'} ${wk} sem`;
  }
  const n = Math.abs(months);
  return `${months > 0 ? 'en' : 'hace'} ${n} mes${n > 1 ? 'es' : ''}`;
}

// =============================================================
// Default treatment plan (template). Used as a seed for new
// consultations and to backfill any missing fields on load.
// `current` values are picked so a fresh plan looks like a case
// already at ~month 4 (matches the previous static demo).
// =============================================================
function seedTreatment() {
  return {
    startDate: null,        // ISO 'YYYY-MM-DD' — seeded by the parent from the 1st ortho consult
    durationMonths: 18,
    nextControl: null,      // ISO — optional; defaults to today + 4 weeks
    milestones: [
      { id: 'inicio',       label: 'Inicio',            month: 0,  objective: 'Cementado de brackets y bandas. Educación del paciente.', archwire: '.014 NiTi' },
      { id: 'alineacion',   label: 'Alineación',        month: 2,  objective: 'Corrección de rotaciones y apiñamiento anterior.',        archwire: '.016 NiTi' },
      { id: 'nivelacion',   label: 'Nivelación',        month: 4,  objective: 'Curva de Spee y nivelación de marginal ridges.',          archwire: '.018 NiTi' },
      { id: 'torque',       label: 'Control de torque', month: 8,  objective: 'Inclinación radicular y control vestíbulo-lingual.',       archwire: '.019×.025 NiTi' },
      { id: 'cierre',       label: 'Cierre de espacios', month: 12, objective: 'Mecánica de deslizamiento. Cadenetas elásticas.',         archwire: '.019×.025 SS' },
      { id: 'refinamiento', label: 'Refinamiento',      month: 16, objective: 'Detallado oclusal, paralelismo radicular, gemelas.',      archwire: '.019×.025 SS' },
      { id: 'final',        label: 'Finalización',      month: 18, objective: 'Retirada de aparatos. Retenedores fijos + Hawley.',        archwire: 'Retenedor' },
    ],
    metrics: [
      { id: 'overjet',    label: 'Overjet',      unit: 'mm', initial: 5.2,  current: 3.4,  target: 2.5 },
      { id: 'overbite',   label: 'Overbite',     unit: 'mm', initial: 4.0,  current: 3.6,  target: 2.5 },
      { id: 'crowding_s', label: 'Apiñ. sup',    unit: 'mm', initial: -3.5, current: -1.2, target: -0.5 },
      { id: 'crowding_i', label: 'Apiñ. inf',    unit: 'mm', initial: -2.0, current: -1.6, target: 0.0 },
      { id: 'midline',    label: 'Línea media',  unit: 'mm', initial: 0.5,  current: 0.4,  target: 0.0 },
      { id: 'class_mol',  label: 'Clase molar',  raw: true,  initial: 'II', current: 'II', target: 'I' },
      { id: 'class_can',  label: 'Clase canina', raw: true,  initial: 'II', current: 'II', target: 'I' },
    ],
    observedChanges: [
      'Reducción de apiñamiento ant. sup.',
      'Mejor alineación de incisivos',
      'Overjet en descenso (5.2 → 3.4 mm)',
    ],
    nextSteps: [
      'Cambio a .019×.025 NiTi en 4 sem.',
      'Inicio de cierre con cadenetas',
      'Revisión radiográfica al mes 8',
    ],
    alerts: [
      'Bracket flojo en 26 — revisar',
      'Higiene oral: control profiláctico',
    ],
    caseNotes: 'Paciente colabora bien con higiene oral. Sin signos de descalcificación. Se recomienda continuar con .018 NiTi hasta nivelación completa antes de progresar a calibre rectangular.',
  };
}

// Merge a (possibly partial / legacy) saved plan with the template so
// every field is always present and the view never breaks.
function normalizeTreatment(t) {
  const base = seedTreatment();
  if (!t || typeof t !== 'object') return base;
  return {
    startDate: t.startDate || base.startDate,
    durationMonths: Number(t.durationMonths) > 0 ? Number(t.durationMonths) : base.durationMonths,
    nextControl: t.nextControl || base.nextControl,
    milestones: Array.isArray(t.milestones) && t.milestones.length ? t.milestones : base.milestones,
    metrics: Array.isArray(t.metrics) && t.metrics.length ? t.metrics : base.metrics,
    observedChanges: Array.isArray(t.observedChanges) ? t.observedChanges : base.observedChanges,
    nextSteps: Array.isArray(t.nextSteps) ? t.nextSteps : base.nextSteps,
    alerts: Array.isArray(t.alerts) ? t.alerts : base.alerts,
    caseNotes: typeof t.caseNotes === 'string' ? t.caseNotes : base.caseNotes,
  };
}

const STATUS_STYLE = {
  mejoro:    { bg:'var(--sd-vital-100)',    fg:'var(--sd-vital-600)',    label: 'mejoró',    icon: '↑' },
  estable:   { bg:'var(--sd-info-100)',     fg:'var(--sd-info-600)',     label: 'estable',   icon: '=' },
  pendiente: { bg:'var(--sd-alert-100)',    fg:'var(--sd-alert-600)',    label: 'pendiente', icon: '·' },
  alerta:    { bg:'var(--sd-critical-100)', fg:'var(--sd-critical-600)', label: 'alerta',    icon: '!' },
};

// =============================================================
// Metric helpers — status + progress from initial→current→target
// =============================================================
function metricStatus(m) {
  if (m.raw) {
    if (String(m.current) === String(m.target)) return 'mejoro';
    if (String(m.current) === String(m.initial)) return 'pendiente';
    return 'mejoro';
  }
  const init = +m.initial, cur = +m.current, tgt = +m.target;
  if (![init, cur, tgt].every(Number.isFinite)) return 'estable';
  const totalGap = Math.abs(tgt - init);
  if (totalGap < 1e-6) return 'estable';
  const remGap = Math.abs(tgt - cur);
  if (remGap > totalGap + 1e-6) return 'alerta';           // moved away from target
  if (remGap < 1e-6) return 'mejoro';                       // reached target
  if (Math.abs(cur - init) < 1e-6) return 'pendiente';      // no change yet
  return 'mejoro';                                          // moving toward target
}

// =============================================================
// Tiny styled inputs for the plan editor
// =============================================================
const editInputStyle = {
  background:'var(--bg-app)', border:'1px solid var(--border-default)',
  borderRadius:'var(--r-sm)', padding:'6px 8px',
  fontSize:'var(--t-12)', color:'var(--fg-strong)', fontFamily:'inherit',
  width:'100%', boxSizing:'border-box',
};
function EInput({ value, onChange, type = 'text', placeholder, style, ...rest }) {
  return (
    <input type={type} value={value == null ? '' : value} placeholder={placeholder}
      onChange={e => onChange(type === 'number' ? e.target.value : e.target.value)}
      style={{ ...editInputStyle, ...style }} {...rest} />
  );
}
function IconBtn({ onClick, title, children, danger }) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{
        width: 26, height: 26, flexShrink: 0, borderRadius:'var(--r-sm)',
        border:'1px solid var(--border-default)', cursor:'pointer',
        background: danger ? 'var(--sd-critical-100)' : 'var(--bg-surface)',
        color: danger ? 'var(--sd-critical-600)' : 'var(--fg-muted)',
        display:'grid', placeItems:'center', padding: 0,
      }}>{children}</button>
  );
}
function AddBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display:'inline-flex', alignItems:'center', gap: 6,
        padding:'6px 10px', borderRadius:'var(--r-sm)',
        border:'1px dashed var(--border-strong)', background:'none',
        color:'var(--sd-blue-700)', fontSize:'var(--t-12)', fontWeight: 600, cursor:'pointer',
      }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
      {children}
    </button>
  );
}
const ICON_X = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

// Editable list of plain strings (cambios / próximos pasos / alertas)
function EditableList({ items, onChange, placeholder, addLabel }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap: 6}}>
      {items.map((it, i) => (
        <div key={i} style={{display:'flex', gap: 6, alignItems:'center'}}>
          <EInput value={it} placeholder={placeholder}
            onChange={v => onChange(items.map((x, j) => j === i ? v : x))} />
          <IconBtn danger title="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))}>{ICON_X}</IconBtn>
        </div>
      ))}
      <div><AddBtn onClick={() => onChange([...items, ''])}>{addLabel || 'Agregar'}</AddBtn></div>
    </div>
  );
}

// =============================================================
// Compact milestone timeline (driven by treatment data)
// =============================================================
function MilestoneTimeline({ milestones, startDate, durationMonths, realMonth, today, progress, currentIdx, beforeStart, inspectIdx, onInspect, onEditPlan, editing }) {
  const start = parseDate(startDate);

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-lg)',
      padding:'18px 24px 16px',
    }}>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 14, gap: 12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-14)', color:'var(--fg-strong)'}}>
            Línea de tiempo del tratamiento
          </div>
          <div style={{fontSize: 'var(--t-12)', color:'var(--fg-muted)', marginTop: 2}}>
            {durationMonths} meses · Etapa actual: <strong style={{color:'var(--sd-blue-700)'}}>{beforeStart ? 'por iniciar' : (milestones[currentIdx] ? milestones[currentIdx].label : '—')}</strong>
            {!start && <span style={{color:'var(--sd-alert-600)'}}> · falta fecha de inicio</span>}
          </div>
        </div>
        <div style={{display:'flex', gap: 12, alignItems:'baseline'}}>
          <div style={{display:'flex', gap: 10, alignItems:'baseline'}}>
            <span style={{
              fontFamily:'var(--font-display)', fontWeight: 800,
              fontSize:'var(--t-24)', color:'var(--sd-blue-700)',
            }}>{Math.round(progress)}<span style={{fontSize:'var(--t-12)', fontWeight: 600, marginLeft: 2}}>%</span></span>
            <span style={{fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>completado</span>
          </div>
          {onEditPlan && (
            <button type="button" onClick={onEditPlan}
              style={{
                display:'inline-flex', alignItems:'center', gap: 6,
                padding:'5px 10px', borderRadius:'var(--r-sm)', cursor:'pointer',
                border:'1px solid ' + (editing ? 'var(--sd-blue-600)' : 'var(--border-default)'),
                background: editing ? 'var(--sd-blue-600)' : 'var(--bg-surface)',
                color: editing ? 'white' : 'var(--fg-default)',
                fontSize:'var(--t-12)', fontWeight: 600,
              }}>
              {editing ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Listo</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Editar plan</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Timeline track */}
      <div style={{position:'relative', height: 60, marginBottom: 4}}>
        {/* base line */}
        <div style={{
          position:'absolute', top: 18, left: 12, right: 12, height: 3,
          background:'var(--border-default)', borderRadius: 2,
        }}></div>
        {/* progress line */}
        <div style={{
          position:'absolute', top: 18, left: 12,
          width: `calc((100% - 24px) * ${progress / 100})`,
          height: 3, borderRadius: 2,
          background: 'linear-gradient(90deg, var(--sd-blue-600) 0%, var(--sd-vital-500) 100%)',
        }}></div>

        {/* milestone stops */}
        {milestones.map((m, i) => {
          const frac = durationMonths ? Math.max(0, Math.min(1, m.month / durationMonths)) : 0;
          const left = `calc(12px + (100% - 24px) * ${frac})`;
          const isPast = m.month < realMonth;
          const isCurrent = !beforeStart && i === currentIdx;
          const isInspect = i === inspectIdx && i !== currentIdx;
          const isFuture = m.month > realMonth;
          const mDate = start ? addMonths(start, m.month) : null;
          return (
            <button key={m.id || i}
              onClick={() => onInspect && onInspect(i)}
              title={`${m.label} · ${fmtMY(mDate)}`}
              style={{
                position:'absolute', top: 0, left, transform:'translateX(-50%)',
                display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
                background:'none', border:'none', cursor:'pointer', padding: 0,
              }}>
              {/* dot */}
              <div style={{
                width: isCurrent ? 22 : 18, height: isCurrent ? 22 : 18,
                borderRadius:'50%',
                background: isCurrent ? 'var(--sd-blue-600)' : isPast ? 'var(--sd-vital-500)' : 'var(--bg-surface)',
                border: isInspect ? '2px solid var(--sd-blue-600)' : isFuture ? '2px solid var(--border-strong)' : '2px solid white',
                boxShadow: isCurrent ? '0 0 0 4px rgba(0,128,176,0.25)' : isInspect ? '0 0 0 3px rgba(0,128,176,0.18)' : 'none',
                marginTop: isCurrent ? 7 : 9,
                display:'grid', placeItems:'center',
                color:'white',
                transition: 'all var(--dur-1) var(--ease-out)',
              }}>
                {isPast && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6L9 17l-5-5"/></svg>
                )}
                {isCurrent && (
                  <div style={{width: 6, height: 6, borderRadius:'50%', background:'white'}}></div>
                )}
              </div>
              {/* label */}
              <div style={{
                fontSize: 10,
                fontWeight: isCurrent ? 700 : (isPast ? 600 : 500),
                color: isCurrent ? 'var(--sd-blue-700)' : isPast ? 'var(--fg-default)' : 'var(--fg-subtle)',
                whiteSpace:'nowrap',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}>{m.label}</div>
              <div style={{
                fontSize: 9,
                color: isCurrent ? 'var(--sd-blue-600)' : 'var(--fg-subtle)',
                fontFamily:'var(--font-mono)',
              }}>{fmtMY(mDate)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================
// Clinical metric tile (comparativo inicio → actual → meta)
// =============================================================
function MetricTile({ m }) {
  const status = metricStatus(m);
  const ss = STATUS_STYLE[status] || STATUS_STYLE.estable;
  const cur = m.raw ? m.current : (Number.isFinite(+m.current) ? (+m.current).toFixed(1) : m.current);

  // Change so far = current − initial (the actual progress, not the plan)
  let change = null;
  if (!m.raw && Number.isFinite(+m.current) && Number.isFinite(+m.initial)) {
    const delta = +m.current - +m.initial;
    change = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${m.unit || ''}`;
  } else if (m.raw) {
    change = `${m.initial} → ${m.current}`;
  }

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-md)',
      padding:'12px 14px',
      display:'flex', flexDirection:'column', gap: 6,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing: 'var(--ls-wide)',
      }}>{m.label}</div>

      <div style={{display:'flex', alignItems:'baseline', gap: 6}}>
        <span style={{
          fontFamily:'var(--font-display)', fontWeight: 800,
          fontSize:'var(--t-20)', color:'var(--fg-strong)', lineHeight: 1,
        }}>{cur}{!m.raw && <span style={{fontSize:'var(--t-12)', fontWeight: 600, color:'var(--fg-muted)', marginLeft: 2}}>{m.unit}</span>}</span>
      </div>

      <div style={{display:'flex', alignItems:'center', gap: 6, fontSize: 'var(--t-12)', color:'var(--fg-muted)', fontFamily:'var(--font-mono)'}}>
        <span>inicio: <strong style={{color:'var(--fg-default)'}}>{m.initial}{!m.raw && m.unit}</strong></span>
        <span style={{margin:'0 4px'}}>→</span>
        <span>meta: <strong style={{color:'var(--fg-default)'}}>{m.target}{!m.raw && m.unit}</strong></span>
      </div>

      <span style={{
        display:'inline-flex', alignItems:'center', gap: 4,
        padding:'2px 8px', borderRadius:'var(--r-pill)',
        background: ss.bg, color: ss.fg,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform:'uppercase',
        width:'fit-content',
      }}>
        <span style={{
          width: 14, height: 14, borderRadius:'50%', background: ss.fg, color:'white',
          display:'grid', placeItems:'center', fontSize: 9, fontWeight: 800,
        }}>{ss.icon}</span>
        {ss.label}{change != null && ` · ${change}`}
      </span>
    </div>
  );
}

// =============================================================
// Summary cards (small cards at bottom)
// =============================================================
function SummaryCard({ title, icon, items, accent }) {
  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-md)',
      padding:'14px 16px',
      display:'flex', flexDirection:'column', gap: 8,
      minHeight: 120,
    }}>
      <div style={{display:'flex', alignItems:'center', gap: 8}}>
        <div style={{
          width: 26, height: 26, borderRadius:'var(--r-sm)',
          background: accent || 'var(--sd-blue-100)',
          color: accent ? 'white' : 'var(--sd-blue-700)',
          display:'grid', placeItems:'center',
        }}>{icon}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-13)', color:'var(--fg-strong)'}}>
          {title}
        </div>
      </div>
      <ul style={{margin: 0, padding: 0, listStyle:'none', display:'flex', flexDirection:'column', gap: 4}}>
        {items.length === 0 && (
          <li style={{fontSize:'var(--t-12)', color:'var(--fg-subtle)', fontStyle:'italic'}}>Sin registros</li>
        )}
        {items.map((it, i) => (
          <li key={i} style={{
            fontSize: 'var(--t-12)', color:'var(--fg-default)',
            display:'flex', gap: 6, alignItems:'baseline',
          }}>
            <span style={{color:'var(--sd-blue-600)', fontWeight: 800}}>·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================
// Before / after PHOTO comparison (real clinical photos)
// Two uploaded images revealed by a draggable divider.
// Photos live inside the shared `media` object (keys evo_before /
// evo_after) so they persist with "Guardar Consulta" like the rest.
// =============================================================
function PhotoDrop({ label, onClick, busy }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      style={{
        position:'absolute', inset: 0, width:'100%', height:'100%',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 10,
        border:'none', cursor: busy ? 'default' : 'pointer',
        background:'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 10px, rgba(255,255,255,0.09) 10px 20px)',
        color:'rgba(255,255,255,0.88)',
      }}>
      {busy ? (
        <span style={{fontSize:'var(--t-13)', fontWeight: 600}}>Procesando…</span>
      ) : (
        <>
          <div style={{width: 44, height: 44, borderRadius:'50%', background:'rgba(255,255,255,0.14)', display:'grid', placeItems:'center'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <span style={{fontSize:'var(--t-13)', fontWeight: 700}}>Subir {label}</span>
        </>
      )}
    </button>
  );
}

function PhotoChip({ title, onClick, icon }) {
  return (
    <button type="button" title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 24, height: 24, borderRadius:'50%', border:'none',
        background:'rgba(11,20,36,0.62)', color:'white', cursor:'pointer',
        display:'grid', placeItems:'center', padding: 0,
      }}>
      {icon === 'x' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h12l-3-3M21 17H9l3 3"/></svg>
      )}
    </button>
  );
}

function EvoPhotoCompare({ media = {}, setMedia = () => {} }) {
  const [slider, setSlider] = useStateE(50);
  const [uploading, setUploading] = useStateE(null); // 'before' | 'after' | null
  const [err, setErr] = useStateE(null);
  const frameRef = useRefE(null);
  const beforeInput = useRefE(null);
  const afterInput = useRefE(null);

  const before = media && media.evo_before;
  const after  = media && media.evo_after;
  const both = !!(before && after);
  const bothEmpty = !before && !after;
  const revealAt = both ? slider : 50;

  const setPhoto = (key, url) => setMedia({ ...(media || {}), [key]: url });
  const clearPhoto = (key) => {
    const next = { ...(media || {}) };
    delete next[key];
    setMedia(next);
  };

  const handleFile = async (key, file) => {
    if (!file) return;
    if (!isHeicFile(file) && (!file.type || !file.type.startsWith('image/'))) { setErr('El archivo no es una imagen'); return; }
    setUploading(key === 'evo_before' ? 'before' : 'after'); setErr(null);
    try {
      setPhoto(key, await resizeImageFile(file));
    } catch (e) {
      setErr((e && e.message) || 'No se pudo procesar la imagen');
    } finally {
      setUploading(null);
    }
  };

  const handleDrag = (e) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setSlider(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  const pickBefore = () => beforeInput.current && beforeInput.current.click();
  const pickAfter  = () => afterInput.current && afterInput.current.click();
  const imgStyle = { position:'absolute', inset: 0, width:'100%', height:'100%', objectFit:'cover', display:'block' };
  const pillStyle = (left) => ({
    position:'absolute', top: 12, [left ? 'left' : 'right']: 12, zIndex: 4,
    padding:'4px 10px', borderRadius:'var(--r-pill)',
    background:'rgba(11,20,36,0.78)', color:'white',
    fontSize: 10, fontWeight: 800, letterSpacing:'var(--ls-wide)',
    display:'flex', alignItems:'center', gap: 6, fontFamily:'var(--font-display)',
  });

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-lg)',
      padding:'var(--sp-5) var(--sp-6) var(--sp-4)',
      boxShadow:'var(--shadow-xs)',
    }}>
      {/* Hidden file inputs */}
      <input ref={beforeInput} type="file" accept="image/*,.heic,.heif" style={{display:'none'}}
        onChange={e => { handleFile('evo_before', e.target.files && e.target.files[0]); e.target.value = ''; }} />
      <input ref={afterInput} type="file" accept="image/*,.heic,.heif" style={{display:'none'}}
        onChange={e => { handleFile('evo_after', e.target.files && e.target.files[0]); e.target.value = ''; }} />

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 14, gap: 12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-18)', color:'var(--fg-strong)'}}>
            Comparativa antes / después
          </div>
          <div style={{display:'flex', alignItems:'center', gap: 6, fontSize:'var(--t-12)', color:'var(--fg-muted)', marginTop: 4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 12h8M12 8l-4 4 4 4"/></svg>
            <span>{bothEmpty ? 'Sube dos fotografías clínicas para comparar la transformación'
                            : both ? 'Arrastra el divisor para comparar las fotografías'
                                   : 'Sube la fotografía que falta para activar el comparador'}</span>
          </div>
        </div>
        {both && (
          <div style={{display:'flex', alignItems:'center', gap: 8, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
            <span style={{fontFamily:'var(--font-mono)'}}>0 %</span>
            <span style={{
              padding:'2px 10px', borderRadius:'var(--r-pill)',
              background:'var(--sd-blue-100)', color:'var(--sd-blue-700)',
              fontFamily:'var(--font-mono)', fontWeight: 800, fontSize: 11,
            }}>{Math.round(slider)} %</span>
            <span style={{fontFamily:'var(--font-mono)'}}>100 %</span>
          </div>
        )}
      </div>

      {bothEmpty ? (
        /* ---- Empty state: upload both photos ---- */
        <div style={{
          border:'2px dashed var(--border-strong)',
          borderRadius:'var(--r-md)',
          padding:'40px 24px',
          display:'flex', flexDirection:'column', alignItems:'center', gap: 16,
          textAlign:'center', background:'var(--bg-app)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius:'var(--r-lg)',
            background:'var(--sd-blue-100)', color:'var(--sd-blue-700)',
            display:'grid', placeItems:'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6V4h8v2"/></svg>
          </div>
          <div style={{maxWidth: 440}}>
            <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-15)', color:'var(--fg-strong)', marginBottom: 4}}>
              Comparativa con fotografías clínicas
            </div>
            <div style={{fontSize:'var(--t-12)', color:'var(--fg-muted)', lineHeight: 1.5}}>
              Sube la <strong>foto inicial</strong> (antes del tratamiento) y la <strong>foto actual</strong> (después). El divisor te dejará deslizar entre ambas.
            </div>
          </div>
          <div style={{display:'flex', gap: 10, flexWrap:'wrap', justifyContent:'center'}}>
            <button type="button" className="btn btn-primary" style={{cursor: uploading ? 'default' : 'pointer'}} onClick={pickBefore} disabled={!!uploading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              {uploading === 'before' ? 'Procesando…' : 'Subir foto inicial'}
            </button>
            <button type="button" className="btn btn-ghost" style={{cursor: uploading ? 'default' : 'pointer'}} onClick={pickAfter} disabled={!!uploading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              {uploading === 'after' ? 'Procesando…' : 'Subir foto actual'}
            </button>
          </div>
        </div>
      ) : (
        /* ---- Compare frame ---- */
        <div ref={frameRef}
          onMouseMove={(e) => both && e.buttons === 1 && handleDrag(e)}
          onTouchMove={(e) => both && handleDrag(e)}
          style={{
            position:'relative', width:'100%',
            aspectRatio: '16 / 10',
            borderRadius:'var(--r-md)', overflow:'hidden',
            background:'#0b0f17',
          }}>

          {/* BEFORE layer (full) */}
          {before
            ? <img src={before} alt="Antes del tratamiento" style={imgStyle} />
            : <PhotoDrop label="foto inicial" onClick={pickBefore} busy={uploading === 'before'} />}

          {/* AFTER layer (clipped reveal from the divider) */}
          <div style={{position:'absolute', inset: 0, clipPath:`inset(0 0 0 ${revealAt}%)`, overflow:'hidden'}}>
            {after
              ? <img src={after} alt="Después del tratamiento" style={imgStyle} />
              : <PhotoDrop label="foto actual" onClick={pickAfter} busy={uploading === 'after'} />}
          </div>

          {/* ANTES / DESPUÉS labels */}
          <div style={pillStyle(true)}>
            <span style={{width: 5, height: 5, borderRadius:'50%', background:'#E0992E'}}></span>
            ANTES
          </div>
          <div style={pillStyle(false)}>
            <span style={{width: 5, height: 5, borderRadius:'50%', background:'#2BA86A'}}></span>
            DESPUÉS
          </div>

          {/* Per-side replace / remove controls (when that photo exists) */}
          {before && (
            <div style={{position:'absolute', top: 42, left: 12, zIndex: 6, display:'flex', gap: 6}}>
              <PhotoChip title="Reemplazar foto inicial" onClick={pickBefore} icon="swap" />
              <PhotoChip title="Quitar foto inicial" onClick={() => clearPhoto('evo_before')} icon="x" />
            </div>
          )}
          {after && (
            <div style={{position:'absolute', top: 42, right: 12, zIndex: 6, display:'flex', gap: 6}}>
              <PhotoChip title="Reemplazar foto actual" onClick={pickAfter} icon="swap" />
              <PhotoChip title="Quitar foto actual" onClick={() => clearPhoto('evo_after')} icon="x" />
            </div>
          )}

          {/* Divider (draggable handle only when both photos present) */}
          <div style={{
            position:'absolute', top: 0, bottom: 0,
            left: `${revealAt}%`, width: 2,
            background:'white', transform:'translateX(-50%)',
            boxShadow:'0 0 16px rgba(11,20,36,0.25)',
            zIndex: 3, pointerEvents:'none',
          }}>
            {both && (
              <div style={{
                position:'absolute', top:'50%', left:'50%',
                transform:'translate(-50%, -50%)',
                width: 44, height: 44, borderRadius:'50%',
                background:'white',
                boxShadow:'var(--shadow-lg), 0 0 0 4px rgba(0,128,176,0.2)',
                display:'grid', placeItems:'center',
                cursor:'ew-resize', pointerEvents:'auto',
                color:'var(--sd-navy-800)', border:'1px solid var(--border-default)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 6l-4 6 4 6M16 6l4 6-4 6"/>
                </svg>
              </div>
            )}
          </div>

          {/* Invisible range input for dragging — only when both photos present */}
          {both && (
            <input type="range" min="0" max="100" step="0.1" value={slider}
              onChange={e => setSlider(+e.target.value)}
              aria-label="Comparar antes y después"
              style={{
                position:'absolute', inset: 0, width:'100%', height:'100%',
                opacity: 0, cursor:'ew-resize', zIndex: 5,
              }} />
          )}
        </div>
      )}

      {err && (
        <div style={{
          marginTop: 10, padding:'8px 12px', borderRadius:'var(--r-md)',
          background:'var(--sd-critical-100)', color:'var(--sd-critical-600)',
          fontSize:'var(--t-12)', fontWeight: 600,
        }}>{err}</div>
      )}
    </div>
  );
}

// =============================================================
// Plan editor — revealed by "Editar plan"
// =============================================================
function EditorSection({ title, children }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap: 8}}>
      <div style={{
        fontSize: 10, fontWeight: 700, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing:'var(--ls-wide)',
      }}>{title}</div>
      {children}
    </div>
  );
}

function PlanEditor({ tx, patch }) {
  const start = parseDate(tx.startDate);
  const setMilestone = (i, mp) => patch({ milestones: tx.milestones.map((m, j) => j === i ? { ...m, ...mp } : m) });
  const setMetric = (i, mp) => patch({ metrics: tx.metrics.map((m, j) => j === i ? { ...m, ...mp } : m) });

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--sd-blue-300)',
      borderRadius:'var(--r-lg)',
      padding:'18px 20px',
      display:'flex', flexDirection:'column', gap: 18,
    }}>
      <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-15)', color:'var(--fg-strong)'}}>
        Editar plan de tratamiento
      </div>

      {/* Dates / duration */}
      <EditorSection title="Fechas y duración">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap: 10}}>
          <label style={{display:'flex', flexDirection:'column', gap: 4, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
            Inicio del tratamiento
            <EInput type="date" value={tx.startDate || ''} onChange={v => patch({ startDate: v || null })} />
          </label>
          <label style={{display:'flex', flexDirection:'column', gap: 4, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
            Duración (meses)
            <EInput type="number" min="1" max="60" value={tx.durationMonths}
              onChange={v => patch({ durationMonths: Math.max(1, parseInt(v) || 1) })} />
          </label>
          <label style={{display:'flex', flexDirection:'column', gap: 4, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
            Próximo control
            <EInput type="date" value={tx.nextControl || ''} onChange={v => patch({ nextControl: v || null })} />
          </label>
        </div>
        {start && (
          <div style={{fontSize:'var(--t-12)', color:'var(--fg-subtle)'}}>
            Fin estimado: <strong style={{color:'var(--fg-default)'}}>{fmtDMY(addMonths(start, tx.durationMonths))}</strong>
          </div>
        )}
      </EditorSection>

      {/* Milestones */}
      <EditorSection title="Etapas del tratamiento">
        <div style={{display:'flex', flexDirection:'column', gap: 8}}>
          {tx.milestones.map((m, i) => (
            <div key={m.id || i} style={{
              display:'grid', gridTemplateColumns:'1.3fr 64px 1fr 2fr 26px', gap: 6, alignItems:'center',
            }}>
              <EInput value={m.label} placeholder="Etapa" onChange={v => setMilestone(i, { label: v })} />
              <EInput type="number" min="0" value={m.month} title="Mes" onChange={v => setMilestone(i, { month: Math.max(0, parseInt(v) || 0) })} />
              <EInput value={m.archwire || ''} placeholder="Arco" onChange={v => setMilestone(i, { archwire: v })} />
              <EInput value={m.objective || ''} placeholder="Objetivo" onChange={v => setMilestone(i, { objective: v })} />
              <IconBtn danger title="Quitar etapa" onClick={() => patch({ milestones: tx.milestones.filter((_, j) => j !== i) })}>{ICON_X}</IconBtn>
            </div>
          ))}
          <div style={{display:'flex', gap: 6, fontSize: 9, color:'var(--fg-subtle)', textTransform:'uppercase', letterSpacing: 0.4, padding:'0 2px'}}>
            <span style={{flex:'1.3'}}>Etapa</span><span style={{width:64}}>Mes</span><span style={{flex:1}}>Arco</span><span style={{flex:2}}>Objetivo</span><span style={{width:26}}></span>
          </div>
          <div>
            <AddBtn onClick={() => patch({ milestones: [...tx.milestones, { id: uid('ms'), label: 'Nueva etapa', month: tx.durationMonths, objective: '', archwire: '' }] })}>Agregar etapa</AddBtn>
          </div>
        </div>
      </EditorSection>

      {/* Metrics */}
      <EditorSection title="Métricas clínicas (inicio → actual → meta)">
        <div style={{display:'flex', flexDirection:'column', gap: 8}}>
          {tx.metrics.map((m, i) => (
            <div key={m.id || i} style={{
              display:'grid', gridTemplateColumns:'1.4fr 70px 70px 70px 54px 26px', gap: 6, alignItems:'center',
            }}>
              <EInput value={m.label} placeholder="Métrica" onChange={v => setMetric(i, { label: v })} />
              <EInput type={m.raw ? 'text' : 'number'} value={m.initial} title="Inicio" onChange={v => setMetric(i, { initial: m.raw ? v : v })} />
              <EInput type={m.raw ? 'text' : 'number'} value={m.current} title="Actual" onChange={v => setMetric(i, { current: m.raw ? v : v })} />
              <EInput type={m.raw ? 'text' : 'number'} value={m.target} title="Meta" onChange={v => setMetric(i, { target: m.raw ? v : v })} />
              <EInput value={m.raw ? '' : (m.unit || '')} placeholder="ud." title="Unidad" disabled={m.raw}
                onChange={v => setMetric(i, { unit: v })} style={m.raw ? { opacity: 0.4 } : undefined} />
              <IconBtn danger title="Quitar métrica" onClick={() => patch({ metrics: tx.metrics.filter((_, j) => j !== i) })}>{ICON_X}</IconBtn>
            </div>
          ))}
          <div style={{display:'flex', gap: 6, fontSize: 9, color:'var(--fg-subtle)', textTransform:'uppercase', letterSpacing: 0.4, padding:'0 2px'}}>
            <span style={{flex:'1.4'}}>Métrica</span><span style={{width:70}}>Inicio</span><span style={{width:70}}>Actual</span><span style={{width:70}}>Meta</span><span style={{width:54}}>Unid.</span><span style={{width:26}}></span>
          </div>
          <div style={{display:'flex', gap: 8, flexWrap:'wrap'}}>
            <AddBtn onClick={() => patch({ metrics: [...tx.metrics, { id: uid('mt'), label: 'Nueva métrica', unit: 'mm', initial: 0, current: 0, target: 0 }] })}>Métrica numérica</AddBtn>
            <AddBtn onClick={() => patch({ metrics: [...tx.metrics, { id: uid('mt'), label: 'Clase', raw: true, initial: 'II', current: 'II', target: 'I' }] })}>Métrica de clase</AddBtn>
          </div>
        </div>
      </EditorSection>

      {/* Text lists */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap: 16}}>
        <EditorSection title="Cambios observados">
          <EditableList items={tx.observedChanges} placeholder="Cambio observado…" addLabel="Agregar cambio"
            onChange={v => patch({ observedChanges: v })} />
        </EditorSection>
        <EditorSection title="Próximos pasos">
          <EditableList items={tx.nextSteps} placeholder="Próximo paso…" addLabel="Agregar paso"
            onChange={v => patch({ nextSteps: v })} />
        </EditorSection>
        <EditorSection title="Alertas clínicas">
          <EditableList items={tx.alerts} placeholder="Alerta…" addLabel="Agregar alerta"
            onChange={v => patch({ alerts: v })} />
        </EditorSection>
      </div>

      {/* Case notes */}
      <EditorSection title="Notas del caso">
        <textarea value={tx.caseNotes} onChange={e => patch({ caseNotes: e.target.value })}
          placeholder="Notas clínicas del caso…"
          style={{ ...editInputStyle, minHeight: 70, resize:'vertical', lineHeight: 1.5 }} />
      </EditorSection>
    </div>
  );
}

// =============================================================
// Main view
// =============================================================
function EvolucionViewV2({ month = 4, setMonth = () => {}, media = {}, setMedia = () => {}, treatment, setTreatment = () => {} }) {
  const tx = useMemoE(() => normalizeTreatment(treatment), [treatment]);
  const today = useMemoE(() => new Date(), []);
  const [editing, setEditing] = useStateE(false);
  const [inspectIdx, setInspectIdx] = useStateE(null);

  const patch = (p) => setTreatment({ ...tx, ...p });

  const start = parseDate(tx.startDate);
  const duration = tx.durationMonths || 18;
  // Milestones sorted by month for a coherent timeline
  const milestones = useMemoE(() => [...tx.milestones].sort((a, b) => a.month - b.month), [tx.milestones]);

  // Real elapsed month (computed from startDate); falls back to the persisted scrubber value
  const realMonth = start
    ? Math.max(0, Math.min(duration, Math.round(monthsBetween(start, today))))
    : (typeof month === 'number' ? month : 4);
  const progress = duration ? Math.max(0, Math.min(100, (realMonth / duration) * 100)) : 0;

  // Current stage = last milestone reached. reachedIdx === -1 means treatment
  // hasn't reached even the first milestone yet ("por iniciar").
  const reachedIdx = milestones.reduce((acc, m, i) => m.month <= realMonth ? i : acc, -1);
  const beforeStart = reachedIdx < 0;
  const currentIdx = beforeStart ? 0 : reachedIdx;
  // Stage being inspected (clicking a dot); defaults to current
  const shownIdx = inspectIdx != null && milestones[inspectIdx] ? inspectIdx : currentIdx;
  const currentMilestone = milestones[currentIdx] || milestones[0] || {};
  const shownMilestone = milestones[shownIdx] || currentMilestone;
  const isInspectingOther = shownIdx !== currentIdx;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'var(--sp-4)'}}>
      {/* ============ Comparativa antes/después (fotografías reales) ============ */}
      <EvoPhotoCompare media={media} setMedia={setMedia} />

      {/* ============ Clinical metrics row ============ */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, color:'var(--fg-muted)',
          textTransform:'uppercase', letterSpacing:'var(--ls-widest)',
          marginBottom: 8, padding:'0 4px',
        }}>Métricas clínicas comparativas</div>
        <div style={{
          display:'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}>
          {tx.metrics.map(m => <MetricTile key={m.id} m={m} />)}
        </div>
      </div>

      {/* ============ Milestone timeline ============ */}
      <MilestoneTimeline
        milestones={milestones}
        startDate={tx.startDate}
        durationMonths={duration}
        realMonth={realMonth}
        today={today}
        progress={progress}
        currentIdx={currentIdx}
        beforeStart={beforeStart}
        inspectIdx={shownIdx}
        onInspect={(i) => setInspectIdx(i === currentIdx ? null : i)}
        onEditPlan={() => setEditing(e => !e)}
        editing={editing}
      />

      {/* ============ Plan editor (toggled) ============ */}
      {editing && <PlanEditor tx={tx} patch={patch} />}

      {/* ============ Summary cards ============ */}
      <div style={{
        display:'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
      }}>
        <SummaryCard
          title={isInspectingOther ? `Etapa · ${shownMilestone.label}` : (beforeStart ? 'Tratamiento por iniciar' : `Cita actual · Mes ${realMonth}`)}
          accent="var(--sd-blue-600)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
          items={[
            start ? fmtMY(addMonths(start, shownMilestone.month || 0)) : `Mes ${shownMilestone.month || 0}`,
            `Arco: ${shownMilestone.archwire || '—'}`,
            isInspectingOther ? 'Etapa seleccionada' : 'Próxima cita: 4 semanas',
          ]}
        />
        <SummaryCard
          title={isInspectingOther ? 'Objetivo de la etapa' : 'Objetivo del mes'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>}
          items={shownMilestone.objective ? [shownMilestone.objective] : []}
        />
        <SummaryCard
          title="Cambios observados"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c0-6 4-10 9-10s9 4 9 10"/></svg>}
          items={tx.observedChanges}
        />
        <SummaryCard
          title="Próximos pasos"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
          items={tx.nextSteps}
        />
        <SummaryCard
          title="Alertas clínicas"
          accent="var(--sd-alert-500)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v5M12 16v.01"/><path d="M10.3 3.86L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>}
          items={tx.alerts}
        />
      </div>
    </div>
  );
}

// =============================================================
// Right-side panel — evolution focused
// =============================================================
function EvolucionAnalysisPanel({ month = 4, treatment }) {
  const tx = normalizeTreatment(treatment);
  const today = useMemoE(() => new Date(), []);
  const start = parseDate(tx.startDate);
  const duration = tx.durationMonths || 18;
  const milestones = [...tx.milestones].sort((a, b) => a.month - b.month);

  const realMonth = start
    ? Math.max(0, Math.min(duration, Math.round(monthsBetween(start, today))))
    : (typeof month === 'number' ? month : 4);
  const progress = duration ? Math.round(Math.max(0, Math.min(100, (realMonth / duration) * 100))) : 0;
  const reachedIdx = milestones.reduce((acc, m, i) => m.month <= realMonth ? i : acc, -1);
  const beforeStart = reachedIdx < 0;
  const currentIdx = beforeStart ? 0 : reachedIdx;
  const stage = beforeStart ? { label: 'Por iniciar' } : (milestones[currentIdx] || milestones[0] || { label: '—' });
  // When still before the first milestone, the "next" stage is that first milestone itself.
  const nextStage = beforeStart ? milestones[0] : milestones[currentIdx + 1];

  const endDate = start ? addMonths(start, duration) : null;
  const nextControlDate = parseDate(tx.nextControl) || new Date(today.getTime() + 28 * 86400000);
  const nextMilestoneDate = start && nextStage ? addMonths(start, nextStage.month) : null;

  // "Principales cambios clínicos" — derived from metrics + alerts
  const metricChanges = tx.metrics.map(m => {
    const status = metricStatus(m);
    const txt = m.raw
      ? `${m.label}: ${m.initial} → ${m.current}` + (String(m.current) === String(m.target) ? '' : ` (meta ${m.target})`)
      : `${m.label}: ${m.initial} → ${m.current} ${m.unit || ''}`.trim();
    return { txt, s: status };
  });
  const alertChanges = tx.alerts.map(a => ({ txt: a, s: 'alerta' }));
  const keyChanges = [...metricChanges, ...alertChanges];

  return (
    <aside className="detail">
      <div className="detail-header">
        <div className="detail-fdi">Evolución del tratamiento</div>
        <div className="detail-name">{stage.label}</div>
        <div className="detail-meta">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Mes {realMonth} de {duration}
          </span>
        </div>
      </div>

      <div className="detail-body">
        {/* Progress */}
        <div className="detail-section">
          <div className="detail-section-title">Progreso global</div>
          <div className="evo-progress-card" style={{
            padding: 14, borderRadius:'var(--r-md)',
            background:'var(--sd-blue-100)', border:'1px solid var(--sd-blue-300)',
          }}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
              <span className="evo-progress-label" style={{fontSize: 11, color:'var(--sd-blue-700)', fontWeight: 700, textTransform:'uppercase', letterSpacing:'var(--ls-wide)'}}>
                Avance estimado
              </span>
              <span className="evo-progress-value" style={{fontFamily:'var(--font-display)', fontWeight: 800, fontSize:'var(--t-32)', color:'var(--sd-navy-800)', lineHeight: 1}}>
                {progress}<span style={{fontSize:'var(--t-14)', fontWeight: 700, marginLeft: 2}}>%</span>
              </span>
            </div>
            <div style={{
              marginTop: 10, height: 8, borderRadius: 4,
              background:'rgba(255,255,255,0.6)',
              overflow:'hidden',
            }}>
              <div style={{
                width: `${progress}%`, height:'100%',
                background:'linear-gradient(90deg, var(--sd-blue-600), var(--sd-vital-500))',
                borderRadius: 4,
                transition: 'width var(--dur-3) var(--ease-out)',
              }}></div>
            </div>
          </div>
        </div>

        {/* Date info */}
        <div className="detail-section">
          <div className="detail-section-title">Fechas clave</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
            <DateCard label="Inicio" date={fmtDMY(start)} sub={start ? relLabel(start, today) : 'sin definir'} />
            <DateCard label="Fin estimado" date={fmtDMY(endDate)} sub={endDate ? relLabel(endDate, today) : '—'} />
            <DateCard label="Próximo control" date={fmtDMY(nextControlDate)} sub={relLabel(nextControlDate, today)} accent />
            <DateCard label="Próximo hito" date={nextStage ? (nextMilestoneDate ? fmtDMY(nextMilestoneDate) : `Mes ${nextStage.month}`) : '—'} sub={nextStage ? nextStage.label : 'final'} />
          </div>
        </div>

        {/* Key changes */}
        <div className="detail-section">
          <div className="detail-section-title">Principales cambios clínicos</div>
          <ul style={{margin: 0, padding: 0, listStyle:'none', display:'flex', flexDirection:'column', gap: 6}}>
            {keyChanges.length === 0 && (
              <li style={{fontSize:'var(--t-12)', color:'var(--fg-subtle)', fontStyle:'italic'}}>Sin cambios registrados</li>
            )}
            {keyChanges.map((it, i) => {
              const ss = STATUS_STYLE[it.s] || STATUS_STYLE.estable;
              return (
                <li key={i} style={{
                  padding:'8px 10px',
                  background:'var(--sd-ink-50)', borderRadius:'var(--r-md)',
                  fontSize:'var(--t-12)', color:'var(--fg-default)',
                  display:'flex', gap: 8, alignItems:'flex-start',
                  borderLeft: `3px solid ${ss.fg}`,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius:'50%', background: ss.fg, color:'white',
                    display:'grid', placeItems:'center', fontSize: 9, fontWeight: 800, flexShrink: 0,
                    marginTop: 1,
                  }}>{ss.icon}</span>
                  <span>{it.txt}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Case notes */}
        <div className="detail-section">
          <div className="detail-section-title">Notas del caso</div>
          <div style={{
            padding: 12, borderRadius:'var(--r-md)',
            background:'var(--bg-surface)', border:'1px solid var(--border-default)',
            fontSize:'var(--t-12)', color:'var(--fg-default)', lineHeight: 1.5,
            whiteSpace:'pre-wrap',
          }}>
            {tx.caseNotes || 'Sin notas.'}
          </div>
        </div>

        {/* Quick actions */}
        <div className="detail-section">
          <div className="detail-section-title">Acciones</div>
          <div style={{display:'flex', flexDirection:'column', gap: 6}}>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c0-6 4-10 9-10s9 4 9 10"/></svg>
              Generar reporte de evolución
            </button>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              Agendar próxima cita
            </button>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
              Exportar comparativa
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DateCard({ label, date, sub, accent }) {
  return (
    <div style={{
      padding: 10, borderRadius:'var(--r-md)',
      background: accent ? 'var(--sd-blue-50)' : 'var(--bg-surface)',
      border: '1px solid ' + (accent ? 'var(--sd-blue-300)' : 'var(--border-default)'),
      display:'flex', flexDirection:'column', gap: 2,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing: 'var(--ls-widest)',
      }}>{label}</span>
      <span style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-13)', color:'var(--fg-strong)'}}>{date}</span>
      <span style={{fontSize: 10, color:'var(--fg-muted)'}}>{sub}</span>
    </div>
  );
}

// Expose
Object.assign(window, {
  EvolucionView: EvolucionViewV2,
  EvolucionAnalysisPanel,
  seedTreatment,
  normalizeTreatment,
});
