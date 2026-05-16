/* =========================================================
   Periodontograma — Chart (rows + per-tooth cells).
   Adapted from the Claude Design bundle.
   ========================================================= */
const { FDI_UPPER: P_UPPER, FDI_LOWER: P_LOWER, SITES_B: P_SITES_B, SITES_L: P_SITES_L, toothType: pToothType } = window.PERIO_DATA;
const { pdCategory: pPdCat } = window.PERIO_DX;

function pIsMirrored(fdi) {
  const q = Math.floor(fdi / 10);
  return q === 2 || q === 3;
}

function PerioSiteNumCell({ tooth, site, field, selection, setSelection }) {
  const isSelected = selection && selection.fdi === tooth.fdi && selection.site === site && selection.field === field;
  const value = tooth.sites[site][field];
  const empty = !tooth.present || value === 0;
  const cat = field === 'pd' ? pPdCat(value) : '';
  return (
    <div
      className={`perio-site-cell ${isSelected ? 'is-selected' : ''} ${empty ? 'is-empty' : ''} ${field === 'pd' ? 'pd-' + cat : ''}`}
      onClick={(e) => { e.stopPropagation(); setSelection({ fdi: tooth.fdi, site, field }); }}
      title={`${tooth.fdi} · ${site} · ${field.toUpperCase()}: ${value} mm`}
    >
      {tooth.present ? (value || '·') : '·'}
    </div>
  );
}

