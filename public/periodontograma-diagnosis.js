/* =========================================================
   Periodontograma — clinical calculations + AAP/EFP 2017 staging.
   Adapted from the Claude Design bundle; namespaced as PERIO_DX.
   ========================================================= */
(function () {
  const { ALL_SITES } = window.PERIO_DATA;

  function siteList(teeth) {
    const list = [];
    Object.values(teeth).forEach(t => {
      if (!t.present) return;
      ALL_SITES.forEach(site => {
        const m = t.sites[site];
        list.push({ fdi: t.fdi, site, ...m, type: t.type, implant: t.implant });
      });
    });
    return list;
  }

  function cal(m) {
    return (m.pd || 0) + (m.gm || 0);
  }

  function stats(teeth) {
    const all = siteList(teeth);
    const measured = all.filter(s => s.pd > 0);
    const total = measured.length;

    const presentTeeth = Object.values(teeth).filter(t => t.present).length;
    const totalTeeth = Object.keys(teeth).length;
    const lostTeeth = totalTeeth - presentTeeth;

    if (!total) {
      return {
        bopPct: 0, plaquePct: 0, supCount: 0,
        pdMean: 0, pdMax: 0, calMean: 0, calMax: 0,
        totalSites: 0, totalSitesAll: all.length,
        presentTeeth, lostTeeth,
        sites4: 0, sites5: 0, sites6: 0, sites7: 0,
        pct4: 0, pct6: 0,
      };
    }

    const bopCount = measured.filter(s => s.bop).length;
    const plaqueCount = measured.filter(s => s.plaque).length;
    const supCount = measured.filter(s => s.sup).length;

    const pdSum = measured.reduce((a, s) => a + s.pd, 0);
    const pdMax = measured.reduce((a, s) => Math.max(a, s.pd), 0);
    const calSum = measured.reduce((a, s) => a + cal(s), 0);
    const calMax = measured.reduce((a, s) => Math.max(a, cal(s)), 0);

    const sites4 = measured.filter(s => s.pd >= 4).length;
    const sites5 = measured.filter(s => s.pd >= 5).length;
    const sites6 = measured.filter(s => s.pd >= 6).length;
    const sites7 = measured.filter(s => s.pd >= 7).length;

    return {
      bopPct: (bopCount / total) * 100,
      plaquePct: (plaqueCount / total) * 100,
      supCount,
      pdMean: pdSum / total,
      pdMax,
      calMean: calSum / total,
      calMax,
      totalSites: total,
      totalSitesAll: all.length,
      presentTeeth,
      lostTeeth,
      sites4, sites5, sites6, sites7,
      pct4: (sites4 / total) * 100,
      pct6: (sites6 / total) * 100,
    };
  }

  function stage(teeth, st) {
    if (st.totalSites === 0) {
      return { stage: '—', extent: '—', interproxCalMax: 0, lossPct: 0 };
    }
    const sites = siteList(teeth).filter(s => s.pd > 0);
    const interprox = sites.filter(s => s.site !== 'B' && s.site !== 'L');
    const interproxCalMax = interprox.reduce((a, s) => Math.max(a, cal(s)), 0);

    let stageVal = '—';
    if (interproxCalMax >= 1 && interproxCalMax <= 2) stageVal = 'I';
    if (interproxCalMax >= 3 && interproxCalMax <= 4) stageVal = 'II';
    if (interproxCalMax >= 5) stageVal = 'III';
    if (st.lostTeeth >= 5 || st.pdMax >= 8) stageVal = 'IV';

    const teethWithLoss = Object.values(teeth).filter(t => {
      if (!t.present) return false;
      return ALL_SITES.some(s => t.sites[s].pd > 0 && cal(t.sites[s]) >= 3);
    }).length;
    const presentCount = Math.max(1, st.presentTeeth);
    const lossPct = (teethWithLoss / presentCount) * 100;
    const extent = lossPct >= 30 ? 'generalizada' : 'localizada';

    return { stage: stageVal, extent, interproxCalMax, lossPct };
  }

  function grade(teeth, st, ctx) {
    if (st.totalSites === 0) {
      return { grade: '—', baseGrade: '—', calOverAge: 0, drivers: [] };
    }
    const age = (ctx && ctx.age) || 40;
    const calOverAge = st.calMax / Math.max(age, 1);
    let baseGrade = 'A';
    if (calOverAge >= 0.25 && calOverAge <= 1.0) baseGrade = 'B';
    if (calOverAge > 1.0) baseGrade = 'C';

    let gradeVal = baseGrade;
    const drivers = [];
    if (ctx && ctx.smoker) {
      gradeVal = 'C';
      drivers.push('tabaquismo activo');
    }
    if (ctx && ctx.hba1c != null) {
      if (ctx.hba1c >= 7.0) {
        gradeVal = 'C';
        drivers.push(`HbA1c ${ctx.hba1c} %`);
      } else if (gradeVal === 'A') {
        gradeVal = 'B';
        drivers.push(`HbA1c ${ctx.hba1c} %`);
      }
    }
    return { grade: gradeVal, baseGrade, calOverAge, drivers };
  }

  function diagnose(teeth, ctx) {
    const st = stats(teeth);
    const stg = stage(teeth, st);
    const grd = grade(teeth, st, ctx || {});
    return {
      label: st.totalSites === 0
        ? 'Sin mediciones registradas'
        : `Periodontitis · Estadio ${stg.stage} · Grado ${grd.grade} · ${stg.extent}`,
      ...st, ...stg, ...grd,
    };
  }

  function pdCategory(pd) {
    if (!pd) return 'empty';
    if (pd <= 3) return 'shallow';
    if (pd <= 5) return 'moderate';
    return 'deep';
  }

  window.PERIO_DX = { stats, stage, grade, diagnose, cal, pdCategory };
})();
