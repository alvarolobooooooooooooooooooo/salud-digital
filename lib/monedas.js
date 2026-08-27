// ── País y moneda de la clínica ──
//
// La plataforma se vende en seis países. Cada uno tiene su moneda, y la moneda
// decide cómo se lee TODO el dinero de la clínica: los cobros, los pendientes,
// las gráficas de Finanzas. Antes el símbolo estaba escrito a mano en catorce
// pantallas ('L. ' + n.toFixed(2)), así que la moneda no era un dato de la
// clínica sino una constante repartida por el código.
//
//   clinics.country   dónde atiende el doctor. Se elige en el alta.
//   clinics.currency  se DERIVA del país. No es una preferencia aparte.
//
// POR QUÉ LA MONEDA NO SE ELIGE POR SEPARADO, Y POR QUÉ NO HAY TASAS DE CAMBIO.
// Cambiar la moneda de una clínica que ya tiene cobros guardados solo se puede
// hacer bien de una forma: convirtiendo esos importes. Y convertir exige una
// tasa. Una tasa que la plataforma se inventara —una tabla escrita a ojo, o una
// API de divisas que puede fallar un martes cualquiera— multiplicaría el
// histórico de cobros de una clínica real por un número que nadie verificó. No
// se hace. La moneda queda fijada por el país en el alta, que es el único
// momento en que no hay ni un importe que reinterpretar.
//
// El Salvador es el ejemplo de por qué el país manda: su moneda oficial es el
// dólar, no una propia.
//
// LA SUSCRIPCIÓN NO ENTRA AQUÍ. Lo que la clínica le paga a Salud Digital vive
// en plans/subscriptions/payments y se cobra en USD por el procesador, mire a
// donde mire este archivo. Aquí solo vive el dinero de la clínica: lo que ella
// le cobra a sus pacientes.
//
// El gemelo para el navegador es public/monedas.js: si se toca uno, hay que
// tocar el otro. El test tests/monedas.test.js compara los dos catálogos campo
// por campo, así que una divergencia se cae en `npm test`.

// ── Monedas ──────────────────────────────────────────────────────────────────
//
// `prefijo` incluye su propio espaciado a propósito, y el espaciado no es
// decorativo: es el de cada convención. Honduras escribe "L. 1,200.00" y
// Argentina y Colombia "$ 1.200.000" con espacio, mientras que México, Estados
// Unidos y Nicaragua lo pegan al número. Es lo que dice CLDR para cada locale, y
// además tiene una consecuencia práctica: ese espacio es el único punto por el
// que un importe largo puede partirse en dos líneas. Sin él, "$255.250,00" es un
// bloque indivisible que se salía de la tarjeta de Ingresos totales en Finanzas
// y quedaba recortado por su `overflow: hidden`.
//
// `locale` importa más de lo que parece: Colombia agrupa al revés que el resto
// —"$1.200.000" con puntos— y el peso colombiano no usa centavos, así que
// `decimales: 0`. Formatear COP con dos decimales no es un detalle estético:
// hace que cada importe parezca cien veces más grande de lo que es.
const MONEDAS = {
  HNL: { codigo: 'HNL', nombre: 'Lempira',         prefijo: 'L. ', locale: 'es-HN', decimales: 2 },
  USD: { codigo: 'USD', nombre: 'Dólar',           prefijo: '$',   locale: 'en-US', decimales: 2 },
  NIO: { codigo: 'NIO', nombre: 'Córdoba',         prefijo: 'C$',  locale: 'es-NI', decimales: 2 },
  MXN: { codigo: 'MXN', nombre: 'Peso mexicano',   prefijo: '$',   locale: 'es-MX', decimales: 2 },
  COP: { codigo: 'COP', nombre: 'Peso colombiano', prefijo: '$ ',  locale: 'es-CO', decimales: 0 },
  ARS: { codigo: 'ARS', nombre: 'Peso argentino',  prefijo: '$ ',  locale: 'es-AR', decimales: 2 },
};

