/* =========================================================
   app.jsx — ensamblaje, navegación y estado
   ========================================================= */
function addDias(iso, d) {
  const dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}
const HOY = '2026-06-02';

function App() {
  const [facturas, setFacturas] = useState(() => FACTURAS.map(f => ({ ...f })));
  const [citas, setCitas] = useState(() => CITAS_PENDIENTES.map(c => ({ ...c })));
  const [caiUsed, setCaiUsed] = useState(CAI_ACTUAL.emitidas);
  const [view, setView] = useState('dashboard');
  const [overlay, setOverlay] = useState(null); // {type, factura, preCita}
  const [toast, setToast] = useState('');

  const abiertas = facturas.filter(f => f.estado !== 'anulada' && saldo(f) > 0.01).length;

  /* --- acciones --- */
  function emitir({ cita, lineas, tipoVenta, rtn, nombre }) {
    const corr = caiUsed + 1;
    const nueva = {
      id: 'f' + corr, corr, pacienteId: cita.pacienteId, fecha: HOY, medico: cita.medico,
      lineas: lineas.map(l => ({ ...l })), estado: 'pendiente', formaPago: null, abonos: [],
      venceEn: addDias(HOY, 15), tipoVenta, citaRef: 'CITA-' + cita.id.toUpperCase(),
    };
    // permite RTN editado en el paciente (para esta sesión)
    if (rtn !== undefined) { const p = paciente(cita.pacienteId); if (p && !p.rtn && rtn) p.rtn = rtn; }
    setFacturas(fs => [nueva, ...fs]);
    setCitas(cs => cs.filter(c => c.id !== cita.id));
    setCaiUsed(corr);
    CAI_ACTUAL.emitidas = corr;
    setOverlay({ type: 'detalle', factura: nueva });
    setToast('Factura ' + correlativo(corr) + ' emitida.');
  }

  function aplicarPago(factura, abonos) {
    setFacturas(fs => fs.map(f => {
      if (f.id !== factura.id) return f;
      const nuevos = [...(f.abonos || []), ...abonos];
      const nf = { ...f, abonos: nuevos };
      const sal = saldo(nf);
      nf.estado = sal <= 0.01 ? 'pagada' : 'parcial';
      nf.formaPago = abonos.length > 1 ? 'mixto' : (abonos[0] && abonos[0].metodo);
      return nf;
    }));
    const total = abonos.reduce((s, a) => s + a.monto, 0);
    const updated = { ...factura, abonos: [...(factura.abonos || []), ...abonos] };
    const sal = saldo(updated);
    setToast(sal <= 0.01 ? 'Pago registrado. Factura saldada.' : 'Abono de ' + L(total) + ' registrado.');
    setOverlay({ type: 'detalle', factura: updated });
  }

  function anular(factura, motivo) {
    setFacturas(fs => fs.map(f => f.id === factura.id ? { ...f, estado: 'anulada', motivoAnula: motivo } : f));
    setOverlay({ type: 'detalle', factura: { ...factura, estado: 'anulada', motivoAnula: motivo } });
    setToast('Factura ' + correlativo(factura.corr) + ' anulada.');
  }

  /* la factura en overlay debe reflejar el estado actual de la lista */
  const liveFactura = overlay && overlay.factura ? (facturas.find(f => f.id === overlay.factura.id) || overlay.factura) : null;

  const tabs = [
    { k: 'dashboard', label: 'Resumen', icon: 'trending' },
    { k: 'facturas', label: 'Facturas', icon: 'receipt', badge: facturas.length },
    { k: 'cuentas', label: 'Cuentas por cobrar', icon: 'wallet', badge: abiertas },
  ];

  const usoPct = Math.round((caiUsed / CAI_ACTUAL.total) * 100);

  return (
    <div className="module">
      {/* top del módulo (no header global) */}
      <div className="mod-top">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Finanzas</div>
          <h1 className="mod-title">Facturación</h1>
          <div className="mod-sub">Emisión electrónica · Honduras (SAR) · {EMISOR.nombre}</div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="cai-chip" title={'CAI ' + CAI_ACTUAL.codigo}>
            <Icon name="fileText" size={16} style={{ color: 'var(--sd-blue-600)' }} />
            <div>
              <div className="cai-chip__txt">CAI vigente · <b>{caiUsed.toLocaleString()}</b>/{CAI_ACTUAL.total.toLocaleString()}</div>
            </div>
            <div className="cai-chip__bar"><div className="cai-chip__fill" style={{ width: Math.max(usoPct, 2) + '%' }} /></div>
          </div>
          <Btn variant="primary" icon="plus" onClick={() => setOverlay({ type: 'emitir' })}>Emitir factura</Btn>
        </div>
      </div>

      {/* tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.k} className={'tab' + (view === t.k ? ' tab--active' : '')} onClick={() => setView(t.k)}>
            <Icon name={t.icon} size={18} />{t.label}
            {t.badge != null && <span className="tab__badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* contenido */}
      {view === 'dashboard' && <Dashboard facturas={facturas} onOpen={f => setOverlay({ type: 'detalle', factura: f })} onEmitir={() => setOverlay({ type: 'emitir' })} />}
      {view === 'facturas' && <Listado facturas={facturas} onOpen={f => setOverlay({ type: 'detalle', factura: f })} onEmitir={() => setOverlay({ type: 'emitir' })} />}
      {view === 'cuentas' && <Cuentas facturas={facturas} onOpen={f => setOverlay({ type: 'detalle', factura: f })} onAbonar={f => setOverlay({ type: 'cobro', factura: f })} />}

      {/* overlays */}
      {overlay && overlay.type === 'emitir' && (
        <EmitirFactura citas={citas} preCita={overlay.preCita} onClose={() => setOverlay(null)} onEmit={emitir} />
      )}
      {overlay && overlay.type === 'detalle' && liveFactura && (
        <FacturaDetalle factura={liveFactura} onClose={() => setOverlay(null)}
          onAnular={anular} onCobrar={f => setOverlay({ type: 'cobro', factura: f })} />
      )}
      {overlay && overlay.type === 'cobro' && liveFactura && (
        <Cobro factura={liveFactura} onClose={() => setOverlay({ type: 'detalle', factura: liveFactura })} onConfirm={aplicarPago} />
      )}

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

/* Señala que el módulo montó, para que la página esconda su page-loader.
   Funciona en los dos modos de uso:
     - NATIVO (montado en /facturacion.html dentro de la plataforma): dispara
       un evento local 'fact:ready' en window.
     - EMBEBIDO (preview standalone index.html dentro de un iframe): además
       avisa al wrapper con postMessage. Mismo patrón que orto:ready / nutri:ready. */
function factSignalReady() {
  try { window.dispatchEvent(new CustomEvent('fact:ready')); } catch (_) {}
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'fact:ready' }, '*');
    }
  } catch (_) {}
}
try {
  requestAnimationFrame(factSignalReady);
} catch (_) {
  factSignalReady();
}
