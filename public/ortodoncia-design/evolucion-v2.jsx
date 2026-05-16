/* global React, ArchToothV2, CrownDefs, UPPER_FDI, LOWER_FDI, fdiToType */
// ============================================================
// evolucion-v2.jsx — Treatment evolution view (redesigned)
// Clean before/after slider, clinical metrics, milestone timeline,
// summary cards, evolution-focused right panel.
// ============================================================

const { useState: useStateE, useRef: useRefE, useMemo: useMemoE } = React;

// =============================================================
// Treatment milestone data
// =============================================================
const TX_MILESTONES = [
  { id: 'inicio',    label: 'Inicio',            month: 0,  date: 'Ene 2026', icon: 'play',
    objective: 'Cementado de brackets y bandas. Educación del paciente.',
    archwire: '.014 NiTi' },
  { id: 'alineacion', label: 'Alineación',       month: 2,  date: 'Mar 2026', icon: 'align',
    objective: 'Corrección de rotaciones y apiñamiento anterior.',
    archwire: '.016 NiTi' },
  { id: 'nivelacion', label: 'Nivelación',       month: 4,  date: 'May 2026', icon: 'level',
    objective: 'Curva de Spee y nivelación de marginal ridges.',
    archwire: '.018 NiTi' },
  { id: 'torque',    label: 'Control de torque', month: 8,  date: 'Sep 2026', icon: 'torque',
    objective: 'Inclinación radicular y control vestíbulo-lingual.',
    archwire: '.019×.025 NiTi' },
  { id: 'cierre',    label: 'Cierre de espacios', month: 12, date: 'Ene 2027', icon: 'close',
    objective: 'Mecánica de deslizamiento. Cadenetas elásticas.',
    archwire: '.019×.025 SS' },
  { id: 'refinamiento', label: 'Refinamiento',  month: 16, date: 'May 2027', icon: 'polish',
    objective: 'Detallado oclusal, paralelismo radicular, gemelas.',
    archwire: '.019×.025 SS' },
  { id: 'final',     label: 'Finalización',      month: 18, date: 'Jul 2027', icon: 'check',
    objective: 'Retirada de aparatos. Retenedores fijos + Hawley.',
    archwire: 'Retenedor' },
];

// Clinical metrics: initial → final values
const TX_METRICS = [
  { id: 'overjet',     label: 'Overjet',        unit:'mm', initial: 5.2, final: 2.5, status: 'mejoro' },
  { id: 'overbite',    label: 'Overbite',       unit:'mm', initial: 4.0, final: 2.5, status: 'mejoro' },
  { id: 'crowding_s',  label: 'Apiñ. sup',      unit:'mm', initial:-3.5, final:-0.5, status: 'mejoro' },
  { id: 'crowding_i',  label: 'Apiñ. inf',      unit:'mm', initial:-2.0, final: 0.0, status: 'mejoro' },
  { id: 'midline',     label: 'Línea media',    unit:'mm', initial: 0.5, final: 0.0, status: 'mejoro' },
  { id: 'class_mol',   label: 'Clase molar',    raw: true, initial:'II',  final:'I',  status: 'mejoro' },
  { id: 'class_can',   label: 'Clase canina',   raw: true, initial:'II',  final:'I',  status: 'mejoro' },
];

const STATUS_STYLE = {
  mejoro:    { bg:'var(--sd-vital-100)',    fg:'var(--sd-vital-600)',    label: 'mejoró',    icon: '↑' },
  estable:   { bg:'var(--sd-info-100)',     fg:'var(--sd-info-600)',     label: 'estable',   icon: '=' },
  pendiente: { bg:'var(--sd-alert-100)',    fg:'var(--sd-alert-600)',    label: 'pendiente', icon: '·' },
  alerta:    { bg:'var(--sd-critical-100)', fg:'var(--sd-critical-600)', label: 'alerta',    icon: '!' },
};

