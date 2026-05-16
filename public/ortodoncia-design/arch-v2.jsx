/* global React, fdiToType, fdiArch, fdiName, TOOTH_NAMES, UPPER_FDI, LOWER_FDI */
// ============================================================
// arch-v2.jsx — Redesigned arch diagram (usable, professional, clean)
// Generous spacing, big clickable hit areas, badges instead of tiny icons,
// external movement arrows, hover tooltip, simplified anatomy.
// Replaces window.ArchView from views.jsx.
// ============================================================

const { useState: useStateA, useMemo: useMemoA, useRef: useRefA } = React;

// Tooth visual widths (SVG units)
const ARCH_W = { m3: 42, m2: 48, m1: 54, p2: 42, p1: 42, c: 38, il: 32, ci: 38 };
const ARCH_GAP = 9;

// Compute arch positions: chain of teeth with proper spacing + gentle curve
function getArchPositionsV2(archType) {
  const fdis = archType === 'upper' ? UPPER_FDI : LOWER_FDI;
  const widths = fdis.map(f => ARCH_W[fdiToType(f)] || 40);
  const totalW = widths.reduce((a,b) => a+b, 0) + (fdis.length - 1) * ARCH_GAP;
  const positions = [];
  let cursor = -totalW / 2;
  for (let i = 0; i < fdis.length; i++) {
    const w = widths[i];
    const cx = cursor + w / 2;
    cursor += w + ARCH_GAP;
    // gentle curve: anteriors at center, posteriors rise outward
    const t = (i - 7.5) / 7.5; // -1..+1
    const curve = Math.pow(Math.abs(t), 2.0) * 38; // up to ~38 units rise
    const y = archType === 'upper' ? -curve : curve;
    positions.push({ x: cx, y, width: w, fdi: fdis[i], side: t < 0 ? 'right' : 'left' });
  }
  return positions;
}

// Crown gradient (single shared def for whole arch)
function CrownDefs() {
  return (
    <defs>
      <linearGradient id="archCrownGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFCF4" />
        <stop offset="0.55" stopColor="#FFF8EC" />
        <stop offset="1" stopColor="#EEDFC0" />
      </linearGradient>
      <linearGradient id="archRootGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(233,214,180,0.55)" />
        <stop offset="1" stopColor="rgba(207,184,154,0.18)" />
      </linearGradient>
      <linearGradient id="archWireGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4F6F9" />
        <stop offset="0.45" stopColor="#BAC2CE" />
        <stop offset="0.55" stopColor="#7B8597" />
        <stop offset="1" stopColor="#4D5667" />
      </linearGradient>
    </defs>
  );
}

