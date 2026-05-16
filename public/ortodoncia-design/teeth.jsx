/* global React */
// ============================================================
// teeth.jsx — Anatomically informed tooth SVG library
// All teeth drawn with crown at top (y=0..42), root below (y=42..115+)
// Center at x=0, width spans ~50 units.
// ============================================================

const { useMemo } = React;

// ---- Tooth anatomy by type --------------------------------------------------
// type codes: ci (incisivo central), il (incisivo lateral), c (canino),
//             p1 (premolar 1), p2 (premolar 2), m1, m2, m3
//
// arch: 'sup' or 'inf' — affects root anatomy (lower premolars/molars have fewer roots)

const TOOTH_NAMES = {
  ci: "Incisivo central",
  il: "Incisivo lateral",
  c: "Canino",
  p1: "Primer premolar",
  p2: "Segundo premolar",
  m1: "Primer molar",
  m2: "Segundo molar",
  m3: "Tercer molar",
};

// FDI arch order (left-to-right as viewer sees it)
// Upper:  18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
// Lower:  48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
const UPPER_FDI = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_FDI = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

function fdiToType(fdi) {
  const pos = fdi % 10; // 1..8 (1=central, 8=wisdom)
  return ["", "ci","il","c","p1","p2","m1","m2","m3"][pos];
}
function fdiArch(fdi) {
  const q = Math.floor(fdi / 10);
  return q === 1 || q === 2 ? 'sup' : 'inf';
}
function fdiName(fdi) {
  const arch = fdiArch(fdi) === 'sup' ? 'superior' : 'inferior';
  const q = Math.floor(fdi / 10);
  const side = (q === 1 || q === 4) ? 'derecho' : 'izquierdo';
  return `${TOOTH_NAMES[fdiToType(fdi)]} ${arch} ${side}`;
}

// ---- Tooth silhouettes ------------------------------------------------------
// Each function returns a JSX <g> with crown + root paths + anatomical details.
// Drawn in local frame: crown apex at y=0, root tip at y≈115.

const ENAMEL = "#FFF8EE";
const ENAMEL_SHADE = "#F0E2C8";
const DENTIN = "#E9D6B4";
const ROOT_FILL = "#E5D2B8";
const ROOT_SHADE = "#CFB89A";
const PULP_HINT = "#E0BFA0";
const CERVICAL = "#D4C0A2";

// helper: gradient ids must be unique per render — handled with a useMemo prefix

function ToothCI({ idPrefix, crownOnly }) {
  const g = `${idPrefix}-grad`;
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="0.55" stopColor={ENAMEL} />
          <stop offset="1" stopColor={ENAMEL_SHADE} />
        </linearGradient>
        <linearGradient id={`${g}-root`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CERVICAL} />
          <stop offset="1" stopColor={ROOT_SHADE} />
        </linearGradient>
      </defs>
      {/* Root — softer, rounded apex */}
      {!crownOnly && (
        <path
          d="M -11 42 C -10.5 70 -8 96 -5 110 Q 0 116 5 110 C 8 96 10.5 70 11 42 Z"
          fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6"
        />
      )}
      {/* Crown — cleaner trapezoid */}
      <path
        className="tooth-crown"
        d="M -15 5 Q -14 1 -10 1 L 10 1 Q 14 1 15 5 L 17 38 Q 16 43 12 44 L -12 44 Q -16 43 -17 38 Z"
        fill={`url(#${g})`} stroke="#C9B48E" strokeWidth="0.7"
      />
      {/* Incisal edge highlight */}
      <path d="M -12 2 L 12 2" stroke="#fff" strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
      {/* Mamelones (subtle lobes) */}
      <path d="M -6 0 L -6 8 M 0 0 L 0 9 M 6 0 L 6 8" stroke={DENTIN} strokeWidth="0.4" opacity="0.5" />
      {/* Cervical line */}
      <path d="M -16 42 Q 0 44 16 42" stroke="#BFA987" strokeWidth="0.5" fill="none" />
    </g>
  );
}

