/* global React, ReactDOM, ArchView, FrontalView, OclusalView, ProfileView, PlanoView, EvolucionView, MediaView, fdiName, fdiToType, TOOTH_NAMES */
// ============================================================
// app.jsx — main application
// ============================================================

const { useState, useEffect, useCallback } = React;

// ---- Icons (Lucide-style inline) -------------------------------------------
const Icon = ({ name, size = 18, ...rest }) => {
  const paths = {
    arch: <path d="M3 17c0-6 4-10 9-10s9 4 9 10" />,
    smile: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></>,
    occlusal: <><ellipse cx="12" cy="12" rx="9" ry="7" /><path d="M3 12h18M12 5v14" /></>,
    profile: <><path d="M16 3c2 2 3 5 3 7 0 4-3 7-3 9l1 2-1 1-3-1-3 1H6V3z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    images: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></>,
    bracket: <><rect x="6" y="9" width="12" height="6" rx="1" /><path d="M3 12h3M18 12h3" /></>,
    wire: <path d="M3 12c3-3 6 3 9 0s6 3 9 0" />,
    aligner: <path d="M5 8c3-4 11-4 14 0v8c-3 4-11 4-14 0z" />,
    cross: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
    rotate: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
    arrowUp: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
    arrowLeft: <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
    note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
    print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></>,
    keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );
};

// ---- Tool palette definitions ----------------------------------------------
const APPLIANCES = [
  { id: 'metal', label: 'Metálico', desc: 'Convencional' },
  { id: 'ceramic', label: 'Cerámica', desc: 'Estético' },
  { id: 'zafiro', label: 'Zafiro', desc: 'Translúcido' },
  { id: 'autolig', label: 'Autoligado', desc: 'Damon/SLI' },
  { id: 'lingual', label: 'Lingual', desc: 'Cara palatina' },
  { id: 'band', label: 'Banda', desc: 'Molar' },
  { id: 'aligner', label: 'Alineador', desc: 'Invisalign®' },
  { id: 'removable', label: 'Removible', desc: 'Hawley/expansor' },
];

const CONDITIONS = [
  { id: 'caries', label: 'Caries', cls: 'warn' },
  { id: 'restoration', label: 'Restauración', cls: '' },
  { id: 'endodoncia', label: 'Endodoncia', cls: '' },
  { id: 'corona', label: 'Corona', cls: '' },
  { id: 'extraido', label: 'Extraído', cls: 'danger' },
  { id: 'ausente', label: 'Ausente', cls: 'danger' },
  { id: 'implante', label: 'Implante', cls: '' },
];

const MOVEMENTS = [
  { id: 'rotacion', label: 'Rotación', glyph: 'rotate' },
  { id: 'intrusion', label: 'Intrusión', glyph: 'arrowUp' },
  { id: 'extrusion', label: 'Extrusión', glyph: 'arrowDown' },
  { id: 'mesial', label: 'Mesial', glyph: 'arrowLeft' },
  { id: 'distal', label: 'Distal', glyph: 'arrowRight' },
  { id: 'vestibular', label: 'Vestibular', glyph: 'target' },
  { id: 'lingual', label: 'Lingual/palatino', glyph: 'target' },
];

const LIGATURE_COLORS = [
  null,
  '#0080B0', '#54B0DD', '#9BD0EA',  // blues
  '#DA453A', '#E0992E', '#198754',  // semantic
  '#7B3FF2', '#E84A8E',              // accent
  '#1A2235', '#FFFFFF',              // neutral
];