// ── Países habilitados ───────────────────────────────────────────────────────
//
// Esta lista es la puerta: routes/auth.js valida el alta contra ella, así que
// añadir un país es añadirlo aquí (y en el gemelo del navegador). El orden es el
// que se ve en el desplegable.
const PAISES = [
  { codigo: 'HN', nombre: 'Honduras',    moneda: 'HNL', telefono: '+504' },
  { codigo: 'SV', nombre: 'El Salvador', moneda: 'USD', telefono: '+503' },
  { codigo: 'NI', nombre: 'Nicaragua',   moneda: 'NIO', telefono: '+505' },
  { codigo: 'MX', nombre: 'México',      moneda: 'MXN', telefono: '+52'  },
  { codigo: 'CO', nombre: 'Colombia',    moneda: 'COP', telefono: '+57'  },
  { codigo: 'AR', nombre: 'Argentina',   moneda: 'ARS', telefono: '+54'  },
];

// Honduras es el país por defecto porque es de donde son TODAS las clínicas que
// existían antes de que este campo naciera. La migración de db.js rellena su
// columna con este mismo valor: ninguna cuenta viva se queda sin país.
const PAIS_POR_DEFECTO = 'HN';
const MONEDA_POR_DEFECTO = 'HNL';

const POR_CODIGO = new Map(PAISES.map((p) => [p.codigo, p]));

/** Códigos de moneda aceptados en la app. */
const CODIGOS_MONEDA = Object.keys(MONEDAS);

/**
 * Devuelve el código ISO del país si está habilitado, o '' si no.
 * Acepta minúsculas y espacios; NO adivina a partir del nombre: un país que no
 * está en la lista es un país que la app todavía no soporta, y silenciarlo
 * dejaría la clínica con una moneda que nadie eligió.
 */
function normalizarPais(valor) {
  const v = String(valor == null ? '' : valor).trim().toUpperCase();
  return POR_CODIGO.has(v) ? v : '';
}

/** Devuelve el código de moneda si es uno de los soportados, o '' si no. */
function normalizarMoneda(valor) {
  const v = String(valor == null ? '' : valor).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(MONEDAS, v) ? v : '';
}

/** La moneda que le corresponde a un país. Un país desconocido cae en lempiras. */
function monedaDePais(pais) {
  const p = POR_CODIGO.get(normalizarPais(pais));
  return p ? p.moneda : MONEDA_POR_DEFECTO;
}

/** Ficha completa del país, o null. */
function pais(codigo) {
  return POR_CODIGO.get(normalizarPais(codigo)) || null;
}

/** Ficha completa de la moneda; una desconocida cae en la de por defecto. */
function moneda(codigo) {
  return MONEDAS[normalizarMoneda(codigo)] || MONEDAS[MONEDA_POR_DEFECTO];
}

/**
 * Formatea un importe con el prefijo y la puntuación de su moneda.
 * "L. 1,200.00" · "$1,200.00" · "C$1,200.00" · "$1.200.000"
 */
function formatear(monto, codigoMoneda) {
  const m = moneda(codigoMoneda);
  const n = Number(monto);
  const valor = Number.isFinite(n) ? n : 0;
  let cuerpo;
  try {
    cuerpo = new Intl.NumberFormat(m.locale, {
      minimumFractionDigits: m.decimales,
      maximumFractionDigits: m.decimales,
    }).format(valor);
  } catch (_) {
    // Un Node sin datos de locale (build mínima de ICU) no puede tumbar una
    // factura: se cae al formato hondureño, que es el de la mayoría.
    cuerpo = valor.toFixed(m.decimales).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return m.prefijo + cuerpo;
}

module.exports = {
  MONEDAS,
  PAISES,
  CODIGOS_MONEDA,
  PAIS_POR_DEFECTO,
  MONEDA_POR_DEFECTO,
  normalizarPais,
  normalizarMoneda,
  monedaDePais,
  pais,
  moneda,
  formatear,
};
