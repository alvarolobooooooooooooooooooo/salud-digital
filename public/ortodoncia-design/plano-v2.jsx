/* global React, ArchToothV2, CrownDefs, fdiToType, fdiArch, TOOTH_NAMES, UPPER_FDI, LOWER_FDI */
// ============================================================
// plano-v2.jsx — Flat FDI odontogram, redesigned
// Two quadrant cards (sup, inf), big clickable teeth, floating tooltip,
// compact Universal equivalence at bottom.
// ============================================================

const { useState: useStatePl, useRef: useRefPl, useEffect: useEffectPl } = React;

// =============================================================
// Flat layout — all teeth at same y, generous spacing
// =============================================================
const PLANO_WIDTHS = { m3: 50, m2: 56, m1: 64, p2: 50, p1: 50, c: 46, il: 40, ci: 48 };
const PLANO_GAP = 14;

function getFlatLayout(archType) {
  const fdis = archType === 'upper' ? UPPER_FDI : LOWER_FDI;
  const widths = fdis.map(f => PLANO_WIDTHS[fdiToType(f)] || 50);
  const totalW = widths.reduce((a, b) => a + b, 0) + (fdis.length - 1) * PLANO_GAP;
  const positions = [];
  let cursor = -totalW / 2;
  for (let i = 0; i < fdis.length; i++) {
    const w = widths[i];
    positions.push({ x: cursor + w / 2, y: 0, width: w, fdi: fdis[i] });
    cursor += w + PLANO_GAP;
  }
  return { positions, totalW };
}

// FDI → Universal mapping
const FDI_TO_UNIV = {
  18:1,17:2,16:3,15:4,14:5,13:6,12:7,11:8,
  21:9,22:10,23:11,24:12,25:13,26:14,27:15,28:16,
  38:17,37:18,36:19,35:20,34:21,33:22,32:23,31:24,
  41:25,42:26,43:27,44:28,45:29,46:30,47:31,48:32,
};

function fdiSide(fdi) {
  const q = Math.floor(fdi / 10);
  return (q === 1 || q === 4) ? 'der' : 'izq';
}

// =============================================================
// Floating tooltip (HTML) — follows mouse
// =============================================================
function FloatingTooltip({ fdi, mouseX, mouseY }) {
  if (!fdi) return null;
  const type = fdiToType(fdi);
  const name = TOOTH_NAMES[type] || '';
  const arch = fdiArch(fdi) === 'sup' ? 'Superior' : 'Inferior';
  const side = fdiSide(fdi) === 'der' ? 'Derecho' : 'Izquierdo';
  const univ = FDI_TO_UNIV[fdi];
  return (
    <div style={{
      position: 'fixed',
      left: mouseX + 14,
      top: mouseY - 8,
      pointerEvents: 'none',
      background: 'var(--sd-ink-1000)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 1000,
      minWidth: 220,
      lineHeight: 1.35,
    }}>
      <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 4}}>
        <span style={{
          padding:'2px 8px', borderRadius:'var(--r-sm)',
          background:'var(--sd-blue-600)', color:'white',
          fontSize: 11, fontWeight: 800, fontFamily:'var(--font-mono)', letterSpacing: 0.5,
        }}>FDI {fdi}</span>
        <span style={{
          fontSize: 10, color:'rgba(255,255,255,0.7)',
          fontFamily:'var(--font-mono)', fontWeight: 600,
        }}>univ. {univ}</span>
      </div>
      <div style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-13)', color:'white'}}>{name}</div>
      <div style={{fontSize: 11, color:'rgba(255,255,255,0.75)', marginTop: 2}}>
        {arch} · {side}
      </div>
    </div>
  );
}