// =================================================================
// Tool palette (left sidebar)
// =================================================================
function ToolPalette({ activeAppliance, setActiveAppliance, activeCondition, setActiveCondition, activeMovement, setActiveMovement, activeLigature, setActiveLigature, mode, setMode }) {
  return (
    <aside className="palette">
      {/* Mode selector */}
      <div className="palette-section">
        <div className="palette-title">Modo de edición</div>
        <div className="tool-grid">
          <button className={`tool ${mode === 'aparato' ? 'active' : ''}`} onClick={() => setMode('aparato')}>
            <span className="tool-glyph"><Icon name="bracket" size={22} /></span>
            <span>Aparatología</span>
          </button>
          <button className={`tool ${mode === 'condicion' ? 'active' : ''}`} onClick={() => setMode('condicion')}>
            <span className="tool-glyph"><Icon name="cross" size={22} /></span>
            <span>Condición</span>
          </button>
          <button className={`tool ${mode === 'movimiento' ? 'active' : ''}`} onClick={() => setMode('movimiento')}>
            <span className="tool-glyph"><Icon name="rotate" size={22} /></span>
            <span>Movimiento</span>
          </button>
          <button className={`tool ${mode === 'ligadura' ? 'active' : ''}`} onClick={() => setMode('ligadura')}>
            <span className="tool-glyph"><span style={{display:'inline-block', width: 14, height: 14, borderRadius:'50%', background: activeLigature || 'var(--sd-blue-600)', border: '2px solid var(--sd-ink-200)'}}></span></span>
            <span>Ligadura</span>
          </button>
        </div>
      </div>

      {/* Context-sensitive tool list */}
      {mode === 'aparato' && (
        <div className="palette-section">
          <div className="palette-title">Aparatos</div>
          <div style={{display:'flex', flexDirection:'column', gap: 6}}>
            {APPLIANCES.map(a => (
              <button key={a.id} className={`tool ${activeAppliance === a.id ? 'active' : ''}`}
                onClick={() => setActiveAppliance(activeAppliance === a.id ? null : a.id)}
                style={{flexDirection:'row', justifyContent:'flex-start', minHeight: 40, padding: '8px 10px', gap: 10}}>
                <ApplianceGlyph kind={a.id} />
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap: 0}}>
                  <span style={{fontSize:'var(--t-13)'}}>{a.label}</span>
                  <span style={{fontSize:10, color:'var(--fg-muted)', fontWeight:500}}>{a.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'condicion' && (
        <div className="palette-section">
          <div className="palette-title">Condiciones</div>
          <div style={{display:'flex', flexDirection:'column', gap: 6}}>
            {CONDITIONS.map(c => (
              <button key={c.id} className={`chip ${c.cls} ${activeCondition === c.id ? 'active' : ''}`}
                onClick={() => setActiveCondition(activeCondition === c.id ? null : c.id)}
                style={{justifyContent:'flex-start', textAlign:'left', borderRadius:'var(--r-md)', padding: '10px 12px', fontSize:'var(--t-13)'}}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'movimiento' && (
        <div className="palette-section">
          <div className="palette-title">Movimientos planeados</div>
          <div className="movement-grid">
            {MOVEMENTS.map(m => (
              <button key={m.id} className={`move-btn ${activeMovement === m.id ? 'active' : ''}`}
                onClick={() => setActiveMovement(activeMovement === m.id ? null : m.id)}>
                <span className="move-glyph"><Icon name={m.glyph} size={14} /></span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'ligadura' && (
        <div className="palette-section">
          <div className="palette-title">Color de ligadura</div>
          <div className="swatch-row">
            {LIGATURE_COLORS.map((c, i) => (
              c === null ? (
                <button key={i} className={`swatch empty ${activeLigature === null ? 'active' : ''}`}
                  onClick={() => setActiveLigature(null)}>
                  <Icon name="cross" size={14} />
                </button>
              ) : (
                <button key={i}
                  className={`swatch ${activeLigature === c ? 'active' : ''}`}
                  style={{background: c, border: c === '#FFFFFF' ? '1px solid var(--border-default)' : undefined}}
                  onClick={() => setActiveLigature(c)} />
              )
            ))}
          </div>
        </div>
      )}

      {/* Quick legend */}
      <div className="palette-section">
        <div className="palette-title">Leyenda</div>
        <div style={{display:'flex', flexDirection:'column', gap: 8, fontSize:'var(--t-12)', color:'var(--fg-default)'}}>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <span style={{width: 10, height: 10, borderRadius:'50%', background:'var(--sd-vital-500)'}}></span>
            <span>Sano · sin tratamiento</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <span style={{width: 10, height: 10, borderRadius:'50%', background:'var(--sd-blue-600)'}}></span>
            <span>En tratamiento activo</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <span style={{width: 10, height: 10, borderRadius:'50%', background:'var(--sd-alert-500)'}}></span>
            <span>Atención (caries, control)</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <span style={{width: 10, height: 10, borderRadius:'50%', background:'var(--sd-critical-500)'}}></span>
            <span>Crítico / ausente</span>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="palette-section">
        <div className="palette-title">Atajos</div>
        <div style={{display:'flex', flexDirection:'column', gap: 6, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>Aparatología</span><kbd className="kbd">A</kbd></div>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>Condición</span><kbd className="kbd">C</kbd></div>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>Movimiento</span><kbd className="kbd">M</kbd></div>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>Ligadura</span><kbd className="kbd">L</kbd></div>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>Quitar todo</span><kbd className="kbd">⌫</kbd></div>
        </div>
      </div>
    </aside>
  );
}

// Small inline appliance icon for the palette
function ApplianceGlyph({ kind }) {
  return (
    <svg width="32" height="20" viewBox="0 0 32 20">
      {/* tiny tooth */}
      <path d="M 4 2 L 28 2 Q 30 2 30 6 L 28 16 Q 26 18 22 18 L 10 18 Q 6 18 4 16 L 2 6 Q 2 2 4 2 Z" fill="#FFF8EE" stroke="#C9B48E" strokeWidth="0.6" />
      {kind === 'metal' && <rect x="11" y="8" width="10" height="5" rx="1" fill="#C9CFDA" stroke="#6C7689" strokeWidth="0.5" />}
      {kind === 'ceramic' && <rect x="11" y="8" width="10" height="5" rx="1" fill="#FAF6EE" stroke="#B5A98E" strokeWidth="0.5" />}
      {kind === 'zafiro' && <rect x="11" y="8" width="10" height="5" rx="1" fill="rgba(155,208,234,0.4)" stroke="#7BAEC8" strokeWidth="0.5" />}
      {kind === 'autolig' && <><rect x="11" y="8" width="10" height="5" rx="1" fill="#A3ADBE" stroke="#444E60" strokeWidth="0.5" /><line x1="12" y1="10.5" x2="20" y2="10.5" stroke="#fff" strokeWidth="0.7" /></>}
      {kind === 'lingual' && <circle cx="16" cy="10" r="2" fill="none" stroke="var(--sd-blue-600)" strokeWidth="0.6" strokeDasharray="1 1" />}
      {kind === 'band' && <rect x="6" y="6" width="20" height="8" rx="1" fill="none" stroke="#5A6577" strokeWidth="1" />}
      {kind === 'aligner' && <path d="M 4 2 L 28 2 Q 30 2 30 6 L 28 16 Q 26 18 22 18 L 10 18 Q 6 18 4 16 L 2 6 Q 2 2 4 2 Z" fill="none" stroke="var(--sd-blue-400)" strokeWidth="0.8" strokeDasharray="1 1" />}
      {kind === 'removable' && <rect x="8" y="14" width="16" height="2.5" rx="1" fill="#C9CFDA" stroke="#7B8597" strokeWidth="0.3" />}
    </svg>
  );
}

// =================================================================
// Detail panel (right sidebar)
// =================================================================
function DetailPanel({ selectedFdi, teeth, updateTooth, clearTooth, view, angleClass, cephValues, month }) {
  // For the profile view, swap in the cephalometric analysis panel
  if (view === 'profile') {
    return <ProfileAnalysisPanel angleClass={angleClass} cephValues={cephValues} />;
  }
  // For the evolution view, swap in the treatment-evolution panel
  if (view === 'evolucion') {
    return <EvolucionAnalysisPanel month={month} />;
  }
  if (!selectedFdi) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          <div className="detail-empty-icon">
            <Icon name="target" size={28} />
          </div>
          <div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:'var(--t-18)', color:'var(--fg-strong)'}}>Selecciona un diente</div>
            <div style={{fontSize:'var(--t-13)', marginTop: 4}}>Haz clic en cualquier pieza del odontograma para ver y editar su estado.</div>
          </div>
        </div>
      </aside>
    );
  }

  const state = teeth[selectedFdi] || {};
  const type = fdiToType(selectedFdi);
  const name = fdiName(selectedFdi);
  const movement = state.movement || {};

  return (
    <aside className="detail">
      <div className="detail-header">
        <div className="detail-fdi">FDI {selectedFdi} · Universal {fdiToUniversal(selectedFdi)}</div>
        <div className="detail-name">{TOOTH_NAMES[type]}</div>
        <div className="detail-meta">
          <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c0-6 4-10 9-10s9 4 9 10"/></svg> {name.split(' ').slice(1).join(' ')}</span>
        </div>
      </div>

      <div className="detail-body">
        {/* Aparatología */}
        <div className="detail-section">
          <div className="detail-section-title">Aparatología</div>
          <div className="chip-row">
            {APPLIANCES.map(a => (
              <button key={a.id} className={`chip ${state.appliance === a.id ? 'active' : ''}`}
                onClick={() => updateTooth(selectedFdi, { appliance: state.appliance === a.id ? null : a.id })}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ligadura color */}
        {state.appliance && !['aligner','removable','autolig','lingual'].includes(state.appliance) && (
          <div className="detail-section">
            <div className="detail-section-title">Color de ligadura</div>
            <div className="swatch-row">
              {LIGATURE_COLORS.map((c, i) => (
                c === null ? (
                  <button key={i} className={`swatch empty ${!state.ligature ? 'active' : ''}`}
                    onClick={() => updateTooth(selectedFdi, { ligature: null })}>
                    <Icon name="cross" size={12} />
                  </button>
                ) : (
                  <button key={i}
                    className={`swatch ${state.ligature === c ? 'active' : ''}`}
                    style={{background: c, border: c === '#FFFFFF' ? '1px solid var(--border-default)' : undefined}}
                    onClick={() => updateTooth(selectedFdi, { ligature: c })} />
                )
              ))}
            </div>
          </div>
        )}

        {/* Condición */}
        <div className="detail-section">
          <div className="detail-section-title">Condición clínica</div>
          <div className="chip-row">
            {CONDITIONS.map(c => (
              <button key={c.id} className={`chip ${c.cls} ${state.condition === c.id ? 'active' : ''}`}
                onClick={() => updateTooth(selectedFdi, { condition: state.condition === c.id ? null : c.id })}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Movimiento planeado */}
        <div className="detail-section">
          <div className="detail-section-title">Movimiento planeado</div>
          <div className="movement-grid">
            {MOVEMENTS.map(m => (
              <button key={m.id} className={`move-btn ${movement.kind === m.id ? 'active' : ''}`}
                onClick={() => updateTooth(selectedFdi, { movement: movement.kind === m.id ? null : { kind: m.id, amount: movement.amount || 2 } })}>
                <span className="move-glyph"><Icon name={m.glyph} size={14} /></span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
          {movement.kind && (
            <div className="slider-row" style={{marginTop: 8}}>
              <span style={{fontSize:'var(--t-12)', color:'var(--fg-muted)', minWidth: 56}}>Magnitud</span>
              <input type="range" min="1" max="6" step="0.5" value={movement.amount || 2}
                onChange={e => updateTooth(selectedFdi, { movement: { ...movement, amount: +e.target.value } })} />
              <span className="slider-val">{movement.amount || 2}mm</span>
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="detail-section">
          <div className="detail-section-title">Notas clínicas</div>
          <textarea className="notes-textarea"
            placeholder="Ej: brackets cementados con corrección de torque. Control en 4 semanas."
            value={state.notes || ''}
            onChange={e => updateTooth(selectedFdi, { notes: e.target.value })} />
        </div>

        {/* Quick actions */}
        <div className="detail-section">
          <button className="btn btn-ghost" style={{justifyContent:'center'}}
            onClick={() => clearTooth(selectedFdi)}>
            <Icon name="cross" size={14} />
            Limpiar registro de este diente
          </button>
        </div>
      </div>
    </aside>
  );
}

function fdiToUniversal(fdi) {
  const map = {
    18:1,17:2,16:3,15:4,14:5,13:6,12:7,11:8,
    21:9,22:10,23:11,24:12,25:13,26:14,27:15,28:16,
    38:17,37:18,36:19,35:20,34:21,33:22,32:23,31:24,
    41:25,42:26,43:27,44:28,45:29,46:30,47:31,48:32,
  };
  return map[fdi] || '?';
}

// =================================================================
// Main App
// =================================================================
function App() {
  // teeth state: { 11: { appliance, ligature, condition, movement: {kind, amount}, notes }, ... }
  const [teeth, setTeeth] = useState(() => {
    // If parent provided initial state via ?empty=1 or postMessage seed, start empty
    const params = new URLSearchParams(window.location.search);
    if (params.get('empty') === '1') return {};
    return seedTeeth();
  });
  const [selected, setSelected] = useState(11);
  const [view, setView] = useState('arch');
  const [mode, setMode] = useState('aparato');
  const [activeAppliance, setActiveAppliance] = useState('metal');
  const [activeCondition, setActiveCondition] = useState(null);
  const [activeMovement, setActiveMovement] = useState(null);
  const [activeLigature, setActiveLigature] = useState('#9BD0EA');
  const [angleClass, setAngleClass] = useState('II-1');
  const [cephValues, setCephValues] = useState({});
  const [media, setMedia] = useState({});
  const [month, setMonth] = useState(4);
  const [showWire, setShowWire] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // ---- Cross-frame state bridge (for embedding in consultation page) ----
  useEffect(() => {
    function onMessage(e) {
      const data = e.data || {};
      if (data.type === 'orto:getState') {
        const reply = { type: 'orto:state', state: { teeth, angleClass, cephValues, media, month } };
        e.source && e.source.postMessage(reply, '*');
      } else if (data.type === 'orto:setState' && data.state) {
        if (data.state.teeth && typeof data.state.teeth === 'object') setTeeth(data.state.teeth);
        if (data.state.angleClass) setAngleClass(data.state.angleClass);
        if (data.state.cephValues && typeof data.state.cephValues === 'object') setCephValues(data.state.cephValues);
        if (data.state.media && typeof data.state.media === 'object') setMedia(data.state.media);
        if (typeof data.state.month === 'number') setMonth(data.state.month);
      }
    }
    window.addEventListener('message', onMessage);
    // Announce readiness to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'orto:ready' }, '*');
    }
    return () => window.removeEventListener('message', onMessage);
  }, [teeth, angleClass, cephValues, media, month]);

  // ---- Auto-scroll the view-tabs strip so the active tab is centered when changed ----
  useEffect(() => {
    const active = document.querySelector('.viewtabs .viewtab.active');
    if (!active) return;
    if (typeof active.scrollIntoView === 'function') {
      try {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } catch (_) {
        // Older browsers: fall back to manual offset
        const strip = active.parentElement;
        if (strip) strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
      }
    }
  }, [view]);

  // ---- Auto-resize: report content height to parent so iframe grows on mobile ----
  useEffect(() => {
    if (!window.parent || window.parent === window) return;
    let last = 0;
    const measure = () => {
      const shell = document.querySelector('.shell');
      if (shell) return Math.ceil(shell.getBoundingClientRect().height);
      return Math.ceil(document.body.getBoundingClientRect().height);
    };
    const postHeight = () => {
      requestAnimationFrame(() => {
        const h = measure();
        if (h !== last && h > 0) {
          last = h;
          window.parent.postMessage({ type: 'orto:height', height: h }, '*');
        }
      });
    };
    postHeight();
    const ro = new ResizeObserver(() => postHeight());
    const shell = document.querySelector('.shell');
    if (shell) ro.observe(shell);
    ro.observe(document.body);
    window.addEventListener('resize', postHeight);
    return () => { ro.disconnect(); window.removeEventListener('resize', postHeight); };
  }, [view, mode, selected, teeth, media, cephValues, angleClass]);

  const updateTooth = useCallback((fdi, patch) => {
    setTeeth(prev => ({ ...prev, [fdi]: { ...(prev[fdi] || {}), ...patch } }));
  }, []);

  const clearTooth = useCallback((fdi) => {
    setTeeth(prev => {
      const next = { ...prev };
      delete next[fdi];
      return next;
    });
  }, []);

  // Click on tooth — applies active tool, then selects
  const handleSelectTooth = useCallback((fdi) => {
    setSelected(fdi);
    // Apply active tool on click
    if (mode === 'aparato' && activeAppliance) {
      const current = (teeth[fdi] || {}).appliance;
      updateTooth(fdi, { appliance: current === activeAppliance ? null : activeAppliance });
    } else if (mode === 'condicion' && activeCondition) {
      const current = (teeth[fdi] || {}).condition;
      updateTooth(fdi, { condition: current === activeCondition ? null : activeCondition });
    } else if (mode === 'movimiento' && activeMovement) {
      const current = (teeth[fdi] || {}).movement;
      const same = current && current.kind === activeMovement;
      updateTooth(fdi, { movement: same ? null : { kind: activeMovement, amount: 2 } });
    } else if (mode === 'ligadura') {
      updateTooth(fdi, { ligature: activeLigature });
    }
  }, [mode, activeAppliance, activeCondition, activeMovement, activeLigature, teeth, updateTooth]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'a' || e.key === 'A') setMode('aparato');
      else if (e.key === 'c' || e.key === 'C') setMode('condicion');
      else if (e.key === 'm' || e.key === 'M') setMode('movimiento');
      else if (e.key === 'l' || e.key === 'L') setMode('ligadura');
      else if (e.key === 'Backspace' && selected) clearTooth(selected);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, clearTooth]);

  const views = [
    { id: 'arch', label: 'Arcadas', icon: 'arch' },
    { id: 'frontal', label: 'Sonrisa', icon: 'smile' },
    { id: 'oclusal', label: 'Oclusal', icon: 'occlusal' },
    { id: 'profile', label: 'Perfil · Angle', icon: 'profile' },
    { id: 'plano', label: 'FDI plano', icon: 'grid' },
    { id: 'evolucion', label: 'Evolución', icon: 'clock' },
    { id: 'media', label: 'Fotos & Rx', icon: 'images' },
  ];

  const titles = {
    arch: { t: 'Diagrama ortodóncico de arcadas', s: 'Ambas arcadas en su forma anatómica. Clic en cualquier pieza para editar.' },
    frontal: { t: 'Vista frontal — sonrisa', s: 'Reproducción de la sonrisa con aparatología visible.' },
    oclusal: { t: 'Vista oclusal', s: 'Mira la arcada desde el plano oclusal — útil para planificar movimientos transversales.' },
    profile: { t: 'Perfil lateral & cefalometría', s: 'Clasificación esquelética de Angle y valores cefalométricos.' },
    plano: { t: 'Odontograma plano · FDI', s: 'Notación FDI estándar — la vista clínica clásica.' },
    evolucion: { t: 'Evolución del tratamiento', s: 'Compara antes/después y revisa el plan mes a mes.' },
    media: { t: 'Fotografías y radiografías', s: 'Archivo visual del caso.' },
  };

  return (
    <div className="shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17c0-6 4-10 9-10s9 4 9 10" />
              <path d="M8 13c0-2 2-3 4-3s4 1 4 3" />
            </svg>
          </div>
          <span>Ortodoncia</span>
          <span className="brand-sub">Salud Digital</span>
        </div>

        <nav className="viewtabs">
          {views.map(v => (
            <button key={v.id} className={`viewtab ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
              <Icon name={v.icon} size={14} />
              {v.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <span style={{ fontSize: 'var(--t-12)', color: 'var(--fg-muted)' }}>
            Los cambios se guardan al pulsar <strong style={{ color: 'var(--fg-default)' }}>Guardar Consulta</strong>
          </span>
        </div>
      </header>

      {/* Main grid */}
      <main className="main">
        <ToolPalette
          activeAppliance={activeAppliance} setActiveAppliance={setActiveAppliance}
          activeCondition={activeCondition} setActiveCondition={setActiveCondition}
          activeMovement={activeMovement} setActiveMovement={setActiveMovement}
          activeLigature={activeLigature} setActiveLigature={setActiveLigature}
          mode={mode} setMode={setMode}
        />

        {/* Center canvas */}
        <section className="canvas">
          <div className="canvas-inner">
            <header className="canvas-header">
              <div>
                <h2 className="canvas-title">{titles[view].t}</h2>
                <div className="canvas-sub">{titles[view].s}</div>
              </div>
              {view === 'arch' && (
                <div className="legend">
                  <label style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
                    <input type="checkbox" checked={showWire} onChange={e => setShowWire(e.target.checked)} />
                    Mostrar arco de alambre
                  </label>
                  <label style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--t-12)', color:'var(--fg-muted)'}}>
                    <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
                    Numeración FDI
                  </label>
                </div>
              )}
            </header>

            {view === 'arch' && <ArchView teeth={teeth} selected={selected} onSelect={handleSelectTooth} showWire={showWire} showLabels={showLabels} />}
            {view === 'frontal' && <FrontalView teeth={teeth} selected={selected} onSelect={handleSelectTooth} />}
            {view === 'oclusal' && <OclusalView teeth={teeth} selected={selected} onSelect={handleSelectTooth} />}
            {view === 'profile' && <ProfileView teeth={teeth} angleClass={angleClass} setAngleClass={setAngleClass} cephValues={cephValues} setCephValues={setCephValues} />}
            {view === 'plano' && <PlanoView teeth={teeth} selected={selected} onSelect={handleSelectTooth} />}
            {view === 'evolucion' && <EvolucionView teeth={teeth} selected={selected} onSelect={handleSelectTooth} month={month} setMonth={setMonth} />}
            {view === 'media' && <MediaView media={media} setMedia={setMedia} />}
          </div>
        </section>

        <DetailPanel selectedFdi={selected} teeth={teeth} updateTooth={updateTooth} clearTooth={clearTooth} view={view} angleClass={angleClass} cephValues={cephValues} month={month} />
      </main>
    </div>
  );
}

// Seed a realistic case: Class II with crowding, brackets on upper, etc.
function seedTeeth() {
  const t = {};
  // Upper arch — full metal brackets with blue ligatures
  [16,15,14,13,12,11,21,22,23,24,25,26].forEach(fdi => {
    t[fdi] = { appliance: 'metal', ligature: '#9BD0EA' };
  });
  // Upper molars have bands
  t[17] = { appliance: 'band' };
  t[27] = { appliance: 'band' };
  // Wisdom teeth — missing
  t[18] = { condition: 'ausente' };
  t[28] = { condition: 'ausente' };

  // Lower arch — same setup
  [46,45,44,43,42,41,31,32,33,34,35,36].forEach(fdi => {
    t[fdi] = { appliance: 'metal', ligature: '#9BD0EA' };
  });
  t[47] = { appliance: 'band' };
  t[37] = { appliance: 'band' };
  t[48] = { condition: 'extraido' };
  t[38] = { condition: 'extraido' };

  // Some clinical conditions
  t[16].condition = 'restoration';
  t[26].condition = 'restoration';
  t[36].condition = 'caries';

  // Planned movements
  t[12].movement = { kind: 'rotacion', amount: 3 };
  t[22].movement = { kind: 'rotacion', amount: 2 };
  t[13].movement = { kind: 'distal', amount: 2 };
  t[23].movement = { kind: 'distal', amount: 2 };
  t[33].movement = { kind: 'vestibular', amount: 1.5 };

  // Notes on selected
  t[11] = { ...t[11], notes: 'Apinhamiento leve. Plan: alineación + nivelación con .014 NiTi durante 8 semanas.' };

  return t;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