function ToothIL({ idPrefix, crownOnly }) {
  const g = `${idPrefix}-grad`;
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="0.55" stopColor={ENAMEL} />
          <stop offset="1" stopColor={ENAMEL_SHADE} />
        </linearGradient>
        <linearGradient id={`${g}-root`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CERVICAL} />
          <stop offset="1" stopColor={ROOT_SHADE} />
        </linearGradient>
      </defs>
      {!crownOnly && (
        <path
          d="M -9 42 C -8.5 68 -6.5 92 -4 104 Q 0 110 4 104 C 6.5 92 8.5 68 9 42 Z"
          fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6"
        />
      )}
      <path
        className="tooth-crown"
        d="M -12 5 Q -11 1 -8 1 L 8 1 Q 11 1 12 5 L 13 36 Q 12 41 9 42 L -9 42 Q -12 41 -13 36 Z"
        fill={`url(#${g})`} stroke="#C9B48E" strokeWidth="0.7"
      />
      <path d="M -10 2 L 10 2" stroke="#fff" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
      <path d="M -13 40 Q 0 42 13 40" stroke="#BFA987" strokeWidth="0.5" fill="none" />
    </g>
  );
}

function ToothC({ idPrefix, crownOnly }) {
  const g = `${idPrefix}-grad`;
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="0.55" stopColor={ENAMEL} />
          <stop offset="1" stopColor={ENAMEL_SHADE} />
        </linearGradient>
        <linearGradient id={`${g}-root`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CERVICAL} />
          <stop offset="1" stopColor={ROOT_SHADE} />
        </linearGradient>
      </defs>
      {!crownOnly && (
        <path
          d="M -10 42 C -9.5 74 -6.5 104 -4 116 Q 0 122 4 116 C 6.5 104 9.5 74 10 42 Z"
          fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6"
        />
      )}
      {/* Pointed crown with refined cusp */}
      <path
        className="tooth-crown"
        d="M -13 9 Q -12 4 -9 4 L -2 -2 Q 0 -3 2 -2 L 9 4 Q 12 4 13 9 L 15 38 Q 13 43 9 44 L -9 44 Q -13 43 -15 38 Z"
        fill={`url(#${g})`} stroke="#C9B48E" strokeWidth="0.7"
      />
      {/* Cusp ridge */}
      <path d="M -8 4 L 0 -2 L 8 4" stroke="#fff" strokeWidth="0.8" opacity="0.5" fill="none" />
      <path d="M -14 42 Q 0 44 14 42" stroke="#BFA987" strokeWidth="0.5" fill="none" />
    </g>
  );
}

function ToothP({ idPrefix, arch, second, crownOnly }) {
  const g = `${idPrefix}-grad`;
  // Premolars: 2 cusps. Upper P1 has 2 roots, others have 1.
  const twoRoots = arch === 'sup' && !second; // upper P1 only
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="0.55" stopColor={ENAMEL} />
          <stop offset="1" stopColor={ENAMEL_SHADE} />
        </linearGradient>
        <linearGradient id={`${g}-root`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CERVICAL} />
          <stop offset="1" stopColor={ROOT_SHADE} />
        </linearGradient>
      </defs>
      {!crownOnly && (twoRoots ? (
        <>
          <path d="M -11 42 C -12 70 -11 95 -9 104 Q -7 108 -5 104 C -4 95 -3.5 70 -3 42 Z" fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
          <path d="M 3 42 C 3.5 70 4 95 5 104 Q 7 108 9 104 C 11 95 12 70 11 42 Z" fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
        </>
      ) : (
        <path d="M -12 42 C -11.5 74 -8 102 -4 112 Q 0 116 4 112 C 8 102 11.5 74 12 42 Z" fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
      ))}
      {/* Crown — two cusps, cleaner profile */}
      <path
        className="tooth-crown"
        d="M -14 8 Q -13 3 -9 3 L -3 5 Q 0 3.5 3 5 L 9 3 Q 13 3 14 8 L 16 38 Q 14 43 10 44 L -10 44 Q -14 43 -16 38 Z"
        fill={`url(#${g})`} stroke="#C9B48E" strokeWidth="0.7"
      />
      {/* Central groove */}
      <path d="M 0 4 L 0 28" stroke={DENTIN} strokeWidth="0.6" opacity="0.6" />
      {/* Cusp highlights */}
      <path d="M -7 4 Q -5 1 -3 4" stroke="#fff" strokeWidth="0.6" opacity="0.5" fill="none" />
      <path d="M 3 4 Q 5 1 7 4" stroke="#fff" strokeWidth="0.6" opacity="0.5" fill="none" />
      <path d="M -15 42 Q 0 44 15 42" stroke="#BFA987" strokeWidth="0.5" fill="none" />
    </g>
  );
}

