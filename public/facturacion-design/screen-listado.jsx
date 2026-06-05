/* =========================================================
   screen-listado.jsx — Listado de facturas + Cuentas por cobrar
   ========================================================= */
function resumenServicios(f) {
  const n = f.lineas.reduce((s, l) => s + l.cant, 0);
  const first = f.lineas[0] ? f.lineas[0].nombre : '';
  return f.lineas.length > 1 ? first + ' +' + (f.lineas.length - 1) : first;
}

function Listado({ facturas, onOpen, onEmitir }) {
  const [filtro, setFiltro] = useState('todas');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = { todas: facturas.length, pendiente: 0, pagada: 0, vencida: 0, anulada: 0, parcial: 0 };
    facturas.forEach(f => { c[f.estado] = (c[f.estado] || 0) + 1; });
    return c;
  }, [facturas]);

  const filtrada = facturas.filter(f => {
    const p = paciente(f.pacienteId);
    const matchQ = !q || p.nombre.toLowerCase().includes(q.toLowerCase()) || correlativo(f.corr).includes(q) || (p.rtn || '').includes(q);
    let matchF = true;
    if (filtro === 'pendientes') matchF = f.estado === 'pendiente' || f.estado === 'parcial';
    else if (filtro === 'pagadas') matchF = f.estado === 'pagada';
    else if (filtro === 'vencidas') matchF = f.estado === 'vencida';
    else if (filtro === 'anuladas') matchF = f.estado === 'anulada';
    return matchQ && matchF;
  });

  const segs = [
    { k: 'todas', label: 'Todas', n: counts.todas },
    { k: 'pendientes', label: 'Pendientes', n: counts.pendiente + counts.parcial },
    { k: 'pagadas', label: 'Pagadas', n: counts.pagada },
    { k: 'vencidas', label: 'Vencidas', n: counts.vencida },
    { k: 'anuladas', label: 'Anuladas', n: counts.anulada },
  ];

  return (
    <div>
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div className="seg">
          {segs.map(s => (
            <button key={s.k} className={'seg__btn' + (filtro === s.k ? ' seg__btn--active' : '')} onClick={() => setFiltro(s.k)}>
              {s.label}<span className="seg__count">{s.n}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Buscar por paciente, RTN o N.º de factura" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>N.º de factura</th>
                <th>Paciente</th>
                <th>Fecha</th>
                <th>Servicios</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map(f => {
                const p = paciente(f.pacienteId);
                const t = totales(f.lineas);
                const sal = saldo(f);
                return (
                  <tr key={f.id} onClick={() => onOpen(f)}>
                    <td className="mono" style={{ color: 'var(--sd-blue-700)', fontWeight: 500 }}>{correlativo(f.corr)}</td>
                    <td>
                      <div className="cell-pac">
                        <Avatar nombre={p.nombre} size={34} />
                        <div>
                          <div className="cell-pac__name">{p.nombre}</div>
                          <div className="cell-pac__meta">{p.rtn || 'Consumidor final'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ color: 'var(--fg-muted)' }}>{fechaCorta(f.fecha)}</td>
                    <td style={{ maxWidth: 180, color: 'var(--fg-muted)' }}>{resumenServicios(f)}</td>
                    <td className="num" style={{ color: 'var(--fg-strong)', fontWeight: 600 }}>{L(t.total)}</td>
                    <td className="num" style={{ color: sal > 0 && f.estado !== 'anulada' ? 'var(--sd-alert-600)' : 'var(--fg-subtle)', fontWeight: 600 }}>
                      {f.estado === 'anulada' ? '—' : L(sal)}
                    </td>
                    <td><EstadoPill estado={f.estado} /></td>
                    <td style={{ textAlign: 'right' }}><Icon name="chevR" size={18} style={{ color: 'var(--fg-subtle)' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtrada.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            <Icon name="receipt" size={32} style={{ color: 'var(--sd-ink-300)' }} />
            <div style={{ marginTop: 10, fontSize: 'var(--t-15)' }}>Sin facturas que coincidan.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Cuentas por cobrar ---------- */
function Cuentas({ facturas, onOpen, onAbonar }) {
  // agrupa saldos por paciente
  const grupos = useMemo(() => {
    const map = {};
    facturas.filter(f => f.estado !== 'anulada' && saldo(f) > 0.01).forEach(f => {
      if (!map[f.pacienteId]) map[f.pacienteId] = { pac: paciente(f.pacienteId), facts: [], total: 0 };
      map[f.pacienteId].facts.push(f);
      map[f.pacienteId].total += saldo(f);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [facturas]);

  const totalGlobal = grupos.reduce((s, g) => s + g.total, 0);
  const [open, setOpen] = useState(grupos.length ? grupos[0].pac.id : null);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(180deg, var(--sd-blue-50), var(--bg-surface))' }}>
        <div className="card__body between" style={{ alignItems: 'center' }}>
          <div className="row" style={{ gap: 14 }}>
            <div className="stat__icon stat__icon--amber" style={{ width: 46, height: 46 }}><Icon name="clock" size={22} /></div>
            <div>
              <div className="mod-sub" style={{ marginTop: 0 }}>Saldo total por cobrar</div>
              <div className="mono" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-32)', fontWeight: 800, color: 'var(--fg-strong)', letterSpacing: 'var(--ls-tight)' }}>{L(totalGlobal)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mod-sub" style={{ marginTop: 0 }}>{grupos.length} pacientes con saldo</div>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--fg-muted)' }}>{grupos.reduce((s, g) => s + g.facts.length, 0)} facturas abiertas</div>
          </div>
        </div>
      </div>

      <div className="card">
        {grupos.map(g => {
          const isOpen = open === g.pac.id;
          return (
            <div key={g.pac.id} className="acc">
              <div className="acc__head" onClick={() => setOpen(isOpen ? null : g.pac.id)}>
                <div className="cell-pac" style={{ flex: 1 }}>
                  <Avatar nombre={g.pac.nombre} size={40} />
                  <div>
                    <div className="cell-pac__name" style={{ fontSize: 'var(--t-15)' }}>{g.pac.nombre}</div>
                    <div className="cell-pac__meta">{g.pac.rtn || 'Consumidor final'} · {g.pac.tel}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 18 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--sd-alert-600)' }}>{L(g.total)}</div>
                    <div style={{ fontSize: 'var(--t-12)', color: 'var(--fg-subtle)' }}>{g.facts.length} factura{g.facts.length > 1 ? 's' : ''}</div>
                  </div>
                  <Icon name="chevD" size={18} style={{ color: 'var(--fg-subtle)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-2)' }} />
                </div>
              </div>
              {isOpen && (
                <div className="acc__body">
                  {g.facts.map(f => (
                    <div key={f.id} className="acc__fact">
                      <div className="row" style={{ gap: 12, flex: 1, cursor: 'pointer' }} onClick={() => onOpen(f)}>
                        <Icon name="fileText" size={18} style={{ color: 'var(--fg-subtle)' }} />
                        <div>
                          <div className="mono" style={{ fontSize: 'var(--t-13)', color: 'var(--sd-blue-700)' }}>{correlativo(f.corr)}</div>
                          <div style={{ fontSize: 'var(--t-12)', color: 'var(--fg-subtle)' }}>Emitida {fechaCorta(f.fecha)} · vence {fechaCorta(f.venceEn)}</div>
                        </div>
                      </div>
                      <EstadoPill estado={f.estado} />
                      <div className="mono" style={{ fontWeight: 600, fontSize: 'var(--t-14)', width: 110, textAlign: 'right' }}>{L(saldo(f))}</div>
                      <Btn size="sm" variant="primary" icon="wallet" onClick={() => onAbonar(f)}>Cobrar</Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            <Icon name="checkCircle" size={32} style={{ color: 'var(--sd-vital-500)' }} />
            <div style={{ marginTop: 10, fontSize: 'var(--t-15)' }}>Sin pagos pendientes. Todo al día.</div>
          </div>
        )}
      </div>
    </div>
  );
}

const listStyle = document.createElement('style');
listStyle.textContent = `
.acc { border-bottom: 1px solid var(--border-soft); }
.acc:last-child { border-bottom: none; }
.acc__head { display: flex; align-items: center; gap: 14px; padding: 16px 22px; cursor: pointer; transition: background var(--dur-1); }
.acc__head:hover { background: var(--sd-ink-50); }
.acc__body { background: var(--sd-ink-50); border-top: 1px solid var(--border-soft); padding: 6px 22px 14px; }
.acc__fact { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border-soft); }
.acc__fact:last-child { border-bottom: none; }
`;
document.head.appendChild(listStyle);

Object.assign(window, { Listado, Cuentas, resumenServicios });