function PerioSiteDotCell({ tooth, site, field, selection, setSelection }) {
  const v = tooth.sites[site][field];
  const sup = tooth.sites[site].sup;
  const isSelected = selection && selection.fdi === tooth.fdi && selection.site === site;
  const onClass = field === 'bop' ? 'on-bop' : field === 'plaque' ? 'on-plaque' : '';
  return (
    <div
      className="perio-dot-slot"
      onClick={(e) => { e.stopPropagation(); setSelection({ fdi: tooth.fdi, site, field }); }}
      style={isSelected ? { background: 'rgba(0,128,176,0.12)' } : null}
      title={`${tooth.fdi} · ${site} · ${field}`}
    >
      <span className={`perio-dot row-${field} ${v ? onClass : ''}`} />
      {field === 'bop' && sup && tooth.present && (
        <span style={{
          position: 'absolute', top: 1, right: 1,
          width: 5, height: 5, borderRadius: 999, border: '1.2px solid var(--sd-critical-500)',
          background: 'white', pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function PerioToothCellRow({ fdis, teeth, render }) {
  return (
    <div className="perio-teeth-row">
      {fdis.map((fdi, idx) => {
        const t = teeth[fdi];
        const mirror = pIsMirrored(fdi);
        const isAfterMidline = idx === 8;
        return (
          <React.Fragment key={fdi}>
            {render({ tooth: t, mirror, fdi, isAfterMidline })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PerioFdiRowCell({ tooth, fdi, selection, setSelection, isAfterMidline }) {
  const sel = selection && selection.fdi === fdi;
  const cls = `perio-fdi-cell ${sel ? 'is-selected' : ''} ${!tooth.present ? 'is-absent' : ''} ${tooth.implant ? 'is-implant' : ''}`;
  return (
    <div
      className={cls}
      onClick={() => setSelection({ fdi, site: 'B', field: 'pd' })}
      style={isAfterMidline ? { borderLeft: '1px dashed var(--p-border-default)' } : null}
    >
      <span>{fdi}</span>
      <span className="perio-fdi-sub">
        {tooth.implant ? 'Implante' : !tooth.present ? 'Ausente' : ''}
      </span>
    </div>
  );
}

function PerioIndicatorRowCell({ tooth, fdi, setSelection, isAfterMidline }) {
  const mob = tooth.mobility || 0;
  const furcs = tooth.furcation || {};
  return (
    <div
      className="perio-indicator-cell"
      onClick={() => setSelection({ fdi, site: 'B', field: 'mobility' })}
      style={isAfterMidline ? { borderLeft: '1px dashed var(--p-border-default)' } : null}
    >
      {mob > 0 && tooth.present && (
        <span className={`perio-mobility-pill mob-${mob}`}>M{perioRoman(mob)}</span>
      )}
      {Object.entries(furcs).map(([site, grade]) => (
        <span key={site} className={`perio-furcation-marker f-${grade}`}>{perioRoman(grade)}</span>
      ))}
    </div>
  );
}
function perioRoman(n) { return ['', 'I', 'II', 'III'][n] || n; }

function PerioThreeSiteCells({ tooth, mirror, sites, field, selection, setSelection, dot, isAfterMidline }) {
  const displayOrder = mirror ? [sites[2], sites[1], sites[0]] : sites;
  const Cell = dot ? PerioSiteDotCell : PerioSiteNumCell;
  return (
    <div className={dot ? 'perio-dot-cell' : 'perio-tooth-cell'}
         style={isAfterMidline ? { borderLeft: '1px dashed var(--p-border-default)' } : null}>
      {displayOrder.map(site => (
        <Cell key={site} tooth={tooth} site={site} field={field}
          selection={selection} setSelection={setSelection} />
      ))}
    </div>
  );
}

function PerioToothIllustrationCell({ tooth, fdi, mirror, view, flipped, selection, setSelection, isAfterMidline }) {
  const sel = selection && selection.fdi === fdi;
  return (
    <div
      className={`perio-tooth-cell-img ${sel ? 'is-selected' : ''} ${!tooth.present ? 'is-absent' : ''}`}
      onClick={() => setSelection({ fdi, site: view === 'buccal' ? 'B' : 'L', field: 'pd' })}
      style={isAfterMidline ? { borderLeft: '1px dashed var(--p-border-default)' } : null}
    >
      {tooth.present ? (
        <PerioToothSVG tooth={tooth} view={view} mirror={mirror} flipped={flipped} />
      ) : (
        <PerioAbsent />
      )}
    </div>
  );
}

function PerioRowLabel({ title, sub }) {
  return (
    <div className="perio-row-label tall">
      <div>
        <div>{title}</div>
        {sub && <span className="perio-row-sub">{sub}</span>}
      </div>
    </div>
  );
}
function PerioSectionHeaderRow({ text }) {
  return (
    <div className="perio-section-header-row">
      <span className="perio-bullet" />
      {text}
    </div>
  );
}

function PerioArch({ arch, teeth, selection, setSelection }) {
  const fdis = arch === 'upper' ? P_UPPER : P_LOWER;
  const flipped = arch === 'lower';
  const commonProps = { fdis, teeth };

  const Row = ({ label, sub, render }) => (
    <>
      <PerioRowLabel title={label} sub={sub} />
      <PerioToothCellRow {...commonProps} render={render} />
    </>
  );

  const buccalRows = [
    { label: 'Placa', sub: 'vestib.', dot: 'plaque' },
    { label: 'Sangrado', sub: '● BOP / ◯ sup', dot: 'bop' },
    { label: 'Margen', sub: 'GM (mm)', num: 'gm', sites: P_SITES_B },
    { label: 'Sondaje', sub: 'PD (mm)', num: 'pd', sites: P_SITES_B },
  ];
  const lingualRows = [
    { label: 'Sondaje', sub: 'PD (mm)', num: 'pd', sites: P_SITES_L },
    { label: 'Margen', sub: 'GM (mm)', num: 'gm', sites: P_SITES_L },
    { label: 'Sangrado', sub: '● BOP / ◯ sup', dot: 'bop', sites: P_SITES_L },
    { label: 'Placa', sub: 'palat./ling.', dot: 'plaque', sites: P_SITES_L },
  ];

  const renderRow = (r) => {
    if (r.dot) {
      const sites = r.sites || P_SITES_B;
      return ({ tooth, mirror, isAfterMidline }) => (
        <PerioThreeSiteCells tooth={tooth} mirror={mirror}
          sites={sites} field={r.dot} dot
          selection={selection} setSelection={setSelection}
          isAfterMidline={isAfterMidline} />
      );
    }
    return ({ tooth, mirror, isAfterMidline }) => (
      <PerioThreeSiteCells tooth={tooth} mirror={mirror}
        sites={r.sites} field={r.num}
        selection={selection} setSelection={setSelection}
        isAfterMidline={isAfterMidline} />
    );
  };

  const fdiRow = ({ tooth, fdi, isAfterMidline }) => (
    <PerioFdiRowCell tooth={tooth} fdi={fdi} selection={selection} setSelection={setSelection} isAfterMidline={isAfterMidline} />
  );
  const indRow = ({ tooth, fdi, isAfterMidline }) => (
    <PerioIndicatorRowCell tooth={tooth} fdi={fdi} selection={selection} setSelection={setSelection} isAfterMidline={isAfterMidline} />
  );
  const toothBuc = ({ tooth, fdi, mirror, isAfterMidline }) => (
    <PerioToothIllustrationCell tooth={tooth} fdi={fdi} mirror={mirror} view="buccal" flipped={flipped}
      selection={selection} setSelection={setSelection} isAfterMidline={isAfterMidline} />
  );
  const toothLin = ({ tooth, fdi, mirror, isAfterMidline }) => (
    <PerioToothIllustrationCell tooth={tooth} fdi={fdi} mirror={mirror} view="lingual" flipped={flipped}
      selection={selection} setSelection={setSelection} isAfterMidline={isAfterMidline} />
  );

  return (
    <div className="perio-chart-grid">
      {arch === 'upper' && (
        <>
          <Row label="Diente" sub="FDI" render={fdiRow} />
          <Row label="Movilidad" sub="Furca" render={indRow} />
          <PerioSectionHeaderRow text="Cara vestibular" />
          {buccalRows.map(r => (
            <Row key={'b-' + r.label} label={r.label} sub={r.sub} render={renderRow(r)} />
          ))}
          <PerioRowLabel title="" sub="" />
          <PerioToothCellRow {...commonProps} render={toothBuc} />
          <PerioRowLabel title="" sub="" />
          <PerioToothCellRow {...commonProps} render={toothLin} />
          <PerioSectionHeaderRow text="Cara palatina" />
          {lingualRows.map(r => (
            <Row key={'l-' + r.label} label={r.label} sub={r.sub} render={renderRow(r)} />
          ))}
        </>
      )}
      {arch === 'lower' && (
        <>
          <PerioSectionHeaderRow text="Cara lingual" />
          {[...lingualRows].reverse().map(r => (
            <Row key={'l-' + r.label} label={r.label} sub={r.sub} render={renderRow(r)} />
          ))}
          <PerioRowLabel title="" sub="" />
          <PerioToothCellRow {...commonProps} render={toothLin} />
          <PerioRowLabel title="" sub="" />
          <PerioToothCellRow {...commonProps} render={toothBuc} />
          {[...buccalRows].reverse().map(r => (
            <Row key={'b-' + r.label} label={r.label} sub={r.sub} render={renderRow(r)} />
          ))}
          <PerioSectionHeaderRow text="Cara vestibular" />
          <Row label="Movilidad" sub="Furca" render={indRow} />
          <Row label="Diente" sub="FDI" render={fdiRow} />
        </>
      )}
    </div>
  );
}

function PerioChart({ teeth, selection, setSelection }) {
  return (
    <div className="perio-chart-wrap">
      <div className="perio-chart-scroll">
        <div className="perio-arch-label">Arcada superior · Maxilar</div>
        <PerioArch arch="upper" teeth={teeth} selection={selection} setSelection={setSelection} />
        <div style={{ height: 18 }} />
        <div className="perio-arch-label">Arcada inferior · Mandíbula</div>
        <PerioArch arch="lower" teeth={teeth} selection={selection} setSelection={setSelection} />
      </div>
    </div>
  );
}

Object.assign(window, { PerioChart, PerioArch });