// =============================================================
// Tooth positions for before/after (upper arch)
// "Before" has random misalignment, "after" is clean
// =============================================================
function getEvoArchPositions(state) {
  // state: 'before' or 'after'
  // Reuse the flat layout from plano but with tighter spacing
  const widths = UPPER_FDI.map(f => ({ m3: 36, m2: 42, m1: 46, p2: 36, p1: 36, c: 34, il: 30, ci: 36 })[fdiToType(f)] || 36);
  const gap = 6;
  const totalW = widths.reduce((a,b) => a+b, 0) + (UPPER_FDI.length - 1) * gap;
  const positions = [];
  let cursor = -totalW / 2;
  for (let i = 0; i < UPPER_FDI.length; i++) {
    const w = widths[i];
    let yOff = 0;
    if (state === 'before') {
      // Random-ish offsets for visual misalignment
      const seed = (i * 7 + 13) % 11;
      yOff = (seed - 5) * 2.2;
    }
    // Gentle smile curve
    const t = (i - 7.5) / 7.5;
    const archCurve = Math.pow(Math.abs(t), 2.0) * 14;
    positions.push({ x: cursor + w/2, y: -archCurve + yOff, width: w, fdi: UPPER_FDI[i] });
    cursor += w + gap;
  }
  return positions;
}

// =============================================================
// Mini tooth — simplified visual for the evolution arch (no edit)
// =============================================================
function EvoTooth({ fdi, x, y, width, hasBrackets, hasWire }) {
  const type = fdiToType(fdi);
  const isMolar = type && type.startsWith('m');
  const crownH = isMolar ? 42 : (type === 'c' ? 40 : 36);
  const rootH = 22;
  const totalH = crownH + rootH;

  // Upper tooth — root up, crown down
  const rootStart  = -totalH/2;
  const rootEnd    = -totalH/2 + rootH;
  const crownStart = rootEnd;
  const crownEnd   = totalH/2;

  const w = width - 4;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Decorative root */}
      <path d={`M ${-w*0.3} ${rootEnd} L ${-w*0.4} ${rootStart + 4} Q 0 ${rootStart - 1} ${w*0.4} ${rootStart + 4} L ${w*0.3} ${rootEnd} Z`}
        fill="rgba(229,210,184,0.4)" stroke="rgba(183,160,121,0.35)" strokeWidth="0.5" />
      {/* Crown */}
      <path d={`M ${-w/2 + 4} ${crownStart}
        L ${w/2 - 4} ${crownStart} Q ${w/2} ${crownStart} ${w/2} ${crownStart + 5}
        L ${w/2} ${crownEnd - 5} Q ${w/2} ${crownEnd} ${w/2 - 4} ${crownEnd}
        L ${-w/2 + 4} ${crownEnd} Q ${-w/2} ${crownEnd} ${-w/2} ${crownEnd - 5}
        L ${-w/2} ${crownStart + 5} Q ${-w/2} ${crownStart} ${-w/2 + 4} ${crownStart} Z`}
        fill="#FFFCF4" stroke="#C9B48E" strokeWidth="0.7" strokeLinejoin="round" />
      {/* Incisal/occlusal highlight */}
      <line x1={-w/2 + 8} y1={crownEnd - 2} x2={w/2 - 8} y2={crownEnd - 2}
        stroke="white" strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
      {/* Bracket */}
      {hasBrackets && (
        <g>
          <rect x="-3.5" y="-1.5" width="7" height="4" rx="0.8" fill="#9CA4B2" stroke="#4D5667" strokeWidth="0.5" />
          <line x1="-3" y1="0.5" x2="3" y2="0.5" stroke="#1A2235" strokeWidth="0.6" />
          {/* Ligadura azul claro */}
          <rect x="-4.5" y="-2.5" width="9" height="6" rx="1.2" fill="none" stroke="#9BD0EA" strokeWidth="0.8" />
        </g>
      )}
    </g>
  );
}

