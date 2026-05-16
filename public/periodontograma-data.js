/* =========================================================
   Periodontograma — data structures & empty initial state.
   Namespaced under window.PERIO_DATA to avoid colliding with
   the dental odontogram on the same page.
   ========================================================= */
(function () {
  const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const FDI = [...FDI_UPPER, ...FDI_LOWER];

  function toothType(fdi) {
    const n = fdi % 10;
    if (n === 1 || n === 2) return 'incisor';
    if (n === 3) return 'canine';
    if (n === 4 || n === 5) return 'premolar';
    return 'molar';
  }

  const SITES_B = ['DB', 'B', 'MB'];
  const SITES_L = ['DL', 'L', 'ML'];
  const ALL_SITES = [...SITES_B, ...SITES_L];

  function emptySites() {
    const o = {};
    ALL_SITES.forEach(s => (o[s] = { pd: 0, gm: 0, bop: false, plaque: false, sup: false }));
    return o;
  }

  function emptyTooth(fdi) {
    return {
      fdi,
      type: toothType(fdi),
      present: true,
      implant: false,
      mobility: 0,
      furcation: {},
      sites: emptySites(),
    };
  }

  function emptyTeeth() {
    const t = {};
    FDI.forEach(fdi => { t[fdi] = emptyTooth(fdi); });
    return t;
  }

  /* Hydrate a partial saved state into the canonical structure.
     Missing teeth / sites are filled in as empty so the chart never
     crashes on stale or partial data. */
  function hydrate(saved) {
    const teeth = emptyTeeth();
    if (!saved || typeof saved !== 'object') return teeth;
    Object.entries(saved).forEach(([fdi, s]) => {
      const k = Number(fdi);
      if (!teeth[k] || !s || typeof s !== 'object') return;
      const t = teeth[k];
      if (typeof s.present === 'boolean') t.present = s.present;
      if (typeof s.implant === 'boolean') t.implant = s.implant;
      if (typeof s.mobility === 'number') t.mobility = s.mobility;
      if (s.furcation && typeof s.furcation === 'object') t.furcation = { ...s.furcation };
      if (s.sites && typeof s.sites === 'object') {
        ALL_SITES.forEach(site => {
          const m = s.sites[site];
          if (!m) return;
          t.sites[site] = {
            pd: Number(m.pd) || 0,
            gm: Number(m.gm) || 0,
            bop: !!m.bop,
            plaque: !!m.plaque,
            sup: !!m.sup,
          };
        });
      }
    });
    return teeth;
  }

  window.PERIO_DATA = {
    FDI_UPPER, FDI_LOWER, FDI,
    SITES_B, SITES_L, ALL_SITES,
    toothType, emptyTooth, emptyTeeth, hydrate,
  };
})();
