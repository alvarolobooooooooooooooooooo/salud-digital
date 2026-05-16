/* =========================================================
   Periodontograma — widget app.
   Mounts the chart + right-side diagnosis panel into a container
   and exposes window.PerioWidget for the host page to read/write state.
   ========================================================= */
(function () {
  const { useState, useCallback, useMemo, useEffect } = React;
  const PD = window.PERIO_DATA;
  const DX = window.PERIO_DX;

  function PerioApp({ initialTeeth, onChange }) {
    const [teeth, setTeeth] = useState(() => initialTeeth || PD.emptyTeeth());
    const [selection, setSelection] = useState({ fdi: 16, site: 'MB', field: 'pd' });

    useEffect(() => {
      if (typeof onChange === 'function') onChange(teeth);
    }, [teeth, onChange]);

    const updateSite = useCallback((fdi, site, patch) => {
      setTeeth(prev => {
        const next = { ...prev };
        const t = { ...next[fdi] };
        t.sites = { ...t.sites };
        t.sites[site] = { ...t.sites[site], ...patch };
        next[fdi] = t;
        return next;
      });
    }, []);

    const updateTooth = useCallback((fdi, patch) => {
      setTeeth(prev => {
        const next = { ...prev };
        next[fdi] = { ...next[fdi], ...patch };
        if (patch.furcation !== undefined) {
          const cleaned = {};
          Object.entries(patch.furcation).forEach(([k, v]) => { if (v) cleaned[k] = v; });
          next[fdi].furcation = cleaned;
        }
        return next;
      });
    }, []);

    const traversalOrder = useMemo(() => {
      const order = [];
      const allFdis = [...PD.FDI_UPPER, ...PD.FDI_LOWER];
      allFdis.forEach(fdi => {
        const mirror = (Math.floor(fdi / 10) === 2 || Math.floor(fdi / 10) === 3);
        const buccal = mirror ? ['MB', 'B', 'DB'] : ['DB', 'B', 'MB'];
        const lingual = mirror ? ['ML', 'L', 'DL'] : ['DL', 'L', 'ML'];
        [...buccal, ...lingual].forEach(site => order.push({ fdi, site }));
      });
      return order;
    }, []);

    const advanceSelection = useCallback((delta = 1) => {
      setSelection(sel => {
        if (!sel) return sel;
        const idx = traversalOrder.findIndex(o => o.fdi === sel.fdi && o.site === sel.site);
        if (idx < 0) return sel;
        let nextIdx = idx + delta;
        for (let safety = 0; safety < traversalOrder.length; safety++) {
          if (nextIdx < 0) nextIdx = traversalOrder.length - 1;
          if (nextIdx >= traversalOrder.length) nextIdx = 0;
          const next = traversalOrder[nextIdx];
          if (teeth[next.fdi] && teeth[next.fdi].present) break;
          nextIdx += delta > 0 ? 1 : -1;
        }
        const next = traversalOrder[nextIdx];
        return { ...sel, fdi: next.fdi, site: next.site };
      });
    }, [traversalOrder, teeth]);

    // Keyboard shortcuts — only when focus is inside the widget root
    const rootRef = React.useRef(null);
    useEffect(() => {
      function onKey(e) {
        if (!selection) return;
        const root = rootRef.current;
        if (!root || !root.contains(document.activeElement)) {
          // Allow shortcuts only when an interactive element inside the widget is focused
          if (document.activeElement !== document.body) return;
        }
        const tag = (e.target.tagName || '').toLowerCase();
        const inEditable = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

        if (e.key === 'Tab' && root && root.contains(e.target)) {
          e.preventDefault();
          advanceSelection(e.shiftKey ? -1 : 1);
          return;
        }
        if (inEditable) return;
        if (root && !root.contains(e.target)) return;

        if (e.key === 'ArrowRight') { e.preventDefault(); advanceSelection(1); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); advanceSelection(-1); return; }
        if (e.key === 'ArrowUp')    { e.preventDefault(); advanceSelection(-6); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); advanceSelection(6); return; }

        if (/^[0-9]$/.test(e.key)) {
          const v = parseInt(e.key, 10);
          const field = selection.field === 'gm' ? 'gm' : 'pd';
          updateSite(selection.fdi, selection.site, { [field]: v });
          if (field === 'pd') advanceSelection(1);
          return;
        }
        const k = e.key.toLowerCase();
        if (k === 'b') {
          const cur = teeth[selection.fdi].sites[selection.site].bop;
          updateSite(selection.fdi, selection.site, { bop: !cur });
        } else if (k === 'p') {
          const cur = teeth[selection.fdi].sites[selection.site].plaque;
          updateSite(selection.fdi, selection.site, { plaque: !cur });
        } else if (k === 's') {
          const cur = teeth[selection.fdi].sites[selection.site].sup;
          updateSite(selection.fdi, selection.site, { sup: !cur });
        } else if (k === 'g') {
          setSelection(sel => ({ ...sel, field: sel.field === 'pd' ? 'gm' : 'pd' }));
        }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [selection, advanceSelection, updateSite, teeth]);

    return (
      <div className="perio-root" ref={rootRef}>
        <div className="perio-main">
          <main className="perio-chart-area">
            <div className="perio-exam-header">
              <div>
                <div className="perio-eyebrow">Periodontograma</div>
                <h2>Sondaje periodontal</h2>
                <div className="perio-sub">Notación FDI · 6 sitios por diente (DB · B · MB · DL · L · ML)</div>
              </div>
            </div>

            <PerioChart teeth={teeth} selection={selection} setSelection={setSelection} />

            <PerioLegend />
          </main>

          <SummaryPanel
            teeth={teeth}
            selection={selection}
            setSelection={setSelection}
            updateSite={updateSite}
            updateTooth={updateTooth}
          />
        </div>
      </div>
    );
  }

  function PerioLegend() {
    return (
      <div className="perio-legend">
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'var(--sd-vital-500)' }} /> 1–3 mm sano</span>
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'var(--sd-alert-500)' }} /> 4–5 mm moderado</span>
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'var(--sd-critical-500)' }} /> ≥ 6 mm profundo</span>
        <span className="perio-legend-divider" />
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'var(--sd-critical-500)' }} /> BOP</span>
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'var(--sd-alert-500)' }} /> Placa</span>
        <span className="perio-legend-item"><span className="perio-legend-dot" style={{ background: 'transparent', border: '1.5px solid var(--sd-critical-500)' }} /> Supuración</span>
        <span className="perio-legend-divider" />
        <span className="perio-legend-item"><span className="perio-mobility-pill" style={{ padding: '0 6px', fontSize: 10 }}>I</span> Movilidad Miller</span>
        <span className="perio-legend-item"><span className="perio-furcation-marker f-2" style={{ width: 13, height: 13, fontSize: 8 }}>II</span> Furca Hamp</span>
        <span className="perio-legend-divider" />
        <span className="perio-legend-item"><span style={{ display:'inline-block', width:16, height:4, background: '#E89797', borderRadius:2 }} /> Encía</span>
        <span className="perio-legend-item"><span style={{ display:'inline-block', width:16, borderTop: '1.3px dashed var(--sd-ink-700)' }} /> Cresta ósea</span>
      </div>
    );
  }

  /* ===========================================================
     Right panel: diagnosis + metrics + site editor
     =========================================================== */
  function SummaryPanel({ teeth, selection, setSelection, updateSite, updateTooth }) {
    const dx = useMemo(() => DX.diagnose(teeth, window.PERIO_PATIENT_CTX || {}), [teeth]);

    return (
      <aside className="perio-right-panel">
        <DxCard dx={dx} />
        <MetricsGrid dx={dx} />
        <PocketDistribution dx={dx} />
        <SiteEditor
          teeth={teeth}
          selection={selection}
          setSelection={setSelection}
          updateSite={updateSite}
          updateTooth={updateTooth}
        />
      </aside>
    );
  }

  function DxCard({ dx }) {
    const empty = dx.totalSites === 0;
    return (
      <div className="perio-dx-card">
        <div className="perio-dx-eyebrow">Diagnóstico · AAP/EFP 2017</div>
        <div className="perio-dx-title">
          {empty
            ? <span>Sin mediciones <span style={{color:'var(--sd-blue-300)'}}>todavía</span></span>
            : dx.stage === '—'
              ? <span>Sin pérdida de <span style={{color:'var(--sd-blue-300)'}}>inserción</span></span>
              : <span>Periodontitis <span style={{color:'var(--sd-blue-300)'}}>{dx.extent}</span></span>}
        </div>
        <div className="perio-dx-meta">
          <div className="perio-dx-tile">
            <div className="perio-label">Estadio</div>
            <div className="perio-value">{dx.stage}</div>
          </div>
          <div className="perio-dx-tile">
            <div className="perio-label">Grado</div>
            <div className="perio-value">{dx.grade}</div>
          </div>
          <div className="perio-dx-tile">
            <div className="perio-label">Extensión</div>
            <div className="perio-value" style={{ fontSize: 15, lineHeight: 1.2, paddingTop: 4 }}>
              {empty ? '—' : <>{Math.round(dx.lossPct || 0)}<span className="perio-small">%</span></>}
            </div>
          </div>
        </div>
        <div className="perio-dx-note">
          <span style={{ color: 'white', fontWeight: 600 }}>NIC máx interprox.</span> {empty ? '—' : `${dx.interproxCalMax || 0} mm`} ·{' '}
          <span style={{ color: 'white', fontWeight: 600 }}>PD máx</span> {empty ? '—' : `${dx.pdMax || 0} mm`}
          {!empty && dx.drivers && dx.drivers.length > 0 && <span> · Modificadores: {dx.drivers.join(' · ')}</span>}
        </div>
      </div>
    );
  }

  function MetricsGrid({ dx }) {
    const empty = dx.totalSites === 0;
    return (
      <div className="perio-metric-grid">
        <div className="perio-metric">
          <div className="perio-label">% BOP</div>
          <div className="perio-value">
            {empty ? '—' : <>{Math.round(dx.bopPct || 0)}<span className="perio-unit">%</span></>}
          </div>
        </div>
        <div className="perio-metric">
          <div className="perio-label">% Placa</div>
          <div className="perio-value">
            {empty ? '—' : <>{Math.round(dx.plaquePct || 0)}<span className="perio-unit">%</span></>}
          </div>
        </div>
        <div className="perio-metric">
          <div className="perio-label">PD media</div>
          <div className="perio-value">
            {empty ? '—' : <>{(dx.pdMean || 0).toFixed(1)}<span className="perio-unit">mm</span></>}
          </div>
        </div>
        <div className="perio-metric">
          <div className="perio-label">Bolsas ≥ 6 mm</div>
          <div className="perio-value">{dx.sites6 || 0}<span className="perio-unit">sitios</span></div>
        </div>
      </div>
    );
  }

  function PocketDistribution({ dx }) {
    const total = dx.totalSites || 0;
    const shallow = total - (dx.sites4 || 0);
    const moderate = (dx.sites4 || 0) - (dx.sites6 || 0);
    const deep = dx.sites6 || 0;
    return (
      <div className="perio-section-card">
        <h3 className="perio-section-card-title">
          Distribución de bolsas
          <span className="perio-badge">{total} {total === 1 ? 'sitio' : 'sitios'}</span>
        </h3>
        {total === 0 ? (
          <div style={{ padding: '12px 4px', fontSize: 12, color: 'var(--p-fg-muted)', textAlign: 'center' }}>
            Registre profundidad de sondaje (PD) para ver la distribución.
          </div>
        ) : (
          <div className="perio-bar-chart">
            <BarRow label="1–3 mm" count={shallow} total={total} cls="shallow" />
            <BarRow label="4–5 mm" count={moderate} total={total} cls="moderate" />
            <BarRow label="≥ 6 mm" count={deep} total={total} cls="deep" />
          </div>
        )}
      </div>
    );
  }
  function BarRow({ label, count, total, cls }) {
    const pct = total ? (count / total) * 100 : 0;
    return (
      <div className="perio-bar-row">
        <span className="perio-blabel">{label}</span>
        <span className="perio-btrack"><span className={`perio-bfill ${cls}`} style={{ width: pct + '%' }} /></span>
        <span className="perio-bnum">{count}</span>
      </div>
    );
  }

  function SiteEditor({ teeth, selection, setSelection, updateSite, updateTooth }) {
    if (!selection) {
      return (
        <div className="perio-site-editor">
          <h3>Sin selección <span className="perio-mono">— haz clic en un diente</span></h3>
        </div>
      );
    }
    const tooth = teeth[selection.fdi];
    if (!tooth) return null;

    if (!tooth.present) {
      return (
        <div className="perio-site-editor">
          <h3>Diente {selection.fdi} <span className="perio-mono">— Ausente</span></h3>
          <div style={{display:'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
            <button type="button" className="perio-btn" onClick={() => updateTooth(selection.fdi, { present: true })}>
              Marcar presente
            </button>
            <button type="button" className="perio-btn" onClick={() => updateTooth(selection.fdi, { present: true, implant: true })}>
              Registrar implante
            </button>
          </div>
        </div>
      );
    }

    const mirror = (Math.floor(selection.fdi / 10) === 2 || Math.floor(selection.fdi / 10) === 3);

    return (
      <div className="perio-site-editor">
        <h3>
          <span>
            Diente {selection.fdi}
            {tooth.implant && <span style={{ color: 'var(--sd-blue-600)', fontWeight: 600, marginLeft: 6, fontSize: 12 }}> · Implante</span>}
          </span>
          <span className="perio-mono">{PD.toothType(selection.fdi).toUpperCase()}</span>
        </h3>

        <div className="perio-tooth-ctrls">
          <div className="perio-field-block">
            <div className="perio-field-label">Movilidad (Miller)</div>
            <div className="perio-seg warn">
              {[0, 1, 2, 3].map(g => (
                <button type="button" key={g}
                  className={tooth.mobility === g ? 'is-active' : ''}
                  onClick={() => updateTooth(selection.fdi, { mobility: g })}>
                  {g === 0 ? '0' : 'I'.repeat(g)}
                </button>
              ))}
            </div>
          </div>
          {PD.toothType(selection.fdi) === 'molar' && !tooth.implant && (
            <div className="perio-field-block">
              <div className="perio-field-label">Furca vestibular (Hamp)</div>
              <div className="perio-seg warn">
                {[0, 1, 2, 3].map(g => (
                  <button type="button" key={g}
                    className={(tooth.furcation?.B || 0) === g ? 'is-active' : ''}
                    onClick={() => updateTooth(selection.fdi, {
                      furcation: { ...tooth.furcation, B: g === 0 ? undefined : g },
                    })}>
                    {g === 0 ? '0' : 'I'.repeat(g)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SiteBlock title="Sitios vestibulares" sites={PD.SITES_B} mirror={mirror}
          tooth={tooth} selection={selection} setSelection={setSelection} updateSite={updateSite} />
        <div style={{height: 8}} />
        <SiteBlock title="Sitios palat./ling." sites={PD.SITES_L} mirror={mirror}
          tooth={tooth} selection={selection} setSelection={setSelection} updateSite={updateSite} />
        <div className="perio-tooth-ctrls" style={{ marginTop: 12 }}>
          <button type="button" className="perio-btn" onClick={() => updateTooth(selection.fdi, { present: false, implant: false })}>
            Marcar ausente
          </button>
          <button type="button" className="perio-btn" onClick={() => updateTooth(selection.fdi, { implant: !tooth.implant })}>
            {tooth.implant ? 'Quitar implante' : 'Marcar implante'}
          </button>
        </div>

        <div className="perio-hint-line">
          <span><span className="perio-kbd">0</span>–<span className="perio-kbd">9</span> PD/GM</span>
          <span><span className="perio-kbd">B</span> sangrado</span>
          <span><span className="perio-kbd">P</span> placa</span>
          <span><span className="perio-kbd">S</span> supuración</span>
          <span><span className="perio-kbd">←</span><span className="perio-kbd">→</span> sitio</span>
        </div>
      </div>
    );
  }

  function SiteBlock({ title, sites, mirror, tooth, selection, setSelection, updateSite }) {
    const displayOrder = mirror ? [sites[2], sites[1], sites[0]] : sites;
    const labels = mirror ? ['M', sites[1] === 'B' ? 'V' : 'L', 'D'] : ['D', sites[1] === 'B' ? 'V' : 'L', 'M'];

    const handleNum = (siteName, field, e) => {
      let v = parseInt(e.target.value || '0', 10);
      if (Number.isNaN(v)) v = 0;
      v = Math.max(0, Math.min(15, v));
      updateSite(tooth.fdi, siteName, { [field]: v });
    };

    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--p-ls-widest)', color: 'var(--p-fg-muted)', margin: '8px 0 4px 0' }}>{title}</div>
        <div className="perio-site-table">
          <div className="perio-head"></div>
          {labels.map(l => <div key={l} className="perio-head">{l}</div>)}

          <div className="perio-rh">PD</div>
          {displayOrder.map(s => {
            const isSel = selection.site === s && selection.field === 'pd';
            const cat = DX.pdCategory(tooth.sites[s].pd);
            return (
              <div className="perio-cell" key={'pd-' + s} onClick={() => setSelection({ fdi: tooth.fdi, site: s, field: 'pd' })}>
                <input
                  value={tooth.sites[s].pd || ''}
                  onChange={e => handleNum(s, 'pd', e)}
                  onFocus={() => setSelection({ fdi: tooth.fdi, site: s, field: 'pd' })}
                  autoFocus={isSel}
                  className={`pd-${cat}`}
                  placeholder="—"
                />
              </div>
            );
          })}

          <div className="perio-rh">GM</div>
          {displayOrder.map(s => (
            <div className="perio-cell" key={'gm-' + s} onClick={() => setSelection({ fdi: tooth.fdi, site: s, field: 'gm' })}>
              <input
                value={tooth.sites[s].gm || ''}
                onChange={e => handleNum(s, 'gm', e)}
                onFocus={() => setSelection({ fdi: tooth.fdi, site: s, field: 'gm' })}
                autoFocus={selection.site === s && selection.field === 'gm'}
                placeholder="0"
              />
            </div>
          ))}

          <div className="perio-rh">NIC</div>
          {displayOrder.map(s => (
            <div className="perio-cell" key={'cal-' + s} style={{ background: 'var(--sd-ink-50)' }}>
              <span style={{ fontFamily: 'var(--p-font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--p-fg-muted)' }}>
                {(tooth.sites[s].pd + tooth.sites[s].gm) || '—'}
              </span>
            </div>
          ))}
        </div>

        <div className="perio-flag-row">
          <div className="perio-rh">BOP</div>
          {displayOrder.map(s => (
            <div className="perio-flag-cell" key={'bop-' + s}>
              <button type="button" className={`perio-flag-btn ${tooth.sites[s].bop ? 'on-bop' : ''}`}
                onClick={() => updateSite(tooth.fdi, s, { bop: !tooth.sites[s].bop })}
                title="Sangrado al sondaje">●</button>
            </div>
          ))}

          <div className="perio-rh">Placa</div>
          {displayOrder.map(s => (
            <div className="perio-flag-cell" key={'plq-' + s}>
              <button type="button" className={`perio-flag-btn ${tooth.sites[s].plaque ? 'on-plaque' : ''}`}
                onClick={() => updateSite(tooth.fdi, s, { plaque: !tooth.sites[s].plaque })}
                title="Placa bacteriana">●</button>
            </div>
          ))}

          <div className="perio-rh">Sup</div>
          {displayOrder.map(s => (
            <div className="perio-flag-cell" key={'sup-' + s}>
              <button type="button" className={`perio-flag-btn ${tooth.sites[s].sup ? 'on-sup' : ''}`}
                onClick={() => updateSite(tooth.fdi, s, { sup: !tooth.sites[s].sup })}
                title="Supuración">○</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ===========================================================
     Public mount API
     =========================================================== */
  let currentTeeth = null;
  let currentRoot = null;

  window.PerioWidget = {
    init(containerId, initialState) {
      const el = document.getElementById(containerId);
      if (!el) { console.warn('[PerioWidget] container not found:', containerId); return; }
      const initialTeeth = PD.hydrate(initialState);
      currentTeeth = initialTeeth;
      const root = ReactDOM.createRoot(el);
      currentRoot = root;
      root.render(<PerioApp initialTeeth={initialTeeth} onChange={(t) => { currentTeeth = t; }} />);
    },
    getState() {
      return currentTeeth || PD.emptyTeeth();
    },
    setPatientContext(ctx) {
      window.PERIO_PATIENT_CTX = ctx || {};
    },
  };
})();