function ToothM({ idPrefix, arch, size, crownOnly }) {
  // size: 1 = m1 (largest), 2 = m2, 3 = m3 (smallest, often impacted)
  const g = `${idPrefix}-grad`;
  const scaleMap = { 1: 1.0, 2: 0.92, 3: 0.78 };
  const s = scaleMap[size] || 1.0;
  const w = 20 * s; // half-width
  const h = 44 * s;
  // Roots: upper molars 3 roots, lower 2 roots
  const upperRoots = arch === 'sup';

  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="0.55" stopColor={ENAMEL} />
          <stop offset="1" stopColor={ENAMEL_SHADE} />
        </linearGradient>
        <linearGradient id={`${g}-root`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CERVICAL} />
          <stop offset="1" stopColor={ROOT_SHADE} />
        </linearGradient>
      </defs>
      {/* Roots — softer rounded apices */}
      {!crownOnly && (upperRoots ? (
        <>
          {/* Mesiobuccal */}
          <path d={`M ${-w+2} ${h-2} C ${-w-1} ${h+22} ${-w*0.85} ${h+48} ${-w*0.7} ${h+56} Q ${-w*0.5} ${h+60} ${-w*0.4} ${h+54} C ${-w*0.35} ${h+44} ${-w*0.38} ${h+22} ${-w*0.4} ${h-2} Z`} fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
          {/* Palatal */}
          <path d={`M -3 ${h-2} C -2 ${h+28} -0.5 ${h+54} 0 ${h+60} Q 2 ${h+64} 4 ${h+58} C 4 ${h+44} 3.5 ${h+22} 3 ${h-2} Z`} fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" opacity="0.85" />
          {/* Distobuccal */}
          <path d={`M ${w*0.4} ${h-2} C ${w*0.38} ${h+22} ${w*0.35} ${h+44} ${w*0.4} ${h+54} Q ${w*0.5} ${h+60} ${w*0.7} ${h+56} C ${w*0.85} ${h+48} ${w+1} ${h+22} ${w-2} ${h-2} Z`} fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
        </>
      ) : (
        <>
          {/* Mesial root */}
          <path d={`M ${-w+2} ${h-2} C ${-w-1} ${h+22} ${-w*0.85} ${h+48} ${-w*0.6} ${h+56} Q ${-w*0.4} ${h+60} ${-w*0.25} ${h+54} C ${-w*0.2} ${h+44} ${-w*0.2} ${h+22} ${-3} ${h-2} Z`} fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
          {/* Distal root */}
          <path d={`M 3 ${h-2} C ${w*0.2} ${h+22} ${w*0.2} ${h+44} ${w*0.25} ${h+54} Q ${w*0.4} ${h+60} ${w*0.6} ${h+56} C ${w*0.85} ${h+48} ${w+1} ${h+22} ${w-2} ${h-2} Z`} fill={`url(#${g}-root)`} stroke="#B7A079" strokeWidth="0.6" />
        </>
      ))}
      {/* Crown — cleaner, gentler cusp transitions */}
      <path
        className="tooth-crown"
        d={`M ${-w+1} 9 Q ${-w+2} 3 ${-w+5} 3
            Q ${-w*0.55} 5 ${-w*0.2} 3.5 Q 0 2.5 ${w*0.2} 3.5 Q ${w*0.55} 5 ${w-5} 3
            Q ${w-2} 3 ${w-1} 9
            L ${w} ${h-4} Q ${w-2} ${h} ${w-5} ${h}
            L ${-w+5} ${h} Q ${-w+2} ${h} ${-w} ${h-4} Z`}
        fill={`url(#${g})`} stroke="#C9B48E" strokeWidth="0.7"
      />
      {/* Occlusal grooves (visible as fissures) */}
      <path d={`M ${-w*0.4} 6 L ${-w*0.4} ${h-6}`} stroke={DENTIN} strokeWidth="0.5" opacity="0.5" />
      <path d={`M ${w*0.4} 6 L ${w*0.4} ${h-6}`} stroke={DENTIN} strokeWidth="0.5" opacity="0.5" />
      <path d={`M ${-w*0.6} ${h*0.45} L ${w*0.6} ${h*0.45}`} stroke={DENTIN} strokeWidth="0.5" opacity="0.5" />
      {/* Cervical line */}
      <path d={`M ${-w} ${h-2} Q 0 ${h+1} ${w} ${h-2}`} stroke="#BFA987" strokeWidth="0.5" fill="none" />
    </g>
  );
}

