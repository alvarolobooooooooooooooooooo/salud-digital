/* global React */
// ============================================================
// profile-v2.jsx — Refined cephalometric analysis view
// Bigger profile, tabbed values table, executive summary panel,
// hover-linked landmarks and measures.
// ============================================================

const { useState: useStateP, useMemo: useMemoP } = React;

// =============================================================
// Angle classes + class-specific data
// =============================================================
const ANGLE_CLASSES = [
  { id: 'I',    label: 'Clase I',           desc: 'Neutroclusión — relación molar normal' },
  { id: 'II-1', label: 'Clase II div. 1',   desc: 'Distoclusión, incisivos protruidos' },
  { id: 'II-2', label: 'Clase II div. 2',   desc: 'Distoclusión, incisivos retroinclinados' },
  { id: 'III',  label: 'Clase III',         desc: 'Mesioclusión — prognatismo mandibular' },
];

function getJawDelta(c) {
  return ({ 'I': 0, 'II-1': -14, 'II-2': -14, 'III': 16 })[c] || 0;
}

function getCephValues(c) {
  const base = {
    SNA: { v: 82.5, norm: 82, range: 2 },
    SNB: { v: 80.0, norm: 80, range: 2 },
    ANB: { v: 2.5, norm: 2, range: 2 },
    Wits: { v: 0.0, norm: 0, range: 1 },
    FMA: { v: 26, norm: 25, range: 4 },
    'SN-GoGn': { v: 32, norm: 32, range: 4 },
    'U1-NA': { v: 22, norm: 22, range: 2 },
    'U1-NA-mm': { v: 4.0, norm: 4, range: 1 },
    'L1-NB': { v: 25, norm: 25, range: 2 },
    'L1-NB-mm': { v: 4.0, norm: 4, range: 1 },
    'U1-L1': { v: 131, norm: 131, range: 5 },
    IMPA: { v: 90, norm: 90, range: 5 },
    Overjet: { v: 2.5, norm: 2.5, range: 0.5 },
    Overbite: { v: 2.5, norm: 2.5, range: 0.5 },
    Convexity: { v: 2, norm: 2, range: 2 },
    'Y-Axis': { v: 60, norm: 60, range: 3 },
  };
  if (c === 'II-1') {
    base.SNB.v = 78.4; base.ANB.v = 4.1; base.Wits.v = 3.0;
    base['U1-NA'].v = 30; base['U1-NA-mm'].v = 7.5;
    base.Overjet.v = 5.2; base.Overbite.v = 4.0;
    base['U1-L1'].v = 115; base.Convexity.v = 5;
  } else if (c === 'II-2') {
    base.SNB.v = 78.4; base.ANB.v = 4.1; base.Wits.v = 3.0;
    base['U1-NA'].v = 14; base['U1-NA-mm'].v = 2;
    base.Overjet.v = 1.5; base.Overbite.v = 6.0;
    base['U1-L1'].v = 145;
  } else if (c === 'III') {
    base.SNB.v = 82.8; base.ANB.v = -1.2; base.Wits.v = -3.0;
    base.IMPA.v = 82; base.Overjet.v = -1.5; base.Convexity.v = -2;
  }
  return base;
}

function statusOf(val, norm, range) {
  if (val == null || norm == null) return 'normal';
  const d = val - norm;
  if (Math.abs(d) <= range) return 'normal';
  if (d > range) return 'aumentado';
  return 'disminuido';
}

// Map each measure to the plane key that should highlight in the profile when hovered
const MEASURE_TO_HIGHLIGHT = {
  SNA: 'SN', SNB: 'SN', ANB: 'ANB', Wits: 'occlusal',
  FMA: 'mandibular', 'SN-GoGn': 'mandibular',
  'U1-NA': 'ANB', 'U1-NA-mm': 'ANB',
  'L1-NB': 'ANB', 'L1-NB-mm': 'ANB',
  'U1-L1': 'occlusal', IMPA: 'mandibular',
  Overjet: 'occlusal', Overbite: 'occlusal',
  Convexity: 'facial', 'Y-Axis': 'facial',
};