// Crown shape per tooth type (simple, recognizable, no rotation)
function ArchCrown({ type, width, crownStart, crownEnd, isUpper }) {
  const w = width - 6;
  const cervY = isUpper ? crownStart : crownEnd;     // gingival side
  const occY  = isUpper ? crownEnd   : crownStart;   // incisal/occlusal side
  const h = Math.abs(crownEnd - crownStart);
  const fill = "url(#archCrownGrad)";
  const stroke = "#C9B48E";
  const sw = 1;

  if (type === 'ci' || type === 'il') {
    // Trapezoidal incisor — wider at incisal edge
    const wInc = w * (type === 'ci' ? 1.0 : 0.92);
    const wCerv = w * 0.86;
    return (
      <g>
        <path d={`M ${-wCerv/2} ${cervY + (isUpper ? 0 : 0)}
          Q ${-wCerv/2 - 2} ${(cervY + occY)/2} ${-wInc/2} ${occY}
          Q 0 ${occY + (isUpper ? 2 : -2)} ${wInc/2} ${occY}
          Q ${wCerv/2 + 2} ${(cervY + occY)/2} ${wCerv/2} ${cervY}
          Q 0 ${cervY + (isUpper ? -2 : 2)} ${-wCerv/2} ${cervY} Z`}
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        {/* Incisal edge highlight */}
        <line x1={-wInc/2 + 3} y1={occY + (isUpper ? -1 : 1)} x2={wInc/2 - 3} y2={occY + (isUpper ? -1 : 1)}
          stroke="white" strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />
        {/* Mamelones (3 subtle bumps) */}
        {[-wInc * 0.25, 0, wInc * 0.25].map((mx, i) => (
          <circle key={i} cx={mx} cy={occY + (isUpper ? -2.5 : 2.5)} r="0.7" fill="white" opacity="0.5" />
        ))}
      </g>
    );
  }
  if (type === 'c') {
    // Canine — pentagonal with pointed cusp
    const cuspY = occY + (isUpper ? 5 : -5);
    return (
      <g>
        <path d={`M ${-w/2 + 2} ${cervY}
          Q ${-w/2 - 1} ${(cervY + occY)/2} ${-w/2 + 3} ${occY}
          L ${-3} ${occY + (isUpper ? 2 : -2)} L 0 ${cuspY} L 3 ${occY + (isUpper ? 2 : -2)}
          L ${w/2 - 3} ${occY}
          Q ${w/2 + 1} ${(cervY + occY)/2} ${w/2 - 2} ${cervY}
          Q 0 ${cervY + (isUpper ? -2 : 2)} ${-w/2 + 2} ${cervY} Z`}
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        {/* Cusp highlight */}
        <circle cx="0" cy={cuspY + (isUpper ? -1 : 1)} r="1.2" fill="white" opacity="0.55" />
      </g>
    );
  }
  if (type === 'p1' || type === 'p2') {
    // Premolar — soft square with 2 cusps visible at occlusal edge
    const r = 7;
    return (
      <g>
        <path d={`M ${-w/2 + r} ${cervY}
          L ${w/2 - r} ${cervY} Q ${w/2} ${cervY} ${w/2} ${cervY + (isUpper ? r : -r)}
          L ${w/2} ${occY - (isUpper ? r : -r)} Q ${w/2} ${occY} ${w/2 - r} ${occY}
          L ${-w/2 + r} ${occY} Q ${-w/2} ${occY} ${-w/2} ${occY - (isUpper ? r : -r)}
          L ${-w/2} ${cervY + (isUpper ? r : -r)} Q ${-w/2} ${cervY} ${-w/2 + r} ${cervY} Z`}
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        {/* Two cusps along occlusal edge */}
        <ellipse cx={-w * 0.18} cy={occY + (isUpper ? -2 : 2)} rx={w * 0.18} ry="2.4" fill="white" opacity="0.45" />
        <ellipse cx={w * 0.18} cy={occY + (isUpper ? -2 : 2)} rx={w * 0.18} ry="2.4" fill="white" opacity="0.35" />
        {/* Central groove */}
        <line x1="0" y1={cervY + (isUpper ? 5 : -5)} x2="0" y2={occY + (isUpper ? -4 : 4)}
          stroke="#C9B48E" strokeWidth="0.6" opacity="0.5" />
      </g>
    );
  }
  // Molars — wider square with 4 cusps
  const r = 6;
  return (
    <g>
      <path d={`M ${-w/2 + r} ${cervY}
        L ${w/2 - r} ${cervY} Q ${w/2} ${cervY} ${w/2} ${cervY + (isUpper ? r : -r)}
        L ${w/2} ${occY - (isUpper ? r : -r)} Q ${w/2} ${occY} ${w/2 - r} ${occY}
        L ${-w/2 + r} ${occY} Q ${-w/2} ${occY} ${-w/2} ${occY - (isUpper ? r : -r)}
        L ${-w/2} ${cervY + (isUpper ? r : -r)} Q ${-w/2} ${cervY} ${-w/2 + r} ${cervY} Z`}
        fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {/* 4 cusps (occlusal half visible at the edge) */}
      <ellipse cx={-w * 0.22} cy={occY + (isUpper ? -3 : 3)} rx={w * 0.18} ry="2.6" fill="white" opacity="0.42" />
      <ellipse cx={w * 0.22} cy={occY + (isUpper ? -3 : 3)} rx={w * 0.18} ry="2.6" fill="white" opacity="0.4" />
      <ellipse cx={-w * 0.22} cy={cervY + (isUpper ? 7 : -7)} rx={w * 0.16} ry="2.2" fill="white" opacity="0.28" />
      <ellipse cx={w * 0.22} cy={cervY + (isUpper ? 7 : -7)} rx={w * 0.16} ry="2.2" fill="white" opacity="0.25" />
      {/* Central fissure cross */}
      <line x1="0" y1={cervY + (isUpper ? 4 : -4)} x2="0" y2={occY + (isUpper ? -4 : 4)} stroke="#C9B48E" strokeWidth="0.55" opacity="0.5" />
      <line x1={-w * 0.3} y1={(cervY + occY) / 2} x2={w * 0.3} y2={(cervY + occY) / 2} stroke="#C9B48E" strokeWidth="0.5" opacity="0.4" />
    </g>
  );
}

