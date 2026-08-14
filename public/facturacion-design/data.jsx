/* =========================================================
   Salud Digital — Facturación (Honduras)
   data.jsx — datos mock + helpers fiscales
   ========================================================= */

/* ---------- Formato de moneda (Lempira) ---------- */
function L(n, withCode) {
  const v = (Math.round((n + Number.EPSILON) * 100) / 100)
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return 'L ' + v + (withCode ? ' HNL' : '');
}

/* ---------- Número a letras (para factura SAR) ---------- */
function numeroALetras(num) {
  const ent = Math.floor(num);
  const cent = Math.round((num - ent) * 100);
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function seccion(n) {
    let out = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (n === 100) return 'CIEN';
    if (c) out += centenas[c] + ' ';
    const resto = n % 100;
    if (resto >= 10 && resto < 20) { out += especiales[resto - 10] + ' '; return out.trim(); }
    if (resto === 20) { out += 'VEINTE '; return out.trim(); }
    if (resto > 20 && resto < 30) { out += 'VEINTI' + unidades[u].toLowerCase().toUpperCase() + ' '; return out.trim(); }
    if (d) out += decenas[d] + (u ? ' Y ' : ' ');
    if (u) out += unidades[u] + ' ';
    return out.trim();
  }

  function convertir(n) {
    if (n === 0) return 'CERO';
    let out = '';
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;
    if (millones) out += (millones === 1 ? 'UN MILLÓN ' : seccion(millones) + ' MILLONES ');
    if (miles) out += (miles === 1 ? 'MIL ' : seccion(miles) + ' MIL ');
    if (resto) out += seccion(resto);
    return out.trim();
  }

  const centStr = String(cent).padStart(2, '0');
  return convertir(ent) + ' LEMPIRAS CON ' + centStr + '/100';
}