// =============================================================
// PROFILE SVG — refined medical illustration
// =============================================================
function ProfileSvg({ angleClass, hoverPlane }) {
  const dx = getJawDelta(angleClass);
  const L = {
    S:   { x: 105, y: 138 },
    N:   { x: 268, y: 144 },
    Or:  { x: 252, y: 190 },
    Po:  { x: 92,  y: 192 },
    A:   { x: 295 + (angleClass === 'II-1' ? 4 : 0), y: 235 },
    ANS: { x: 290, y: 222 },
    PNS: { x: 170, y: 222 },
    B:   { x: 290 + dx, y: 282 },
    Pog: { x: 296 + dx, y: 310 },
    Me:  { x: 286 + dx, y: 326 },
    Go:  { x: 108 + dx * 0.3, y: 312 },
    Ar:  { x: 110, y: 230 },
  };

  const profilePath = `
    M 60 60
    C 90 6 220 -2 290 30
    C 332 60 320 110 305 138
    L 287 162
    C 290 172 305 178 318 198
    C 332 213 332 230 322 244
    C 314 252 296 254 282 252
    L 276 258
    C 274 266 280 274 274 280
    L 270 286
    C ${266 + dx * 0.5} 296 ${274 + dx * 0.5} 304 ${268 + dx} 310
    C ${274 + dx} 322 ${278 + dx * 0.8} 336 ${260 + dx} 348
    L ${238 + dx} 362
    C ${200 + dx * 0.5} 368 150 366 110 360
    C 80 354 64 336 56 312
    L 50 240
    L 60 60 Z
  `;

  // Plane base colors vs highlight color
  const baseStroke = '#7A8497';
  const baseRedStroke = 'rgba(218,69,58,0.8)';
  const hl = '#0080B0';
  const planeStroke = {
    SN:        hoverPlane === 'SN' ? hl : baseStroke,
    facial:    hoverPlane === 'facial' ? hl : baseStroke,
    mandibular: hoverPlane === 'mandibular' ? hl : baseStroke,
    maxilla:   hoverPlane === 'maxilla' ? hl : baseStroke,
    occlusal:  hoverPlane === 'occlusal' ? hl : baseStroke,
    ANB:       hoverPlane === 'ANB' ? '#C2362C' : baseRedStroke,
  };
  const planeWidth = (key) => hoverPlane === key ? 2 : 1.2;
  const planeOpacity = (key) => hoverPlane && hoverPlane !== key ? 0.3 : 1;

  return (
    <svg viewBox="0 0 400 430" xmlns="http://www.w3.org/2000/svg"
         className="ceph-svg"
         style={{width:'100%', height:'auto', display:'block'}}>
      <defs>
        <linearGradient id="skinV2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBF2EA" />
          <stop offset="1" stopColor="#EFDDC9" />
        </linearGradient>
        <linearGradient id="bgGrid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FAFCFE" />
          <stop offset="1" stopColor="#EAF2F8" />
        </linearGradient>
        <radialGradient id="skullHint" cx="0.3" cy="0.3" r="0.5">
          <stop offset="0" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="430" fill="url(#bgGrid)" />
      {/* Subtle grid */}
      {Array.from({length: 10}).map((_, i) => (
        <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="430"
              stroke="rgba(220,225,233,0.5)" strokeWidth="0.5" />
      ))}
      {Array.from({length: 10}).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50}
              stroke="rgba(220,225,233,0.5)" strokeWidth="0.5" />
      ))}

      {/* Profile silhouette */}
      <path d={profilePath} fill="url(#skinV2)" stroke="#9C7A60" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={profilePath} fill="url(#skullHint)" />

      {/* Subtle face details */}
      <path d="M 240 188 Q 256 184 270 188" stroke="#5A3F2E" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <circle cx="254" cy="190" r="2.5" fill="#3A2A1E" />
      <path d="M 240 170 Q 260 166 275 170" stroke="#4A2F20" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 278 273 Q 282 278 278 283" stroke="#7A3F2F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d={`M ${274} ${288} Q ${278 + dx*0.4} ${294} ${272 + dx*0.5} ${298}`} stroke="#7A3F2F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M 88 200 C 84 212 86 226 96 232" stroke="#9C7A60" strokeWidth="1" fill="rgba(190,148,118,0.25)" />

      {/* ============ Cephalometric planes ============ */}
      {/* SN plane */}
      <line x1={L.S.x} y1={L.S.y} x2={L.N.x} y2={L.N.y}
            stroke={planeStroke.SN} strokeWidth={planeWidth('SN')} opacity={planeOpacity('SN')} />
      <text x={(L.S.x + L.N.x)/2 - 12} y={(L.S.y + L.N.y)/2 - 4}
            fontSize="9" fill={planeStroke.SN} opacity={planeOpacity('SN')}
            fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.5">S-N</text>

      {/* Mandibular plane */}
      <line x1={L.Go.x} y1={L.Go.y} x2={L.Me.x} y2={L.Me.y}
            stroke={planeStroke.mandibular} strokeWidth={planeWidth('mandibular')} strokeDasharray="6 3"
            opacity={planeOpacity('mandibular')} />
      <text x={(L.Go.x + L.Me.x)/2 - 28} y={(L.Go.y + L.Me.y)/2 + 14}
            fontSize="9" fill={planeStroke.mandibular} opacity={planeOpacity('mandibular')}
            fontFamily="var(--font-mono)" fontWeight="700">P. MAND.</text>

      {/* Facial plane */}
      <line x1={L.N.x} y1={L.N.y} x2={L.Pog.x} y2={L.Pog.y}
            stroke={planeStroke.facial} strokeWidth={planeWidth('facial')} strokeDasharray="2 2 6 2"
            opacity={planeOpacity('facial') * 0.85} />

      {/* Maxillary plane */}
      <line x1={L.PNS.x} y1={L.PNS.y} x2={L.ANS.x} y2={L.ANS.y}
            stroke={planeStroke.maxilla} strokeWidth={planeWidth('maxilla')} strokeDasharray="2 3"
            opacity={planeOpacity('maxilla') * 0.85} />
      <text x={L.PNS.x - 4} y={L.PNS.y - 4}
            fontSize="8" fill={planeStroke.maxilla} opacity={planeOpacity('maxilla')}
            fontFamily="var(--font-mono)" fontWeight="600" textAnchor="end">P. MAX.</text>

      {/* Occlusal plane */}
      <line x1={170} y1={254} x2={310} y2={262}
            stroke={planeStroke.occlusal} strokeWidth={planeWidth('occlusal')} strokeDasharray="3 4"
            opacity={planeOpacity('occlusal') * 0.85} />
      <text x={310} y={252} fontSize="8" fill={planeStroke.occlusal} opacity={planeOpacity('occlusal')}
            fontFamily="var(--font-mono)" fontWeight="600" textAnchor="end">P. OCLUSAL</text>

      {/* NA / NB lines for ANB */}
      <line x1={L.N.x} y1={L.N.y} x2={L.A.x} y2={L.A.y}
            stroke={planeStroke.ANB} strokeWidth={planeWidth('ANB') - 0.2} opacity={planeOpacity('ANB') * 0.85} />
      <line x1={L.N.x} y1={L.N.y} x2={L.B.x} y2={L.B.y}
            stroke={planeStroke.ANB} strokeWidth={planeWidth('ANB') - 0.2} opacity={planeOpacity('ANB') * 0.85} />
      <path d={`M ${L.N.x + 15} ${L.N.y + 14} A 18 18 0 0 1 ${L.N.x + 14} ${L.N.y + 18}`}
            stroke={planeStroke.ANB} strokeWidth="1.5" fill="none" opacity={planeOpacity('ANB')} />
      <text x={L.N.x + 22} y={L.N.y + 22}
            fontSize="11" fill={planeStroke.ANB} opacity={planeOpacity('ANB')}
            fontFamily="var(--font-mono)" fontWeight="800">
        ANB {getCephValues(angleClass).ANB.v}°
      </text>

      {/* ============ Landmark points (larger, higher contrast) ============ */}
      {Object.entries({
        S: 'Silla', N: 'Nasion', A: 'Subesp.', B: 'Supram.',
        Pog: 'Pogonion', Me: 'Menton', Go: 'Gonion', Ar: 'Articular',
        Or: 'Orbitario', Po: 'Porion', ANS: 'ENA', PNS: 'ENP'
      }).map(([key]) => {
        const p = L[key];
        if (!p) return null;
        const offsets = {
          S:   { dx: -10, dy: -8,  anchor: 'end' },
          N:   { dx: 12,  dy: 0,   anchor: 'start' },
          A:   { dx: 12,  dy: 4,   anchor: 'start' },
          B:   { dx: 12,  dy: 4,   anchor: 'start' },
          Pog: { dx: 12,  dy: 4,   anchor: 'start' },
          Me:  { dx: 8,   dy: 16,  anchor: 'start' },
          Go:  { dx: -10, dy: 16,  anchor: 'end' },
          Ar:  { dx: -10, dy: 0,   anchor: 'end' },
          Or:  { dx: 8,   dy: -4,  anchor: 'start' },
          Po:  { dx: -10, dy: -4,  anchor: 'end' },
          ANS: { dx: 10,  dy: -10, anchor: 'start' },
          PNS: { dx: -10, dy: -10, anchor: 'end' },
        };
        const o = offsets[key] || { dx: 8, dy: 0, anchor: 'start' };
        // Label width estimate
        const lw = key.length * 7 + 8;
        const lx = p.x + o.dx + (o.anchor === 'end' ? -lw : 0);
        return (
          <g key={key}>
            {/* Guide line */}
            <line x1={p.x + Math.sign(o.dx) * 5} y1={p.y} x2={p.x + o.dx} y2={p.y + o.dy}
                  stroke="rgba(0,128,176,0.4)" strokeWidth="0.6" />
            {/* Label bg pill */}
            <rect x={lx} y={p.y + o.dy - 7.5}
                  width={lw} height="14" rx="3.5"
                  fill="rgba(255,255,255,0.92)" stroke="rgba(0,128,176,0.25)" strokeWidth="0.6" />
            {/* Landmark point — larger w/ white halo */}
            <circle cx={p.x} cy={p.y} r="5" fill="#FFFFFF" stroke="#0080B0" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="2" fill="#0080B0" />
            {/* Label */}
            <text x={p.x + o.dx + (o.anchor === 'end' ? -3 : 4)} y={p.y + o.dy + 3.5}
                  fontSize="11" fill="#00638A" fontFamily="var(--font-mono)" fontWeight="800"
                  textAnchor={o.anchor}>{key}</text>
          </g>
        );
      })}
    </svg>
  );
}