// Decorative translucent root
function ArchRoot({ type, isUpper, rootStart, rootEnd }) {
  // Root tapers from cervical (wide) toward tip (narrow)
  const baseW = ({ m3: 16, m2: 18, m1: 22, p2: 12, p1: 12, c: 11, il: 8, ci: 10 })[type] || 10;
  const tipW = baseW * 0.45;
  const wideY = isUpper ? rootEnd : rootStart;       // cervical = closer to crown
  const tipY  = isUpper ? rootStart : rootEnd;       // root tip
  return (
    <path
      d={`M ${-baseW/2} ${wideY}
          C ${-baseW/2 + 0.5} ${(wideY + tipY) * 0.6} ${-tipW/2 - 0.5} ${(wideY + tipY) * 0.85} ${-tipW/2} ${tipY + (isUpper ? 3 : -3)}
          Q 0 ${tipY} ${tipW/2} ${tipY + (isUpper ? 3 : -3)}
          C ${tipW/2 + 0.5} ${(wideY + tipY) * 0.85} ${baseW/2 - 0.5} ${(wideY + tipY) * 0.6} ${baseW/2} ${wideY} Z`}
      fill="url(#archRootGrad)" stroke="rgba(183,160,121,0.5)" strokeWidth="0.5"
    />
  );
}

// Badge in corner of tooth: summarizes state (or "+N" if multi)
function ArchBadge({ state, width, totalH, isUpper }) {
  const items = [];
  if (state.appliance) items.push({ kind: 'app', value: state.appliance });
  if (state.condition) items.push({ kind: 'cond', value: state.condition });
  if (state.movement)  items.push({ kind: 'mov',  value: state.movement.kind });
  if (state.notes)     items.push({ kind: 'note', value: 'note' });
  if (items.length === 0) return null;

  // Position: top-right corner of tooth bounding box
  const x = width / 2 - 2;
  const y = isUpper ? -totalH / 2 + 6 : totalH / 2 - 6;
  const r = 11;

  if (items.length >= 2) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <circle cx="0" cy="0" r={r} fill="var(--sd-blue-600)" stroke="white" strokeWidth="2" />
        <text x="0" y="3.6" fontSize="11" fontWeight="800" fill="white" textAnchor="middle" fontFamily="var(--font-display)">+{items.length}</text>
      </g>
    );
  }

  // Single — render with specific glyph + color
  const item = items[0];
  let color = 'var(--sd-blue-600)';
  let glyph = '●';
  if (item.kind === 'app') {
    const colors = {
      metal: '#5A6577', ceramic: '#D9C8A1', zafiro: '#9BD0EA', autolig: '#3A4254',
      lingual: '#1A2235', band: '#8A93A4', aligner: '#54B0DD', removable: '#7B8597',
    };
    color = state.ligature || colors[item.value] || '#5A6577';
    glyph = item.value === 'aligner' ? 'A' : (item.value === 'removable' ? 'R' : (item.value === 'band' ? 'B' : (item.value === 'lingual' ? 'L' : '■')));
  } else if (item.kind === 'cond') {
    const map = {
      caries:      { c: '#E0992E', g: 'C' },
      restoration: { c: '#8A93A4', g: 'R' },
      endodoncia:  { c: '#DA453A', g: 'E' },
      corona:      { c: '#C7811C', g: '◆' },
      extraido:    { c: '#C2362C', g: '✕' },
      ausente:     { c: '#C2362C', g: '−' },
      implante:    { c: '#198754', g: 'I' },
    };
    const m = map[item.value] || { c: 'var(--sd-blue-600)', g: '!' };
    color = m.c; glyph = m.g;
  } else if (item.kind === 'mov') {
    const map = { rotacion: '↻', intrusion: '↑', extrusion: '↓', mesial: '←', distal: '→', vestibular: '◉', lingual: '◌' };
    glyph = map[item.value] || '↔';
    color = 'var(--sd-blue-600)';
  } else if (item.kind === 'note') {
    color = '#8A93A4'; glyph = '✎';
  }

  // Choose text color based on bg brightness
  const useDarkText = ['#9BD0EA','#D9C8A1','#54B0DD','#FBF7EF','#FFFFFF'].includes(color);
  const textColor = useDarkText ? '#0B1424' : 'white';

  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r={r} fill={color} stroke="white" strokeWidth="2" />
      <text x="0" y="4" fontSize="12" fontWeight="800" fill={textColor} textAnchor="middle" fontFamily="var(--font-display)">{glyph}</text>
    </g>
  );
}