// =============================================================
// Single quadrant card (upper or lower)
// =============================================================
function PlanoCard({ arch, teeth, selected, hover, onHoverFdi, onSelect, mouseX, mouseY }) {
  const isUpper = arch === 'sup';
  const { positions, totalW } = getFlatLayout(isUpper ? 'upper' : 'lower');

  const Q_RIGHT = isUpper ? '1' : '4';
  const Q_LEFT  = isUpper ? '2' : '3';
  const FDI_R   = isUpper ? '18 → 11' : '48 → 41';
  const FDI_L   = isUpper ? '21 → 28' : '31 → 38';

  // SVG viewBox — give plenty of height for tooth + label + arrows
  const svgW = totalW + 80;
  const svgH = 200;

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-lg)',
      padding: 'var(--sp-5) var(--sp-6) var(--sp-4)',
      boxShadow: 'var(--shadow-xs)',
    }}>
      {/* Header */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto 1fr',
        gap: 12, marginBottom: 12, alignItems:'center',
      }}>
        {/* Right side label */}
        <div style={{display:'flex', alignItems:'center', gap: 8}}>
          <span style={{
            padding:'3px 10px', borderRadius:'var(--r-pill)',
            background:'var(--sd-blue-600)', color:'white',
            fontSize: 10, fontWeight: 800, letterSpacing:'var(--ls-wide)',
          }}>DER</span>
          <div style={{display:'flex', flexDirection:'column', gap: 1}}>
            <span style={{fontSize: 10, color:'var(--fg-muted)', fontWeight: 700, textTransform:'uppercase', letterSpacing:'var(--ls-wide)'}}>
              Cuadrante {Q_RIGHT}
            </span>
            <span style={{fontSize: 10, color:'var(--fg-subtle)', fontFamily:'var(--font-mono)'}}>{FDI_R}</span>
          </div>
        </div>

        {/* Center title */}
        <div style={{
          textAlign:'center',
          fontFamily:'var(--font-display)', fontWeight: 700,
          fontSize:'var(--t-13)', color:'var(--fg-strong)',
          letterSpacing:'var(--ls-wide)', textTransform:'uppercase',
          padding:'4px 16px',
          borderLeft:'1px solid var(--border-default)',
          borderRight:'1px solid var(--border-default)',
        }}>
          {isUpper ? 'Maxilar superior' : 'Mandibular inferior'}
        </div>

        {/* Left side label */}
        <div style={{display:'flex', alignItems:'center', gap: 8, justifyContent:'flex-end'}}>
          <div style={{display:'flex', flexDirection:'column', gap: 1, alignItems:'flex-end'}}>
            <span style={{fontSize: 10, color:'var(--fg-muted)', fontWeight: 700, textTransform:'uppercase', letterSpacing:'var(--ls-wide)'}}>
              Cuadrante {Q_LEFT}
            </span>
            <span style={{fontSize: 10, color:'var(--fg-subtle)', fontFamily:'var(--font-mono)'}}>{FDI_L}</span>
          </div>
          <span style={{
            padding:'3px 10px', borderRadius:'var(--r-pill)',
            background:'var(--sd-blue-600)', color:'white',
            fontSize: 10, fontWeight: 800, letterSpacing:'var(--ls-wide)',
          }}>IZQ</span>
        </div>
      </div>

      {/* SVG with teeth */}
      <svg
        viewBox={`${-svgW/2} ${-svgH/2} ${svgW} ${svgH}`}
        style={{ width:'100%', height:'auto', display:'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <CrownDefs />
        {/* Midline divider */}
        <line x1="0" y1={-svgH/2 + 6} x2="0" y2={svgH/2 - 6}
              stroke="var(--border-strong)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
        {/* Subtle gum band */}
        <rect x={-svgW/2 + 20} y={isUpper ? -2 : -4} width={svgW - 40} height={6}
              rx="3" fill="rgba(234,170,158,0.18)" />

        {/* Teeth */}
        {positions.map(p => (
          <ArchToothV2 key={p.fdi} fdi={p.fdi} x={p.x} y={p.y} width={p.width}
            state={teeth[p.fdi] || {}}
            selected={selected === p.fdi}
            hovered={hover === p.fdi}
            onHover={onHoverFdi}
            onSelect={onSelect}
          />
        ))}
      </svg>
    </div>
  );
}

