/* =========================================================
   Periodontograma — Tooth SVG (detailed anatomy).
   Adapted from the Claude Design bundle.
   ========================================================= */
const PERIO_W = 50;
const PERIO_H = 130;
const PERIO_CEJ = 55;
const PERIO_MM = 4;

const PERIO_EN_LIGHT = '#FDFCFA';
const PERIO_EN_SHAD  = '#B8B2A0';
const PERIO_EN_LINE  = '#2E3340';
const PERIO_DT_LIGHT = '#F1DDB2';
const PERIO_DT_MID   = '#E2C58A';
const PERIO_DT_SHAD  = '#9C7E3E';
const PERIO_DT_LINE  = '#5A4216';
const PERIO_GROOVE   = '#7E7660';
const PERIO_CUSP_SH  = '#9B8E6E';

function perioBuildTooth(type, upper, fdi) {
  if (type === 'molar') return perioBuildMolar(upper, fdi);
  if (type === 'premolar') return perioBuildPremolar(upper, fdi);
  if (type === 'canine') return perioBuildCanine(fdi);
  return perioBuildIncisor(fdi);
}

function perioBuildIncisor(fdi) {
  const crownD = `
    M 12.5 55 C 11.5 44, 10.5 28, 11 21
    C 11.5 12, 14 6, 17 4.5 C 20 4, 30 4, 33 4.5
    C 36 6, 38.5 12, 39 21 C 39.5 28, 38.5 44, 37.5 55 Z`.replace(/\s+/g, ' ');
  const rootD = `
    M 14 55 C 12.5 72, 12 92, 14.5 110
    C 16.5 118, 20 121, 22 121 L 24 122 L 26 122
    L 28 121 C 30 121, 33.5 118, 35.5 110
    C 38 92, 37.5 72, 36 55 Z`.replace(/\s+/g, ' ');
  const pulpD = `
    M 22 14 Q 22 24 22 35 L 22 50 L 28 50
    L 28 35 Q 28 24 28 14 Z`.replace(/\s+/g, ' ');
  return {
    crownD, rootD, pulpD,
    details: (
      <g pointerEvents="none">
        <path d="M 13 5 Q 25 3.5 37 5" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.4" opacity="0.5" />
        <g opacity="0.35" stroke={PERIO_GROOVE} strokeWidth="0.4" strokeLinecap="round" fill="none">
          <path d="M 18 5 L 18 11" />
          <path d="M 25 4 L 25 12" />
          <path d="M 32 5 L 32 11" />
        </g>
        <path d="M 12 53 Q 25 55 38 53" fill="none" stroke="#A39880" strokeWidth="0.5" opacity="0.6" />
        <path d="M 38 20 C 39 28 38 44 37 54" fill="none" stroke={PERIO_EN_SHAD} strokeWidth="0.5" opacity="0.4" />
      </g>
    ),
  };
}

function perioBuildCanine(fdi) {
  const crownD = `
    M 12.5 55 C 11.5 42, 10.5 25, 11.5 18
    C 12.5 14, 14 12, 16 11 L 22 7 L 24.5 2.5
    L 26 1 L 27.5 2.5 L 30 8 L 34 11
    C 36 12, 37.5 14, 38.5 18
    C 39.5 25, 38.5 42, 37.5 55 Z`.replace(/\s+/g, ' ');
  const rootD = `
    M 13.5 55 C 11.5 74, 10 96, 13 117
    C 15.5 126, 20 130, 23.5 130.5 L 26 131 L 28 130
    C 32 129, 35 126, 37 117 C 40 96, 38.5 74, 36.5 55 Z`.replace(/\s+/g, ' ');
  const pulpD = `
    M 23 8 C 23 16, 23 32, 23 48 L 27 48
    C 27 32, 27 16, 27 8 Z`.replace(/\s+/g, ' ');
  return {
    crownD, rootD, pulpD,
    details: (
      <g pointerEvents="none">
        <path d="M 16 11 L 25 2 L 34 11" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.55" strokeLinecap="round" opacity="0.55" />
        <path d="M 25 3 Q 25 22 25 46" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.45" strokeDasharray="1.2 1.2" opacity="0.55" />
        <path d="M 13 18 C 12 25 12 38 13 50" fill="none" stroke={PERIO_EN_SHAD} strokeWidth="0.5" opacity="0.4" />
        <path d="M 37 18 C 38 25 38 38 37 50" fill="none" stroke={PERIO_EN_SHAD} strokeWidth="0.5" opacity="0.4" />
        <path d="M 12 53 Q 25 55.5 38 53" fill="none" stroke="#A39880" strokeWidth="0.5" opacity="0.6" />
        <ellipse cx="25" cy="3.5" rx="1.2" ry="0.6" fill={PERIO_CUSP_SH} opacity="0.55" />
      </g>
    ),
  };
}

