/* =========================================================
   screen-cobro.jsx — Registrar pago (efectivo / tarjeta / transferencia / mixto)
   ========================================================= */
const METODOS = [
  { k: 'efectivo', label: 'Efectivo', icon: 'cash' },
  { k: 'tarjeta', label: 'Tarjeta', icon: 'card' },
  { k: 'transferencia', label: 'Transferencia', icon: 'bank' },
];

function Cobro({ factura, onClose, onConfirm }) {
  const f = factura;
  const p = paciente(f.pacienteId);
  const sal = saldo(f);
  const [pagos, setPagos] = useState([{ metodo: 'efectivo', monto: sal, ref: '' }]);

  const ingresado = pagos.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0);
  const efectivoIngresado = pagos.filter(x => x.metodo === 'efectivo').reduce((s, x) => s + (parseFloat(x.monto) || 0), 0);
  // monto que realmente abona (no cuenta el exceso de efectivo como abono)
  const aplicado = Math.min(ingresado, sal);
  const cambio = Math.max(0, ingresado - sal);
  const restante = Math.max(0, sal - ingresado);
  const esParcial = ingresado > 0.001 && ingresado < sal - 0.001;

  function upd(i, patch) { setPagos(ps => ps.map((x, idx) => idx === i ? { ...x, ...patch } : x)); }
  function add() {
    const usados = pagos.map(x => x.metodo);
    const libre = METODOS.find(m => !usados.includes(m.k)) || METODOS[0];
    setPagos(ps => [...ps, { metodo: libre.k, monto: restante > 0 ? restante : 0, ref: '' }]);
  }
  function quitar(i) { setPagos(ps => ps.filter((_, idx) => idx !== i)); }

  function confirmar() {
    const abonos = pagos
      .filter(x => (parseFloat(x.monto) || 0) > 0)
      .map(x => {
        let m = parseFloat(x.monto);
        // recorta el exceso de efectivo (el cambio no se abona)
        return { metodo: x.metodo, monto: m, ref: x.ref, fecha: '2026-06-02' };
      });
    // ajusta para no abonar más que el saldo
    let acc = 0;
    const ajustados = [];
    for (const a of abonos) {
      const room = sal - acc;
      if (room <= 0) break;
      const monto = Math.min(a.monto, room);
      ajustados.push({ ...a, monto });
      acc += monto;
    }
    onConfirm(f, ajustados);
  }

  return (
    <Overlay onClose={onClose}>
      <div className="ov-head">
        <div>
          <h2 className="ov-title">Registrar pago</h2>
          <div className="mod-sub" style={{ marginTop: 2 }}>{correlativo(f.corr)} · {p.nombre}</div>
        </div>
        <button className="ov-close" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>

      <div className="ov-body">
        {/* saldo */}
        <div className="cobro-saldo">
          <div>
            <div className="fp-k">Saldo pendiente</div>
            <div className="mono" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-32)', fontWeight: 800, color: 'var(--fg-strong)', letterSpacing: 'var(--ls-tight)' }}>{L(sal)}</div>
          </div>
          {abonado(f) > 0 && <div style={{ textAlign: 'right' }}><div className="fp-k">Ya abonado</div><div className="mono" style={{ fontWeight: 700, color: 'var(--sd-vital-600)', fontSize: 'var(--t-18)' }}>{L(abonado(f))}</div></div>}
        </div>

        {/* atajos */}
        <div className="row" style={{ gap: 8, margin: '4px 0 18px', flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => setPagos([{ metodo: 'efectivo', monto: sal, ref: '' }])}>Pago completo</button>
          <button className="chip" onClick={() => setPagos([{ metodo: 'efectivo', monto: Math.round(sal / 2 * 100) / 100, ref: '' }])}>50%</button>
          <button className="chip" onClick={add}><Icon name="plus" size={14} />Pago mixto</button>
        </div>

        {/* líneas de pago */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pagos.map((pago, i) => (
            <div key={i} className="pago-line">
              <div className="metodo-seg">
                {METODOS.map(m => (
                  <button key={m.k} className={'metodo-btn' + (pago.metodo === m.k ? ' metodo-btn--active' : '')} onClick={() => upd(i, { metodo: m.k })} title={m.label}>
                    <Icon name={m.icon} size={18} />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="pago-monto">
                <span className="pago-currency">L</span>
                <input className="input input--mono" type="number" min="0" step="0.01" value={pago.monto}
                  onChange={e => upd(i, { monto: e.target.value })} style={{ paddingLeft: 26, textAlign: 'right' }} />
                {pagos.length > 1 && <button className="line-del" onClick={() => quitar(i)}><Icon name="trash" size={16} /></button>}
              </div>
              {(pago.metodo === 'tarjeta' || pago.metodo === 'transferencia') && (
                <input className="input input--mono" placeholder={pago.metodo === 'tarjeta' ? 'N.º de autorización / voucher' : 'N.º de referencia bancaria'}
                  value={pago.ref} onChange={e => upd(i, { ref: e.target.value })} style={{ fontSize: 'var(--t-13)' }} />
              )}
            </div>
          ))}
        </div>

        {pagos.length < METODOS.length && (
          <button className="add-pago" onClick={add}><Icon name="plus" size={16} />Agregar otra forma de pago</button>
        )}

        {/* resumen */}
        <div className="cobro-resumen">
          <div className="tot-row"><span>Total ingresado</span><span className="mono">{L(ingresado)}</span></div>
          {cambio > 0.001 && <div className="tot-row" style={{ color: 'var(--sd-vital-600)' }}><span>Cambio (efectivo)</span><span className="mono">{L(cambio)}</span></div>}
          {restante > 0.001 && <div className="tot-row" style={{ color: 'var(--sd-alert-600)' }}><span>Quedará pendiente</span><span className="mono">{L(restante)}</span></div>}
          <div className="divider" style={{ margin: '8px 0' }} />
          <div className="tot-row tot-row--big"><span>Se aplicará a la factura</span><span className="mono">{L(aplicado)}</span></div>
        </div>

        {esParcial && (
          <div className="parcial-note"><Icon name="alert" size={16} />La factura quedará como <b>abono parcial</b> con saldo de {L(restante)}.</div>
        )}
      </div>

      <div className="ov-foot">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="success" icon="check" disabled={ingresado < 0.01} onClick={confirmar}>
          {esParcial ? 'Registrar abono' : 'Confirmar pago'} · {L(aplicado).replace('L ', 'L')}
        </Btn>
      </div>
    </Overlay>
  );
}

const cobroStyle = document.createElement('style');
cobroStyle.textContent = `
.cobro-saldo { display: flex; justify-content: space-between; align-items: flex-end; background: var(--sd-blue-50); border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 16px 18px; margin-bottom: 16px; }
.chip { appearance: none; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-pill); padding: 7px 14px; font-family: var(--font-body); font-size: var(--t-13); font-weight: 600; color: var(--fg-default); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all var(--dur-1); }
.chip:hover { border-color: var(--sd-blue-400); background: var(--sd-blue-50); color: var(--sd-blue-700); }
.pago-line { display: flex; flex-direction: column; gap: 10px; background: var(--sd-ink-50); border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 14px; }
.metodo-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.metodo-btn { appearance: none; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-sm); padding: 10px 6px; cursor: pointer; font-family: var(--font-body); font-size: var(--t-12); font-weight: 600; color: var(--fg-muted); display: flex; flex-direction: column; align-items: center; gap: 5px; transition: all var(--dur-1); }
.metodo-btn:hover { border-color: var(--border-strong); color: var(--fg-default); }
.metodo-btn--active { border-color: var(--sd-blue-600); background: var(--sd-blue-50); color: var(--sd-blue-700); box-shadow: inset 0 0 0 1px var(--sd-blue-600); }
.pago-monto { position: relative; display: flex; align-items: center; gap: 8px; }
.pago-monto .input { flex: 1; }
.pago-currency { position: absolute; left: 12px; font-family: var(--font-mono); color: var(--fg-muted); font-size: var(--t-14); pointer-events: none; z-index: 1; }
.add-pago { appearance: none; background: none; border: 1px dashed var(--border-strong); border-radius: var(--r-md); width: 100%; padding: 11px; margin-top: 12px; cursor: pointer; font-family: var(--font-body); font-size: var(--t-13); font-weight: 600; color: var(--sd-blue-700); display: flex; align-items: center; justify-content: center; gap: 7px; transition: all var(--dur-1); }
.add-pago:hover { background: var(--sd-blue-50); border-color: var(--sd-blue-400); }
.cobro-resumen { background: var(--sd-ink-50); border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 16px 18px; margin-top: 18px; }
.parcial-note { display: flex; align-items: center; gap: 9px; background: var(--sd-alert-100); color: var(--sd-alert-600); font-size: var(--t-13); font-weight: 500; padding: 11px 14px; border-radius: var(--r-md); margin-top: 12px; }
.parcial-note svg { flex: none; }
`;
document.head.appendChild(cobroStyle);

Object.assign(window, { Cobro, METODOS });