// =============================================================
// Compact milestone timeline
// =============================================================
function MilestoneTimeline({ currentMonth, onMonthChange }) {
  const totalMonths = 18;
  const progress = Math.min(100, (currentMonth / totalMonths) * 100);

  // Find current milestone (closest one that's been reached)
  const currentMilestoneIdx = TX_MILESTONES.reduce((acc, m, i) => m.month <= currentMonth ? i : acc, 0);

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-lg)',
      padding:'18px 24px 16px',
    }}>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 14}}>
        <div>
          <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-14)', color:'var(--fg-strong)'}}>
            Línea de tiempo del tratamiento
          </div>
          <div style={{fontSize: 'var(--t-12)', color:'var(--fg-muted)', marginTop: 2}}>
            {totalMonths} meses · Etapa actual: <strong style={{color:'var(--sd-blue-700)'}}>{TX_MILESTONES[currentMilestoneIdx].label}</strong>
          </div>
        </div>
        <div style={{display:'flex', gap: 10, alignItems:'baseline'}}>
          <span style={{
            fontFamily:'var(--font-display)', fontWeight: 800,
            fontSize:'var(--t-24)', color:'var(--sd-blue-700)',
          }}>{Math.round(progress)}<span style={{fontSize:'var(--t-12)', fontWeight: 600, marginLeft: 2}}>%</span></span>
          <span style={{fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>completado</span>
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
        {TX_MILESTONES.map((m, i) => {
          const left = `calc(${(m.month / totalMonths) * 100}% * (1 - 24px/100%) + 12px)`;
          const isPast = m.month < currentMonth;
          const isCurrent = i === currentMilestoneIdx;
          const isFuture = m.month > currentMonth;
          return (
            <button key={m.id}
              onClick={() => onMonthChange(m.month)}
              title={`${m.label} · ${m.date}`}
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
                border: isFuture ? '2px solid var(--border-strong)' : '2px solid white',
                boxShadow: isCurrent ? '0 0 0 4px rgba(0,128,176,0.25)' : 'none',
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
              }}>{m.date}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================
// Clinical metric tile (comparativo antes → ahora)
// =============================================================
function MetricTile({ m, progress }) {
  const ss = STATUS_STYLE[m.status] || STATUS_STYLE.estable;
  // Interpolate value at current progress (between initial and final)
  const cur = m.raw
    ? m.initial /* keep initial label for non-numeric until done */
    : (m.initial + (m.final - m.initial) * (progress / 100)).toFixed(1);

  const change = m.raw
    ? `${m.initial} → ${m.final}`
    : `${m.final - m.initial >= 0 ? '+' : ''}${(m.final - m.initial).toFixed(1)}${m.unit}`;

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
        <span>meta: <strong style={{color:'var(--fg-default)'}}>{m.final}{!m.raw && m.unit}</strong></span>
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
        {ss.label} {!m.raw && `· ${change}`}
      </span>
    </div>
  );
}

// =============================================================
// Summary cards (5 small cards at bottom)
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
// Main view
// =============================================================
function EvolucionViewV2({ month = 4, setMonth = () => {} }) {
  const [slider, setSlider] = useStateE(50);
  const frameRef = useRefE(null);

  const beforePositions = useMemoE(() => getEvoArchPositions('before'), []);
  const afterPositions  = useMemoE(() => getEvoArchPositions('after'),  []);

  const progress = (month / 18) * 100;
  const currentMilestoneIdx = TX_MILESTONES.reduce((acc, m, i) => m.month <= month ? i : acc, 0);
  const currentMilestone = TX_MILESTONES[currentMilestoneIdx];

  const handleDrag = (e) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSlider(pct);
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'var(--sp-4)'}}>
      {/* ============ Comparativa antes/después ============ */}
      <div style={{
        background:'var(--bg-surface)',
        border:'1px solid var(--border-default)',
        borderRadius:'var(--r-lg)',
        padding:'var(--sp-5) var(--sp-6) var(--sp-4)',
        boxShadow:'var(--shadow-xs)',
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 14}}>
          <div>
            <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-18)', color:'var(--fg-strong)'}}>
              Comparativa antes / después
            </div>
            <div style={{display:'flex', alignItems:'center', gap: 6, fontSize:'var(--t-12)', color:'var(--fg-muted)', marginTop: 4}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 12h8M12 8l-4 4 4 4"/></svg>
              <span>Arrastra el divisor para comparar la transformación</span>
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap: 8, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
            <span style={{fontFamily:'var(--font-mono)'}}>0 %</span>
            <span style={{
              padding:'2px 10px', borderRadius:'var(--r-pill)',
              background:'var(--sd-blue-100)', color:'var(--sd-blue-700)',
              fontFamily:'var(--font-mono)', fontWeight: 800, fontSize: 11,
            }}>{Math.round(slider)} %</span>
            <span style={{fontFamily:'var(--font-mono)'}}>100 %</span>
          </div>
        </div>

        {/* Compare frame */}
        <div ref={frameRef}
          onMouseMove={(e) => e.buttons === 1 && handleDrag(e)}
          onTouchMove={handleDrag}
          style={{
            position:'relative', width:'100%',
            aspectRatio: '16 / 6.5',
            borderRadius:'var(--r-md)', overflow:'hidden',
            background: 'linear-gradient(180deg, #FBF4EA 0%, #F1E2CE 100%)',
          }}>

          {/* ANTES / DESPUÉS labels */}
          <div style={{
            position:'absolute', top: 12, left: 12, zIndex: 4,
            padding:'4px 10px', borderRadius:'var(--r-pill)',
            background:'rgba(11,20,36,0.78)', color:'white',
            fontSize: 10, fontWeight: 800, letterSpacing: 'var(--ls-wide)',
            display:'flex', alignItems:'center', gap: 6, fontFamily:'var(--font-display)',
          }}>
            <span style={{width: 5, height: 5, borderRadius:'50%', background:'#E0992E'}}></span>
            ANTES · Ene 2026
          </div>
          <div style={{
            position:'absolute', top: 12, right: 12, zIndex: 4,
            padding:'4px 10px', borderRadius:'var(--r-pill)',
            background:'rgba(11,20,36,0.78)', color:'white',
            fontSize: 10, fontWeight: 800, letterSpacing: 'var(--ls-wide)',
            display:'flex', alignItems:'center', gap: 6, fontFamily:'var(--font-display)',
          }}>
            <span style={{width: 5, height: 5, borderRadius:'50%', background:'#2BA86A'}}></span>
            DESPUÉS · Jul 2027
          </div>

          {/* BEFORE arch (visible always, full width) */}
          <svg viewBox="-380 -90 760 180" style={{position:'absolute', inset: 0, width:'100%', height:'100%'}}>
            {beforePositions.map(p => (
              <EvoTooth key={`b-${p.fdi}`} fdi={p.fdi} x={p.x} y={p.y + 20} width={p.width} hasBrackets={false} />
            ))}
            {/* Subtle "before" hint — slight chaos */}
            <text x="0" y="-58" textAnchor="middle" fontSize="8"
              fill="rgba(11,20,36,0.4)" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">
              INICIO DEL TRATAMIENTO
            </text>
          </svg>

          {/* AFTER arch — clipped reveal from right */}
          <div style={{position:'absolute', inset: 0, clipPath: `inset(0 0 0 ${slider}%)`, overflow:'hidden'}}>
            <svg viewBox="-380 -90 760 180" style={{position:'absolute', inset: 0, width:'100%', height:'100%'}}>
              {afterPositions.map(p => (
                <EvoTooth key={`a-${p.fdi}`} fdi={p.fdi} x={p.x} y={p.y + 20} width={p.width} hasBrackets={true} hasWire={true} />
              ))}
              {/* Continuous wire across all afters */}
              {(function() {
                const pts = afterPositions.map(p => `${p.x},${p.y + 20}`).join(' L ');
                return (
                  <>
                    <path d={`M ${pts}`} fill="none" stroke="#1A2235" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
                    <path d={`M ${pts}`} fill="none" stroke="#9CA4B2" strokeWidth="2" strokeLinecap="round" />
                    <path d={`M ${pts}`} fill="none" stroke="#FFFFFF" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
                  </>
                );
              })()}
              <text x="0" y="-58" textAnchor="middle" fontSize="8"
                fill="rgba(11,20,36,0.4)" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">
                META DEL TRATAMIENTO
              </text>
            </svg>
          </div>

          {/* Divider */}
          <div style={{
            position:'absolute', top: 0, bottom: 0,
            left: `${slider}%`, width: 2,
            background:'white', transform:'translateX(-50%)',
            boxShadow:'0 0 16px rgba(11,20,36,0.25)',
            zIndex: 3,
            pointerEvents:'none',
          }}>
            {/* Handle */}
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              transform:'translate(-50%, -50%)',
              width: 44, height: 44, borderRadius:'50%',
              background:'white',
              boxShadow:'var(--shadow-lg), 0 0 0 4px rgba(0,128,176,0.2)',
              display:'grid', placeItems:'center',
              cursor:'ew-resize',
              pointerEvents:'auto',
              color:'var(--sd-navy-800)',
              border:'1px solid var(--border-default)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6l-4 6 4 6M16 6l4 6-4 6"/>
              </svg>
            </div>
          </div>

          {/* Invisible range input for slider control */}
          <input type="range" min="0" max="100" step="0.1" value={slider}
            onChange={e => setSlider(+e.target.value)}
            style={{
              position:'absolute', inset: 0, width:'100%', height:'100%',
              opacity: 0, cursor:'ew-resize', zIndex: 5,
            }} />
        </div>
      </div>

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
          {TX_METRICS.map(m => <MetricTile key={m.id} m={m} progress={progress} />)}
        </div>
      </div>

      {/* ============ Milestone timeline ============ */}
      <MilestoneTimeline currentMonth={month} onMonthChange={setMonth} />

      {/* ============ Summary cards ============ */}
      <div style={{
        display:'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
      }}>
        <SummaryCard
          title={`Cita actual · Mes ${month}`}
          accent="var(--sd-blue-600)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
          items={[
            currentMilestone.date,
            `Arco: ${currentMilestone.archwire}`,
            'Próxima cita: 4 semanas',
          ]}
        />
        <SummaryCard
          title="Objetivo del mes"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>}
          items={[currentMilestone.objective]}
        />
        <SummaryCard
          title="Cambios observados"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c0-6 4-10 9-10s9 4 9 10"/></svg>}
          items={[
            'Reducción de apiñamiento ant. sup.',
            'Mejor alineación de incisivos',
            'Overjet en descenso (5.2 → 3.4 mm)',
          ]}
        />
        <SummaryCard
          title="Próximos pasos"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
          items={[
            'Cambio a .019×.025 NiTi en 4 sem.',
            'Inicio de cierre con cadenetas',
            'Revisión radiográfica al mes 8',
          ]}
        />
        <SummaryCard
          title="Alertas clínicas"
          accent="var(--sd-alert-500)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v5M12 16v.01"/><path d="M10.3 3.86L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>}
          items={[
            'Bracket flojo en 26 — revisar',
            'Higiene oral: control profiláctico',
          ]}
        />
      </div>
    </div>
  );
}

