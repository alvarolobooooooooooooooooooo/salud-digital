/* =========================================================
   screen-dashboard.jsx — Resumen financiero
   ========================================================= */
function Dashboard({ facturas, onOpen, onEmitir }) {
  // métricas derivadas
  const vivas = facturas.filter(f => f.estado !== 'anulada');
  const cobrado = f => {
    const ab = abonado(f);
    if (ab > 0) return ab;
    return f.estado === 'pagada' ? totales(f.lineas).total : 0;
  };
  const ingresos = vivas.reduce((s, f) => s + cobrado(f), 0);
  const porCobrar = vivas.filter(f => f.estado !== 'pagada').reduce((s, f) => s + saldo(f), 0);
  const isvRecaudado = vivas.reduce((s, f) => s + totales(f.lineas).isv, 0);
  const vencidas = vivas.filter(f => f.estado === 'vencida');

  // ingresos por día (últimos 7 días simulados)
  const serie = [
    { d: 'Lun', v: 3200 }, { d: 'Mar', v: 4100 }, { d: 'Mié', v: 2750 },
    { d: 'Jue', v: 5400 }, { d: 'Vie', v: 4850 }, { d: 'Sáb', v: 6100 }, { d: 'Hoy', v: 3680 },
  ];
  const maxV = Math.max(...serie.map(s => s.v));

  // formas de pago
  const pagosMap = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  vivas.forEach(f => {
    if (f.abonos && f.abonos.length) {
      f.abonos.forEach(a => { pagosMap[a.metodo] = (pagosMap[a.metodo] || 0) + a.monto; });
    } else if (f.estado === 'pagada' && f.formaPago && f.formaPago !== 'mixto') {
      pagosMap[f.formaPago] = (pagosMap[f.formaPago] || 0) + totales(f.lineas).total;
    }
  });
  const totPagos = Object.values(pagosMap).reduce((a, b) => a + b, 0) || 1;
  const pagoMeta = {
    efectivo: { label: 'Efectivo', icon: 'cash', color: 'var(--sd-vital-500)' },
    tarjeta: { label: 'Tarjeta', icon: 'card', color: 'var(--sd-blue-600)' },
    transferencia: { label: 'Transferencia', icon: 'bank', color: 'var(--sd-navy-600)' },
  };

  const pendientes = vivas.filter(f => f.estado === 'pendiente' || f.estado === 'parcial' || f.estado === 'vencida')
    .sort((a, b) => new Date(a.venceEn) - new Date(b.venceEn));

  const usoPct = Math.round((CAI_ACTUAL.emitidas / CAI_ACTUAL.total) * 100);

  return (
    <div>
      {/* KPIs */}
      <div className="stat-grid">
        <StatCard icon="coins" tint="green" label="Ingresos cobrados · junio" value={L(ingresos)} delta="+12.4%" deltaDir="up" sub="vs. mayo" />
        <StatCard icon="clock" tint="amber" label="Por cobrar" value={L(porCobrar)} sub={pendientes.length + ' facturas abiertas'} />
        <StatCard icon="percent" tint="blue" label="ISV 15% recaudado" value={L(isvRecaudado)} sub="declarable al SAR" />
        <StatCard icon="receipt" tint="navy" label="Facturas emitidas" value={String(vivas.length)} sub={vencidas.length + ' vencidas'} />
      </div>

      {/* fila media */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
        {/* gráfico ingresos */}
        <div className="card">
          <div className="card__head">
            <div>
              <h3 className="card__title">Ingresos de la semana</h3>
              <div className="mod-sub">Pagos registrados por día</div>
            </div>
            <span className="pill pill--vital"><Icon name="trending" size={14} />+18% semana</span>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 168, padding: '0 4px' }}>
              {serie.map((s, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <div className="bar-val">{L(s.v).replace('L ', 'L')}</div>
                  <div style={{
                    width: '100%', maxWidth: 46, height: (s.v / maxV * 100) + '%',
                    background: i === serie.length - 1 ? 'var(--sd-blue-600)' : 'var(--sd-blue-300)',
                    borderRadius: '6px 6px 0 0', minHeight: 6, transition: 'height .4s var(--ease-out)',
                  }} />
                  <div style={{ fontSize: 'var(--t-12)', color: 'var(--fg-muted)', fontWeight: 600 }}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* formas de pago */}
        <div className="card">
          <div className="card__head"><h3 className="card__title">Formas de pago</h3></div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(pagoMeta).map(k => {
              const pct = Math.round(pagosMap[k] / totPagos * 100);
              const m = pagoMeta[k];
              return (
                <div key={k}>
                  <div className="between" style={{ marginBottom: 7 }}>
                    <span className="row" style={{ fontSize: 'var(--t-14)', fontWeight: 600 }}>
                      <Icon name={m.icon} size={17} style={{ color: m.color }} />{m.label}
                    </span>
                    <span className="mono" style={{ fontSize: 'var(--t-13)', color: 'var(--fg-strong)' }}>{L(pagosMap[k])}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--sd-ink-100)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: m.color, borderRadius: 'var(--r-pill)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* fila inferior */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* pendientes próximos a vencer */}
        <div className="card">
          <div className="card__head">
            <h3 className="card__title">Pendientes de cobro</h3>
            <span className="muted" style={{ fontSize: 'var(--t-13)' }}>{pendientes.length} facturas</span>
          </div>
          <div>
            {pendientes.slice(0, 4).map(f => {
              const p = paciente(f.pacienteId);
              return (
                <div key={f.id} className="pend-row" onClick={() => onOpen(f)}>
                  <Avatar nombre={p.nombre} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{p.nombre}</div>
                    <div className="mono" style={{ fontSize: 'var(--t-12)', color: 'var(--fg-subtle)' }}>{correlativo(f.corr)} · vence {fechaCorta(f.venceEn)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 600, fontSize: 'var(--t-14)' }}>{L(saldo(f))}</div>
                    <EstadoPill estado={f.estado} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* estado CAI */}
        <div className="card">
          <div className="card__head"><h3 className="card__title">Autorización de facturación (CAI)</h3></div>
          <div className="card__body">
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <span className="pill pill--vital"><span className="pill__dot" />Vigente</span>
              <span className="muted" style={{ fontSize: 'var(--t-13)' }}>vence {fechaCorta(CAI_ACTUAL.fechaLimite)}</span>
            </div>
            <div style={{ fontSize: 'var(--t-12)', color: 'var(--fg-muted)', marginBottom: 4 }}>Código CAI</div>
            <div className="mono" style={{ fontSize: 'var(--t-13)', color: 'var(--fg-strong)', wordBreak: 'break-all', marginBottom: 16 }}>{CAI_ACTUAL.codigo}</div>
            <div className="between" style={{ marginBottom: 7 }}>
              <span style={{ fontSize: 'var(--t-13)', fontWeight: 600 }}>Correlativos utilizados</span>
              <span className="mono" style={{ fontSize: 'var(--t-13)' }}>{CAI_ACTUAL.emitidas.toLocaleString()} / {CAI_ACTUAL.total.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, background: 'var(--sd-ink-100)', borderRadius: 'var(--r-pill)', overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: Math.max(usoPct, 1.5) + '%', height: '100%', background: 'var(--sd-blue-600)', borderRadius: 'var(--r-pill)' }} />
            </div>
            <div style={{ fontSize: 'var(--t-12)', color: 'var(--fg-muted)', lineHeight: 'var(--lh-normal)' }}>
              Rango autorizado <span className="mono" style={{ color: 'var(--fg-default)' }}>{CAI_ACTUAL.rangoDesde}</span> al <span className="mono" style={{ color: 'var(--fg-default)' }}>{CAI_ACTUAL.rangoHasta}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const dashStyle = document.createElement('style');
dashStyle.textContent = `
.bar-val { font-family: var(--font-mono); font-size: 11px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; }
.pend-row { display: flex; align-items: center; gap: 12px; padding: 13px 22px; border-bottom: 1px solid var(--border-soft); cursor: pointer; transition: background var(--dur-1); }
.pend-row:last-child { border-bottom: none; }
.pend-row:hover { background: var(--sd-blue-50); }
`;
document.head.appendChild(dashStyle);

window.Dashboard = Dashboard;