/* ---------- Fechas ---------- */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}
function fechaSlash(iso) {
  const d = new Date(iso + 'T00:00:00');
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

/* ---------- Datos del establecimiento (emisor) ---------- */
const EMISOR = {
  nombre: 'Clínica Salud Digital, S. de R.L.',
  rtn: '08019025874103',
  direccion: 'Col. Palmira, Ave. República de Panamá, Edificio Médico 2, Tegucigalpa, Francisco Morazán',
  correo: 'facturacion@saluddigital.hn',
  tel: '+504 2235-8800',
  establecimiento: '000',
  puntoEmision: '002',
  tipoDoc: '01',
};

/* ---------- Datos del CAI vigente ---------- */
const CAI_ACTUAL = {
  codigo: '357A2F-9C81B4-4E2D60-A7F315-8B0C9D-2E',
  rangoDesde: '000-002-01-00000001',
  rangoHasta: '000-002-01-00050000',
  fechaLimite: '2026-12-31',
  emitidas: 147,        // correlativos ya usados
  total: 50000,
};

/* genera el siguiente correlativo legible */
function correlativo(n) {
  return EMISOR.establecimiento + '-' + EMISOR.puntoEmision + '-' + EMISOR.tipoDoc + '-' + String(n).padStart(8, '0');
}

/* ---------- Catálogo de servicios ---------- */
const SERVICIOS = [
  { id: 's1', nombre: 'Consulta médica general', precio: 600, isv: 0, exento: true },
  { id: 's2', nombre: 'Consulta especializada (cardiología)', precio: 1100, isv: 0, exento: true },
  { id: 's3', nombre: 'Consulta de control', precio: 400, isv: 0, exento: true },
  { id: 's4', nombre: 'Ultrasonido abdominal', precio: 950, isv: 0, exento: true },
  { id: 's5', nombre: 'Electrocardiograma', precio: 750, isv: 0, exento: true },
  { id: 's6', nombre: 'Hemograma completo', precio: 480, isv: 0, exento: true },
  { id: 's7', nombre: 'Perfil lipídico', precio: 520, isv: 0, exento: true },
  { id: 's8', nombre: 'Curación e infiltración', precio: 680, isv: 0, exento: true },
  { id: 's9', nombre: 'Acetaminofén 500mg (caja)', precio: 85, isv: 0.15, exento: false },
  { id: 's10', nombre: 'Vitamina D inyectable', precio: 240, isv: 0.15, exento: false },
  { id: 's11', nombre: 'Material de curación', precio: 160, isv: 0.15, exento: false },
];

/* ---------- Pacientes ---------- */
const PACIENTES = [
  { id: 'p1', nombre: 'Ana Funes Discua', rtn: '0801199500123', tel: '+504 9912-4480', exonerado: false },
  { id: 'p2', nombre: 'José Roberto Mejía', rtn: '0501198800456', tel: '+504 9745-1130', exonerado: false },
  { id: 'p3', nombre: 'María Banegas Pineda', rtn: '', tel: '+504 8890-2204', exonerado: false },
  { id: 'p4', nombre: 'Carlos Andino Lobo', rtn: '0801197700789', tel: '+504 9988-7711', exonerado: false },
  { id: 'p5', nombre: 'Wendy Suazo Cálix', rtn: '0703199200234', tel: '+504 9456-8820', exonerado: false },
  { id: 'p6', nombre: 'Fundación Hondureña (exonerada)', rtn: '08019002311045', tel: '+504 2239-4400', exonerado: true, regExo: 'SAR-EXO-2026-00891' },
  { id: 'p7', nombre: 'Óscar Maradiaga Ruiz', rtn: '0801198300567', tel: '+504 9301-7765', exonerado: false },
];

/* ---------- Médicos ---------- */
const MEDICOS = {
  m1: 'Dra. Patricia López',
  m2: 'Dr. Marco Cálix',
  m3: 'Dra. Sofía Mendoza',
};

/* ---------- Citas atendidas pendientes de facturar ---------- */
const CITAS_PENDIENTES = [
  { id: 'c1', pacienteId: 'p3', fecha: '2026-06-02', hora: '09:30', medico: 'm1', motivo: 'Consulta general',
    servicios: [{ ...SERVICIOS[0], cant: 1 }] },
  { id: 'c2', pacienteId: 'p2', fecha: '2026-06-02', hora: '10:15', medico: 'm2', motivo: 'Control cardiológico',
    servicios: [{ ...SERVICIOS[1], cant: 1 }, { ...SERVICIOS[4], cant: 1 }] },
  { id: 'c3', pacienteId: 'p5', fecha: '2026-06-02', hora: '11:00', medico: 'm3', motivo: 'Chequeo + laboratorio',
    servicios: [{ ...SERVICIOS[2], cant: 1 }, { ...SERVICIOS[5], cant: 1 }, { ...SERVICIOS[6], cant: 1 }] },
  { id: 'c4', pacienteId: 'p7', fecha: '2026-06-01', hora: '15:45', medico: 'm1', motivo: 'Ultrasonido',
    servicios: [{ ...SERVICIOS[3], cant: 1 }] },
];

/* ---------- Facturas (histórico) ----------
   estado: pagada | pendiente | parcial | vencida | anulada
   formaPago: efectivo | tarjeta | transferencia | mixto
*/
function mkLineas(items) {
  return items.map(it => ({ ...it, total: it.precio * it.cant }));
}
function totales(lineas) {
  let exento = 0, gravado = 0, isv = 0;
  lineas.forEach(l => {
    const sub = l.precio * l.cant;
    if (l.exento) exento += sub;
    else { gravado += sub; isv += sub * l.isv; }
  });
  const subtotal = exento + gravado;
  return { exento, gravado, isv, subtotal, total: subtotal + isv };
}

let FACTURAS = [
  {
    id: 'f147', corr: 147, pacienteId: 'p1', fecha: '2026-06-01', medico: 'm1',
    lineas: mkLineas([{ ...SERVICIOS[1], cant: 1 }, { ...SERVICIOS[9], cant: 1 }]),
    estado: 'pendiente', formaPago: null, abonos: [], venceEn: '2026-06-16',
  },
  {
    id: 'f146', corr: 146, pacienteId: 'p4', fecha: '2026-05-30', medico: 'm2',
    lineas: mkLineas([{ ...SERVICIOS[0], cant: 1 }, { ...SERVICIOS[4], cant: 1 }]),
    estado: 'pagada', formaPago: 'tarjeta', abonos: [{ fecha: '2026-05-30', monto: 1350, metodo: 'tarjeta' }], venceEn: '2026-06-14',
  },
  {
    id: 'f145', corr: 145, pacienteId: 'p5', fecha: '2026-05-29', medico: 'm3',
    lineas: mkLineas([{ ...SERVICIOS[3], cant: 1 }, { ...SERVICIOS[6], cant: 1 }]),
    estado: 'parcial', formaPago: 'efectivo', abonos: [{ fecha: '2026-05-29', monto: 700, metodo: 'efectivo' }], venceEn: '2026-06-13',
  },
  {
    id: 'f144', corr: 144, pacienteId: 'p2', fecha: '2026-05-28', medico: 'm1',
    lineas: mkLineas([{ ...SERVICIOS[0], cant: 1 }]),
    estado: 'pagada', formaPago: 'efectivo', abonos: [{ fecha: '2026-05-28', monto: 600, metodo: 'efectivo' }], venceEn: '2026-06-12',
  },
  {
    id: 'f143', corr: 143, pacienteId: 'p7', fecha: '2026-05-20', medico: 'm2',
    lineas: mkLineas([{ ...SERVICIOS[1], cant: 1 }, { ...SERVICIOS[7], cant: 1 }]),
    estado: 'vencida', formaPago: null, abonos: [], venceEn: '2026-05-25',
  },
  {
    id: 'f142', corr: 142, pacienteId: 'p3', fecha: '2026-05-18', medico: 'm3',
    lineas: mkLineas([{ ...SERVICIOS[2], cant: 1 }]),
    estado: 'pagada', formaPago: 'transferencia', abonos: [{ fecha: '2026-05-18', monto: 400, metodo: 'transferencia' }], venceEn: '2026-06-02',
  },
  {
    id: 'f141', corr: 141, pacienteId: 'p4', fecha: '2026-05-15', medico: 'm1',
    lineas: mkLineas([{ ...SERVICIOS[5], cant: 1 }, { ...SERVICIOS[6], cant: 1 }, { ...SERVICIOS[10], cant: 2 }]),
    estado: 'pagada', formaPago: 'mixto', abonos: [{ fecha: '2026-05-15', monto: 500, metodo: 'efectivo' }, { fecha: '2026-05-15', monto: 868, metodo: 'tarjeta' }], venceEn: '2026-05-30',
  },
  {
    id: 'f140', corr: 140, pacienteId: 'p1', fecha: '2026-05-10', medico: 'm2',
    lineas: mkLineas([{ ...SERVICIOS[4], cant: 1 }]),
    estado: 'anulada', formaPago: null, abonos: [], venceEn: '2026-05-25', motivoAnula: 'Error en datos del cliente',
  },
];

/* abonado total de una factura */
function abonado(f) {
  return (f.abonos || []).reduce((s, a) => s + a.monto, 0);
}
function saldo(f) {
  return totales(f.lineas).total - abonado(f);
}

/* paciente helper */
function paciente(id) { return PACIENTES.find(p => p.id === id); }

/* exporta al scope global para los demás scripts babel */
Object.assign(window, {
  L, numeroALetras, fechaCorta, fechaSlash, MESES,
  EMISOR, CAI_ACTUAL, correlativo,
  SERVICIOS, PACIENTES, MEDICOS, CITAS_PENDIENTES, FACTURAS,
  mkLineas, totales, abonado, saldo, paciente,
});