// =============================================================
// Refined Angle class card
// =============================================================
function AngleClassCard({ data, active, onClick }) {
  const c = data.id;
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 14px', textAlign:'left',
        borderRadius:'var(--r-md)',
        border: '1px solid ' + (active ? 'var(--sd-blue-600)' : 'var(--border-default)'),
        background: active ? 'var(--bg-surface)' : 'var(--bg-surface)',
        display:'flex', flexDirection:'column', gap: 10,
        cursor:'pointer', width: '100%',
        boxShadow: active ? '0 2px 8px rgba(0,128,176,0.12)' : 'none',
        transition: 'all var(--dur-1) var(--ease-out)',
        position: 'relative',
      }}>
      {/* Active accent rail on the left */}
      {active && (
        <div style={{
          position:'absolute', left: -1, top: -1, bottom: -1, width: 3,
          background: 'var(--sd-blue-600)',
          borderTopLeftRadius:'var(--r-md)', borderBottomLeftRadius:'var(--r-md)',
        }}></div>
      )}
      <div style={{display:'flex', alignItems:'center', gap: 8}}>
        <span style={{
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          minWidth: 30, padding:'2px 7px',
          borderRadius:'var(--r-sm)',
          background: active ? 'var(--sd-blue-600)' : 'var(--sd-blue-100)',
          color: active ? 'white' : 'var(--sd-blue-700)',
          fontWeight: 800, fontSize: 11,
          fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
        }}>{c}</span>
        <strong style={{
          fontFamily:'var(--font-display)',
          color: 'var(--fg-strong)',
          fontSize: 'var(--t-13)', flex: 1,
        }}>{data.label}</strong>
      </div>
      <ClassDentalScheme c={c} active={active} />
      <span style={{fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4}}>
        {data.desc}
      </span>
    </button>
  );
}