function perioBuildPremolar(upper, fdi) {
  const crownD = `
    M 9 55 C 8 42, 8 25, 10 18
    C 12 12, 15 8, 19 6.5 L 23 4.5 L 25 3.5 L 27 4.5 L 31 6.5
    C 35 8, 38 12, 40 18 C 42 25, 42 42, 41 55 Z`.replace(/\s+/g, ' ');
  const isUpperFirst = upper && (fdi % 10 === 4);
  const rootD = isUpperFirst ? `
    M 11.5 55 C 10 72, 9 95, 13 115
    C 15.5 122, 18 123, 19.5 120 L 21 90 L 23 70 L 25 65
    L 27 70 L 29 90 L 30.5 120
    C 32 123, 34.5 122, 37 115 C 41 95, 40 72, 38.5 55 Z`.replace(/\s+/g, ' ') : `
    M 12 55 C 10.5 72, 10 96, 13.5 116
    C 16 124, 20 126, 23 126 L 25 126.5 L 27 126
    C 30 126, 34 124, 36.5 116 C 40 96, 39.5 72, 38 55 Z`.replace(/\s+/g, ' ');
  const pulpD = `
    M 22 10 C 22 18, 22 35, 22 50 L 28 50
    C 28 35, 28 18, 28 10 Z`.replace(/\s+/g, ' ');
  return {
    crownD, rootD, pulpD,
    details: (
      <g pointerEvents="none">
        <path d="M 17 8 Q 25 2.5 33 8" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.5" opacity="0.5" />
        <path d="M 20 7.5 Q 25 12 30 7.5" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.4" opacity="0.55" />
        <path d="M 25 4 L 25 16 Q 25 30 25 48" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.45" strokeDasharray="1 1.2" opacity="0.5" />
        <path d="M 17 9 Q 18 14 19 18" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.35" opacity="0.4" />
        <path d="M 33 9 Q 32 14 31 18" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.35" opacity="0.4" />
        <ellipse cx="25" cy="5.5" rx="1.4" ry="0.7" fill={PERIO_CUSP_SH} opacity="0.5" />
        <path d="M 10 53 Q 25 55.5 40 53" fill="none" stroke="#A39880" strokeWidth="0.5" opacity="0.6" />
      </g>
    ),
  };
}