// Dispatcher
function ToothShape({ type, arch, idPrefix, crownOnly }) {
  switch (type) {
    case 'ci': return <ToothCI idPrefix={idPrefix} crownOnly={crownOnly} />;
    case 'il': return <ToothIL idPrefix={idPrefix} crownOnly={crownOnly} />;
    case 'c':  return <ToothC idPrefix={idPrefix} crownOnly={crownOnly} />;
    case 'p1': return <ToothP idPrefix={idPrefix} arch={arch} second={false} crownOnly={crownOnly} />;
    case 'p2': return <ToothP idPrefix={idPrefix} arch={arch} second={true} crownOnly={crownOnly} />;
    case 'm1': return <ToothM idPrefix={idPrefix} arch={arch} size={1} crownOnly={crownOnly} />;
    case 'm2': return <ToothM idPrefix={idPrefix} arch={arch} size={2} crownOnly={crownOnly} />;
    case 'm3': return <ToothM idPrefix={idPrefix} arch={arch} size={3} crownOnly={crownOnly} />;
    default:   return null;
  }
}

// ---- Appliance overlay -------------------------------------------------------

function Bracket({ kind, ligature, type }) {
  // kind: metal | ceramic | zafiro | autolig | lingual | aligner | band | removable
  const isMolar = type && type.startsWith('m');
  const isIncisor = type === 'ci' || type === 'il';
  const w = isMolar ? 10 : (type === 'c' ? 8.5 : 7.5);
  const h = isMolar ? 6.5 : 6;

  if (kind === 'lingual') {
    return (
      <g>
        <circle cx="0" cy="22" r="3.4" fill="rgba(255,255,255,0.6)" stroke="var(--sd-blue-600)" strokeWidth="1" strokeDasharray="1.6 1.2" />
        <circle cx="0" cy="22" r="0.9" fill="var(--sd-blue-600)" />
      </g>
    );
  }
  if (kind === 'aligner') {
    return (
      <path
        d="M -16 1 Q -15 -1 -11 -1 L 11 -1 Q 15 -1 16 1 L 18 39 Q 17 44 13 45 L -13 45 Q -17 44 -18 39 Z"
        fill="rgba(155,208,234,0.25)" stroke="var(--sd-blue-400)" strokeWidth="1" strokeDasharray="1 1.4"
      />
    );
  }
  if (kind === 'removable') {
    return (
      <g>
        <rect x="-10" y="40" width="20" height="3" rx="1.5" fill="#C9CFDA" stroke="#7B8597" strokeWidth="0.4" />
        <circle cx="-7" cy="41.5" r="0.8" fill="#7B8597" />
        <circle cx="7" cy="41.5" r="0.8" fill="#7B8597" />
      </g>
    );
  }

  const fillMap = {
    metal: '#D4D9E2',
    ceramic: '#FBF7EF',
    zafiro: 'rgba(245,250,255,0.7)',
    autolig: '#9CA4B2',
    band: '#9AA5B6',
  };
  const strokeMap = {
    metal: '#5A6577',
    ceramic: '#B5A98E',
    zafiro: '#7BAEC8',
    autolig: '#3A4254',
    band: '#5A6577',
  };

  const cy = 22; // bracket Y center on crown
  // Band width adapts to tooth type so it wraps the crown correctly
  const bandW = isMolar ? 40 : (type === 'p1' || type === 'p2' ? 32 : (type === 'c' ? 30 : 30));
  const bandH = isMolar ? 18 : 16;
  const bandY = isMolar ? 13 : 14;

  return (
    <g>
      {kind === 'band' && (
        <>
          <rect x={-bandW/2} y={bandY} width={bandW} height={bandH} rx="2.5" fill="none" stroke={strokeMap[kind]} strokeWidth="1.3" />
          {/* highlight band edge */}
          <rect x={-bandW/2 + 0.5} y={bandY + 0.5} width={bandW - 1} height={bandH - 1} rx="2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        </>
      )}
      {/* Subtle shadow under bracket so it reads as bonded */}
      <ellipse cx="0.4" cy={cy + h/2 + 0.6} rx={w/2 + 0.8} ry="1.1" fill="rgba(11,20,36,0.18)" />
      {/* Bracket body */}
      <rect x={-w/2} y={cy - h/2} width={w} height={h} rx="1.2"
        fill={fillMap[kind] || '#C9CFDA'} stroke={strokeMap[kind] || '#6C7689'} strokeWidth="0.7" />
      {/* Wings (tie-wings) */}
      {kind !== 'autolig' && (
        <>
          <rect x={-w/2 - 0.8} y={cy - h/2 + 0.6} width="2" height="1.2" rx="0.4" fill={strokeMap[kind]} opacity="0.85" />
          <rect x={w/2 - 1.2} y={cy - h/2 + 0.6} width="2" height="1.2" rx="0.4" fill={strokeMap[kind]} opacity="0.85" />
          <rect x={-w/2 - 0.8} y={cy + h/2 - 1.8} width="2" height="1.2" rx="0.4" fill={strokeMap[kind]} opacity="0.85" />
          <rect x={w/2 - 1.2} y={cy + h/2 - 1.8} width="2" height="1.2" rx="0.4" fill={strokeMap[kind]} opacity="0.85" />
        </>
      )}
      {/* Slot (archwire channel) */}
      <rect x={-w/2 + 0.6} y={cy - 0.7} width={w - 1.2} height="1.4" fill="#0B1424" />
      {/* Auto-ligating clip */}
      {kind === 'autolig' && (
        <>
          <rect x={-w/2 + 0.5} y={cy - 0.9} width={w - 1} height="1.8" fill="#E8ECF2" stroke="#0B1424" strokeWidth="0.25" rx="0.3" />
          <line x1={-w/2 + 1.5} y1={cy} x2={w/2 - 1.5} y2={cy} stroke="#0B1424" strokeWidth="0.4" />
        </>
      )}
      {/* Ligature O-ring */}
      {ligature && kind !== 'autolig' && (
        <rect x={-w/2 - 1.8} y={cy - h/2 - 1.6} width={w + 3.6} height={h + 3.2} rx="2.2" ry="2.2"
              fill="none" stroke={ligature} strokeWidth="1.4" opacity="0.95" />
      )}
      {/* Zafiro shimmer */}
      {kind === 'zafiro' && (
        <>
          <line x1={-w/2 + 1.2} y1={cy - h/2 + 1.2} x2={-w/2 + 3.5} y2={cy - h/2 + 1.2} stroke="#fff" strokeWidth="0.7" opacity="0.95" />
          <line x1={w/2 - 2.5} y1={cy + h/2 - 1.2} x2={w/2 - 1} y2={cy + h/2 - 1.2} stroke="#fff" strokeWidth="0.5" opacity="0.7" />
        </>
      )}
      {/* Ceramic highlight */}
      {kind === 'ceramic' && (
        <line x1={-w/2 + 1.2} y1={cy - h/2 + 1.2} x2={-w/2 + 3} y2={cy - h/2 + 1.2} stroke="#fff" strokeWidth="0.6" opacity="0.85" />
      )}
    </g>
  );
}