// External movement arrows — drawn AROUND the tooth's bounding box
function ArchExternalMovement({ kind, amount, width, totalH, isUpper, side }) {
  if (!kind) return null;
  const color = "#0080B0";
  const halo = "#FFFFFF";
  const sw = 2.2;
  const len = 14 + (amount || 1) * 1.8;

  // Helper to render an arrow with halo
  const Arrow = ({ x1, y1, x2, y2, dir }) => {
    // dir: 'up' | 'down' | 'left' | 'right'
    const s = 5; // arrow head size
    let pts;
    if (dir === 'up') pts = `${x2 - s/2},${y2 + s} ${x2},${y2} ${x2 + s/2},${y2 + s}`;
    else if (dir === 'down') pts = `${x2 - s/2},${y2 - s} ${x2},${y2} ${x2 + s/2},${y2 - s}`;
    else if (dir === 'left') pts = `${x2 + s},${y2 - s/2} ${x2},${y2} ${x2 + s},${y2 + s/2}`;
    else pts = `${x2 - s},${y2 - s/2} ${x2},${y2} ${x2 - s},${y2 + s/2}`;
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={halo} strokeWidth={sw + 2.5} strokeLinecap="round" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <polygon points={pts} fill={color} stroke={halo} strokeWidth="0.8" strokeLinejoin="round" />
      </g>
    );
  };

  switch (kind) {
    case 'rotacion': {
      // Arc above tooth with arrowhead at the end
      const arcY = isUpper ? -totalH/2 - 14 : totalH/2 + 14;
      const ax1 = -width/2 + 2, ax2 = width/2 - 2;
      // half-circle arc — arrow at the right end
      return (
        <g>
          <path d={`M ${ax1} ${arcY} A ${(ax2-ax1)/2} 9 0 0 ${isUpper ? 1 : 0} ${ax2} ${arcY}`}
            fill="none" stroke={halo} strokeWidth={sw + 2.5} strokeLinecap="round" />
          <path d={`M ${ax1} ${arcY} A ${(ax2-ax1)/2} 9 0 0 ${isUpper ? 1 : 0} ${ax2} ${arcY}`}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <polygon points={`${ax2 - 4},${arcY - 4} ${ax2 + 1},${arcY} ${ax2 - 4},${arcY + 4}`}
            fill={color} stroke={halo} strokeWidth="0.8" />
        </g>
      );
    }
    case 'intrusion': {
      // Push into bone — upper goes UP, lower goes DOWN
      const dir = isUpper ? 'up' : 'down';
      const startY = isUpper ? -totalH/2 - 4 : totalH/2 + 4;
      const endY = isUpper ? startY - len : startY + len;
      return <Arrow x1={0} y1={startY} x2={0} y2={endY} dir={dir} />;
    }
    case 'extrusion': {
      // Pull out — upper goes DOWN, lower goes UP
      const dir = isUpper ? 'down' : 'up';
      const startY = isUpper ? totalH/2 + 4 : -totalH/2 - 4;
      const endY = isUpper ? startY + len : startY - len;
      return <Arrow x1={0} y1={startY} x2={0} y2={endY} dir={dir} />;
    }
    case 'mesial': {
      // Toward midline (x=0) — depends on side
      const dir = side === 'right' ? 'right' : 'left';
      const startX = dir === 'right' ? width/2 + 4 : -width/2 - 4;
      const endX   = dir === 'right' ? startX + len : startX - len;
      return <Arrow x1={startX} y1={0} x2={endX} y2={0} dir={dir} />;
    }
    case 'distal': {
      // Away from midline
      const dir = side === 'right' ? 'left' : 'right';
      const startX = dir === 'left' ? -width/2 - 4 : width/2 + 4;
      const endX   = dir === 'left' ? startX - len : startX + len;
      return <Arrow x1={startX} y1={0} x2={endX} y2={0} dir={dir} />;
    }
    case 'vestibular':
    case 'lingual': {
      // Small target indicator next to tooth on the buccal side (above for visibility)
      const cy = isUpper ? -totalH/2 - 14 : totalH/2 + 14;
      const isVest = kind === 'vestibular';
      return (
        <g>
          <circle cx="0" cy={cy} r="7" fill={halo} />
          <circle cx="0" cy={cy} r="5" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray={isVest ? 'none' : '1.4 1.2'} />
          {isVest && <circle cx="0" cy={cy} r="2" fill={color} />}
        </g>
      );
    }
    default: return null;
  }
}