function ClassDentalScheme({ c, active }) {
  const accent = active ? '#0080B0' : '#9CA4B2';
  const ink = '#5A6577';
  const upperShiftX = c === 'II-1' || c === 'II-2' ? 6 : c === 'III' ? -8 : 0;
  const incisorTilt = c === 'II-1' ? 14 : c === 'II-2' ? -8 : 0;

  return (
    <svg viewBox="0 0 140 50" style={{width:'100%', height: 50, display:'block'}}>
      <rect x="2" y="4" width="136" height="2" rx="1" fill="rgba(212,135,124,0.45)" />
      <rect x="2" y="44" width="136" height="2" rx="1" fill="rgba(212,135,124,0.45)" />
      <g transform={`translate(${24 + upperShiftX}, -2)`}>
        <path d="M 0 9 L 24 9 L 22 23 Q 12 25 2 23 Z" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <path d="M 4 9 L 7 6 L 10 9 M 14 9 L 17 6 L 20 9" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <line x1="6" y1="21" x2="18" y2="21" stroke={ink} strokeWidth="0.35" opacity="0.5" />
      </g>
      <g transform="translate(24, 2)">
        <path d="M 0 43 L 24 43 L 22 29 Q 12 27 2 29 Z" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <path d="M 4 43 L 7 46 L 10 43 M 14 43 L 17 46 L 20 43" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <line x1="6" y1="31" x2="18" y2="31" stroke={ink} strokeWidth="0.35" opacity="0.5" />
      </g>
      <g transform="translate(36, 25)">
        {c === 'I' && (
          <>
            <circle cx="0" cy="0" r="1.6" fill={accent} />
            <text x="6" y="3" fontSize="7" fill={accent} fontFamily="var(--font-mono)" fontWeight="700">neutro</text>
          </>
        )}
        {(c === 'II-1' || c === 'II-2') && (
          <>
            <path d="M 5 0 L -4 0" stroke={accent} strokeWidth="1.2" />
            <path d="M -1 -2 L -4 0 L -1 2" stroke={accent} strokeWidth="1.2" fill="none" />
            <text x="8" y="3" fontSize="7" fill={accent} fontFamily="var(--font-mono)" fontWeight="700">mesial</text>
          </>
        )}
        {c === 'III' && (
          <>
            <path d="M -5 0 L 4 0" stroke={accent} strokeWidth="1.2" />
            <path d="M 1 -2 L 4 0 L 1 2" stroke={accent} strokeWidth="1.2" fill="none" />
            <text x="-26" y="3" fontSize="7" fill={accent} fontFamily="var(--font-mono)" fontWeight="700">distal</text>
          </>
        )}
      </g>
      <g transform={`translate(110, 22) rotate(${incisorTilt})`}>
        <path d="M -3 -14 L 3 -14 L 4 0 L -4 0 Z" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <line x1="-3" y1="-14" x2="3" y2="-14" stroke="white" strokeWidth="1" />
      </g>
      <g transform="translate(110, 25)">
        <path d="M -3 12 L 3 12 L 4 0 L -4 0 Z" fill="#FFFCF4" stroke={ink} strokeWidth="0.7" />
        <line x1="-3" y1="12" x2="3" y2="12" stroke="white" strokeWidth="1" />
      </g>
    </svg>
  );
}

