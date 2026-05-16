/* global React, Tooth, fdiToType, fdiArch, fdiName, TOOTH_NAMES, UPPER_FDI, LOWER_FDI, getArchPositions */
// ============================================================
// views.jsx — Different visualization modes
// ============================================================

const { useState, useMemo, useRef, useEffect } = React;

// =================================================================
// Orthodontic case summary card (used in ArchView)
// =================================================================
function OrthoSummary() {
  const metrics = [
    {
      label: 'Clase molar',
      sides: [{ k: 'D', v: 'II' }, { k: 'I', v: 'II' }],
      status: 'alert',
    },
    {
      label: 'Clase canina',
      sides: [{ k: 'D', v: 'II' }, { k: 'I', v: 'I' }],
      status: 'alert',
    },
    {
      label: 'Overjet',
      value: '5.2',
      unit: 'mm',
      norm: '2–3',
      status: 'alert',
    },
    {
      label: 'Overbite',
      value: '4.0',
      unit: 'mm',
      norm: '2–3',
      sub: '40 %',
      status: 'alert',
    },
    {
      label: 'Línea media',
      value: '0.5',
      unit: 'mm',
      sub: 'desv. izq.',
      status: 'warn',
    },
    {
      label: 'Apiñamiento',
      sides: [{ k: 'Sup', v: '−3.5' }, { k: 'Inf', v: '−2.0' }],
      unit: 'mm',
      status: 'alert',
    },
  ];

  const statusColor = (s) => ({
    ok: 'var(--sd-vital-500)',
    warn: 'var(--sd-alert-500)',
    alert: 'var(--sd-critical-500)',
  }[s] || 'var(--sd-blue-600)');

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '14px 0',
      display: 'grid',
      gridTemplateColumns: `repeat(${metrics.length}, 1fr)`,
      width: '100%',
      maxWidth: 980,
      margin: '0 auto var(--sp-4)',
      boxShadow: '0 1px 2px rgba(11,20,36,0.04)',
    }}>
      {metrics.map((m, i) => (
        <div key={m.label} style={{
          padding: '4px 18px',
          borderLeft: i === 0 ? 'none' : '1px solid var(--border-soft)',
          display: 'flex', flexDirection: 'column', gap: 4,
          position: 'relative',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 700,
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-widest)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: statusColor(m.status),
              display: 'inline-block',
            }}></span>
            {m.label}
          </div>
          {m.sides ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              {m.sides.map(s => (
                <div key={s.k} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 'var(--t-20)', color: 'var(--fg-strong)',
                    lineHeight: 1,
                  }}>{s.v}{m.unit ? <span style={{fontSize: 'var(--t-12)', fontWeight: 600, color: 'var(--fg-muted)', marginLeft: 2}}> {m.unit}</span> : null}</span>
                  <span style={{
                    fontSize: 10, color: 'var(--fg-subtle)',
                    fontFamily: 'var(--font-mono)', fontWeight: 600,
                    marginTop: 2,
                  }}>{s.k}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'var(--t-24)', color: 'var(--fg-strong)',
                lineHeight: 1,
              }}>{m.value}<span style={{fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--fg-muted)', marginLeft: 3}}>{m.unit}</span></span>
              <span style={{
                fontSize: 10, color: 'var(--fg-subtle)',
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                marginTop: 4,
              }}>
                {m.sub ? m.sub : (m.norm ? `norma ${m.norm}` : '')}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// =================================================================
// VIEW 1: ARCH (Diagrama ortodóncico de arcadas) — main view
// =================================================================
function ArchView({ teeth, selected, onSelect, showWire, showLabels }) {
  const upperPositions = useMemo(() => getArchPositions('upper'), []);
  const lowerPositions = useMemo(() => getArchPositions('lower'), []);

  // Compute wire path connecting brackets in each arch
  const upperWire = computeWirePath(upperPositions, teeth, 'sup');
  const lowerWire = computeWirePath(lowerPositions, teeth, 'inf');

  // SVG viewBox: tall enough for both arches + roots
  // Each arch sits ±260 vertical, plus root tips
  return (
    <div className="arch-wrap">
      <OrthoSummary />
      <svg className="arch-svg" viewBox="-440 -310 880 620" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="gumGrad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#F0C9C0" />
            <stop offset="1" stopColor="#D9A296" />
          </radialGradient>
          {/* Wire metallic */}
          <linearGradient id="wireGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F4F6F9" />
            <stop offset="0.45" stopColor="#B8BFCC" />
            <stop offset="0.55" stopColor="#7B8597" />
            <stop offset="1" stopColor="#4D5667" />
          </linearGradient>
        </defs>

        {/* Subtle gum tissue arcs behind teeth */}
        <path d="M -360 -240 Q -400 -190 -340 -130 Q -300 -90 -260 -60 Q -200 -20 0 -10 Q 200 -20 260 -60 Q 300 -90 340 -130 Q 400 -190 360 -240"
              fill="none" stroke="#F4D9D2" strokeWidth="120" strokeLinejoin="round" opacity="0.35" />
        <path d="M -360 240 Q -400 190 -340 130 Q -300 90 -260 60 Q -200 20 0 10 Q 200 20 260 60 Q 300 90 340 130 Q 400 190 360 240"
              fill="none" stroke="#F4D9D2" strokeWidth="120" strokeLinejoin="round" opacity="0.35" />

        {/* Center axis hint */}
        <line x1="-380" y1="0" x2="380" y2="0" stroke="var(--border-soft)" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.6" />
        <text x="-390" y="-4" fontSize="9" fill="var(--fg-subtle)" fontFamily="var(--font-mono)">PLANO OCLUSAL</text>

        {/* Upper arch label */}
        <text x="0" y="-280" textAnchor="middle" fontSize="11" fill="var(--fg-muted)"
              fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">MAXILAR — ARCO SUPERIOR</text>
        {/* Lower arch label */}
        <text x="0" y="295" textAnchor="middle" fontSize="11" fill="var(--fg-muted)"
              fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">MANDIBULAR — ARCO INFERIOR</text>

        {/* Side labels: derecho/izquierdo */}
        <text x="-410" y="0" textAnchor="middle" fontSize="10" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="600">DER</text>
        <text x="410" y="0" textAnchor="middle" fontSize="10" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="600">IZQ</text>

        {/* Wires — outer dark for definition, then metallic gradient on top */}
        {showWire && upperWire && (
          <>
            <path d={upperWire} fill="none" stroke="#1A2235" strokeWidth="3.4" strokeLinecap="round" opacity="0.35" />
            <path d={upperWire} fill="none" stroke="url(#wireGrad)" strokeWidth="2.6" strokeLinecap="round" />
            <path d={upperWire} fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" />
          </>
        )}
        {showWire && lowerWire && (
          <>
            <path d={lowerWire} fill="none" stroke="#1A2235" strokeWidth="3.4" strokeLinecap="round" opacity="0.35" />
            <path d={lowerWire} fill="none" stroke="url(#wireGrad)" strokeWidth="2.6" strokeLinecap="round" />
            <path d={lowerWire} fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" />
          </>
        )}

        {/* Upper teeth */}
        {upperPositions.map((p) => (
          <Tooth
            key={p.fdi}
            fdi={p.fdi}
            state={teeth[p.fdi] || {}}
            x={p.x} y={p.y} rotate={p.rotate}
            selected={selected === p.fdi}
            onClick={() => onSelect(p.fdi)}
          />
        ))}
        {/* Upper FDI labels */}
        {showLabels && upperPositions.map((p) => (
          <text key={`l${p.fdi}`} className="tooth-fdi"
                x={p.x * 1.18} y={p.y * 1.18 - 8}>{p.fdi}</text>
        ))}

        {/* Lower teeth */}
        {lowerPositions.map((p) => (
          <Tooth
            key={p.fdi}
            fdi={p.fdi}
            state={teeth[p.fdi] || {}}
            x={p.x} y={p.y} rotate={p.rotate}
            selected={selected === p.fdi}
            onClick={() => onSelect(p.fdi)}
          />
        ))}
        {/* Lower FDI labels */}
        {showLabels && lowerPositions.map((p) => (
          <text key={`l${p.fdi}`} className="tooth-fdi"
                x={p.x * 1.18} y={p.y * 1.18 + 14}>{p.fdi}</text>
        ))}
      </svg>
    </div>
  );
}

// Compute wire path: bezier through bracket centers
function computeWirePath(positions, teeth, archCode) {
  // Only include teeth that have a fixed bracket appliance (not aligner/removable/none/missing)
  const FIXED = new Set(['metal','ceramic','zafiro','autolig','lingual','band']);
  const bracketed = positions.filter(p => {
    const s = teeth[p.fdi];
    if (!s || !s.appliance) return false;
    if (!FIXED.has(s.appliance)) return false;
    if (s.condition === 'ausente' || s.condition === 'extraido') return false;
    return true;
  });
  if (bracketed.length < 2) return null;

  // For each bracketed tooth, compute the bracket center in world coords
  const pts = bracketed.map(p => {
    // Bracket is at local (0, 22) — transform through rotate(rotate) scale(1) rotate(flip)
    // flipForUpper inverts y for upper arch, so bracket position is (0, -22) in local frame post-flip
    const localY = archCode === 'sup' ? -22 : 22;
    const rad = p.rotate * Math.PI / 180;
    const wx = p.x + Math.sin(rad) * (-localY); // rotation around origin: x_new = -localY * sin(rad)... actually let me redo
    // After translate(x,y).rotate(rotate).scale(1).rotate(flip)
    // local point (lx, ly) becomes: world = (x,y) + R(rotate) * scale(1) * R(flip) * (lx, ly)
    // For upper: flip=180, so R(flip)*(lx,ly) = (-lx,-ly). Local (0, 22) → (0, -22), then R(rotate)*(0,-22) = (22*sin(rotate), -22*cos(rotate))
    // For lower: flip=0, R(rotate)*(0,22) = (-22*sin(rotate), 22*cos(rotate))
    let dx, dy;
    if (archCode === 'sup') {
      dx = 22 * Math.sin(rad);
      dy = -22 * Math.cos(rad);
    } else {
      dx = -22 * Math.sin(rad);
      dy = 22 * Math.cos(rad);
    }
    return { x: p.x + dx, y: p.y + dy };
  });

  // Smooth bezier through points using Catmull-Rom approximation
  if (pts.length < 2) return null;
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

// =================================================================
// VIEW 2: FRONTAL SMILE — clinical retracted intraoral view
// =================================================================
function FrontalView({ teeth, selected, onSelect }) {
  const [hoverFdi, setHoverFdi] = useState(null);

  // Anterior + premolar visible in retracted view
  // Centered around midline (x=0). Bracket Y will land on the archwire plane.
  // Upper anteriors (canine→canine→premolar) with natural smile-arc tip placement
  //   gingival baseline:  Y_gum_upper = -68 (where crown's gingival edge sits)
  //   tooth Y = y_gum_upper + (crown_height * scale)?  We position so bracket is at archwire plane.
  //   With our local bracket Y=22 and crown ending at Y=42, bracket-from-crown-bottom = 20.
  //   For upper teeth (flipped 180°), bracket world Y = toothY - 22*scale.
  //   Let's target upper bracket Y = -38 (above center). With scale 1.45, toothY = -38 + 22*1.45 = -6.
  // ... but easier: define each tooth's screen position and compute bracket points after.

  const upperTeeth = [
    { fdi: 15, x: -210, y: -10, scale: 1.10 },   // P2
    { fdi: 14, x: -160, y: -8,  scale: 1.20 },   // P1
    { fdi: 13, x: -110, y: -6,  scale: 1.35 },   // canino — bajo
    { fdi: 12, x: -62,  y: -10, scale: 1.25 },   // IL — un poco más arriba
    { fdi: 11, x: -18,  y: -6,  scale: 1.45 },   // IC — central, baja
    { fdi: 21, x: 18,   y: -6,  scale: 1.45 },
    { fdi: 22, x: 62,   y: -10, scale: 1.25 },
    { fdi: 23, x: 110,  y: -6,  scale: 1.35 },
    { fdi: 24, x: 160,  y: -8,  scale: 1.20 },
    { fdi: 25, x: 210,  y: -10, scale: 1.10 },
  ];
  const lowerTeeth = [
    { fdi: 45, x: -200, y: 38, scale: 0.95 },
    { fdi: 44, x: -154, y: 38, scale: 1.05 },
    { fdi: 43, x: -108, y: 38, scale: 1.15 },
    { fdi: 42, x: -64,  y: 36, scale: 1.00 },
    { fdi: 41, x: -22,  y: 36, scale: 1.05 },
    { fdi: 31, x: 22,   y: 36, scale: 1.05 },
    { fdi: 32, x: 64,   y: 36, scale: 1.00 },
    { fdi: 33, x: 108,  y: 38, scale: 1.15 },
    { fdi: 34, x: 154,  y: 38, scale: 1.05 },
    { fdi: 35, x: 200,  y: 38, scale: 0.95 },
  ];

  // Bracket world centers (for the wire)
  const upperBracketCenters = upperTeeth.map(t => ({ x: t.x, y: t.y - 22 * t.scale, fdi: t.fdi }));
  const lowerBracketCenters = lowerTeeth.map(t => ({ x: t.x, y: t.y + 22 * t.scale, fdi: t.fdi }));

  const wireUpper = catmullRomPath(upperBracketCenters.filter(p => {
    const s = teeth[p.fdi];
    return s && s.appliance && ['metal','ceramic','zafiro','autolig','lingual','band'].includes(s.appliance);
  }));
  const wireLower = catmullRomPath(lowerBracketCenters.filter(p => {
    const s = teeth[p.fdi];
    return s && s.appliance && ['metal','ceramic','zafiro','autolig','lingual','band'].includes(s.appliance);
  }));

  const allTeeth = [...upperTeeth, ...lowerTeeth];

  return (
    <div className="smile-wrap">
      <svg viewBox="-340 -160 680 320" xmlns="http://www.w3.org/2000/svg"
        style={{width:'100%', maxWidth: 900, height: 'auto', display: 'block', filter: 'drop-shadow(0 12px 32px rgba(11,20,36,0.08))'}}>
        <defs>
          {/* Soft skin vignette frame */}
          <radialGradient id="skinFrame" cx="0.5" cy="0.5" r="0.7">
            <stop offset="0.50" stopColor="rgba(244,217,200,0)" />
            <stop offset="0.85" stopColor="rgba(228,194,176,0.55)" />
            <stop offset="1" stopColor="rgba(208,170,150,0.85)" />
          </radialGradient>
          {/* Mouth cavity */}
          <radialGradient id="mouthCavity" cx="0.5" cy="0.5" r="0.65">
            <stop offset="0" stopColor="#3D1B16" />
            <stop offset="1" stopColor="#0F0606" />
          </radialGradient>
          {/* Gum gradient */}
          <linearGradient id="gumUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E4ACA1" />
            <stop offset="1" stopColor="#CE8076" />
          </linearGradient>
          <linearGradient id="gumDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CE8076" />
            <stop offset="1" stopColor="#E4ACA1" />
          </linearGradient>
          {/* Wire metallic */}
          <linearGradient id="wireSmile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F4F6F9" />
            <stop offset="0.45" stopColor="#BAC2CE" />
            <stop offset="0.55" stopColor="#7B8597" />
            <stop offset="1" stopColor="#4D5667" />
          </linearGradient>
          {/* Clip for crown area only — masks anything that pokes above gum or below */}
          <clipPath id="upperGumClip">
            <path d="M -340 -80 Q -260 -85 -180 -82 Q -90 -78 0 -76 Q 90 -78 180 -82 Q 260 -85 340 -80 L 340 60 L -340 60 Z" />
          </clipPath>
          <clipPath id="lowerGumClip">
            <path d="M -340 -60 L 340 -60 L 340 80 Q 260 85 180 82 Q 90 78 0 76 Q -90 78 -180 82 Q -260 85 -340 80 Z" />
          </clipPath>
        </defs>

        {/* Mouth cavity dark interior */}
        <rect x="-340" y="-160" width="680" height="320" fill="url(#mouthCavity)" />

        {/* Soft skin frame (retractor edges) */}
        <rect x="-340" y="-160" width="680" height="320" fill="url(#skinFrame)" />

        {/* Cheek retractors — subtle clinical hint at the edges */}
        <path d="M -340 -160 Q -330 -80 -310 -10 Q -300 60 -310 130 Q -330 160 -340 160 Z" fill="rgba(232,194,176,0.6)" />
        <path d="M 340 -160 Q 330 -80 310 -10 Q 300 60 310 130 Q 330 160 340 160 Z" fill="rgba(232,194,176,0.6)" />
        <path d="M -310 -120 Q -290 0 -310 120" fill="none" stroke="rgba(180,140,120,0.4)" strokeWidth="1.5" />
        <path d="M 310 -120 Q 290 0 310 120" fill="none" stroke="rgba(180,140,120,0.4)" strokeWidth="1.5" />

        {/* Upper gum (palatal) — covers above teeth, hides roots */}
        <path d="M -340 -160 L 340 -160 L 340 -68 Q 280 -76 200 -78 Q 100 -82 0 -80 Q -100 -82 -200 -78 Q -280 -76 -340 -68 Z"
              fill="url(#gumUp)" />
        {/* Gum scallops — soft interdental papillae */}
        {upperTeeth.map(t => (
          <path key={`up-gum-${t.fdi}`}
            d={`M ${t.x - 18} -72 Q ${t.x} -64 ${t.x + 18} -72`}
            fill="rgba(180,120,108,0.35)" stroke="none" />
        ))}

        {/* Lower gum (lingual/mandibular) */}
        <path d="M -340 68 Q -280 76 -200 78 Q -100 82 0 80 Q 100 82 200 78 Q 280 76 340 68 L 340 160 L -340 160 Z"
              fill="url(#gumDown)" />
        {lowerTeeth.map(t => (
          <path key={`lo-gum-${t.fdi}`}
            d={`M ${t.x - 16} 72 Q ${t.x} 64 ${t.x + 16} 72`}
            fill="rgba(180,120,108,0.35)" stroke="none" />
        ))}

        {/* Subtle inner shadow at gum line */}
        <path d="M -340 -68 Q -200 -78 0 -80 Q 200 -78 340 -68" fill="none" stroke="rgba(80,30,20,0.3)" strokeWidth="2" />
        <path d="M -340 68 Q -200 78 0 80 Q 200 78 340 68" fill="none" stroke="rgba(80,30,20,0.3)" strokeWidth="2" />

        {/* === Clinical guides (rendered BEHIND teeth) === */}
        {/* Facial midline */}
        <line x1="0" y1="-150" x2="0" y2="150" stroke="rgba(0,128,176,0.35)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="6" y="-140" fontSize="9" fill="rgba(0,128,176,0.8)" fontFamily="var(--font-mono)" fontWeight="700">L. MEDIA FACIAL</text>

        {/* Occlusal plane (horizontal — where upper and lower meet) */}
        <line x1="-280" y1="14" x2="280" y2="14" stroke="rgba(0,128,176,0.35)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="-275" y="11" fontSize="9" fill="rgba(0,128,176,0.8)" fontFamily="var(--font-mono)" fontWeight="700">PLANO OCLUSAL</text>

        {/* === Teeth (crown only) — upper first, then lower === */}
        {upperTeeth.map(t => (
          <Tooth key={`u-${t.fdi}`} fdi={t.fdi} state={teeth[t.fdi] || {}}
            x={t.x} y={t.y} rotate={0} scale={t.scale}
            selected={selected === t.fdi}
            onClick={() => onSelect(t.fdi)}
            crownOnly={true}
          />
        ))}

        {/* Upper wire — bold, continuous, sits at bracket Y */}
        {wireUpper && (
          <>
            <path d={wireUpper} fill="none" stroke="#1A2235" strokeWidth="4.6" strokeLinecap="round" opacity="0.4" />
            <path d={wireUpper} fill="none" stroke="url(#wireSmile)" strokeWidth="3.6" strokeLinecap="round" />
            <path d={wireUpper} fill="none" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          </>
        )}

        {lowerTeeth.map(t => (
          <Tooth key={`l-${t.fdi}`} fdi={t.fdi} state={teeth[t.fdi] || {}}
            x={t.x} y={t.y} rotate={0} scale={t.scale}
            selected={selected === t.fdi}
            onClick={() => onSelect(t.fdi)}
            crownOnly={true}
          />
        ))}

        {/* Lower wire */}
        {wireLower && (
          <>
            <path d={wireLower} fill="none" stroke="#1A2235" strokeWidth="4.6" strokeLinecap="round" opacity="0.4" />
            <path d={wireLower} fill="none" stroke="url(#wireSmile)" strokeWidth="3.6" strokeLinecap="round" />
            <path d={wireLower} fill="none" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          </>
        )}

        {/* === Clinical guides (rendered ON TOP of teeth) === */}
        {/* Dental midline upper (between 11 & 21) */}
        <line x1="0" y1="-58" x2="0" y2="14" stroke="rgba(218,69,58,0.7)" strokeWidth="1.2" strokeDasharray="2 2" />
        <text x="3" y="-50" fontSize="8" fill="rgba(218,69,58,0.95)" fontFamily="var(--font-mono)" fontWeight="700">LMD ↑</text>
        {/* Dental midline lower (slight deviation to the left, for the seed Class II) */}
        <line x1="-3" y1="14" x2="-3" y2="78" stroke="rgba(218,69,58,0.7)" strokeWidth="1.2" strokeDasharray="2 2" />
        <text x="0" y="74" fontSize="8" fill="rgba(218,69,58,0.95)" fontFamily="var(--font-mono)" fontWeight="700">LMD ↓ 0.5</text>

        {/* Overbite measurement bracket on right side */}
        <g transform="translate(240, -10)">
          <line x1="0" y1="-32" x2="0" y2="22" stroke="rgba(0,128,176,0.9)" strokeWidth="1" />
          <line x1="-4" y1="-32" x2="4" y2="-32" stroke="rgba(0,128,176,0.9)" strokeWidth="1" />
          <line x1="-4" y1="22" x2="4" y2="22" stroke="rgba(0,128,176,0.9)" strokeWidth="1" />
          <rect x="6" y="-12" width="46" height="24" rx="4" fill="rgba(255,255,255,0.95)" stroke="rgba(0,128,176,0.6)" strokeWidth="0.6" />
          <text x="29" y="-1" fontSize="8" fill="var(--fg-muted)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="0.5">OVERBITE</text>
          <text x="29" y="9" fontSize="10" fill="var(--fg-strong)" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">4.0 mm</text>
        </g>

        {/* Sonrisa gingival measurement (left side) */}
        <g transform="translate(-240, -70)">
          <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(224,153,46,0.95)" strokeWidth="1" />
          <line x1="-4" y1="0" x2="4" y2="0" stroke="rgba(224,153,46,0.95)" strokeWidth="1" />
          <line x1="-4" y1="16" x2="4" y2="16" stroke="rgba(224,153,46,0.95)" strokeWidth="1" />
          <rect x="-58" y="0" width="50" height="24" rx="4" fill="rgba(255,255,255,0.95)" stroke="rgba(224,153,46,0.6)" strokeWidth="0.6" />
          <text x="-33" y="11" fontSize="8" fill="var(--fg-muted)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="0.5">SONR. GINGIVAL</text>
          <text x="-33" y="21" fontSize="10" fill="var(--fg-strong)" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">2.0 mm</text>
        </g>

        {/* Buccal corridor (subtle shaded zones at sides) */}
        <path d="M -310 -50 L -240 -50 L -240 50 L -310 50 Z" fill="rgba(11,20,36,0.18)" />
        <path d="M 240 -50 L 310 -50 L 310 50 L 240 50 Z" fill="rgba(11,20,36,0.18)" />
        <text x="-275" y="60" fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" letterSpacing="1">CORREDOR BUCAL</text>
        <text x="275" y="60" fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" letterSpacing="1">CORREDOR BUCAL</text>

        {/* FDI labels — only on selected or hover */}
        {allTeeth.map(t => {
          const isOn = selected === t.fdi || hoverFdi === t.fdi;
          if (!isOn) return null;
          const isUpper = t.fdi < 30;
          const labelY = isUpper ? t.y + 32 * t.scale + 10 : t.y - 32 * t.scale - 4;
          return (
            <g key={`lbl-${t.fdi}`}>
              <rect x={t.x - 12} y={labelY - 9} width="24" height="13" rx="3" fill="rgba(11,20,36,0.85)" />
              <text x={t.x} y={labelY} fontSize="9" textAnchor="middle" fill="white" fontFamily="var(--font-mono)" fontWeight="700">{t.fdi}</text>
            </g>
          );
        })}

        {/* Hover handlers — overlay rects */}
        {allTeeth.map(t => (
          <rect key={`hit-${t.fdi}`}
            x={t.x - 20} y={t.y - 30 * t.scale} width="40" height={60 * t.scale}
            fill="transparent" style={{cursor: 'pointer'}}
            onMouseEnter={() => setHoverFdi(t.fdi)}
            onMouseLeave={() => setHoverFdi(null)}
            onClick={() => onSelect(t.fdi)}
          />
        ))}
      </svg>

      {/* Metric strip under the view */}
      <div style={{
        display:'flex', gap: 'var(--sp-5)', marginTop: 'var(--sp-4)',
        flexWrap:'wrap', justifyContent:'center', alignItems:'center',
        fontSize:'var(--t-12)', color:'var(--fg-muted)',
      }}>
        <ClinicalChip color="var(--sd-blue-600)" label="Línea media facial" value="centrada" />
        <ClinicalChip color="var(--sd-critical-500)" label="Línea media dental sup." value="centrada" />
        <ClinicalChip color="var(--sd-critical-500)" label="Línea media dental inf." value="−0.5 mm izq." />
        <ClinicalChip color="var(--sd-blue-600)" label="Overbite" value="4.0 mm (40%)" />
        <ClinicalChip color="var(--sd-alert-500)" label="Sonrisa gingival" value="2.0 mm" />
        <ClinicalChip color="var(--fg-muted)" label="Corredor bucal" value="medio" />
      </div>
    </div>
  );
}

function ClinicalChip({ color, label, value }) {
  return (
    <div style={{display:'inline-flex', alignItems:'center', gap: 8, padding: '6px 12px', borderRadius:'var(--r-pill)', background:'var(--bg-surface)', border:'1px solid var(--border-default)'}}>
      <span style={{width: 7, height: 7, borderRadius:'50%', background: color}}></span>
      <span style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', color: 'var(--fg-muted)'}}>{label}</span>
      <span style={{fontSize: 'var(--t-12)', fontWeight: 700, color: 'var(--fg-strong)', fontFamily: 'var(--font-mono)'}}>{value}</span>
    </div>
  );
}

// Catmull-Rom smoothing for a wire path through points
function catmullRomPath(pts) {
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

// =================================================================
// OCCLUSAL TOOTH SHAPES — anatomical top-down view
// Each tooth drawn in local frame: X = mesio-distal, Y = bucco-lingual.
// Negative Y = buccal (outside arch). Positive Y = lingual (inside arch).
// =================================================================
const ENAMEL_FILL = "#FFF8EE";
const ENAMEL_DARK = "#E9D6B4";
const FISSURE = "#B7A079";

function OccCI({ k }) {
  return (
    <g>
      <defs>
        <radialGradient id={`occCI-${k}`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#FFFCF4" />
          <stop offset="1" stopColor={ENAMEL_DARK} />
        </radialGradient>
      </defs>
      {/* Crown outline (top-down): wider M-D, narrow B-L. Cingulum bulge on lingual side. */}
      <path d="M -4.6 -3.2 Q -4.3 -3.6 -3.5 -3.6 L 3.5 -3.6 Q 4.3 -3.6 4.6 -3.2 L 4.4 1 Q 3.5 3.2 0 3.4 Q -3.5 3.2 -4.4 1 Z"
        fill={`url(#occCI-${k})`} stroke="#A8916D" strokeWidth="0.35" />
      {/* Incisal edge — narrow strip along buccal side */}
      <path d="M -3.6 -3.4 L 3.6 -3.4" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.85" strokeLinecap="round" />
      <path d="M -3.6 -3.0 L 3.6 -3.0" stroke={FISSURE} strokeWidth="0.25" opacity="0.5" />
      {/* Mamelones */}
      <circle cx="-1.7" cy="-3.4" r="0.5" fill="#FFFFFF" opacity="0.6" />
      <circle cx="0" cy="-3.5" r="0.5" fill="#FFFFFF" opacity="0.6" />
      <circle cx="1.7" cy="-3.4" r="0.5" fill="#FFFFFF" opacity="0.6" />
      {/* Marginal ridges */}
      <path d="M -4.2 -1.5 Q -3.8 0 -3.6 1.5" stroke={FISSURE} strokeWidth="0.3" fill="none" opacity="0.5" />
      <path d="M 4.2 -1.5 Q 3.8 0 3.6 1.5" stroke={FISSURE} strokeWidth="0.3" fill="none" opacity="0.5" />
      {/* Cingulum (lingual bulge) */}
      <ellipse cx="0" cy="1.8" rx="2.2" ry="1.1" fill="#FFFFFF" opacity="0.25" />
    </g>
  );
}

function OccIL({ k }) {
  return (
    <g>
      <defs>
        <radialGradient id={`occIL-${k}`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#FFFCF4" />
          <stop offset="1" stopColor={ENAMEL_DARK} />
        </radialGradient>
      </defs>
      <path d="M -3.6 -2.8 Q -3.4 -3.2 -2.7 -3.2 L 2.7 -3.2 Q 3.4 -3.2 3.6 -2.8 L 3.4 0.8 Q 2.5 2.6 0 2.8 Q -2.5 2.6 -3.4 0.8 Z"
        fill={`url(#occIL-${k})`} stroke="#A8916D" strokeWidth="0.35" />
      <path d="M -2.8 -3 L 2.8 -3" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.85" strokeLinecap="round" />
      <ellipse cx="0" cy="1.4" rx="1.8" ry="0.8" fill="#FFFFFF" opacity="0.2" />
    </g>
  );
}

function OccC({ k }) {
  return (
    <g>
      <defs>
        <radialGradient id={`occC-${k}`} cx="0.5" cy="0.4" r="0.65">
          <stop offset="0" stopColor="#FFFCF4" />
          <stop offset="1" stopColor={ENAMEL_DARK} />
        </radialGradient>
      </defs>
      {/* Diamond / pentagonal — pointed cusp toward buccal */}
      <path d="M -3.4 -2 Q -2.5 -3.6 0 -3.8 Q 2.5 -3.6 3.4 -2 L 3.8 1 Q 2.8 3.4 0 3.6 Q -2.8 3.4 -3.8 1 Z"
        fill={`url(#occC-${k})`} stroke="#A8916D" strokeWidth="0.4" />
      {/* Cusp tip */}
      <circle cx="0" cy="-3.4" r="0.55" fill="#FFFFFF" opacity="0.9" />
      <circle cx="0" cy="-3.4" r="0.25" fill={FISSURE} opacity="0.6" />
      {/* Cusp ridges down to marginal ridges */}
      <path d="M 0 -3.4 L -3 -1.4" stroke={FISSURE} strokeWidth="0.3" opacity="0.55" />
      <path d="M 0 -3.4 L 3 -1.4" stroke={FISSURE} strokeWidth="0.3" opacity="0.55" />
      {/* Lingual cingulum */}
      <ellipse cx="0" cy="2.2" rx="1.7" ry="0.9" fill="#FFFFFF" opacity="0.22" />
    </g>
  );
}

function OccP({ k, second }) {
  return (
    <g>
      <defs>
        <radialGradient id={`occP-${k}`} cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#FFFCF4" />
          <stop offset="1" stopColor={ENAMEL_DARK} />
        </radialGradient>
      </defs>
      {/* Oval rectangle — two cusps separated by central fissure */}
      <path d="M -3.6 -3.8 Q 0 -4.2 3.6 -3.8 L 3.8 3.8 Q 0 4.2 -3.8 3.8 Z"
        fill={`url(#occP-${k})`} stroke="#A8916D" strokeWidth="0.4" />
      {/* Buccal cusp (dominant) */}
      <ellipse cx="0" cy="-1.8" rx="2.8" ry="1.6" fill="#FFFFFF" opacity="0.35" />
      <circle cx="0" cy="-2.2" r="0.5" fill="#FFFFFF" opacity="0.9" />
      {/* Lingual cusp */}
      <ellipse cx="0" cy="2" rx="2.4" ry="1.4" fill="#FFFFFF" opacity="0.25" />
      <circle cx={second ? 0.2 : -0.1} cy="2.2" r="0.45" fill="#FFFFFF" opacity="0.8" />
      {/* Central fissure (mesio-distal) */}
      <path d="M -3 0 Q 0 0.2 3 0" stroke={FISSURE} strokeWidth="0.6" fill="none" opacity="0.7" />
      <path d="M -3 0.4 Q 0 0.6 3 0.4" stroke={FISSURE} strokeWidth="0.25" fill="none" opacity="0.4" />
      {/* Marginal ridges (mesial / distal) */}
      <path d="M -3.6 -2.5 Q -3.4 0 -3.6 2.5" stroke={FISSURE} strokeWidth="0.3" fill="none" opacity="0.5" />
      <path d="M 3.6 -2.5 Q 3.4 0 3.6 2.5" stroke={FISSURE} strokeWidth="0.3" fill="none" opacity="0.5" />
    </g>
  );
}

function OccM({ k, arch, size }) {
  // size: 1 = m1, 2 = m2, 3 = m3
  const s = { 1: 1.0, 2: 0.9, 3: 0.78 }[size] || 1.0;
  const w = 5.5 * s;
  const h = 5.5 * s;
  // Upper M1: rhomboid with oblique ridge MB-DL. Lower M1: 5 cusps, more rectangular.
  const upper = arch === 'sup';
  return (
    <g>
      <defs>
        <radialGradient id={`occM-${k}`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#FFFCF4" />
          <stop offset="1" stopColor={ENAMEL_DARK} />
        </radialGradient>
      </defs>
      {/* Outline */}
      {upper ? (
        // Rhomboid — mesiobuccal corner slightly extended
        <path d={`M ${-w-0.4} ${-h+0.5} Q 0 ${-h-0.4} ${w-0.2} ${-h+0.8} L ${w+0.2} ${h-0.5} Q 0 ${h+0.3} ${-w+0.3} ${h-0.5} Z`}
          fill={`url(#occM-${k})`} stroke="#A8916D" strokeWidth="0.4" />
      ) : (
        // Rectangular — 5-cusp lower
        <path d={`M ${-w} ${-h+0.5} Q 0 ${-h-0.2} ${w} ${-h+0.5} L ${w-0.2} ${h-0.5} Q 0 ${h+0.3} ${-w+0.2} ${h-0.5} Z`}
          fill={`url(#occM-${k})`} stroke="#A8916D" strokeWidth="0.4" />
      )}

      {/* Cusps — drawn as soft highlights with small tips */}
      {upper ? (
        <>
          {/* Mesiobuccal (largest) */}
          <ellipse cx={-w*0.5} cy={-h*0.5} rx={w*0.45} ry={h*0.4} fill="#FFFFFF" opacity="0.35" />
          <circle cx={-w*0.5} cy={-h*0.55} r="0.55" fill="#FFFFFF" opacity="0.95" />
          {/* Distobuccal */}
          <ellipse cx={w*0.5} cy={-h*0.5} rx={w*0.4} ry={h*0.35} fill="#FFFFFF" opacity="0.32" />
          <circle cx={w*0.5} cy={-h*0.55} r="0.5" fill="#FFFFFF" opacity="0.9" />
          {/* Mesiolingual */}
          <ellipse cx={-w*0.5} cy={h*0.5} rx={w*0.42} ry={h*0.38} fill="#FFFFFF" opacity="0.28" />
          <circle cx={-w*0.5} cy={h*0.55} r="0.5" fill="#FFFFFF" opacity="0.85" />
          {/* Distolingual (smallest) */}
          <ellipse cx={w*0.5} cy={h*0.5} rx={w*0.32} ry={h*0.3} fill="#FFFFFF" opacity="0.25" />
          <circle cx={w*0.5} cy={h*0.55} r="0.4" fill="#FFFFFF" opacity="0.85" />
          {/* Oblique ridge MB → DL */}
          <path d={`M ${-w*0.4} ${-h*0.35} Q 0 0 ${w*0.4} ${h*0.4}`} stroke="#D8C396" strokeWidth="0.6" fill="none" opacity="0.7" />
          {/* Central fossa pit */}
          <circle cx="0" cy="0" r="0.5" fill={FISSURE} opacity="0.5" />
          {/* Grooves: Y-shape */}
          <path d={`M 0 0 L ${-w*0.5} ${-h*0.3}`} stroke={FISSURE} strokeWidth="0.35" opacity="0.7" />
          <path d={`M 0 0 L ${w*0.5} ${-h*0.3}`} stroke={FISSURE} strokeWidth="0.35" opacity="0.7" />
          <path d={`M 0 0 L ${-w*0.5} ${h*0.3}`} stroke={FISSURE} strokeWidth="0.35" opacity="0.5" />
        </>
      ) : (
        <>
          {/* 5 cusps for lower molars (M1) — MB, DB, D (distal), ML, DL */}
          <ellipse cx={-w*0.5} cy={-h*0.5} rx={w*0.4} ry={h*0.38} fill="#FFFFFF" opacity="0.32" />
          <circle cx={-w*0.5} cy={-h*0.55} r="0.5" fill="#FFFFFF" opacity="0.9" />
          <ellipse cx={w*0.45} cy={-h*0.5} rx={w*0.35} ry={h*0.32} fill="#FFFFFF" opacity="0.3" />
          <circle cx={w*0.45} cy={-h*0.55} r="0.45" fill="#FFFFFF" opacity="0.85" />
          {/* Distal cusp (between DB and DL) - small */}
          <circle cx={w*0.85} cy="0" r="0.4" fill="#FFFFFF" opacity="0.7" />
          <ellipse cx={-w*0.5} cy={h*0.5} rx={w*0.4} ry={h*0.35} fill="#FFFFFF" opacity="0.28" />
          <circle cx={-w*0.5} cy={h*0.55} r="0.45" fill="#FFFFFF" opacity="0.85" />
          <ellipse cx={w*0.45} cy={h*0.45} rx={w*0.35} ry={h*0.32} fill="#FFFFFF" opacity="0.25" />
          <circle cx={w*0.45} cy={h*0.5} r="0.4" fill="#FFFFFF" opacity="0.8" />
          {/* + groove pattern */}
          <path d={`M ${-w*0.6} 0 L ${w*0.7} 0`} stroke={FISSURE} strokeWidth="0.35" opacity="0.65" />
          <path d={`M 0 ${-h*0.6} L 0 ${h*0.6}`} stroke={FISSURE} strokeWidth="0.35" opacity="0.6" />
          <circle cx="0" cy="0" r="0.5" fill={FISSURE} opacity="0.5" />
        </>
      )}
    </g>
  );
}

function OccToothShape({ type, arch, k }) {
  switch (type) {
    case 'ci': return <OccCI k={k} />;
    case 'il': return <OccIL k={k} />;
    case 'c':  return <OccC k={k} />;
    case 'p1': return <OccP k={k} second={false} />;
    case 'p2': return <OccP k={k} second={true} />;
    case 'm1': return <OccM k={k} arch={arch} size={1} />;
    case 'm2': return <OccM k={k} arch={arch} size={2} />;
    case 'm3': return <OccM k={k} arch={arch} size={3} />;
    default:   return null;
  }
}

// Top-down bracket (smaller, oriented as if seen from above)
function OccBracket({ kind, ligature, type }) {
  if (!kind) return null;
  const isMolar = type && type.startsWith('m');
  const w = isMolar ? 4.5 : 3.5;  // mesio-distal length of bracket footprint
  const h = isMolar ? 1.6 : 1.4;  // bucco-lingual depth of bracket footprint
  const yBuccal = isMolar ? -4 : -3.2; // bracket sits at buccal surface

  if (kind === 'lingual') {
    return (
      <g>
        <rect x={-w/2} y={(isMolar ? 4 : 3.2) - h/2} width={w} height={h} rx="0.3"
          fill="rgba(255,255,255,0.7)" stroke="var(--sd-blue-600)" strokeWidth="0.35" strokeDasharray="0.5 0.4" />
      </g>
    );
  }
  if (kind === 'aligner') {
    return null; // shown as outline below
  }
  if (kind === 'removable') {
    return (
      <line x1={-w} y1={yBuccal - 0.4} x2={w} y2={yBuccal - 0.4} stroke="#7B8597" strokeWidth="0.5" />
    );
  }

  const fillMap = {
    metal: '#D4D9E2', ceramic: '#FBF7EF', zafiro: 'rgba(245,250,255,0.7)',
    autolig: '#9CA4B2', band: '#9AA5B6',
  };
  const strokeMap = {
    metal: '#5A6577', ceramic: '#B5A98E', zafiro: '#7BAEC8',
    autolig: '#3A4254', band: '#5A6577',
  };

  return (
    <g>
      {kind === 'band' && (
        // Band wraps around tooth — outline at the perimeter
        <path d={`M ${-w*1.4} ${yBuccal + 0.3} L ${w*1.4} ${yBuccal + 0.3} L ${w*1.4} ${-yBuccal - 0.3} L ${-w*1.4} ${-yBuccal - 0.3} Z`}
          fill="none" stroke={strokeMap[kind]} strokeWidth="0.45" rx="0.5" />
      )}
      {/* Bracket pad (footprint) */}
      <rect x={-w/2} y={yBuccal - h/2} width={w} height={h} rx="0.3"
        fill={fillMap[kind]} stroke={strokeMap[kind]} strokeWidth="0.4" />
      {/* Slot indicator (running mesio-distal — wire channel) */}
      <line x1={-w/2 + 0.3} y1={yBuccal} x2={w/2 - 0.3} y2={yBuccal} stroke="#0B1424" strokeWidth="0.4" />
      {/* Ligature ring around bracket */}
      {ligature && kind !== 'autolig' && (
        <rect x={-w/2 - 0.6} y={yBuccal - h/2 - 0.5} width={w + 1.2} height={h + 1} rx="0.6"
          fill="none" stroke={ligature} strokeWidth="0.5" opacity="0.95" />
      )}
    </g>
  );
}

// Top-down condition overlay (subtle marker on occlusal surface)
function OccCondition({ kind }) {
  if (!kind) return null;
  if (kind === 'caries') return <circle cx="0" cy="0" r="1.2" fill="#3A2920" opacity="0.85" />;
  if (kind === 'restoration') return <path d="M -1.5 -0.5 Q -0.5 -1.5 1 -0.5 Q 1.5 1 0 1.5 Q -1.5 1 -1.5 -0.5 Z" fill="#7E8895" opacity="0.7" />;
  if (kind === 'corona') return <path d="" fill="none" />; // crown shown as gold outline below
  if (kind === 'endodoncia') return <circle cx="0" cy="0" r="0.8" fill="#C2362C" opacity="0.8" />;
  if (kind === 'ausente' || kind === 'extraido') {
    return (
      <g>
        <line x1="-4" y1="-4" x2="4" y2="4" stroke="#C2362C" strokeWidth="0.8" />
        <line x1="4" y1="-4" x2="-4" y2="4" stroke="#C2362C" strokeWidth="0.8" />
      </g>
    );
  }
  return null;
}

// Top-down movement arrow (transverse / rotational planning)
function OccMovement({ kind, amount }) {
  if (!kind) return null;
  const len = 2 + (amount || 1) * 0.8;
  const color = "#0080B0";
  const halo = "#FFFFFF";
  switch (kind) {
    case 'rotacion':
      return (
        <g>
          <path d="M -3 0 A 3 3 0 0 1 3 0" fill="none" stroke={halo} strokeWidth="1.2" />
          <path d="M -3 0 A 3 3 0 0 1 3 0" fill="none" stroke={color} strokeWidth="0.6" />
          <path d="M 3 0 L 2 -0.7 M 3 0 L 2 0.7" stroke={color} strokeWidth="0.6" />
        </g>
      );
    case 'vestibular':
      return (
        <g>
          <line x1="0" y1="0" x2="0" y2={-len} stroke={halo} strokeWidth="1.2" />
          <line x1="0" y1="0" x2="0" y2={-len} stroke={color} strokeWidth="0.7" />
          <path d={`M -0.5 ${-len + 0.6} L 0 ${-len} L 0.5 ${-len + 0.6}`} stroke={color} fill={color} strokeWidth="0.5" />
        </g>
      );
    case 'lingual':
      return (
        <g>
          <line x1="0" y1="0" x2="0" y2={len} stroke={halo} strokeWidth="1.2" />
          <line x1="0" y1="0" x2="0" y2={len} stroke={color} strokeWidth="0.7" />
          <path d={`M -0.5 ${len - 0.6} L 0 ${len} L 0.5 ${len - 0.6}`} stroke={color} fill={color} strokeWidth="0.5" />
        </g>
      );
    case 'mesial':
      return (
        <g>
          <line x1="0" y1="0" x2={-len} y2="0" stroke={halo} strokeWidth="1.2" />
          <line x1="0" y1="0" x2={-len} y2="0" stroke={color} strokeWidth="0.7" />
          <path d={`M ${-len + 0.6} -0.5 L ${-len} 0 L ${-len + 0.6} 0.5`} stroke={color} fill={color} strokeWidth="0.5" />
        </g>
      );
    case 'distal':
      return (
        <g>
          <line x1="0" y1="0" x2={len} y2="0" stroke={halo} strokeWidth="1.2" />
          <line x1="0" y1="0" x2={len} y2="0" stroke={color} strokeWidth="0.7" />
          <path d={`M ${len - 0.6} -0.5 L ${len} 0 L ${len - 0.6} 0.5`} stroke={color} fill={color} strokeWidth="0.5" />
        </g>
      );
    default:
      return <circle cx="0" cy="0" r="1.4" fill="none" stroke={color} strokeWidth="0.5" />;
  }
}

// Occlusal tooth wrapper
function OcclusalTooth({ fdi, state = {}, x, y, rotate = 0, scale = 4, selected, onClick }) {
  const type = window.fdiToType(fdi);
  const arch = window.fdiArch(fdi);
  const k = `occ-${fdi}`;
  const isMissing = state.condition === 'ausente';
  const op = isMissing ? 0.15 : 1;
  // For lower arch, flip 180° so buccal still points outward (away from arch center which is above)
  const archFlip = arch === 'inf' ? 180 : 0;
  return (
    <g
      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale}) rotate(${archFlip})`}
      style={{ opacity: op, cursor: 'pointer' }}
      onClick={onClick}
    >
      {selected && (
        <circle cx="0" cy="0" r="6" fill="rgba(0,128,176,0.1)" stroke="var(--sd-blue-600)" strokeWidth="0.4" strokeDasharray="0.8 0.8" />
      )}
      <OccToothShape type={type} arch={arch} k={k} />
      {state.appliance && state.condition !== 'ausente' && state.condition !== 'extraido' && (
        <OccBracket kind={state.appliance} ligature={state.ligature} type={type} />
      )}
      <OccCondition kind={state.condition} />
      {state.movement && <OccMovement kind={state.movement.kind} amount={state.movement.amount} />}
    </g>
  );
}

// Horseshoe positions for occlusal view
// archType: 'upper' or 'lower'
// orientation: anteriors at bottom, posteriors curving up → like a U opening up
function getOcclusalPositions(archType) {
  const fdis = archType === 'upper' ? window.UPPER_FDI : window.LOWER_FDI;
  const N = fdis.length;
  const a = 230;   // half-width
  const b = 260;   // depth front-to-back
  const positions = [];
  for (let i = 0; i < N; i++) {
    const t = (i - 7.5) / 7.5;
    const ang = Math.sign(t) * Math.pow(Math.abs(t), 1.18) * 1.45;
    const x = a * Math.sin(ang);
    // Anteriors at y = +120 (bottom), posteriors at y = -100 (top)
    const y = -b * Math.cos(ang) + 140;
    // Rotation: tangent of arch. For upper arch with anteriors at bottom and ∪ shape,
    // the tooth's buccal (-Y_local) must point OUTWARD from arch center (which sits at top).
    // The angle from arch center (0, 140-b) to tooth (x, y): atan2(x, y - (140-b))
    // y - (140-b) = -b cos(ang) + 140 - 140 + b = b(1 - cos(ang)) > 0 (always positive)
    // So direction (x_world+, y_world+). We need local -Y to align with this direction.
    // -Y_local = (0,-1). After rotate(θ), this becomes (sin θ, -cos θ).
    // Setting sin θ = sin(ang) → θ = ang. -cos(ang) is negative, but we need positive y...
    // So rotation needs to be θ = ang + π. Then -Y_local → (sin(ang+π), -cos(ang+π)) = (-sin(ang), cos(ang))
    // Still doesn't match. Let me think again.
    //
    // Easier: brute-force. We want at ang=0 (anterior), buccal points DOWN on screen (+y).
    // In local frame, buccal is -Y (up). So we need rotate(180) to flip it down.
    // At ang=π/2 (right posterior), we want buccal to point RIGHT (+x). After rotate(180+ang*180/π), -Y goes to:
    //   rotate by (180 + 90) = 270°: (0,-1) → (cos 270, sin 270) ... wait this is getting confused.
    //   Standard rotation: (x,y) → (x cos θ - y sin θ, x sin θ + y cos θ). For (0,-1) and θ in degrees:
    //   At θ=180: (0,1) → buccal points down ✓
    //   At θ=180+90=270: (1,0) → buccal points right ✓
    // So rotation in degrees = 180 + ang*(180/π) for upper.
    // But that ang for right posterior is +π/2 (positive). 180 + 90 = 270 ✓.
    // For left posterior ang = -π/2: 180 - 90 = 90 → buccal points left ✓.
    //
    // For lower arch, we'll flip via archFlip=180 inside the component, so we apply the SAME rotation
    // and let the component handle the flip. Wait — that means lower buccal would also point down,
    // but we want it to point UP for lower (since lower arch center is below the tooth in our layout).
    //
    // Hmm, let me just reuse upper layout for both arches (flipped in the component if needed).
    // Actually for clinical clarity, render upper and lower with the SAME ∪ horseshoe oriented same way.
    // The component handles the flip so buccal still points outward.
    let rotateDeg = 180 + ang * (180 / Math.PI);
    positions.push({ x, y, rotate: rotateDeg, fdi: fdis[i] });
  }
  return positions;
}

Object.assign(window, { OcclusalTooth, getOcclusalPositions });
// =================================================================
// VIEW 3: OCLUSAL — true top-down arch (anatomical horseshoe)
// =================================================================
function OclusalView({ teeth, selected, onSelect }) {
  const [arch, setArch] = useState('sup');
  const [showLabels, setShowLabels] = useState(false);
  const positions = useMemo(() => getOcclusalPositions(arch === 'sup' ? 'upper' : 'lower'), [arch]);

  // Compute arch geometry for clinical guides
  // Brackets sit at buccal edge: local (0, -3.4) for incisors → outward radial point
  const buccalPoint = (p) => {
    // Bucco-lingual depth in local units (≈3.4), times scale (4)
    const r = (window.fdiToType(p.fdi).startsWith('m') ? 5.5 : 3.6) * 4;
    const rad = p.rotate * Math.PI / 180;
    // From the rotation math above: -Y_local after rotate(rotate) goes to (cos(rotate-90°), sin(rotate-90°))... 
    // Easier: use the same formula as bracket position
    // local (0, -3.4) after rotate(rotate*deg) → (3.4*sin(rotate), -3.4*cos(rotate)) but with archFlip=180 for lower
    // To make this robust: just compute the outward direction
    // For our layout, the arch center is approximately at (0, 140 - 260) = (0, -120) for upper
    const cx = 0, cy = -120;
    const dx = p.x - cx, dy = p.y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return {
      x: p.x + (dx/dist) * r * 0.92,
      y: p.y + (dy/dist) * r * 0.92,
    };
  };

  // Find specific teeth for measurements
  const findP = (fdi) => positions.find(p => p.fdi === fdi);
  const canineR = arch === 'sup' ? findP(13) : findP(43);
  const canineL = arch === 'sup' ? findP(23) : findP(33);
  const molarR  = arch === 'sup' ? findP(16) : findP(46);
  const molarL  = arch === 'sup' ? findP(26) : findP(36);

  // Wire path along buccal edges of bracketed teeth
  const FIXED = new Set(['metal','ceramic','zafiro','autolig','lingual','band']);
  const wirePts = positions
    .filter(p => {
      const s = teeth[p.fdi];
      return s && s.appliance && FIXED.has(s.appliance) && s.condition !== 'ausente' && s.condition !== 'extraido';
    })
    .map(buccalPoint);
  const wirePath = catmullRomPath(wirePts);

  return (
    <div className="arch-wrap" style={{gap:'var(--sp-3)'}}>
      <div style={{display:'flex', gap: 6, alignItems:'center'}}>
        <button className="btn btn-ghost"
          style={{background: arch==='sup' ? 'var(--sd-blue-100)' : '', color: arch==='sup' ? 'var(--sd-blue-700)' : '', borderColor: arch==='sup' ? 'var(--sd-blue-600)' : ''}}
          onClick={()=>setArch('sup')}>Maxilar superior</button>
        <button className="btn btn-ghost"
          style={{background: arch==='inf' ? 'var(--sd-blue-100)' : '', color: arch==='inf' ? 'var(--sd-blue-700)' : '', borderColor: arch==='inf' ? 'var(--sd-blue-600)' : ''}}
          onClick={()=>setArch('inf')}>Mandibular inferior</button>
        <label style={{display:'flex', alignItems:'center', gap: 6, fontSize:'var(--t-12)', color:'var(--fg-muted)', marginLeft: 16}}>
          <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
          Numeración FDI
        </label>
      </div>

      <svg viewBox="-320 -200 640 460" xmlns="http://www.w3.org/2000/svg"
        style={{width:'100%', maxWidth: 760, height:'auto', display:'block', filter:'drop-shadow(0 8px 28px rgba(11,20,36,0.06))'}}>
        <defs>
          <linearGradient id="palateSoft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F9E6DE" stopOpacity="0.6" />
            <stop offset="1" stopColor="#F4D2C7" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="wireOcc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EEF1F5" />
            <stop offset="0.5" stopColor="#9CA4B2" />
            <stop offset="1" stopColor="#4D5667" />
          </linearGradient>
        </defs>

        {/* === Palate / floor of mouth — SUBTLE only, hugs arch === */}
        {arch === 'sup' && (
          <>
            {/* Hard palate hint — only inside the arch */}
            <path d="M -220 -100 Q -240 0 -210 130 Q -100 175 0 180 Q 100 175 210 130 Q 240 0 220 -100 Q 110 -150 0 -148 Q -110 -150 -220 -100 Z"
              fill="url(#palateSoft)" />
            {/* Median raphe (palatal midline ridge) */}
            <path d="M 0 -130 Q 1 0 0 165" stroke="rgba(180,120,108,0.45)" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
            {/* Rugae palatinae (subtle waves on hard palate) */}
            {[-100,-70,-40,-10].map((y, i) => (
              <path key={i} d={`M -50 ${y} Q -25 ${y - 6} 0 ${y} Q 25 ${y - 6} 50 ${y}`} stroke="rgba(180,120,108,0.25)" strokeWidth="0.8" fill="none" />
            ))}
          </>
        )}
        {arch === 'inf' && (
          <>
            {/* Floor of mouth + tongue space (very subtle) */}
            <path d="M -220 -100 Q -240 0 -210 130 Q -100 175 0 180 Q 100 175 210 130 Q 240 0 220 -100 Q 110 -150 0 -148 Q -110 -150 -220 -100 Z"
              fill="url(#palateSoft)" opacity="0.6" />
            {/* Lingual frenum */}
            <path d="M 0 90 L 0 170" stroke="rgba(180,120,108,0.5)" strokeWidth="1" fill="none" />
            <ellipse cx="0" cy="40" rx="80" ry="55" fill="rgba(204,140,120,0.12)" />
          </>
        )}

        {/* === Gum line along arch (thin band hugging teeth) === */}
        <path
          d={(function() {
            // Inner contour points (just inside the arch teeth)
            const inner = positions.map(p => {
              const cx = 0, cy = -120;
              const dx = p.x - cx, dy = p.y - cy;
              const dist = Math.sqrt(dx*dx + dy*dy);
              // Inward offset
              return { x: p.x - (dx/dist) * 16, y: p.y - (dy/dist) * 16 };
            });
            return catmullRomPath(inner) + ' L ' + inner[inner.length-1].x + ' ' + inner[inner.length-1].y;
          })()}
          fill="none" stroke="rgba(206,128,118,0.55)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"
        />
        <path
          d={(function() {
            const outer = positions.map(p => {
              const cx = 0, cy = -120;
              const dx = p.x - cx, dy = p.y - cy;
              const dist = Math.sqrt(dx*dx + dy*dy);
              return { x: p.x + (dx/dist) * 18, y: p.y + (dy/dist) * 18 };
            });
            return catmullRomPath(outer);
          })()}
          fill="none" stroke="rgba(206,128,118,0.45)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" opacity="0.65"
        />

        {/* === Clinical guides (rendered BEHIND teeth) === */}
        {/* Midline */}
        <line x1="0" y1="-180" x2="0" y2="230" stroke="rgba(0,128,176,0.35)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="-46" y="-175" fontSize="9" fill="rgba(0,128,176,0.85)" fontFamily="var(--font-mono)" fontWeight="700">LÍNEA MEDIA</text>

        {/* Arch form curve (lays right on top of the wire path) */}
        {wirePath && (
          <path d={wirePath} fill="none" stroke="rgba(0,128,176,0.18)" strokeWidth="3" strokeDasharray="2 4" />
        )}

        {/* Intercanine width measurement */}
        {canineR && canineL && (
          <g>
            <line x1={canineR.x} y1={canineR.y} x2={canineL.x} y2={canineL.y}
                  stroke="rgba(224,153,46,0.7)" strokeWidth="0.8" strokeDasharray="3 3" />
            <rect x={-32} y={(canineR.y + canineL.y)/2 - 11} width="64" height="22" rx="4" fill="rgba(255,255,255,0.95)" stroke="rgba(224,153,46,0.6)" strokeWidth="0.5" />
            <text x="0" y={(canineR.y + canineL.y)/2 - 2} fontSize="8" fill="var(--fg-muted)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="0.5">INTERCANINO</text>
            <text x="0" y={(canineR.y + canineL.y)/2 + 7} fontSize="10" fill="var(--fg-strong)" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">{arch === 'sup' ? '34.0 mm' : '26.5 mm'}</text>
          </g>
        )}

        {/* Intermolar width measurement */}
        {molarR && molarL && (
          <g>
            <line x1={molarR.x} y1={molarR.y} x2={molarL.x} y2={molarL.y}
                  stroke="rgba(218,69,58,0.7)" strokeWidth="0.8" strokeDasharray="3 3" />
            <rect x={-34} y={(molarR.y + molarL.y)/2 - 11} width="68" height="22" rx="4" fill="rgba(255,255,255,0.95)" stroke="rgba(218,69,58,0.6)" strokeWidth="0.5" />
            <text x="0" y={(molarR.y + molarL.y)/2 - 2} fontSize="8" fill="var(--fg-muted)" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="0.5">INTERMOLAR</text>
            <text x="0" y={(molarR.y + molarL.y)/2 + 7} fontSize="10" fill="var(--fg-strong)" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">{arch === 'sup' ? '49.5 mm' : '44.0 mm'}</text>
          </g>
        )}

        {/* Right / Left labels */}
        <text x="-300" y="-10" fontSize="9" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="1">DER</text>
        <text x="300" y="-10" fontSize="9" fill="var(--fg-subtle)" fontFamily="var(--font-display)" fontWeight="700" letterSpacing="1" textAnchor="end">IZQ</text>

        {/* === Teeth === */}
        {positions.map(p => (
          <OcclusalTooth key={p.fdi} fdi={p.fdi} state={teeth[p.fdi] || {}}
            x={p.x} y={p.y} rotate={p.rotate} scale={4}
            selected={selected === p.fdi} onClick={() => onSelect(p.fdi)}
          />
        ))}

        {/* === Wire (drawn ON TOP of teeth, on buccal contour) === */}
        {wirePath && (
          <>
            <path d={wirePath} fill="none" stroke="#1A2235" strokeWidth="3.2" strokeLinecap="round" opacity="0.45" />
            <path d={wirePath} fill="none" stroke="url(#wireOcc)" strokeWidth="2.4" strokeLinecap="round" />
            <path d={wirePath} fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" />
          </>
        )}

        {/* === FDI labels (optional) === */}
        {showLabels && positions.map(p => {
          const cx = 0, cy = -120;
          const dx = p.x - cx, dy = p.y - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const lx = p.x + (dx/dist) * 32;
          const ly = p.y + (dy/dist) * 32;
          return (
            <text key={`l-${p.fdi}`} x={lx} y={ly} fontSize="9" textAnchor="middle"
              fill="var(--fg-muted)" fontFamily="var(--font-mono)" fontWeight="600">{p.fdi}</text>
          );
        })}

        {/* Top title */}
        <text x="0" y="-175" textAnchor="middle" fontSize="11" fill="var(--fg-muted)"
              fontFamily="var(--font-display)" fontWeight="700" letterSpacing="2">
          {arch === 'sup' ? 'VISTA OCLUSAL — MAXILAR' : 'VISTA OCLUSAL — MANDIBULAR'}
        </text>
      </svg>

      {/* Metric strip under the view */}
      <div style={{
        display:'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)',
        flexWrap:'wrap', justifyContent:'center', alignItems:'center',
        fontSize:'var(--t-12)', color:'var(--fg-muted)',
      }}>
        <ClinicalChip color="var(--sd-blue-600)" label="Forma de arco" value={arch === 'sup' ? 'ovoide' : 'cuadrangular'} />
        <ClinicalChip color="var(--sd-alert-500)" label="Intercanino" value={arch === 'sup' ? '34.0 mm' : '26.5 mm'} />
        <ClinicalChip color="var(--sd-critical-500)" label="Intermolar" value={arch === 'sup' ? '49.5 mm' : '44.0 mm'} />
        <ClinicalChip color="var(--sd-critical-500)" label="Asimetría" value={arch === 'sup' ? '+1.2 mm der.' : '+0.8 mm izq.'} />
        <ClinicalChip color="var(--sd-alert-500)" label="Apiñamiento" value={arch === 'sup' ? '−3.5 mm' : '−2.0 mm'} />
        <ClinicalChip color="var(--sd-blue-600)" label="Expansión planeada" value={arch === 'sup' ? '+3 mm' : '0 mm'} />
      </div>
    </div>
  );
}

// =================================================================
// VIEW 4: PROFILE LATERAL (Angle classification + cephalometry)
// =================================================================
const CEPH_FIELDS = [
  { id: 'sna',      label: 'SNA',      unit: '°',  norm: '82 ± 2' },
  { id: 'snb',      label: 'SNB',      unit: '°',  norm: '80 ± 2' },
  { id: 'anb',      label: 'ANB',      unit: '°',  norm: '2 ± 2'  },
  { id: 'fma',      label: 'FMA',      unit: '°',  norm: '25 ± 4' },
  { id: 'impa',     label: 'IMPA',     unit: '°',  norm: '90 ± 5' },
  { id: 'wits',     label: 'Wits',     unit: 'mm', norm: '0–1'    },
  { id: 'overjet',  label: 'Overjet',  unit: 'mm', norm: '2–3'    },
  { id: 'overbite', label: 'Overbite', unit: 'mm', norm: '2–3'    },
];

function ProfileView({ teeth, angleClass, setAngleClass, cephValues, setCephValues }) {
  const classes = [
    { id: 'I', label: 'Clase I', desc: 'Neutroclusión — relación molar normal' },
    { id: 'II-1', label: 'Clase II div. 1', desc: 'Distoclusión, incisivos protruidos' },
    { id: 'II-2', label: 'Clase II div. 2', desc: 'Distoclusión, incisivos retroinclinados' },
    { id: 'III', label: 'Clase III', desc: 'Mesioclusión — prognatismo mandibular' },
  ];

  return (
    <div className="angle-wrap">
      {/* Left card: Profile SVG with skeletal landmarks */}
      <div className="angle-card" style={{maxWidth: 420}}>
        <div className="palette-title">Análisis facial</div>
        <svg viewBox="-20 0 300 380" className="profile-svg">
          <defs>
            <linearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F3D5C0" />
              <stop offset="1" stopColor="#D9AE93" />
            </linearGradient>
          </defs>
          {/* Profile silhouette — left-facing */}
          <path d="M 200 30 Q 240 60 245 110 Q 248 140 240 170 L 230 195 Q 245 200 240 215 L 220 225 Q 225 245 215 255 Q 225 270 215 290 Q 230 300 210 320 Q 195 340 170 350 L 150 360 L 50 360 L 50 30 Z"
                fill="url(#skinGrad)" stroke="#A37760" strokeWidth="1" />
          {/* Eye */}
          <ellipse cx="200" cy="115" rx="6" ry="3" fill="#2C2018" />
          <path d="M 192 110 Q 200 105 208 110" stroke="#2C2018" strokeWidth="1" fill="none" />
          {/* Brow */}
          <path d="M 188 95 Q 200 91 215 95" stroke="#5A3D2E" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Nose tip */}
          {/* Lips */}
          <path d="M 232 218 Q 238 222 232 230" stroke="#8B4438" strokeWidth="1.5" fill="none" />
          <path d="M 232 232 Q 240 236 232 244" stroke="#8B4438" strokeWidth="1.5" fill="none" />
          {/* Cephalometric landmarks */}
          <g fontFamily="var(--font-mono)" fontSize="9" fontWeight="600">
            <circle cx="232" cy="120" r="2" fill="var(--sd-blue-600)" />
            <text x="240" y="120" fill="var(--sd-blue-700)">N (nasion)</text>
            <circle cx="240" cy="200" r="2" fill="var(--sd-blue-600)" />
            <text x="248" y="200" fill="var(--sd-blue-700)">A</text>
            <circle cx="232" cy="252" r="2" fill="var(--sd-blue-600)" />
            <text x="240" y="252" fill="var(--sd-blue-700)">B</text>
            <circle cx="78" cy="125" r="2" fill="var(--sd-blue-600)" />
            <text x="58" y="120" fill="var(--sd-blue-700)" textAnchor="end">S (silla)</text>
            <circle cx="98" cy="330" r="2" fill="var(--sd-blue-600)" />
            <text x="78" y="330" fill="var(--sd-blue-700)" textAnchor="end">Go</text>
            <circle cx="215" cy="335" r="2" fill="var(--sd-blue-600)" />
            <text x="223" y="338" fill="var(--sd-blue-700)">Pog</text>
          </g>
          {/* Reference lines */}
          <line x1="78" y1="125" x2="232" y2="120" stroke="var(--sd-blue-600)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
          <text x="160" y="115" fontSize="8" fill="var(--sd-blue-700)" fontFamily="var(--font-mono)">SN</text>
          <line x1="232" y1="120" x2="240" y2="200" stroke="var(--sd-vital-500)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
          <line x1="232" y1="120" x2="232" y2="252" stroke="var(--sd-alert-500)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
          <line x1="98" y1="330" x2="215" y2="335" stroke="var(--sd-blue-600)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
          {/* ANB angle marker */}
          <path d="M 232 130 A 14 14 0 0 0 240 142" stroke="var(--sd-critical-500)" strokeWidth="1.2" fill="none" />
          <text x="245" y="140" fontSize="9" fill="var(--sd-critical-600)" fontFamily="var(--font-mono)" fontWeight="700">ANB</text>
        </svg>
      </div>

      {/* Middle: Classification picker */}
      <div className="angle-card">
        <div className="palette-title">Clasificación de Angle</div>
        <div style={{display:'flex', flexDirection:'column', gap: 8, marginTop: 12}}>
          {classes.map(c => (
            <button key={c.id}
              onClick={() => setAngleClass(c.id)}
              style={{
                padding: 12, textAlign:'left', borderRadius:'var(--r-md)',
                border: '1px solid ' + (angleClass === c.id ? 'var(--sd-blue-600)' : 'var(--border-default)'),
                background: angleClass === c.id ? 'var(--sd-blue-100)' : 'var(--bg-surface)',
                display:'flex', flexDirection:'column', gap:2,
                cursor:'pointer',
              }}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span className="angle-class-pill">{c.id}</span>
                <strong style={{fontFamily:'var(--font-display)', color: angleClass === c.id ? 'var(--sd-blue-700)' : 'var(--fg-strong)'}}>{c.label}</strong>
              </div>
              <span style={{fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cephalometric values (editable) */}
      <div className="angle-card">
        <div className="palette-title">Valores cefalométricos</div>
        <div className="ceph-table" style={{ marginTop: 12 }}>
          {CEPH_FIELDS.map(f => (
            <React.Fragment key={f.id}>
              <div className="ceph-label">{f.label}</div>
              <div className="ceph-val" style={{ padding: 0 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cephValues?.[f.id] ?? ''}
                  placeholder="—"
                  onChange={(e) => setCephValues({ ...(cephValues || {}), [f.id]: e.target.value })}
                  style={{
                    width: '100%', border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)', color: 'var(--fg-strong)',
                    borderRadius: 'var(--r-sm)', padding: '4px 6px',
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--t-13)', fontWeight: 600,
                    textAlign: 'right',
                  }}
                />
              </div>
              <div className="ceph-norm">{f.norm} {f.unit}</div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--t-12)', color: 'var(--fg-muted)' }}>
          Registre los valores medidos en la cefalometría del paciente. Quedan guardados con la consulta.
        </div>
      </div>
    </div>
  );
}

// =================================================================
// VIEW 5: PLANO (FDI flat grid)
// =================================================================
function PlanoView({ teeth, selected, onSelect }) {
  return (
    <div className="plano-wrap">
      <div className="plano-arch">
        <div className="plano-quadrant-label">Maxilar superior · Cuadrante 1 (der) → Cuadrante 2 (izq)</div>
        <div className="plano-grid">
          {UPPER_FDI.map((fdi, i) => (
            <React.Fragment key={fdi}>
              {i === 8 && <div className="plano-divider"></div>}
              <div
                className={`plano-tooth ${selected === fdi ? 'selected' : ''}`}
                onClick={() => onSelect(fdi)}
              >
                <svg viewBox="-25 -10 50 130" width="36" height="80">
                  <Tooth fdi={fdi} state={teeth[fdi] || {}} x={0} y={0} rotate={0} flipForUpper={false} onClick={()=>{}} />
                </svg>
                <div className="plano-tooth-num">{fdi}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="plano-arch">
        <div className="plano-quadrant-label">Mandibular inferior · Cuadrante 4 (der) → Cuadrante 3 (izq)</div>
        <div className="plano-grid">
          {LOWER_FDI.map((fdi, i) => (
            <React.Fragment key={fdi}>
              {i === 8 && <div className="plano-divider"></div>}
              <div
                className={`plano-tooth ${selected === fdi ? 'selected' : ''}`}
                onClick={() => onSelect(fdi)}
              >
                <svg viewBox="-25 -10 50 130" width="36" height="80">
                  <Tooth fdi={fdi} state={teeth[fdi] || {}} x={0} y={0} rotate={0} flipForUpper={false} onClick={()=>{}} />
                </svg>
                <div className="plano-tooth-num">{fdi}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Universal numbering reference */}
      <div className="plano-arch" style={{marginTop: 'var(--sp-3)'}}>
        <div className="plano-quadrant-label">Equivalencia numeración Universal (EUA)</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(16, 1fr)', gap: 6, fontSize: 'var(--t-12)', fontFamily:'var(--font-mono)', color:'var(--fg-muted)', textAlign:'center'}}>
          {Array.from({length: 16}).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
          {Array.from({length: 16}).map((_, i) => (
            <div key={`l${i}`}>{32 - i}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// VIEW 6: EVOLUCIÓN (before/after slider + monthly timeline)
// =================================================================
function EvolucionView({ teeth, selected, onSelect, month, setMonth }) {
  const [sliderPos, setSliderPos] = useState(50);
  const frameRef = useRef(null);

  // Generate "before" teeth state (no brackets, with malocclusion offsets) and "after" (with brackets, aligned)
  // For simplicity, we'll show two arches side by side
  const beforePositions = useMemo(() => {
    const ps = getArchPositions('upper');
    // Add random offsets to simulate crowding
    return ps.map((p, i) => ({
      ...p,
      x: p.x + (i % 3 - 1) * 12,
      y: p.y + (i % 2) * 8,
      rotate: p.rotate + (i % 4 - 2) * 8,
    }));
  }, []);
  const afterPositions = useMemo(() => getArchPositions('upper'), []);

  const months = [
    { num: 0, label: 'Inicio', date: 'Ene 2026' },
    { num: 1, label: 'Mes 1', date: 'Feb 2026' },
    { num: 2, label: 'Mes 2', date: 'Mar 2026' },
    { num: 3, label: 'Mes 3', date: 'Abr 2026' },
    { num: 4, label: 'Mes 4', date: 'May 2026' },
    { num: 5, label: 'Mes 5', date: 'Jun 2026' },
    { num: 6, label: 'Mes 6', date: 'Jul 2026' },
    { num: 8, label: 'Mes 8', date: 'Sep 2026' },
    { num: 10, label: 'Mes 10', date: 'Nov 2026' },
    { num: 12, label: 'Mes 12', date: 'Ene 2027' },
    { num: 16, label: 'Mes 16', date: 'May 2027' },
    { num: 18, label: 'Final', date: 'Jul 2027' },
  ];

  const handleDrag = (e) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  return (
    <div className="evo-wrap">
      <div className="evo-compare">
        <div className="canvas-header" style={{marginBottom: 'var(--sp-3)'}}>
          <div>
            <h2 className="canvas-title">Comparativa antes / después</h2>
            <div className="canvas-sub">Arrastra el divisor para revelar la transformación · {months[month]?.date}</div>
          </div>
          <div style={{display:'flex', gap:8, fontSize:'var(--t-12)', fontFamily:'var(--font-mono)', color:'var(--fg-muted)'}}>
            <span>0% ←</span>
            <span style={{color:'var(--fg-strong)', fontWeight:700}}>{Math.round(sliderPos)}%</span>
            <span>→ 100%</span>
          </div>
        </div>
        <div className="evo-compare-frame" ref={frameRef}
             onMouseMove={(e) => e.buttons === 1 && handleDrag(e)}
             onTouchMove={handleDrag}>
          <span className="evo-label left">ANTES · {months[0].date}</span>
          <span className="evo-label right">DESPUÉS · {months[months.length - 1].date}</span>

          {/* Before layer */}
          <svg viewBox="-440 -260 880 320" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
            {beforePositions.map(p => (
              <Tooth key={`b${p.fdi}`} fdi={p.fdi} state={{}} x={p.x} y={p.y + 60} rotate={p.rotate} onClick={()=>{}} />
            ))}
          </svg>

          {/* After mask */}
          <div className="evo-after-mask" style={{clipPath: `inset(0 0 0 ${sliderPos}%)`}}>
            <svg viewBox="-440 -260 880 320" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
              {afterPositions.map(p => (
                <Tooth key={`a${p.fdi}`} fdi={p.fdi} state={{ appliance: 'metal', ligature: '#9BD0EA' }} x={p.x} y={p.y + 60} rotate={p.rotate} onClick={()=>{}} />
              ))}
              {/* After wire */}
              <path d={computeWirePath(afterPositions, Object.fromEntries(afterPositions.map(p => [p.fdi, {appliance:'metal'}])), 'sup')}
                    fill="none" stroke="#9CA4B2" strokeWidth="1.6" />
            </svg>
          </div>

          {/* Divider */}
          <div className="evo-divider" style={{left: `${sliderPos}%`}}>
            <div className="evo-divider-handle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 6L4 12L8 18M16 6L20 12L16 18"/></svg>
            </div>
          </div>
          <input className="evo-slider" type="range" min="0" max="100" step="0.1" value={sliderPos} onChange={e => setSliderPos(+e.target.value)} />
        </div>
      </div>

      <div className="evo-months">
        {months.map((m, i) => (
          <button key={m.num} className={`evo-month ${month === i ? 'active' : ''}`} onClick={() => setMonth(i)}>
            <div className="evo-month-num">{m.num === 0 ? 'T0' : m.num}</div>
            <div className="evo-month-label">{m.date}</div>
          </button>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap: 'var(--sp-5)'}}>
        {/* Timeline of appointments */}
        <div className="angle-card" style={{maxWidth:'none'}}>
          <div className="palette-title">Línea de tiempo del tratamiento</div>
          <div style={{position:'relative', height: 90, marginTop: 20}}>
            <div className="timeline-line" style={{top:'50%'}}></div>
            <div className="timeline-progress" style={{top:'50%', width: `${(month / (months.length - 1)) * 100}%`}}></div>
            {months.map((m, i) => (
              <div key={i} className={`timeline-stop ${i < month ? 'done' : ''} ${i === month ? 'current' : ''}`}
                   style={{left: `${(i / (months.length - 1)) * 100}%`}}
                   onClick={() => setMonth(i)}>
                <div className="timeline-stop-label upper">{m.label}</div>
                <div className="timeline-stop-label">{m.date}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="angle-card" style={{maxWidth:'none'}}>
          <div className="palette-title">Cita actual — {months[month]?.label}</div>
          <div style={{display:'flex', flexDirection:'column', gap: 8, marginTop: 12, fontSize: 'var(--t-13)'}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'var(--fg-muted)'}}>Fecha</span>
              <span style={{fontFamily:'var(--font-mono)', fontWeight:600}}>{months[month]?.date}</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'var(--fg-muted)'}}>Procedimiento</span>
              <span style={{fontWeight:600}}>
                {month === 0 ? 'Cementado de brackets' :
                 month === months.length - 1 ? 'Retirada y retención' :
                 'Ajuste de arco'}
              </span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'var(--fg-muted)'}}>Calibre del arco</span>
              <span style={{fontFamily:'var(--font-mono)'}}>{['.014 NiTi','.014 NiTi','.016 NiTi','.018 NiTi','.018 NiTi','.019×.025 NiTi','.019×.025 NiTi','.019×.025 SS','.019×.025 SS','.019×.025 SS','Detallado','Retenedor'][month] || '—'}</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'var(--fg-muted)'}}>Próxima cita</span>
              <span>4 semanas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// VIEW 7: FOTOS & RX  — categorized photo / x-ray slots
// =================================================================
const PHOTO_SLOTS = [
  { id: 'frontal_reposo',   label: 'Frontal en reposo' },
  { id: 'frontal_sonrisa',  label: 'Frontal sonrisa' },
  { id: 'perfil_derecho',   label: 'Perfil derecho' },
  { id: 'intraoral_frontal',label: 'Intraoral frontal' },
  { id: 'intraoral_derecha',label: 'Intraoral derecha' },
  { id: 'intraoral_izq',    label: 'Intraoral izquierda' },
  { id: 'oclusal_superior', label: 'Oclusal superior' },
  { id: 'oclusal_inferior', label: 'Oclusal inferior' },
  { id: 'sonrisa_lateral',  label: 'Sonrisa lateral' },
];
const XRAY_SLOTS = [
  { id: 'panoramica',  label: 'Panorámica' },
  { id: 'cefalometria',label: 'Cefalometría lateral' },
  { id: 'periapicales',label: 'Periapicales' },
  { id: 'aleta_der',   label: 'Aleta de mordida der.' },
  { id: 'aleta_izq',   label: 'Aleta de mordida izq.' },
  { id: 'manopla',     label: 'Manopla' },
];

const MEDIA_MAX_DIM = 1400;     // px on longest side
const MEDIA_JPEG_QUALITY = 0.78;

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, MEDIA_MAX_DIM / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', MEDIA_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function MediaSlot({ slot, dataUrl, onUpload, onClear, isXray }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Archivo no es imagen'); return; }
    setBusy(true); setErr(null);
    try {
      const url = await resizeImageFile(file);
      onUpload(slot.id, url);
    } catch (e) {
      setErr(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`media-tile${dataUrl ? '' : ' empty'}`}
         style={{
           position: 'relative', cursor: 'pointer', overflow: 'hidden',
           background: dataUrl ? '#000' : 'var(--bg-subtle)',
         }}
         onClick={() => !busy && inputRef.current && inputRef.current.click()}
         title={dataUrl ? `${slot.label} — clic para reemplazar` : `${slot.label} — clic para subir`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files && e.target.files[0]); e.target.value = ''; }}
      />
      {dataUrl ? (
        <>
          <img src={dataUrl} alt={slot.label}
               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <button type="button"
                  onClick={(e) => { e.stopPropagation(); onClear(slot.id); }}
                  title="Quitar imagen"
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                    borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                    color: 'white', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                    display: 'grid', placeItems: 'center',
                  }}>×</button>
        </>
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: isXray ? 'rgba(255,255,255,0.5)' : 'var(--fg-muted)',
        }}>
          {busy ? (
            <span style={{ fontSize: 11, fontWeight: 600 }}>Procesando…</span>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </div>
      )}
      <div className="media-tile-label">{slot.label}</div>
      {err && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--sd-critical-500)', color: 'white',
          fontSize: 10, padding: '2px 6px', fontWeight: 600,
        }}>{err}</div>
      )}
    </div>
  );
}

function MediaView({ media, setMedia }) {
  const updateSlot = (slotId, dataUrl) => {
    setMedia({ ...(media || {}), [slotId]: dataUrl });
  };
  const clearSlot = (slotId) => {
    const next = { ...(media || {}) };
    delete next[slotId];
    setMedia(next);
  };

  return (
    <div className="media-wrap">
      <div className="media-section">
        <div className="media-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6V4h8v2"/></svg>
          Fotografía clínica
        </div>
        <div className="media-grid">
          {PHOTO_SLOTS.map(s => (
            <MediaSlot key={s.id} slot={s}
              dataUrl={media?.[s.id]}
              onUpload={updateSlot} onClear={clearSlot} />
          ))}
        </div>
      </div>

      <div className="media-section">
        <div className="media-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
          Radiografías
        </div>
        <div className="media-grid">
          {XRAY_SLOTS.map(s => (
            <MediaSlot key={s.id} slot={s} isXray
              dataUrl={media?.[s.id]}
              onUpload={updateSlot} onClear={clearSlot} />
          ))}
        </div>
      </div>

      <div className="media-save-hint" style={{
        marginTop: 'var(--sp-4)', padding: '10px 14px', borderRadius: 'var(--r-md)',
        background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
        border: '1px solid var(--border-soft)',
        fontSize: 'var(--t-12)', display: 'flex', gap: 8, alignItems: 'flex-start',
        lineHeight: 1.5,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>Las imágenes se comprimen y guardan junto al diagrama al pulsar <strong style={{ color: 'var(--fg-default)' }}>Guardar Consulta</strong>.</span>
      </div>
    </div>
  );
}

// Expose views
Object.assign(window, {
  ArchView, FrontalView, OclusalView, ProfileView, PlanoView, EvolucionView, MediaView,
});