// ---- Condition overlay -------------------------------------------------------

function Condition({ kind, type }) {
  // kind: caries | restoration | ausente | extraido | implante | endodoncia | corona
  if (kind === 'caries') {
    return (
      <g>
        <circle cx="-3" cy="14" r="2.2" fill="#3A2920" opacity="0.85" />
        <circle cx="5" cy="22" r="1.6" fill="#3A2920" opacity="0.8" />
      </g>
    );
  }
  if (kind === 'restoration') {
    return (
      <g>
        <path d="M -6 12 Q -2 8 4 14 Q 6 20 2 26 Q -4 26 -8 22 Z" fill="#7E8895" opacity="0.7" stroke="#3F485C" strokeWidth="0.3" />
      </g>
    );
  }
  if (kind === 'endodoncia') {
    // pulp chamber filled — show vertical lines down crown
    return (
      <g>
        <path d="M -1 6 L -1 42 M 1 6 L 1 42" stroke="#C2362C" strokeWidth="1.2" opacity="0.85" />
      </g>
    );
  }
  if (kind === 'corona') {
    return (
      <g>
        <path d="M -16 4 Q -15 0 -11 0 L 11 0 Q 15 0 16 4 L 18 38 Q 17 43 13 44 L -13 44 Q -17 43 -18 38 Z"
          fill="rgba(212,175,55,0.35)" stroke="#B89348" strokeWidth="1" strokeDasharray="1 1.5" />
      </g>
    );
  }
  if (kind === 'implante') {
    // Replace root with screw, crown becomes ceramic
    return (
      <g>
        {/* white-out actual root area */}
        <rect x="-16" y="42" width="32" height="80" fill="white" />
        {/* implant screw */}
        <path d="M -5 42 L -5 100 L 0 110 L 5 100 L 5 42 Z" fill="#B0B7C2" stroke="#5A6577" strokeWidth="0.5" />
        {Array.from({length: 10}).map((_, i) => (
          <line key={i} x1="-5" y1={48 + i*5} x2="5" y2={48 + i*5} stroke="#5A6577" strokeWidth="0.4" />
        ))}
      </g>
    );
  }
  if (kind === 'ausente' || kind === 'extraido') {
    // X mark, faded body
    return (
      <g>
        <rect x="-20" y="-3" width="40" height="120" fill="white" opacity="0.55" />
        <line x1="-16" y1="-2" x2="16" y2="44" stroke="#C2362C" strokeWidth="2" />
        <line x1="16" y1="-2" x2="-16" y2="44" stroke="#C2362C" strokeWidth="2" />
        {kind === 'ausente' && (
          <text x="0" y="58" textAnchor="middle" fill="#C2362C" fontSize="6" fontWeight="700" fontFamily="var(--font-mono)">AUS</text>
        )}
      </g>
    );
  }
  return null;
}