function perioBuildMolar(upper, fdi) {
  const crownD = `
    M 4 55 C 3 42, 3 25, 5 17
    C 7.5 10, 12 6.5, 16 8.5
    C 17 7, 18.5 5, 20 6 L 21 8 L 22 5.5 L 23 8.5
    L 24 13.5 L 25 16 L 26 13.5 L 27 8.5 L 28 5.5
    L 29 8 L 30 6 C 31.5 5, 33 7, 34 8.5
    C 38 6.5, 42.5 10, 45 17 C 47 25, 47 42, 46 55 Z`.replace(/\s+/g, ' ');

  let rootD;
  if (upper) {
    rootD = `
      M 8 55 C 5 75, 3.5 95, 7 110
      C 10 119, 14 121, 16 119
      C 17.5 113, 18 100, 19 80 L 19.5 55
      M 30.5 55 L 31 80
      C 32 100, 32.5 113, 34 119
      C 36 121, 40 119, 43 110
      C 46.5 95, 45 75, 42 55 Z`.replace(/\s+/g, ' ');
  } else {
    rootD = `
      M 8 55 C 5 76, 3 102, 7 118
      C 11 126, 16 126, 18.5 121
      C 20 110, 20 82, 19 55
      M 31 55 C 30 82, 30 110, 31.5 121
      C 34 126, 39 126, 43 118
      C 47 102, 45 76, 42 55 Z`.replace(/\s+/g, ' ');
  }

  const palatalRootD = upper ? `
    M 20.5 55 C 19.5 78, 19 98, 22 112
    C 24 119, 26 119, 28 112 C 31 98, 30.5 78, 29.5 55 Z`.replace(/\s+/g, ' ') : null;

  const pulpD = `
    M 12 12 C 12 20, 12 36, 13 50 L 37 50
    C 38 36, 38 20, 38 12 Z`.replace(/\s+/g, ' ');

  return {
    crownD, rootD, pulpD, palatalRootD,
    details: (
      <g pointerEvents="none">
        <path d="M 14 11 Q 19 6 23 9" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.55" opacity="0.55" />
        <path d="M 27 9 Q 31 6 36 11" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.55" opacity="0.55" />
        <path d="M 25 9 Q 25 18 25 26 Q 25 38 25 50" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.7" opacity="0.55" />
        <ellipse cx="19" cy="7" rx="1.6" ry="0.8" fill={PERIO_CUSP_SH} opacity="0.5" />
        <ellipse cx="31" cy="7" rx="1.6" ry="0.8" fill={PERIO_CUSP_SH} opacity="0.5" />
        <path d="M 16 9 Q 19 12 22 9" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.35" opacity="0.45" />
        <path d="M 28 9 Q 31 12 34 9" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.35" opacity="0.45" />
        <path d="M 13 13 Q 14 22 15 30" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.4" opacity="0.4" />
        <path d="M 37 13 Q 36 22 35 30" fill="none" stroke={PERIO_GROOVE} strokeWidth="0.4" opacity="0.4" />
        <path d="M 5 53 Q 25 56 45 53" fill="none" stroke="#A39880" strokeWidth="0.55" opacity="0.6" />
        {upper && <path d="M 25 56 L 25 70" stroke={PERIO_DT_SHAD} strokeWidth="0.4" opacity="0.4" strokeDasharray="1 1" fill="none" />}
        {!upper && <path d="M 25 56 L 25 95" stroke={PERIO_DT_SHAD} strokeWidth="0.4" opacity="0.4" strokeDasharray="1 1" fill="none" />}
      </g>
    ),
  };
}

function perioPdClass(pd) {
  if (!pd) return 'empty';
  if (pd <= 3) return 'shallow';
  if (pd <= 5) return 'moderate';
  return 'deep';
}