// Single tooth in arch view
function ArchToothV2({ fdi, x, y, width, state, selected, hovered, onHover, onSelect }) {
  const type = fdiToType(fdi);
  const arch = fdiArch(fdi);
  const isUpper = arch === 'sup';
  const crownH = type && type.startsWith('m') ? 60 : (type === 'c' ? 56 : 52);
  const rootH = 36;
  const totalH = crownH + rootH;

  // Root is on the AWAY-from-mouth side, crown on the toward-center side.
  // For upper: root at top, crown at bottom (closer to mouth opening line at y=0)
  // For lower: crown at top, root at bottom
  let rootStart, rootEnd, crownStart, crownEnd;
  if (isUpper) {
    rootStart  = -totalH/2;
    rootEnd    = -totalH/2 + rootH;
    crownStart = rootEnd;
    crownEnd   = totalH/2;
  } else {
    crownStart = -totalH/2;
    crownEnd   = -totalH/2 + crownH;
    rootStart  = crownEnd;
    rootEnd    = totalH/2;
  }

  const isMissing = state.condition === 'ausente';
  const isExtracted = state.condition === 'extraido';

  const side = x < 0 ? 'right' : 'left'; // visual right = patient's right

  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}
       onMouseEnter={() => onHover(fdi)} onMouseLeave={() => onHover(null)}
       onClick={() => onSelect(fdi)}>
      {/* Hover/selected backdrop */}
      {(hovered || selected) && (
        <rect x={-width/2 - 5} y={-totalH/2 - 8} width={width + 10} height={totalH + 16} rx={10}
              fill={selected ? 'rgba(0,128,176,0.13)' : 'rgba(0,128,176,0.07)'}
              stroke={selected ? 'var(--sd-blue-600)' : 'rgba(0,128,176,0.4)'}
              strokeWidth={selected ? 1.6 : 1}
              strokeDasharray={selected ? 'none' : '3 3'} />
      )}

      {/* Tooth (root + crown) */}
      <g style={{ opacity: isMissing ? 0.15 : (isExtracted ? 0.35 : 1) }}>
        <ArchRoot type={type} isUpper={isUpper} rootStart={rootStart} rootEnd={rootEnd} />
        <ArchCrown type={type} width={width} crownStart={crownStart} crownEnd={crownEnd} isUpper={isUpper} />
      </g>

      {/* "Missing" or "extracted" mark */}
      {(isMissing || isExtracted) && (
        <g>
          <line x1={-width/2 + 4} y1={crownStart + 4} x2={width/2 - 4} y2={crownEnd - 4}
            stroke="#C2362C" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={width/2 - 4} y1={crownStart + 4} x2={-width/2 + 4} y2={crownEnd - 4}
            stroke="#C2362C" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}

      {/* External movement arrows (always around the tooth, not inside) */}
      {state.movement && !isMissing && !isExtracted && (
        <ArchExternalMovement kind={state.movement.kind} amount={state.movement.amount}
          width={width} totalH={totalH} isUpper={isUpper} side={side} />
      )}

      {/* Single corner badge (summary or +N) */}
      {!isMissing && !isExtracted && <ArchBadge state={state} width={width} totalH={totalH} isUpper={isUpper} />}

      {/* FDI number under tooth */}
      <text x="0" y={isUpper ? totalH/2 + 18 : -totalH/2 - 10}
        fontSize="11" textAnchor="middle"
        fill={selected ? 'var(--sd-blue-700)' : 'var(--fg-muted)'}
        fontFamily="var(--font-mono)" fontWeight={selected ? 700 : 500}>
        {fdi}
      </text>

      {/* Large invisible hit area */}
      <rect x={-width/2 - 6} y={-totalH/2 - 10} width={width + 12} height={totalH + 20} fill="transparent" />
    </g>
  );
}