// ---- Movement arrow overlay --------------------------------------------------

function Movement({ kind, amount }) {
  // kind: rotacion | extrusion | intrusion | mesial | distal | vestibular | lingual
  const color = "#0080B0";        // var(--sd-blue-600)
  const haloColor = "#FFFFFF";
  const len = 8 + (amount || 1) * 1.6;
  const sw = 2.2;     // main stroke
  const halo = 4.6;   // white halo for contrast

  // Filled triangular arrowhead helper
  const Arrowhead = ({ x, y, angle }) => {
    // angle in degrees, points in direction of arrow
    const a = (angle * Math.PI) / 180;
    const s = 4.2; // arrowhead length
    const w = 2.6; // arrowhead half-width
    const tipX = x;
    const tipY = y;
    const baseX = x - Math.cos(a) * s;
    const baseY = y - Math.sin(a) * s;
    const leftX = baseX - Math.sin(a) * w;
    const leftY = baseY + Math.cos(a) * w;
    const rightX = baseX + Math.sin(a) * w;
    const rightY = baseY - Math.cos(a) * w;
    return <path d={`M ${tipX} ${tipY} L ${leftX.toFixed(1)} ${leftY.toFixed(1)} L ${rightX.toFixed(1)} ${rightY.toFixed(1)} Z`} fill={color} stroke={haloColor} strokeWidth="0.8" strokeLinejoin="round" />;
  };

  switch (kind) {
    case 'rotacion':
      return (
        <g>
          <path d={`M -13 22 A 14 14 0 0 1 11 22`} fill="none" stroke={haloColor} strokeWidth={halo} strokeLinecap="round" />
          <path d={`M -13 22 A 14 14 0 0 1 11 22`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Arrowhead x={11} y={22} angle={90} />
        </g>
      );
    case 'extrusion': {
      const tipY = 44 + len;
      return (
        <g>
          <line x1="0" y1="44" x2="0" y2={tipY} stroke={haloColor} strokeWidth={halo} strokeLinecap="round" />
          <line x1="0" y1="44" x2="0" y2={tipY} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Arrowhead x={0} y={tipY} angle={90} />
        </g>
      );
    }
    case 'intrusion': {
      const tipY = -len;
      return (
        <g>
          <line x1="0" y1="0" x2="0" y2={tipY} stroke={haloColor} strokeWidth={halo} strokeLinecap="round" />
          <line x1="0" y1="0" x2="0" y2={tipY} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Arrowhead x={0} y={tipY} angle={-90} />
        </g>
      );
    }
    case 'mesial': {
      const tipX = -len;
      return (
        <g>
          <line x1="0" y1="22" x2={tipX} y2="22" stroke={haloColor} strokeWidth={halo} strokeLinecap="round" />
          <line x1="0" y1="22" x2={tipX} y2="22" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Arrowhead x={tipX} y={22} angle={180} />
        </g>
      );
    }
    case 'distal': {
      const tipX = len;
      return (
        <g>
          <line x1="0" y1="22" x2={tipX} y2="22" stroke={haloColor} strokeWidth={halo} strokeLinecap="round" />
          <line x1="0" y1="22" x2={tipX} y2="22" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Arrowhead x={tipX} y={22} angle={0} />
        </g>
      );
    }
    case 'vestibular':
      return (
        <g>
          <circle cx="0" cy="22" r="4.6" fill={haloColor} />
          <circle cx="0" cy="22" r="4.2" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="0" cy="22" r="1.6" fill={color} />
        </g>
      );
    case 'lingual':
      return (
        <g>
          <circle cx="0" cy="22" r="4.6" fill={haloColor} />
          <circle cx="0" cy="22" r="4.2" fill="none" stroke={color} strokeWidth={sw} strokeDasharray="1.4 1.2" />
        </g>
      );
    default:
      return null;
  }
}

// ---- The full Tooth component -----------------------------------------------

function Tooth({ fdi, state = {}, x, y, rotate = 0, scale = 1, flipForUpper = true, onClick, selected, showLabel = true, crownOnly = false }) {
  const type = fdiToType(fdi);
  const arch = fdiArch(fdi);
  const idPrefix = `t${fdi}`;
  // Hide tooth if extraido or ausente still shows X — but for ausente we hide; for extraido we show ghost
  const isMissing = state.condition === 'ausente';
  const opacity = isMissing ? 0.15 : 1;

  // For upper arch, we flip the tooth 180° so crown points DOWN (toward mouth opening / center)
  const flipDeg = (arch === 'sup' && flipForUpper) ? 180 : 0;
  const transform = `translate(${x}, ${y}) rotate(${rotate}) scale(${scale}) rotate(${flipDeg})`;

  return (
    <g
      className={`tooth-group ${selected ? 'selected' : ''}`}
      transform={transform}
      onClick={onClick}
      style={{ opacity }}
    >
      {/* Selection halo */}
      <ellipse className="tooth-halo" cx="0" cy={crownOnly ? 22 : 44} rx={crownOnly ? 22 : 26} ry={crownOnly ? 28 : 64} fill="rgba(0,128,176,0.08)" stroke="var(--sd-blue-600)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      {/* Tooth body */}
      <ToothShape type={type} arch={arch} idPrefix={idPrefix} crownOnly={crownOnly} />
      {/* Appliance on crown (vestibular face is the front we see in this projection) */}
      {state.appliance && state.condition !== 'ausente' && state.condition !== 'extraido' && (
        <Bracket kind={state.appliance} ligature={state.ligature} type={type} />
      )}
      {/* Condition overlay */}
      {state.condition && <Condition kind={state.condition} type={type} />}
      {/* Movement arrow */}
      {state.movement && <Movement kind={state.movement.kind} amount={state.movement.amount} />}
    </g>
  );
}

// ---- Arch positioning math --------------------------------------------------
//
// Returns positions for the 16 teeth of an arch along a U-curve.
// archType: 'upper' (∩ open downward) or 'lower' (∪ open upward)
// The arches are positioned so they "kiss" along the central horizontal axis y=0.

function getArchPositions(archType) {
  // Use a parametric "horseshoe": the front teeth are densely placed on a tight curve,
  // back teeth flare out along nearly parallel sides.
  const positions = [];
  const fdis = archType === 'upper' ? UPPER_FDI : LOWER_FDI;
  const N = fdis.length; // 16

  // We'll place teeth along an ellipse with these parameters:
  // Horizontal spread (a) and depth (b), with anterior at theta=0 (front).
  // theta range: -π/2 → +π/2 across 16 teeth, but skewed toward anterior packing.

  // To get even visual spacing, parameterize by arc-length on the ellipse.
  // Simpler: hand-tuned angles per index.
  // Anterior teeth (4 incisors + 2 canines on each side) take more angular space at front.

  // Index in arch (0..15), 0 is leftmost (FDI 18 or 48), 15 rightmost (28 or 38).
  // We map index 0..15 to a theta angle.
  // Use a function that packs the middle (incisors 11/21) at theta ~ 0
  // and distributes posteriors to ±(maxTheta).

  const angles = [];
  // 16 teeth: indices 0..15, midpoint between 7 and 8 (= 7.5)
  // Use a tan-like easing to give anterior more horizontal space.
  for (let i = 0; i < N; i++) {
    const t = (i - 7.5) / 7.5; // -1..+1
    // ease: emphasize middle (anterior gets wider angular span per tooth)
    const ang = Math.sign(t) * Math.pow(Math.abs(t), 1.15) * 1.42; // radians: ~±81°
    angles.push(ang);
  }

  const a = 330; // horizontal radius
  const b = 175; // vertical radius (depth of arch from anterior to posterior)
  // For upper arch (∩), center of ellipse is BELOW anterior point. Anterior at theta=0 sits at top.
  // We position so the anterior is near y = -10 (just above central axis), posteriors curl outward and away.

  for (let i = 0; i < N; i++) {
    const theta = angles[i];
    // Ellipse point: x = a*sin(theta), y = -b*cos(theta) for upper (so anterior at top, posterior at bottom of arch)
    let x = a * Math.sin(theta);
    let y;
    if (archType === 'upper') {
      // Anterior at top (near central axis), posteriors going UP and OUT.
      // We want upper arch to sit ABOVE the central axis. Anterior touches axis from above; posteriors highest.
      y = -b * (1 - Math.cos(theta)) - 24; // anterior at y=-24, posteriors at y ≈ -24 - b
    } else {
      // Lower arch BELOW central axis. Anterior touches axis from below.
      y = b * (1 - Math.cos(theta)) + 24;
    }
    // Tooth rotation: tangent to arch — long axis points radially OUT from center of mouth.
    // The center of the mouth (where the tongue is) is at (0, archType==='upper' ? -b-24 : b+24).
    // Tooth's long axis (from crown to root) should point away from center of mouth.
    // For upper: crown points DOWN (toward axis), root points UP (away from axis).
    // We already flip upper teeth 180° inside <Tooth>, so the tooth's local "down" (root) is what shows up.
    // The angle to rotate by = theta (in degrees) so the tooth tilts radially.
    let rotateDeg;
    if (archType === 'upper') {
      // theta=0 → no rotation (anterior). theta=+π/2 → tooth rotated +90° (right molars). But the rotation needs to keep crown facing center.
      // Since upper teeth are flipped 180° via flipForUpper, the resulting rotation: original rotate is theta in degrees.
      rotateDeg = theta * (180 / Math.PI);
    } else {
      // Lower arch, no flip. Crowns naturally point up. Rotation = theta.
      rotateDeg = theta * (180 / Math.PI);
    }
    positions.push({ x, y, rotate: rotateDeg, fdi: fdis[i] });
  }
  return positions;
}

// Make components available to other scripts
Object.assign(window, {
  Tooth, ToothShape, Bracket, Condition, Movement,
  fdiToType, fdiArch, fdiName, TOOTH_NAMES,
  UPPER_FDI, LOWER_FDI,
  getArchPositions,
});