function PerioToothSVG({ tooth, view, mirror, flipped }) {
  const sites = view === 'buccal' ? ['DB', 'B', 'MB'] : ['DL', 'L', 'ML'];
  const displayOrder = mirror ? [sites[2], sites[1], sites[0]] : sites;
  const xs = [9, 25, 41];

  const points = displayOrder.map((siteName, i) => {
    const m = tooth.sites[siteName];
    const gmY = PERIO_CEJ + (m.gm || 0) * PERIO_MM;
    return {
      siteName, x: xs[i],
      pd: m.pd || 0, gm: m.gm || 0, bop: m.bop, plaque: m.plaque, sup: m.sup,
      gmY, pdEndY: gmY + (m.pd || 0) * PERIO_MM,
    };
  });

  const gp = points;
  const gumLine = [
    `M -2 ${PERIO_CEJ + 4}`,
    `Q 3 ${gp[0].gmY - 0.5} ${gp[0].x} ${gp[0].gmY}`,
    `Q ${(gp[0].x + gp[1].x) / 2} ${(gp[0].gmY + gp[1].gmY) / 2 - 1.4} ${gp[1].x} ${gp[1].gmY}`,
    `Q ${(gp[1].x + gp[2].x) / 2} ${(gp[1].gmY + gp[2].gmY) / 2 - 1.4} ${gp[2].x} ${gp[2].gmY}`,
    `Q ${PERIO_W - 3} ${gp[2].gmY - 0.5} ${PERIO_W + 2} ${PERIO_CEJ + 4}`,
  ].join(' ');
  const gumFill = gumLine + ` L ${PERIO_W + 2} ${PERIO_H + 2} L -2 ${PERIO_H + 2} Z`;
  const boneLine = [
    `M -2 ${gp[0].pdEndY + 3}`,
    `Q 3 ${gp[0].pdEndY + 1} ${gp[0].x} ${gp[0].pdEndY}`,
    `L ${gp[1].x} ${gp[1].pdEndY}`,
    `L ${gp[2].x} ${gp[2].pdEndY}`,
    `Q ${PERIO_W - 3} ${gp[2].pdEndY + 1} ${PERIO_W + 2} ${gp[2].pdEndY + 3}`,
  ].join(' ');

  const q = Math.floor(tooth.fdi / 10);
  const upper = q === 1 || q === 2;
  const transform = flipped ? `scale(1,-1) translate(0,${-PERIO_H})` : '';

  const idSuffix = tooth.fdi + '-' + view;

  return (
    <svg viewBox={`0 0 ${PERIO_W} ${PERIO_H}`} className="perio-tooth-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`pEnSh-${idSuffix}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.85" stopColor={PERIO_EN_SHAD} stopOpacity="0.35" />
          <stop offset="1" stopColor={PERIO_EN_SHAD} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`pEnHi-${idSuffix}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pEnCv-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#7A6A3F" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`pRtHi-${idSuffix}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pRtSh-${idSuffix}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor={PERIO_DT_SHAD} stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={`pPulp-${idSuffix}`} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#A0623A" stopOpacity="0.32" />
          <stop offset="1" stopColor="#A0623A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pGum-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#9C3030" stopOpacity="0.32" />
        </linearGradient>
      </defs>

      <g transform={transform}>
        {tooth.implant ? (
          <PerioImplant fdi={tooth.fdi} />
        ) : (
          <PerioRealistic fdi={tooth.fdi} type={tooth.type} upper={upper} idSuffix={idSuffix} />
        )}

        <line x1="4" y1={PERIO_CEJ} x2={PERIO_W - 4} y2={PERIO_CEJ} stroke="#6B4F22" strokeWidth="0.4" strokeDasharray="1.2 0.8" opacity="0.55" />

        <path d={gumFill} fill="#E89797" opacity="0.92" />
        <path d={gumFill} fill={`url(#pGum-${idSuffix})`} />
        <path d={gumLine} fill="none" stroke="#8A3F3F" strokeWidth="0.85" />

        {points.map((p, i) => (
          p.pd > 0 && (
            <rect key={i}
              x={p.x - 1.8} y={p.gmY}
              width="3.6" height={Math.max(0.8, p.pd * PERIO_MM)}
              fill={
                perioPdClass(p.pd) === 'shallow' ? 'rgba(43,168,106,0.4)'
                  : perioPdClass(p.pd) === 'moderate' ? 'rgba(224,153,46,0.55)'
                    : 'rgba(218,69,58,0.55)'
              }
              rx="0.6" />
          )
        ))}

        <path d={boneLine} stroke="#3F485C" strokeWidth="0.65" strokeDasharray="2 1.4" opacity="0.7" fill="none" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.gmY} r="1.5"
              fill={p.bop ? '#DA453A' : p.plaque ? '#E0992E' : '#FFFFFF'}
              stroke={p.bop || p.plaque ? '#FFFFFF' : '#5F687A'} strokeWidth="0.5" />
            {p.sup && (
              <circle cx={p.x} cy={p.gmY} r="2.5" fill="none" stroke="#DA453A" strokeWidth="0.55" />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}

function PerioRealistic({ fdi, type, upper, idSuffix }) {
  const t = perioBuildTooth(type, upper, fdi);
  return (
    <g>
      {t.palatalRootD && (
        <g>
          <path d={t.palatalRootD} fill={PERIO_DT_MID} stroke={PERIO_DT_LINE} strokeWidth="0.75" opacity="0.82" />
          <path d={t.palatalRootD} fill={`url(#pRtSh-${idSuffix})`} opacity="0.7" />
        </g>
      )}
      <path d={t.rootD} fill={PERIO_DT_LIGHT} stroke={PERIO_DT_LINE} strokeWidth="0.85" />
      <path d={t.rootD} fill={`url(#pRtSh-${idSuffix})`} />
      <path d={t.rootD} fill={`url(#pRtHi-${idSuffix})`} />
      <path d={t.crownD} fill={PERIO_EN_LIGHT} stroke={PERIO_EN_LINE} strokeWidth="1.0" strokeLinejoin="round" />
      <path d={t.crownD} fill={`url(#pEnSh-${idSuffix})`} />
      <path d={t.crownD} fill={`url(#pEnCv-${idSuffix})`} />
      <path d={t.crownD} fill={`url(#pEnHi-${idSuffix})`} />
      {t.pulpD && <path d={t.pulpD} fill={`url(#pPulp-${idSuffix})`} opacity="0.7" />}
      {t.details}
    </g>
  );
}

function PerioImplant({ fdi }) {
  return (
    <g>
      <defs>
        <linearGradient id={`pTi-${fdi}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6E7682" />
          <stop offset="0.3" stopColor="#B5BBC4" />
          <stop offset="0.55" stopColor="#E0E4EB" />
          <stop offset="0.75" stopColor="#A8AEB8" />
          <stop offset="1" stopColor="#5C6470" />
        </linearGradient>
        <linearGradient id={`pTiCr-${fdi}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDFCFA" />
          <stop offset="1" stopColor="#D9D3C5" />
        </linearGradient>
      </defs>
      <path d="M 9 55 C 8 38 8 22 11 14 C 14 8 19 5 25 5 C 31 5 36 8 39 14 C 42 22 42 38 41 55 Z"
            fill={`url(#pTiCr-${fdi})`} stroke={PERIO_EN_LINE} strokeWidth="0.7" />
      <path d="M 11 9 Q 25 4 39 9" fill="none" stroke={PERIO_EN_LINE} strokeWidth="0.4" opacity="0.4" />
      <ellipse cx="20" cy="14" rx="6" ry="4" fill="#FFFFFF" opacity="0.4" />
      <line x1="11" y1="50" x2="39" y2="50" stroke="#7A8290" strokeWidth="0.45" strokeDasharray="0.8 0.6" />
      <path d="M 14 55 L 12 110 C 13 122 18 124 25 124 C 32 124 37 122 38 110 L 36 55 Z"
            fill={`url(#pTi-${fdi})`} stroke="#3C4250" strokeWidth="0.55" />
      {[60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 118].map((y) => (
        <path key={y}
          d={`M 13 ${y} Q 25 ${y + 2.2} 37 ${y}`}
          fill="none" stroke="#2E3340" strokeWidth="0.4" opacity="0.7" />
      ))}
      <rect x="22.5" y="56" width="2.5" height="64" fill="#FFFFFF" opacity="0.25" rx="0.5" />
      <ellipse cx="25" cy="123" rx="6" ry="2" fill="#3C4250" opacity="0.5" />
    </g>
  );
}

function PerioAbsent() {
  return (
    <svg viewBox={`0 0 ${PERIO_W} ${PERIO_H}`} className="perio-tooth-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="perio-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#DCE1E9" />
        </pattern>
      </defs>
      <rect x="6" y="20" width="38" height="90" fill="url(#perio-hatch)" opacity="0.5" rx="3" />
      <text x="25" y="68" textAnchor="middle" fontSize="8"
            fontFamily="JetBrains Mono, monospace" fill="#8A93A4" fontWeight="700">
        AUSENTE
      </text>
    </svg>
  );
}

Object.assign(window, { PerioToothSVG, PerioAbsent, PerioImplant, perioPdClass });
