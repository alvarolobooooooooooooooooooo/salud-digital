/* =========================================================
   screen-emitir.jsx — Emitir factura desde una cita
   ========================================================= */
function EmitirFactura({ citas, preCita, onClose, onEmit }) {
  const [cita, setCita] = useState(preCita || null);
  const [lineas, setLineas] = useState([]);
  const [tipoVenta, setTipoVenta] = useState('contado');
  const [rtn, setRtn] = useState('');
  const [nombre, setNombre] = useState('');
  const [addId, setAddId] = useState('');

  useEffect(() => {
    if (cita) {
      const p = paciente(cita.pacienteId);
      setLineas(cita.servicios.map(s => ({ ...s })));
      setRtn(p.rtn || '');
      setNombre(p.nombre);
    }
  }, [cita]);

  const t = totales(lineas);
  const pac = cita ? paciente(cita.pacienteId) : null;

  function setCant(i, v) {
    const n = Math.max(1, parseInt(v) || 1);
    setLineas(ls => ls.map((l, idx) => idx === i ? { ...l, cant: n } : l));
  }
  function quitar(i) { setLineas(ls => ls.filter((_, idx) => idx !== i)); }
  function agregar() {
    if (!addId) return;
    const s = SERVICIOS.find(x => x.id === addId);
    setLineas(ls => {
      const ex = ls.findIndex(l => l.id === s.id);
      if (ex >= 0) return ls.map((l, idx) => idx === ex ? { ...l, cant: l.cant + 1 } : l);
      return [...ls, { ...s, cant: 1 }];
    });
    setAddId('');
  }

  /* --- Paso 1: elegir cita --- */
  if (!cita) {
    return (
      <Overlay onClose={onClose} drawer wide>
        <div className="ov-head">
          <div>
            <h2 className="ov-title">Emitir factura</h2>
            <div className="mod-sub" style={{ marginTop: 2 }}>Elija la consulta atendida a facturar</div>
          </div>
          <button className="ov-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="ov-body">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Citas atendidas · pendientes de facturar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {citas.map(c => {
              const p = paciente(c.pacienteId);
              const ct = totales(c.servicios.map(s => ({ ...s })));
              return (
                <button key={c.id} className="cita-card" onClick={() => setCita(c)}>
                  <Avatar nombre={p.nombre} size={42} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: 'var(--fg-strong)', fontSize: 'var(--t-15)' }}>{p.nombre}</div>
                    <div style={{ fontSize: 'var(--t-13)', color: 'var(--fg-muted)' }}>
                      {c.motivo} · {MEDICOS[c.medico]}
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 'var(--t-12)', color: 'var(--fg-subtle)' }}>
                      <Icon name="calendar" size={13} />{fechaCorta(c.fecha)} · {c.hora}
                      <span style={{ margin: '0 2px' }}>·</span>
                      <Icon name="stethoscope" size={13} />{c.servicios.length} servicio{c.servicios.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{L(ct.total)}</div>
                    <span className="row" style={{ gap: 5, justifyContent: 'flex-end', color: 'var(--sd-blue-700)', fontSize: 'var(--t-13)', fontWeight: 600, marginTop: 4 }}>
                      Facturar <Icon name="chevR" size={15} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Overlay>
    );
  }

  /* --- Paso 2: construir factura --- */
  return (
    <Overlay onClose={onClose} drawer wide>
      <div className="ov-head">
        <div className="row" style={{ gap: 12 }}>
          <button className="ov-close" onClick={() => setCita(null)}><Icon name="arrowL" size={18} /></button>
          <div>
            <h2 className="ov-title">Nueva factura</h2>
            <div className="mod-sub" style={{ marginTop: 2 }}>Próximo correlativo <span className="mono" style={{ color: 'var(--sd-blue-700)' }}>{correlativo(CAI_ACTUAL.emitidas + 1)}</span></div>
          </div>
        </div>
        <button className="ov-close" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>

      <div className="emit-grid">
        {/* columna izquierda: datos */}
        <div className="ov-body" style={{ paddingBottom: 8 }}>
          {/* origen cita */}
          <div className="origin-tag">
            <Icon name="link" size={15} />
            Facturando consulta del {fechaCorta(cita.fecha)} · {cita.motivo} · {MEDICOS[cita.medico]}
          </div>

          {/* cliente */}
          <div className="eyebrow" style={{ margin: '20px 0 12px' }}>Datos del cliente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nombre / razón social" required>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
            </Field>
            <Field label="RTN o identidad" hint={rtn ? '' : 'Sin RTN se emite como consumidor final'}>
              <input className="input input--mono" value={rtn} onChange={e => setRtn(e.target.value)} placeholder="0000-0000-00000" />
            </Field>
          </div>

          {/* tipo de venta */}
          <div className="eyebrow" style={{ margin: '22px 0 12px' }}>Condición de venta</div>
          <div className="seg" style={{ width: '100%' }}>
            {[['contado', 'Contado', 'cash'], ['credito', 'Crédito', 'clock']].map(([k, lbl, ic]) => (
              <button key={k} className={'seg__btn' + (tipoVenta === k ? ' seg__btn--active' : '')} style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setTipoVenta(k)}>
                <Icon name={ic} size={16} />{lbl}
              </button>
            ))}
          </div>

          {/* servicios */}
          <div className="eyebrow" style={{ margin: '22px 0 12px' }}>Detalle de servicios</div>
          <div className="line-tbl">
            <div className="line-head">
              <span>Descripción</span>
              <span style={{ textAlign: 'center' }}>Cant.</span>
              <span style={{ textAlign: 'right' }}>P. unit.</span>
              <span style={{ textAlign: 'right' }}>Importe</span>
              <span></span>
            </div>
            {lineas.map((l, i) => (
              <div key={i} className="line-row">
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--fg-strong)', fontSize: 'var(--t-14)' }}>{l.nombre}</div>
                  <span className={'tax-tag ' + (l.exento ? 'tax-tag--ex' : 'tax-tag--gr')}>{l.exento ? 'Exento ISV' : 'Gravado 15%'}</span>
                </div>
                <input className="input qty" type="number" min="1" value={l.cant} onChange={e => setCant(i, e.target.value)} />
                <div className="mono lr-num">{L(l.precio)}</div>
                <div className="mono lr-num" style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{L(l.precio * l.cant)}</div>
                <button className="line-del" onClick={() => quitar(i)} title="Quitar"><Icon name="trash" size={16} /></button>
              </div>
            ))}
            {lineas.length === 0 && <div style={{ padding: '18px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 'var(--t-13)' }}>Agregue al menos un servicio.</div>}
          </div>

          {/* agregar servicio */}
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <select className="select" value={addId} onChange={e => setAddId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Agregar otro servicio o producto…</option>
              {SERVICIOS.map(s => <option key={s.id} value={s.id}>{s.nombre} — {L(s.precio)}{s.exento ? '' : ' +ISV'}</option>)}
            </select>
            <Btn variant="secondary" icon="plus" onClick={agregar} disabled={!addId}>Agregar</Btn>
          </div>
        </div>

        {/* columna derecha: totales (sticky) */}
        <div className="emit-side">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Resumen fiscal</div>
          <div className="tot-row"><span>Importe exento</span><span className="mono">{L(t.exento)}</span></div>
          <div className="tot-row"><span>Importe gravado 15%</span><span className="mono">{L(t.gravado)}</span></div>
          <div className="tot-row"><span>Subtotal</span><span className="mono">{L(t.subtotal)}</span></div>
          <div className="tot-row"><span>ISV 15%</span><span className="mono">{L(t.isv)}</span></div>
          <div className="divider" style={{ margin: '12px 0' }} />
          <div className="tot-row tot-row--big"><span>Total a pagar</span><span className="mono">{L(t.total)}</span></div>
          <div className="cantidad-letras">{numeroALetras(t.total)}</div>

          <div className="cai-mini">
            <div className="row between" style={{ marginBottom: 6 }}><span>CAI</span><span className="pill pill--vital" style={{ padding: '2px 8px' }}><span className="pill__dot" />Vigente</span></div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', wordBreak: 'break-all' }}>{CAI_ACTUAL.codigo}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>Fecha límite de emisión: {fechaSlash(CAI_ACTUAL.fechaLimite)}</div>
          </div>

          <Btn variant="primary" size="lg" full icon="receipt" onClick={() => onEmit({ cita, lineas, tipoVenta, rtn, nombre })} disabled={lineas.length === 0}>
            Emitir factura · {L(t.total).replace('L ', 'L')}
          </Btn>
          <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
            Se asignará el correlativo <span className="mono">{correlativo(CAI_ACTUAL.emitidas + 1)}</span> y la cita quedará facturada.
          </div>
        </div>
      </div>
    </Overlay>
  );
}

const emitStyle = document.createElement('style');
emitStyle.textContent = `
.cita-card { display: flex; align-items: center; gap: 14px; width: 100%; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-lg); padding: 16px; cursor: pointer; transition: all var(--dur-2) var(--ease-out); font-family: var(--font-body); }
.cita-card:hover { border-color: var(--sd-blue-400); background: var(--sd-blue-50); }
.emit-grid { display: grid; grid-template-columns: 1fr 320px; align-items: start; }
.emit-side { position: sticky; top: 73px; align-self: start; background: var(--bg-surface); border-left: 1px solid var(--border-default); padding: 24px; min-height: calc(100vh - 73px); }
.origin-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--sd-blue-100); color: var(--sd-blue-700); font-size: var(--t-13); font-weight: 600; padding: 9px 14px; border-radius: var(--r-md); }
.line-tbl { border: 1px solid var(--border-default); border-radius: var(--r-md); overflow: hidden; }
.line-head, .line-row { display: grid; grid-template-columns: 1fr 64px 92px 100px 36px; align-items: center; gap: 8px; padding: 10px 14px; }
.line-head { background: var(--sd-ink-50); font-size: var(--t-12); font-weight: 700; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border-default); }
.line-row { border-bottom: 1px solid var(--border-soft); }
.line-row:last-child { border-bottom: none; }
.line-tbl .qty { width: 100%; text-align: center; padding: 7px 4px; font-family: var(--font-mono); -moz-appearance: textfield; }
.line-tbl .qty::-webkit-outer-spin-button, .line-tbl .qty::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.lr-num { text-align: right; font-size: var(--t-13); color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.line-del { appearance: none; border: none; background: none; color: var(--fg-subtle); cursor: pointer; display: grid; place-items: center; padding: 6px; border-radius: var(--r-sm); transition: all var(--dur-1); }
.line-del:hover { background: var(--sd-critical-100); color: var(--sd-critical-600); }
.tax-tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: var(--r-pill); margin-top: 4px; letter-spacing: .02em; }
.tax-tag--ex { background: var(--sd-ink-100); color: var(--sd-ink-500); }
.tax-tag--gr { background: var(--sd-blue-100); color: var(--sd-blue-700); }
.tot-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--t-14); color: var(--fg-muted); padding: 5px 0; }
.tot-row .mono { color: var(--fg-default); font-variant-numeric: tabular-nums; }
.tot-row--big { font-size: var(--t-16); font-weight: 700; color: var(--fg-strong); }
.tot-row--big .mono { font-size: var(--t-20); color: var(--fg-strong); font-weight: 700; }
.cantidad-letras { font-size: 11px; color: var(--fg-subtle); text-transform: uppercase; letter-spacing: .03em; line-height: 1.4; margin: 6px 0 18px; }
.cai-mini { background: var(--sd-ink-50); border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 12px 14px; font-size: var(--t-13); margin-bottom: 18px; }
@media (max-width: 860px) { .emit-grid { grid-template-columns: 1fr; } .emit-side { position: static; min-height: 0; border-left: none; border-top: 1px solid var(--border-default); } }
`;
document.head.appendChild(emitStyle);

window.EmitirFactura = EmitirFactura;