// Floating tooltip with FDI + tooth name (HTML overlay outside SVG)
function ArchTooltip({ fdi, x, y, containerRect }) {
  if (!fdi || !containerRect) return null;
  const name = TOOTH_NAMES[fdiToType(fdi)] || '';
  const arch = fdiArch(fdi) === 'sup' ? 'Sup' : 'Inf';
  const side = (Math.floor(fdi / 10) === 1 || Math.floor(fdi / 10) === 4) ? 'Der' : 'Izq';
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      pointerEvents: 'none',
      transform: 'translate(-50%, -100%)',
      background: 'var(--sd-ink-1000)',
      color: 'white',
      padding: '6px 10px',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-md)',
      fontSize: 'var(--t-12)',
      whiteSpace: 'nowrap',
      zIndex: 10,
    }}>
      <span style={{fontFamily:'var(--font-mono)', opacity: 0.7, marginRight: 6}}>FDI {fdi}</span>
      <span style={{fontWeight: 600}}>{name}</span>
      <span style={{opacity: 0.7, marginLeft: 6, fontSize: 10, textTransform:'uppercase', letterSpacing: 1}}>{arch} · {side}</span>
    </div>
  );
}

// =============================================================
// OrthoSummary (reused — show case summary at top of arch view)
// =============================================================
function OrthoSummaryV2() {
  const metrics = [
    { label: 'Clase molar',   sides: [{k:'D',v:'II'},{k:'I',v:'II'}],     status:'alert' },
    { label: 'Clase canina',  sides: [{k:'D',v:'II'},{k:'I',v:'I'}],      status:'alert' },
    { label: 'Overjet',       value: '5.2', unit: 'mm', norm: '2–3',      status:'alert' },
    { label: 'Overbite',      value: '4.0', unit: 'mm', sub:'40 %',       status:'alert' },
    { label: 'Línea media',   value: '0.5', unit: 'mm', sub:'desv. izq.', status:'warn'  },
    { label: 'Apiñamiento',   sides:[{k:'Sup',v:'−3.5'},{k:'Inf',v:'−2.0'}], unit:'mm', status:'alert' },
  ];
  const statusColor = (s) => ({ ok:'var(--sd-vital-500)', warn:'var(--sd-alert-500)', alert:'var(--sd-critical-500)' }[s] || 'var(--sd-blue-600)');

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: '14px 0',
      display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`,
      width: '100%', maxWidth: 1040,
      margin: '0 auto var(--sp-4)',
      boxShadow: '0 1px 2px rgba(11,20,36,0.04)',
    }}>
      {metrics.map((m, i) => (
        <div key={m.label} style={{
          padding:'4px 18px',
          borderLeft: i === 0 ? 'none' : '1px solid var(--border-soft)',
          display:'flex', flexDirection:'column', gap:4,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:700,color:'var(--fg-muted)',textTransform:'uppercase',letterSpacing:'var(--ls-widest)'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(m.status),display:'inline-block'}}></span>
            {m.label}
          </div>
          {m.sides ? (
            <div style={{display:'flex',gap:12,alignItems:'baseline'}}>
              {m.sides.map(s => (
                <div key={s.k} style={{display:'flex',flexDirection:'column'}}>
                  <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'var(--t-20)',color:'var(--fg-strong)',lineHeight:1}}>
                    {s.v}{m.unit ? <span style={{fontSize:'var(--t-12)',fontWeight:600,color:'var(--fg-muted)',marginLeft:2}}> {m.unit}</span> : null}
                  </span>
                  <span style={{fontSize:10,color:'var(--fg-subtle)',fontFamily:'var(--font-mono)',fontWeight:600,marginTop:2}}>{s.k}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column'}}>
              <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'var(--t-24)',color:'var(--fg-strong)',lineHeight:1}}>
                {m.value}<span style={{fontSize:'var(--t-13)',fontWeight:600,color:'var(--fg-muted)',marginLeft:3}}>{m.unit}</span>
              </span>
              <span style={{fontSize:10,color:'var(--fg-subtle)',fontFamily:'var(--font-mono)',fontWeight:600,marginTop:4}}>{m.sub || (m.norm ? `norma ${m.norm}` : '')}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Catmull-Rom path through points
function smoothPath(pts) {
  if (!pts || pts.length < 2) return null;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// =============================================================
// Main ArchView V2
// =============================================================
function ArchViewV2({ teeth, selected, onSelect, showWire, showLabels }) {
  const upperPos = useMemoA(() => getArchPositionsV2('upper'), []);
  const lowerPos = useMemoA(() => getArchPositionsV2('lower'), []);
  const [hover, setHover] = useStateA(null);
  const [tooltipPos, setTooltipPos] = useStateA(null);
  const wrapRef = useRefA(null);

  // Bracket Y on each tooth = crown center (between cervical and incisal/occlusal)
  // For upper at y=y_pos: crown spans (rootEnd, totalH/2) = (y_pos - totalH/2 + rootH, y_pos + totalH/2). Center = y_pos + rootH/2.
  // For lower: crown spans (-totalH/2, -totalH/2 + crownH). Center = y_pos - totalH/2 + crownH/2.
  const FIXED = new Set(['metal','ceramic','zafiro','autolig','lingual','band']);
  const wireUpperPts = upperPos
    .filter(p => {
      const s = teeth[p.fdi];
      return s && s.appliance && FIXED.has(s.appliance) && s.condition !== 'ausente' && s.condition !== 'extraido';
    })
    .map(p => {
      const type = fdiToType(p.fdi);
      const crownH = type && type.startsWith('m') ? 60 : (type === 'c' ? 56 : 52);
      const rootH = 36;
      // Upper: crown center y = p.y + rootH/2 ... but we want bracket NEAR occlusal edge, so use ~70% of crown
      const bracketRel = -28 + crownH * 0.55; // approximate "middle of crown" 
      return { x: p.x, y: p.y + bracketRel };
    });
  const wireLowerPts = lowerPos
    .filter(p => {
      const s = teeth[p.fdi];
      return s && s.appliance && FIXED.has(s.appliance) && s.condition !== 'ausente' && s.condition !== 'extraido';
    })
    .map(p => {
      const type = fdiToType(p.fdi);
      const crownH = type && type.startsWith('m') ? 60 : (type === 'c' ? 56 : 52);
      const bracketRel = 28 - crownH * 0.55;
      return { x: p.x, y: p.y + bracketRel };
    });

  const wireUpper = showWire ? smoothPath(wireUpperPts) : null;
  const wireLower = showWire ? smoothPath(wireLowerPts) : null;

  const onHover = (fdi) => {
    setHover(fdi);
    if (fdi !== null && wrapRef.current) {
      // Find tooth position in screen coords
      const all = [...upperPos, ...lowerPos];
      const p = all.find(t => t.fdi === fdi);
      if (p) {
        const rect = wrapRef.current.getBoundingClientRect();
        const svg = wrapRef.current.querySelector('svg');
        if (svg) {
          const svgRect = svg.getBoundingClientRect();
          const vbW = 920, vbH = 540;
          const sx = svgRect.width / vbW;
          const sy = svgRect.height / vbH;
          // viewBox is -460 to 460 horizontally (centered), -270 to 270 vertically
          const screenX = svgRect.left - rect.left + (p.x + 460) * sx;
          const screenY = svgRect.top - rect.top + (p.y - 110 + 270) * sy; // tooth center offset upward for upper
          setTooltipPos({ x: screenX, y: screenY - 6 });
        }
      }
    } else {
      setTooltipPos(null);
    }
  };

  // Y offsets so upper arch sits above center, lower below (with gap)
  const ARCH_Y_OFFSET = 110;

  return (
    <div className="arch-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <OrthoSummaryV2 />

      <svg viewBox="-460 -270 920 540" xmlns="http://www.w3.org/2000/svg"
           style={{width:'100%', maxWidth: 1040, height:'auto', display:'block'}}>
        <CrownDefs />
        {/* Subtle gum bands behind teeth */}
        <path d="M -460 -190 Q -300 -210 0 -208 Q 300 -210 460 -190 L 460 -120 L -460 -120 Z"
              fill="rgba(234,170,158,0.22)" stroke="none"
              transform={`translate(0, ${-ARCH_Y_OFFSET + 80})`} />
        <path d="M -460 120 L 460 120 L 460 190 Q 300 210 0 208 Q -300 210 -460 190 Z"
              fill="rgba(234,170,158,0.22)" stroke="none"
              transform={`translate(0, ${ARCH_Y_OFFSET - 80})`} />

        {/* Midline */}
        <line x1="0" y1="-260" x2="0" y2="260" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="4 6" opacity="0.7" />
        <text x="-6" y="-250" fontSize="9" fill="var(--fg-subtle)" fontFamily="var(--font-mono)" fontWeight="700" textAnchor="end">L. MEDIA</text>

        {/* Plano oclusal */}
        <line x1="-450" y1="0" x2="450" y2="0" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 5" opacity="0.55" />
        <text x="-450" y="-4" fontSize="9" fill="var(--fg-subtle)" fontFamily="var(--font-mono)" fontWeight="600">PLANO OCLUSAL</text>

        {/* Arch labels */}
        <text x="0" y="-258" textAnchor="middle" fontSize="11" fill="var(--fg-muted)"
              fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">MAXILAR · ARCO SUPERIOR</text>
        <text x="0" y="260" textAnchor="middle" fontSize="11" fill="var(--fg-muted)"
              fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">MANDIBULAR · ARCO INFERIOR</text>

        <text x="-440" y="4" fontSize="10" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="700">DER</text>
        <text x="440" y="4" fontSize="10" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="700" textAnchor="end">IZQ</text>

        {/* Wires drawn BEHIND teeth corner badges */}
        {wireUpper && (
          <g transform={`translate(0, ${-ARCH_Y_OFFSET})`}>
            <path d={wireUpper} fill="none" stroke="#1A2235" strokeWidth="4.5" strokeLinecap="round" opacity="0.32" />
            <path d={wireUpper} fill="none" stroke="url(#archWireGrad)" strokeWidth="3.4" strokeLinecap="round" />
            <path d={wireUpper} fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
          </g>
        )}
        {wireLower && (
          <g transform={`translate(0, ${ARCH_Y_OFFSET})`}>
            <path d={wireLower} fill="none" stroke="#1A2235" strokeWidth="4.5" strokeLinecap="round" opacity="0.32" />
            <path d={wireLower} fill="none" stroke="url(#archWireGrad)" strokeWidth="3.4" strokeLinecap="round" />
            <path d={wireLower} fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
          </g>
        )}

        {/* Upper teeth */}
        <g transform={`translate(0, ${-ARCH_Y_OFFSET})`}>
          {upperPos.map(p => (
            <ArchToothV2 key={p.fdi} fdi={p.fdi} x={p.x} y={p.y} width={p.width}
              state={teeth[p.fdi] || {}}
              selected={selected === p.fdi}
              hovered={hover === p.fdi}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
        </g>

        {/* Lower teeth */}
        <g transform={`translate(0, ${ARCH_Y_OFFSET})`}>
          {lowerPos.map(p => (
            <ArchToothV2 key={p.fdi} fdi={p.fdi} x={p.x} y={p.y} width={p.width}
              state={teeth[p.fdi] || {}}
              selected={selected === p.fdi}
              hovered={hover === p.fdi}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
        </g>
      </svg>

      {/* HTML tooltip */}
      {hover && tooltipPos && (
        <ArchTooltip fdi={hover} x={tooltipPos.x} y={tooltipPos.y} containerRect={wrapRef.current?.getBoundingClientRect()} />
      )}
    </div>
  );
}

// Override the global ArchView with V2
Object.assign(window, {
  ArchView: ArchViewV2,
  OrthoSummary: OrthoSummaryV2,
  // Exposed for reuse in plano view
  ArchToothV2,
  ArchTooltip,
  CrownDefs,
  smoothPath,
});