// =============================================================
// Tabbed cephalometric values table
// =============================================================
function CephValuesTabbed({ angleClass, onHoverMeasure }) {
  const [tab, setTab] = useStateP('skeletal');
  const vals = useMemoP(() => getCephValues(angleClass), [angleClass]);

  const groups = {
    skeletal: {
      label: 'Esqueletal',
      rows: [
        { k: 'SNA', label: 'Posición maxilar (S-N-A)', unit: '°' },
        { k: 'SNB', label: 'Posición mandibular (S-N-B)', unit: '°' },
        { k: 'ANB', label: 'Relación máxilo-mandibular', unit: '°' },
        { k: 'Wits', label: 'Wits (AO-BO)', unit: 'mm' },
        { k: 'FMA', label: 'Plano mandibular (FMA)', unit: '°' },
        { k: 'SN-GoGn', label: 'Inclinación mandibular', unit: '°' },
      ],
    },
    dental: {
      label: 'Dental',
      rows: [
        { k: 'U1-NA', label: 'Inclinación incisivo sup.', unit: '°' },
        { k: 'U1-NA-mm', label: 'Posición incisivo sup.', unit: 'mm' },
        { k: 'L1-NB', label: 'Inclinación incisivo inf.', unit: '°' },
        { k: 'L1-NB-mm', label: 'Posición incisivo inf.', unit: 'mm' },
        { k: 'U1-L1', label: 'Ángulo interincisal', unit: '°' },
        { k: 'IMPA', label: 'Incisivo inf. al plano mand.', unit: '°' },
        { k: 'Overjet', label: 'Resalte (overjet)', unit: 'mm' },
        { k: 'Overbite', label: 'Sobremordida (overbite)', unit: 'mm' },
      ],
    },
    facial: {
      label: 'Facial',
      rows: [
        { k: 'Convexity', label: 'Convexidad facial (N-A-Pog)', unit: '°' },
        { k: 'Y-Axis', label: 'Eje Y (SGn-FH)', unit: '°' },
      ],
    },
  };
  const tabList = ['skeletal', 'dental', 'facial'];

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-lg)',
      overflow:'hidden',
    }}>
      {/* Tab strip */}
      <div style={{
        display:'flex', padding:'12px 16px 0', gap: 4,
        borderBottom:'1px solid var(--border-soft)',
        alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{display:'flex', gap: 4}}>
          {tabList.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding:'8px 14px',
                background:'transparent', border:'none',
                color: tab === t ? 'var(--sd-blue-700)' : 'var(--fg-muted)',
                fontWeight: 700, fontSize:'var(--t-13)',
                fontFamily:'var(--font-body)',
                borderBottom: '2px solid ' + (tab === t ? 'var(--sd-blue-600)' : 'transparent'),
                marginBottom: -1,
                cursor:'pointer',
                transition: 'all var(--dur-1) var(--ease-out)',
              }}>
              {groups[t].label}
              <span style={{
                marginLeft: 6,
                padding:'1px 6px', borderRadius:'var(--r-pill)',
                background: tab === t ? 'var(--sd-blue-100)' : 'var(--sd-ink-100)',
                color: tab === t ? 'var(--sd-blue-700)' : 'var(--fg-muted)',
                fontSize: 10, fontFamily:'var(--font-mono)', fontWeight: 600,
              }}>{groups[t].rows.length}</span>
            </button>
          ))}
        </div>
        <span style={{
          fontSize: 10, color:'var(--fg-subtle)',
          fontFamily:'var(--font-mono)', fontWeight: 600, letterSpacing: 'var(--ls-wide)',
          textTransform:'uppercase',
          paddingBottom: 8,
        }}>Trazado Steiner</span>
      </div>

      {/* Column header */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 70px 70px 100px',
        padding:'8px 16px',
        background:'var(--sd-ink-50)',
        fontSize: 10, fontWeight: 700, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing: 'var(--ls-wide)',
        borderBottom:'1px solid var(--border-soft)',
      }}>
        <div>Medida</div>
        <div style={{textAlign:'right'}}>Paciente</div>
        <div style={{textAlign:'right'}}>Norma</div>
        <div style={{textAlign:'center'}}>Estado</div>
      </div>

      {/* Rows */}
      <div>
        {groups[tab].rows.map((row, idx) => {
          const d = vals[row.k];
          if (!d) return null;
          const status = statusOf(d.v, d.norm, d.range);
          return (
            <div key={row.k}
              onMouseEnter={() => onHoverMeasure(MEASURE_TO_HIGHLIGHT[row.k] || null)}
              onMouseLeave={() => onHoverMeasure(null)}
              style={{
                display:'grid', gridTemplateColumns:'1fr 70px 70px 100px',
                padding:'10px 16px',
                borderBottom: idx === groups[tab].rows.length - 1 ? 'none' : '1px solid var(--border-soft)',
                fontSize:'var(--t-12)', alignItems:'center',
                transition: 'background var(--dur-1) var(--ease-out)',
                cursor: 'default',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--sd-blue-50)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{display:'flex', alignItems:'center', gap: 8}}>
                <span style={{
                  fontFamily:'var(--font-mono)', fontWeight: 700,
                  fontSize: 10, color:'var(--fg-brand)',
                  padding:'2px 6px', borderRadius:'var(--r-xs)',
                  background:'var(--sd-blue-100)', minWidth: 56, textAlign:'center',
                }}>{row.k}</span>
                <span style={{color:'var(--fg-default)'}}>{row.label}</span>
              </div>
              <div style={{textAlign:'right', fontFamily:'var(--font-mono)', fontWeight: 700,
                          color: status === 'normal' ? 'var(--fg-strong)' :
                                 status === 'aumentado' ? 'var(--sd-alert-600)' : 'var(--sd-critical-600)'}}>
                {d.v}{row.unit}
              </div>
              <div style={{textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--fg-subtle)'}}>
                {d.norm}±{d.range}
              </div>
              <div style={{textAlign:'center'}}>
                <StatusChip status={status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    normal:     { bg:'var(--sd-vital-100)',    fg:'var(--sd-vital-600)',    label:'normal' },
    aumentado:  { bg:'var(--sd-alert-100)',    fg:'var(--sd-alert-600)',    label:'aumentado' },
    disminuido: { bg:'var(--sd-critical-100)', fg:'var(--sd-critical-600)', label:'disminuido' },
  };
  const m = map[status] || map.normal;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: 4,
      padding:'2px 8px', borderRadius:'var(--r-pill)',
      background: m.bg, color: m.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform:'uppercase',
    }}>
      <span style={{width: 5, height: 5, borderRadius:'50%', background: m.fg}}></span>
      {m.label}
    </span>
  );
}

// =============================================================
// Executive summary right panel
// =============================================================
// Merge user-entered cephValues (sparse strings keyed by lowercase id) over scenario defaults
function mergeCephValues(base, userVals) {
  if (!userVals || typeof userVals !== 'object') return base;
  const next = { ...base };
  Object.entries(userVals).forEach(([k, raw]) => {
    if (raw == null || raw === '') return;
    const num = parseFloat(String(raw).replace(',', '.'));
    if (Number.isNaN(num)) return;
    const cap = { sna: 'SNA', snb: 'SNB', anb: 'ANB', fma: 'FMA', impa: 'IMPA',
                  wits: 'Wits', overjet: 'Overjet', overbite: 'Overbite' }[k] || k;
    if (next[cap]) next[cap] = { ...next[cap], v: num };
  });
  return next;
}

function ProfileAnalysisPanel({ angleClass, cephValues }) {
  const vals = mergeCephValues(getCephValues(angleClass), cephValues);
  const anb = vals.ANB.v;
  const fma = vals.FMA.v;

  const skeletal = anb < 0 ? 'Clase III esquelética' :
                   anb > 4 ? 'Clase II esquelética' :
                   anb < 1 ? 'Tendencia Cl. III' :
                   anb > 3 ? 'Tendencia Cl. II' : 'Clase I esquelética';
  const pattern = fma > 30 ? 'Dolicofacial' : fma < 22 ? 'Braquifacial' : 'Mesofacial';
  const overjetTag = vals.Overjet.v > 3.5 ? 'Overjet aumentado'
                   : vals.Overjet.v < 1 ? (vals.Overjet.v < 0 ? 'Overjet invertido' : 'Overjet reducido')
                   : 'Overjet normal';

  // Severity flag for the summary card
  const severity = anb < 0 || vals.Overjet.v < 0 ? 'high'
                 : Math.abs(anb - 2) > 2 || Math.abs(vals.Overjet.v - 2.5) > 1.5 ? 'med'
                 : 'low';
  const sevStyle = {
    low:  { color:'var(--sd-vital-600)',    bg:'var(--sd-vital-100)',    label:'Caso favorable' },
    med:  { color:'var(--sd-alert-600)',    bg:'var(--sd-alert-100)',    label:'Atención clínica' },
    high: { color:'var(--sd-critical-600)', bg:'var(--sd-critical-100)', label:'Caso complejo' },
  }[severity];

  const findings = [];
  if (Math.abs(anb - 2) > 2) findings.push({ t: `ANB ${anb}° → ${anb > 2 ? 'patrón Cl. II' : 'patrón Cl. III'} esquelético`, s: anb > 2 ? 'aumentado' : 'disminuido' });
  if (vals.Overjet.v > 3.5) findings.push({ t: `Overjet aumentado (${vals.Overjet.v} mm)`, s: 'aumentado' });
  if (vals.Overjet.v < 1) findings.push({ t: `Overjet ${vals.Overjet.v < 0 ? 'invertido' : 'reducido'} (${vals.Overjet.v} mm)`, s: 'disminuido' });
  if (vals.Overbite.v > 4) findings.push({ t: `Sobremordida profunda (${vals.Overbite.v} mm)`, s: 'aumentado' });
  if (vals.Overbite.v < 1) findings.push({ t: `Mordida abierta anterior (${vals.Overbite.v} mm)`, s: 'disminuido' });
  if (vals['U1-NA'].v > 25) findings.push({ t: `Incisivos superiores protruidos (${vals['U1-NA'].v}°)`, s: 'aumentado' });
  if (vals['U1-NA'].v < 18) findings.push({ t: `Incisivos superiores retroinclinados (${vals['U1-NA'].v}°)`, s: 'disminuido' });
  if (findings.length === 0) findings.push({ t: 'Valores cefalométricos dentro de norma.', s: 'normal' });

  const keyMetrics = [
    { k: 'SNA', v: vals.SNA.v, u:'°', d: vals.SNA },
    { k: 'SNB', v: vals.SNB.v, u:'°', d: vals.SNB },
    { k: 'ANB', v: vals.ANB.v, u:'°', d: vals.ANB },
    { k: 'Overjet', v: vals.Overjet.v, u:'mm', d: vals.Overjet },
  ];

  return (
    <aside className="detail">
      <div className="detail-header">
        <div className="detail-fdi">Análisis cefalométrico</div>
        <div className="detail-name">Resumen ejecutivo</div>
      </div>

      <div className="detail-body">
        {/* ======= Big composite summary headline ======= */}
        <div style={{
          padding: 16, borderRadius:'var(--r-lg)',
          background: 'linear-gradient(135deg, var(--sd-navy-800), var(--sd-blue-700))',
          color: 'white',
          boxShadow: 'var(--shadow-md)',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{position:'absolute', top: -20, right: -20, width: 120, height: 120,
            borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}></div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing:'var(--ls-widest)',
            textTransform:'uppercase', opacity: 0.7, marginBottom: 8,
          }}>Diagnóstico</div>
          <div style={{
            fontFamily:'var(--font-display)', fontWeight: 800, fontSize:'var(--t-20)',
            lineHeight: 1.2, marginBottom: 10,
          }}>
            {skeletal}
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap: 6}}>
            <span style={{
              padding:'4px 10px', borderRadius:'var(--r-pill)',
              background:'rgba(255,255,255,0.18)', color:'white',
              fontSize: 11, fontWeight: 700,
            }}>{pattern}</span>
            <span style={{
              padding:'4px 10px', borderRadius:'var(--r-pill)',
              background:'rgba(255,255,255,0.18)', color:'white',
              fontSize: 11, fontWeight: 700,
            }}>{overjetTag}</span>
            <span style={{
              padding:'4px 10px', borderRadius:'var(--r-pill)',
              background: sevStyle.bg, color: sevStyle.color,
              fontSize: 11, fontWeight: 800,
            }}>{sevStyle.label}</span>
          </div>
        </div>

        {/* ======= Key metrics 2-col ======= */}
        <div className="detail-section">
          <div className="detail-section-title">Métricas clave</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
            {keyMetrics.map(m => {
              const s = statusOf(m.v, m.d.norm, m.d.range);
              return (
                <div key={m.k} style={{
                  padding: 10, borderRadius:'var(--r-md)',
                  background:'var(--bg-surface)', border:'1px solid var(--border-default)',
                  display:'flex', flexDirection:'column', gap: 4,
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{
                      fontSize: 10, color:'var(--sd-blue-700)', fontWeight: 800,
                      fontFamily:'var(--font-mono)', letterSpacing: 0.5,
                      padding:'1px 6px', borderRadius:'var(--r-xs)',
                      background:'var(--sd-blue-100)',
                    }}>{m.k}</span>
                    <StatusChip status={s} />
                  </div>
                  <div style={{
                    fontFamily:'var(--font-display)', fontWeight: 800,
                    fontSize:'var(--t-20)', lineHeight: 1,
                    color: s === 'normal' ? 'var(--fg-strong)' : s === 'aumentado' ? 'var(--sd-alert-600)' : 'var(--sd-critical-600)',
                  }}>
                    {m.v}<span style={{fontSize:'var(--t-12)', fontWeight: 600, color:'var(--fg-muted)', marginLeft: 2}}>{m.u}</span>
                  </div>
                  <span style={{fontSize: 10, color:'var(--fg-subtle)', fontFamily:'var(--font-mono)'}}>norma {m.d.norm}±{m.d.range}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======= Findings ======= */}
        <div className="detail-section">
          <div className="detail-section-title">Hallazgos</div>
          <ul style={{margin: 0, padding: 0, listStyle:'none', display:'flex', flexDirection:'column', gap: 6}}>
            {findings.map((f, i) => {
              const color = f.s === 'normal' ? 'var(--sd-vital-500)' :
                            f.s === 'aumentado' ? 'var(--sd-alert-500)' :
                            f.s === 'disminuido' ? 'var(--sd-critical-500)' : 'var(--sd-blue-600)';
              return (
                <li key={i} style={{
                  padding:'8px 10px',
                  background:'var(--sd-ink-50)', borderRadius:'var(--r-md)',
                  fontSize:'var(--t-12)', color:'var(--fg-default)',
                  display:'flex', gap: 8, alignItems:'flex-start',
                  borderLeft: `3px solid ${color}`,
                }}>
                  <span style={{color, fontWeight: 800, marginTop: 1}}>·</span>
                  <span>{f.t}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ======= Acciones ======= */}
        <div className="detail-section">
          <div className="detail-section-title">Acciones sugeridas</div>
          <div style={{display:'flex', flexDirection:'column', gap: 6}}>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir trazado cefalométrico
            </button>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c0-6 4-10 9-10s9 4 9 10"/></svg>
              Generar plan de movimientos
            </button>
            <button className="btn btn-ghost" style={{justifyContent:'flex-start'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v16M4 12h16"/></svg>
              Comparar con norma poblacional
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// =============================================================
// MAIN VIEW
// =============================================================
function ProfileViewV2({ angleClass, setAngleClass }) {
  const [hoverPlane, setHoverPlane] = useStateP(null);

  return (
    <div className="profile-v2-grid">
      {/* LEFT — compact Angle picker + plane legend */}
      <div className="profile-v2-side" style={{display:'flex', flexDirection:'column', gap: 'var(--sp-3)'}}>
        <div style={{
          fontSize: 10, fontWeight: 700, color:'var(--fg-muted)',
          textTransform:'uppercase', letterSpacing:'var(--ls-widest)',
          padding:'0 4px',
        }}>Clasificación de Angle</div>
        {ANGLE_CLASSES.map(c => (
          <AngleClassCard key={c.id} data={c} active={angleClass === c.id} onClick={() => setAngleClass(c.id)} />
        ))}

        {/* Plane legend */}
        <div style={{
          marginTop: 4, padding: 14,
          background:'var(--bg-surface)', border:'1px solid var(--border-default)',
          borderRadius:'var(--r-md)',
        }}>
          <div style={{fontSize: 10, fontWeight: 700, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'var(--ls-widest)', marginBottom: 10}}>
            Planos cefalométricos
          </div>
          <div style={{display:'flex', flexDirection:'column', gap: 8, fontSize:'var(--t-12)'}}>
            <PlaneLegendRow id="SN" label="S-N (base craneal)" type="solid" onHover={setHoverPlane} />
            <PlaneLegendRow id="mandibular" label="Plano mandibular" type="dashed" onHover={setHoverPlane} />
            <PlaneLegendRow id="facial" label="Plano facial (N-Pog)" type="dotdash" onHover={setHoverPlane} />
            <PlaneLegendRow id="maxilla" label="Plano maxilar (ANS-PNS)" type="dotted" onHover={setHoverPlane} />
            <PlaneLegendRow id="occlusal" label="Plano oclusal" type="dashed" onHover={setHoverPlane} />
            <PlaneLegendRow id="ANB" label="Relación ANB" type="solid-red" onHover={setHoverPlane} />
          </div>
        </div>
      </div>

      {/* CENTER — Profile (big) + values table */}
      <div className="profile-v2-main" style={{display:'flex', flexDirection:'column', gap:'var(--sp-6)'}}>
        {/* Profile card */}
        <div style={{
          background:'var(--bg-surface)', border:'1px solid var(--border-default)',
          borderRadius:'var(--r-lg)', overflow:'hidden',
          boxShadow:'var(--shadow-sm)',
        }}>
          <div style={{
            padding:'12px 20px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            borderBottom:'1px solid var(--border-soft)',
            background:'var(--bg-surface)',
          }}>
            <div style={{display:'flex', alignItems:'center', gap: 12}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-16)', color:'var(--fg-strong)'}}>
                Perfil cefalométrico
              </div>
              <span style={{
                padding:'3px 10px', borderRadius:'var(--r-pill)',
                background:'var(--sd-blue-600)', color:'white',
                fontSize: 11, fontWeight: 800, fontFamily:'var(--font-mono)', letterSpacing: 0.5,
              }}>{angleClass}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap: 14}}>
              <span style={{fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
                Hover sobre puntos o tabla para resaltar
              </span>
            </div>
          </div>
          <div style={{padding:'18px 24px', background:'var(--bg-app)'}}>
            <ProfileSvg angleClass={angleClass} hoverPlane={hoverPlane} />
          </div>
        </div>

        {/* Tabbed cephalometric values */}
        <div>
          <CephValuesTabbed angleClass={angleClass} onHoverMeasure={setHoverPlane} />
        </div>
      </div>
    </div>
  );
}

function PlaneLegendRow({ id, label, type, onHover }) {
  let dash = null; let stroke = '#7A8497';
  if (type === 'dashed') dash = '6 3';
  else if (type === 'dotdash') dash = '2 2 6 2';
  else if (type === 'dotted') dash = '2 3';
  else if (type === 'solid-red') stroke = 'rgba(218,69,58,0.85)';
  return (
    <div
      onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}
      style={{
        display:'flex', alignItems:'center', gap: 8, cursor: 'help',
        padding:'4px 6px', borderRadius:'var(--r-sm)',
        transition: 'background var(--dur-1) var(--ease-out)',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = 'var(--sd-blue-50)'; }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <svg width="24" height="8" style={{flexShrink: 0}}>
        <line x1="0" y1="4" x2="24" y2="4" stroke={stroke} strokeWidth="1.6" strokeDasharray={dash || undefined} />
      </svg>
      <span style={{color:'var(--fg-default)'}}>{label}</span>
    </div>
  );
}

// Expose
Object.assign(window, {
  ProfileView: ProfileViewV2,
  ProfileAnalysisPanel,
});
