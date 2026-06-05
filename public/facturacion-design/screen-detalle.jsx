/* =========================================================
   screen-detalle.jsx — Detalle de factura (formato SAR) + acciones
   ========================================================= */
function FacturaDetalle({ factura, onClose, onAnular, onCobrar }) {
  const [confirmAnula, setConfirmAnula] = useState(false);
  const [motivo, setMotivo] = useState('');
  const f = factura;
  const p = paciente(f.pacienteId);
  const t = totales(f.lineas);
  const ab = abonado(f);
  const sal = saldo(f);
  const anulada = f.estado === 'anulada';

  return (
    <Overlay onClose={onClose} drawer wide>
      {/* barra de acciones */}
      <div className="ov-head">
        <div className="row" style={{ gap: 12 }}>
          <button className="ov-close" onClick={onClose}><Icon name="arrowL" size={18} /></button>
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h2 className="ov-title">Factura {correlativo(f.corr)}</h2>
              <EstadoPill estado={f.estado} />
            </div>
            <div className="mod-sub" style={{ marginTop: 2 }}>{p.nombre} · emitida {fechaCorta(f.fecha)}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Btn variant="secondary" size="sm" icon="printer" onClick={() => window.print()}>Imprimir</Btn>
          <Btn variant="secondary" size="sm" icon="download" onClick={() => window.print()}>PDF</Btn>
          {!anulada && sal > 0.01 && <Btn variant="primary" size="sm" icon="wallet" onClick={() => onCobrar(f)}>Registrar pago</Btn>}
          {!anulada && <Btn variant="danger" size="sm" icon="ban" onClick={() => setConfirmAnula(true)}>Anular</Btn>}
        </div>
      </div>

      <div className="ov-body" style={{ background: 'var(--sd-ink-100)' }}>
        {/* ===== PAPEL FACTURA ===== */}
        <div className="factura-paper">
          {anulada && <div className="anulada-stamp">ANULADA</div>}

          {/* encabezado emisor */}
          <div className="fp-head">
            <div className="fp-emisor">
              <div className="fp-logo">
                <svg viewBox="0 0 200 200" width="38" height="38" aria-hidden="true">
                  <rect x="78" y="6" width="64" height="92" rx="28" fill="#0080B0"></rect>
                  <rect x="102" y="78" width="92" height="64" rx="28" fill="#0080B0"></rect>
                  <rect x="78" y="102" width="64" height="92" rx="28" fill="#0080B0"></rect>
                  <rect x="6" y="78" width="92" height="64" rx="28" fill="#002A60"></rect>
                  <rect x="86" y="86" width="28" height="28" fill="#fff"></rect>
                </svg>
              </div>
              <div>
                <div className="fp-emisor-name">{EMISOR.nombre}</div>
                <div className="fp-emisor-meta">RTN <span className="mono">{EMISOR.rtn}</span></div>
                <div className="fp-emisor-meta">{EMISOR.direccion}</div>
                <div className="fp-emisor-meta">{EMISOR.tel} · {EMISOR.correo}</div>
              </div>
            </div>
            <div className="fp-doc">
              <div className="fp-doc-type">Factura</div>
              <div className="fp-doc-num mono">{correlativo(f.corr)}</div>
              <div className="fp-doc-line">Casa Matriz · Punto de emisión {EMISOR.puntoEmision}</div>
            </div>
          </div>

          <div className="fp-cai">
            <div><span className="fp-cai-k">C.A.I.</span><span className="mono fp-cai-v">{CAI_ACTUAL.codigo}</span></div>
            <div><span className="fp-cai-k">Rango autorizado</span><span className="mono fp-cai-v">{CAI_ACTUAL.rangoDesde} al {CAI_ACTUAL.rangoHasta}</span></div>
            <div><span className="fp-cai-k">Fecha límite de emisión</span><span className="mono fp-cai-v">{fechaSlash(CAI_ACTUAL.fechaLimite)}</span></div>
          </div>

          {/* cliente + meta */}
          <div className="fp-cliente">
            <div className="fp-cl-grid">
              <div><span className="fp-k">Cliente</span><span className="fp-v">{p.nombre}</span></div>
              <div><span className="fp-k">Fecha de emisión</span><span className="fp-v mono">{fechaSlash(f.fecha)}</span></div>
              <div><span className="fp-k">RTN / Identidad</span><span className="fp-v mono">{p.rtn || 'Consumidor final'}</span></div>
              <div><span className="fp-k">Condición</span><span className="fp-v">{f.tipoVenta === 'credito' ? 'Crédito' : 'Contado'}</span></div>
              <div><span className="fp-k">Atendido por</span><span className="fp-v">{MEDICOS[f.medico]}</span></div>
              <div><span className="fp-k">N.º de orden / cita</span><span className="fp-v mono">{f.citaRef || ('CITA-' + f.corr)}</span></div>
            </div>
          </div>

          {/* líneas */}
          <table className="fp-tbl">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>Cant.</th>
                <th>Descripción</th>
                <th style={{ width: 90, textAlign: 'right' }}>P. unit.</th>
                <th style={{ width: 95, textAlign: 'right' }}>Exento</th>
                <th style={{ width: 95, textAlign: 'right' }}>Gravado 15%</th>
              </tr>
            </thead>
            <tbody>
              {f.lineas.map((l, i) => (
                <tr key={i}>
                  <td className="mono" style={{ textAlign: 'center' }}>{l.cant}</td>
                  <td>{l.nombre}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{L(l.precio)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{l.exento ? L(l.precio * l.cant) : '—'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{l.exento ? '—' : L(l.precio * l.cant)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* totales */}
          <div className="fp-foot">
            <div className="fp-letras">
              <span className="fp-k">Cantidad en letras</span>
              <span className="fp-letras-v">{numeroALetras(t.total)}</span>
              <div className="fp-legend">
                Esta factura es válida por 30 días. <br />
                "La factura es beneficio de todos, exíjala."
              </div>
            </div>
            <div className="fp-tots">
              <div className="fp-tot"><span>Importe exento</span><span className="mono">{L(t.exento)}</span></div>
              <div className="fp-tot"><span>Importe gravado 15%</span><span className="mono">{L(t.gravado)}</span></div>
              <div className="fp-tot"><span>Descuento</span><span className="mono">{L(0)}</span></div>
              <div className="fp-tot"><span>Subtotal</span><span className="mono">{L(t.subtotal)}</span></div>
              <div className="fp-tot"><span>ISV 15%</span><span className="mono">{L(t.isv)}</span></div>
              <div className="fp-tot fp-tot--total"><span>Total</span><span className="mono">{L(t.total)}</span></div>
            </div>
          </div>
        </div>

        {/* ===== estado de pago / abonos (fuera del papel) ===== */}
        {!anulada && (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card__head">
              <h3 className="card__title">Estado de pago</h3>
              {sal <= 0.01
                ? <span className="pill pill--vital"><Icon name="check" size={13} />Pagada en su totalidad</span>
                : <span className="pill pill--alert"><span className="pill__dot" />Saldo {L(sal)}</span>}
            </div>
            <div className="card__body">
              <div className="pay-summary">
                <div><span className="fp-k">Total factura</span><span className="mono pay-amt">{L(t.total)}</span></div>
                <div><span className="fp-k">Abonado</span><span className="mono pay-amt" style={{ color: 'var(--sd-vital-600)' }}>{L(ab)}</span></div>
                <div><span className="fp-k">Saldo pendiente</span><span className="mono pay-amt" style={{ color: sal > 0.01 ? 'var(--sd-alert-600)' : 'var(--fg-subtle)' }}>{L(sal)}</span></div>
              </div>
              {(f.abonos && f.abonos.length > 0) && (
                <div style={{ marginTop: 16 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Historial de abonos</div>
                  {f.abonos.map((a, i) => (
                    <div key={i} className="abono-row">
                      <Icon name={a.metodo === 'efectivo' ? 'cash' : a.metodo === 'tarjeta' ? 'card' : 'bank'} size={17} style={{ color: 'var(--sd-blue-600)' }} />
                      <span style={{ flex: 1, textTransform: 'capitalize', fontSize: 'var(--t-14)' }}>{a.metodo}</span>
                      <span className="mono" style={{ fontSize: 'var(--t-12)', color: 'var(--fg-subtle)' }}>{fechaCorta(a.fecha)}</span>
                      <span className="mono" style={{ fontWeight: 600, width: 100, textAlign: 'right' }}>{L(a.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
              {sal > 0.01 && (
                <Btn variant="primary" icon="wallet" onClick={() => onCobrar(f)} full>Registrar pago · saldo {L(sal)}</Btn>
              )}
            </div>
          </div>
        )}
        {anulada && f.motivoAnula && (
          <div className="card" style={{ marginTop: 18, borderColor: 'var(--sd-critical-100)' }}>
            <div className="card__body row" style={{ gap: 12, color: 'var(--sd-critical-600)' }}>
              <Icon name="ban" size={20} />
              <div><b>Factura anulada.</b> <span className="muted">Motivo: {f.motivoAnula}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* confirmación de anulación */}
      {confirmAnula && (
        <Overlay onClose={() => setConfirmAnula(false)}>
          <div className="ov-head"><h2 className="ov-title">Anular factura {correlativo(f.corr)}</h2><button className="ov-close" onClick={() => setConfirmAnula(false)}><Icon name="x" size={18} /></button></div>
          <div className="ov-body">
            <p style={{ fontSize: 'var(--t-14)', color: 'var(--fg-muted)', marginTop: 0, lineHeight: 'var(--lh-normal)' }}>
              La factura se marcará como anulada ante el SAR. El correlativo <span className="mono">{correlativo(f.corr)}</span> no podrá reutilizarse. Esta acción queda registrada en la bitácora.
            </p>
            <Field label="Motivo de anulación" required>
              <textarea className="textarea" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Error en datos del cliente" />
            </Field>
          </div>
          <div className="ov-foot">
            <Btn variant="ghost" onClick={() => setConfirmAnula(false)}>Cancelar</Btn>
            <Btn variant="danger" icon="ban" disabled={!motivo.trim()} onClick={() => { onAnular(f, motivo.trim()); setConfirmAnula(false); }}>Confirmar anulación</Btn>
          </div>
        </Overlay>
      )}
    </Overlay>
  );
}

const detStyle = document.createElement('style');
detStyle.textContent = `
.factura-paper { background: #fff; border: 1px solid var(--border-default); border-radius: var(--r-md); padding: 32px 34px; box-shadow: var(--shadow-md); position: relative; max-width: 720px; margin: 0 auto; }
.anulada-stamp { position: absolute; top: 46%; left: 50%; transform: translate(-50%,-50%) rotate(-14deg); font-family: var(--font-display); font-size: 84px; font-weight: 800; color: rgba(218,69,58,.14); border: 6px solid rgba(218,69,58,.18); border-radius: 14px; padding: 4px 28px; letter-spacing: .04em; pointer-events: none; z-index: 3; }
.fp-head { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid var(--sd-navy-700); }
.fp-emisor { display: flex; gap: 14px; }
.fp-logo { flex: none; }
.fp-emisor-name { font-family: var(--font-display); font-weight: 800; font-size: var(--t-16); color: var(--sd-navy-700); letter-spacing: var(--ls-tight); }
.fp-emisor-meta { font-size: 11.5px; color: var(--fg-muted); line-height: 1.5; max-width: 280px; }
.fp-doc { text-align: right; flex: none; }
.fp-doc-type { font-family: var(--font-display); font-weight: 800; font-size: var(--t-24); color: var(--sd-navy-700); letter-spacing: var(--ls-tight); text-transform: uppercase; }
.fp-doc-num { font-size: var(--t-15); color: var(--fg-strong); font-weight: 600; margin-top: 2px; }
.fp-doc-line { font-size: 11px; color: var(--fg-subtle); margin-top: 4px; }
.fp-cai { display: flex; flex-direction: column; gap: 3px; padding: 12px 0; border-bottom: 1px solid var(--border-soft); }
.fp-cai > div { display: flex; gap: 10px; align-items: baseline; }
.fp-cai-k { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--fg-muted); width: 150px; flex: none; }
.fp-cai-v { font-size: 11.5px; color: var(--fg-default); }
.fp-cliente { padding: 16px 0; border-bottom: 1px solid var(--border-soft); }
.fp-cl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
.fp-cl-grid > div { display: flex; flex-direction: column; gap: 2px; }
.fp-k { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--fg-subtle); }
.fp-v { font-size: var(--t-14); color: var(--fg-strong); font-weight: 500; }
.fp-tbl { width: 100%; border-collapse: collapse; margin: 6px 0; }
.fp-tbl thead th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted); text-align: left; padding: 10px 8px; border-bottom: 1.5px solid var(--sd-ink-300); }
.fp-tbl tbody td { font-size: var(--t-13); padding: 9px 8px; border-bottom: 1px solid var(--border-soft); color: var(--fg-default); }
.fp-foot { display: grid; grid-template-columns: 1fr 280px; gap: 24px; padding-top: 18px; }
.fp-letras { display: flex; flex-direction: column; gap: 4px; }
.fp-letras-v { font-size: var(--t-13); font-weight: 600; color: var(--fg-strong); text-transform: uppercase; line-height: 1.4; }
.fp-legend { font-size: 10.5px; color: var(--fg-subtle); margin-top: auto; padding-top: 16px; line-height: 1.6; font-style: italic; }
.fp-tots { display: flex; flex-direction: column; gap: 6px; }
.fp-tot { display: flex; justify-content: space-between; font-size: var(--t-13); color: var(--fg-muted); }
.fp-tot .mono { color: var(--fg-default); font-variant-numeric: tabular-nums; }
.fp-tot--total { border-top: 2px solid var(--sd-navy-700); margin-top: 6px; padding-top: 10px; font-size: var(--t-18); font-weight: 800; color: var(--sd-navy-700); }
.fp-tot--total .mono { font-size: var(--t-20); color: var(--sd-navy-700); font-weight: 800; }
.pay-summary { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.pay-summary > div { display: flex; flex-direction: column; gap: 4px; background: var(--sd-ink-50); border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 14px 16px; }
.pay-amt { font-size: var(--t-20); font-weight: 700; color: var(--fg-strong); }
.abono-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); }
.abono-row:last-child { border-bottom: none; }

@media print {
  body * { visibility: hidden !important; }
  .scrim { position: static !important; background: #fff !important; }
  .overlay--drawer { width: 100% !important; box-shadow: none !important; overflow: visible !important; }
  .ov-head, .ov-foot, .card { display: none !important; }
  .ov-body { background: #fff !important; padding: 0 !important; }
  .factura-paper, .factura-paper * { visibility: visible !important; }
  .factura-paper { box-shadow: none !important; border: none !important; max-width: 100% !important; }
}
`;
document.head.appendChild(detStyle);

window.FacturaDetalle = FacturaDetalle;