// =============================================================
// Right-side panel — evolution focused
// =============================================================
function EvolucionAnalysisPanel({ month = 4 }) {
  const progress = Math.round((month / 18) * 100);
  const currentMilestoneIdx = TX_MILESTONES.reduce((acc, m, i) => m.month <= month ? i : acc, 0);
  const stage = TX_MILESTONES[currentMilestoneIdx];

  return (
    <aside className="detail">
      <div className="detail-header">
        <div className="detail-fdi">Evolución del tratamiento</div>
        <div className="detail-name">{stage.label}</div>
        <div className="detail-meta">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Mes {month} de 18
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
            <DateCard label="Inicio" date="9 Ene 2026" sub="hace 4 meses" />
            <DateCard label="Fin estimado" date="11 Jul 2027" sub="en 14 meses" />
            <DateCard label="Próximo control" date="6 Jun 2026" sub="en 4 semanas" accent />
            <DateCard label="Próximo hito" date={TX_MILESTONES[currentMilestoneIdx + 1]?.date || '—'} sub={TX_MILESTONES[currentMilestoneIdx + 1]?.label || 'final'} />
          </div>
        </div>

        {/* Key changes */}
        <div className="detail-section">
          <div className="detail-section-title">Principales cambios clínicos</div>
          <ul style={{margin: 0, padding: 0, listStyle:'none', display:'flex', flexDirection:'column', gap: 6}}>
            {[
              { txt: 'Reducción de apiñamiento ant. sup. (−3.5 → −1.2 mm)', s: 'mejoro' },
              { txt: 'Overjet: 5.2 → 3.4 mm', s: 'mejoro' },
              { txt: 'Alineación de 12 y 22 (corrección rotacional)', s: 'mejoro' },
              { txt: 'Overbite aún por debajo de meta (4.0 → 3.6 mm)', s: 'pendiente' },
              { txt: 'Bracket 26: desprendimiento parcial', s: 'alerta' },
            ].map((it, i) => {
              const ss = STATUS_STYLE[it.s];
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
          }}>
            Paciente colabora bien con higiene oral. Sin signos de descalcificación.
            Se recomienda continuar con .018 NiTi hasta nivelación completa antes de progresar a calibre rectangular.
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
});