// =============================================================
// Universal equivalence (collapsible, secondary)
// =============================================================
function UniversalEquivalence() {
  const [open, setOpen] = useStatePl(false);

  return (
    <div style={{
      background:'var(--bg-surface)',
      border:'1px solid var(--border-default)',
      borderRadius:'var(--r-md)',
      overflow:'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width:'100%', padding:'10px 16px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'transparent', border:'none', cursor:'pointer',
          color:'var(--fg-default)',
        }}>
        <div style={{display:'flex', alignItems:'center', gap: 10}}>
          <span style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width: 28, height: 28, borderRadius:'var(--r-sm)',
            background:'var(--sd-ink-100)', color:'var(--fg-muted)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          </span>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap: 1}}>
            <span style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize:'var(--t-13)'}}>Equivalencia FDI ↔ Universal</span>
            <span style={{fontSize: 11, color:'var(--fg-muted)'}}>Referencia secundaria — notación EUA</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             style={{transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--dur-2) var(--ease-out)', color:'var(--fg-muted)'}}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{padding:'12px 16px 16px', borderTop:'1px solid var(--border-soft)'}}>
          {/* Upper row */}
          <div style={{marginBottom: 12}}>
            <div style={{fontSize: 9, fontWeight: 700, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'var(--ls-widest)', marginBottom: 6}}>
              Maxilar superior
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(16, 1fr)', gap: 4, fontSize: 11, textAlign:'center'}}>
              {UPPER_FDI.map(fdi => (
                <div key={`u-${fdi}`} style={{
                  padding:'4px 0', borderRadius:'var(--r-xs)',
                  background:'var(--sd-blue-50)',
                  fontFamily:'var(--font-mono)', fontWeight: 700,
                  color:'var(--sd-blue-700)',
                }}>
                  <div style={{fontSize: 11}}>{fdi}</div>
                  <div style={{fontSize: 9, color:'var(--fg-muted)', fontWeight: 500}}>{FDI_TO_UNIV[fdi]}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Lower row */}
          <div>
            <div style={{fontSize: 9, fontWeight: 700, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'var(--ls-widest)', marginBottom: 6}}>
              Mandibular inferior
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(16, 1fr)', gap: 4, fontSize: 11, textAlign:'center'}}>
              {LOWER_FDI.map(fdi => (
                <div key={`l-${fdi}`} style={{
                  padding:'4px 0', borderRadius:'var(--r-xs)',
                  background:'var(--sd-blue-50)',
                  fontFamily:'var(--font-mono)', fontWeight: 700,
                  color:'var(--sd-blue-700)',
                }}>
                  <div style={{fontSize: 11}}>{fdi}</div>
                  <div style={{fontSize: 9, color:'var(--fg-muted)', fontWeight: 500}}>{FDI_TO_UNIV[fdi]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// Main view
// =============================================================
function PlanoViewV2({ teeth, selected, onSelect }) {
  const [hover, setHover] = useStatePl(null);
  const [mouse, setMouse] = useStatePl({ x: 0, y: 0 });
  const wrapRef = useRefPl(null);

  // Track mouse position globally while in this view
  useEffectPl(() => {
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div ref={wrapRef} style={{ display:'flex', flexDirection:'column', gap:'var(--sp-4)' }}>
      {/* Upper */}
      <PlanoCard arch="sup" teeth={teeth} selected={selected} hover={hover}
        onHoverFdi={setHover} onSelect={onSelect}
        mouseX={mouse.x} mouseY={mouse.y} />

      {/* Lower */}
      <PlanoCard arch="inf" teeth={teeth} selected={selected} hover={hover}
        onHoverFdi={setHover} onSelect={onSelect}
        mouseX={mouse.x} mouseY={mouse.y} />

      {/* Compact collapsible Universal table */}
      <UniversalEquivalence />

      {/* Floating tooltip (HTML, follows mouse) */}
      <FloatingTooltip fdi={hover} mouseX={mouse.x} mouseY={mouse.y} />
    </div>
  );
}

// Override PlanoView with V2
Object.assign(window, {
  PlanoView: PlanoViewV2,
});
