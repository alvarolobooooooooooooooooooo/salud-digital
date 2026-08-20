// ── Límites de uso por niveles ──
//
// El límite global de /api (300/min por IP en server.js) frena la enumeración
// masiva, pero no sirve de nada contra el agotamiento de recursos: hay
// operaciones que cuestan 300 veces más que un GET normal —hashear una
// contraseña, decodificar un HEIC, hablar con OpenAI, escribir 25 MB de fotos
// en Postgres— y a todas ellas se llega dentro de ese mismo presupuesto de 300.
// Trescientas peticiones de cambio de contraseña son dos bcrypt cada una: más
// segundos de CPU que segundos tiene el minuto, desde una sola IP y con una
// cuenta cualquiera. El proceso es de un solo hilo, así que eso no es "ir
// lento": es que la plataforma deja de responder a todo el mundo.
//
// Por eso los límites de aquí son POR OPERACIÓN y, cuando hay sesión, POR
// USUARIO. Dos motivos para no quedarse en la IP:
//
//   1. Una clínica entera sale por la misma IP. Un límite estrecho por IP
//      castigaría a la recepción por lo que hace el consultorio de al lado.
//   2. Una IP se cambia sola; una cuenta cuesta un registro y una tarjeta.
//      Contar por cuenta es lo único que encarece de verdad el abuso.
//
// Quien no trae sesión se cuenta por IP, con el prefijo /64 en IPv6: un
// atacante con un bloque IPv6 tiene billones de direcciones y contarlas una a
// una equivale a no contar nada.

const rateLimit = require('express-rate-limit');
const { decodeToken } = require('./auth');

// IPv6: agrupar por /64 (los 4 primeros grupos). Es la unidad que asigna un
// proveedor a un cliente, así que es la que representa "el mismo abonado".
function normalizarIp(ip) {
  const limpia = String(ip || 'desconocida').replace(/^::ffff:/, '');
  if (!limpia.includes(':')) return limpia; // IPv4 tal cual
  const grupos = limpia.split(':');
  return grupos.slice(0, 4).join(':') + '::/64';
}

// Clave de conteo: la cuenta si la hay, la IP si no. `decodeToken` solo verifica
// la firma del JWT (no toca la BD), así que es barato y no se puede falsear:
// sin la clave del servidor no se fabrica un `u:<id>` ajeno.
function claveUsuarioOIp(req) {
  const user = decodeToken(req);
  if (user && user.id) return 'u:' + user.id;
  return 'ip:' + normalizarIp(req.ip);
}

function clavePorIp(req) {
  return 'ip:' + normalizarIp(req.ip);
}

/**
 * Crea un limitador con la forma que usa el resto de la app.
 *
 * @param {object} opciones
 * @param {number} opciones.windowMs  Ventana de conteo.
 * @param {number} opciones.max       Peticiones permitidas por ventana y clave.
 * @param {string} opciones.mensaje   Lo que lee el usuario al chocar con el tope.
 * @param {boolean} [opciones.porIp]  true → contar siempre por IP, aunque haya sesión.
 * @param {boolean} [opciones.omitirExitosas] true → solo cuentan las respuestas de error.
 */
function crear({ windowMs, max, mensaje, porIp = false, omitirExitosas = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: omitirExitosas,
    keyGenerator: porIp ? clavePorIp : claveUsuarioOIp,
    // Se apaga el chequeo `ip` de la librería porque la clave la construimos
    // aquí: el salto de confianza ya está declarado con `app.set('trust proxy', 1)`
    // en server.js, y la normalización de IPv6 la hace `normalizarIp`.
    validate: { ip: false },
    message: { error: mensaje, code: 'rate_limited' },
  });
}

// ── Autenticación ────────────────────────────────────────────────────────────

// Techo absoluto de /api/auth/login. El limitador estricto que ya existe
// (10 por 15 min) solo cuenta los INTENTOS FALLIDOS —lo correcto contra la
// fuerza bruta—, pero por eso mismo deja pasar peticiones ilimitadas a quien
// acierta la contraseña. Y cada login acertado son un bcrypt (CPU) y una fila
// nueva en user_sessions (disco). Una cuenta propia basta para las dos cosas.
const loginTecho = crear({
  windowMs: 15 * 60 * 1000,
  max: 60,
  porIp: true,
  mensaje: 'Demasiadas solicitudes de inicio de sesión. Espera unos minutos.',
});

// Contraseñas y 2FA: cada petición cuesta uno o dos bcrypt (~100-300 ms de CPU
// bloqueando el proceso entero). Nadie cambia su contraseña diez veces por hora.
const credenciales = crear({
  windowMs: 15 * 60 * 1000,
  max: 10,
  mensaje: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
});

// ── Operaciones caras ────────────────────────────────────────────────────────

// Subidas: cada una reserva el archivo entero en memoria (multer usa
// memoryStorage) y sale a Cloudinary. Holgado para una jornada de fotos
// clínicas —una consulta de ortodoncia sube 15 fotos— pero no infinito.
const subidas = crear({
  windowMs: 60 * 60 * 1000,
  max: 200,
  mensaje: 'Demasiadas subidas seguidas. Espera un momento e intenta de nuevo.',
});

// Conversión HEIC: JS puro decodificando en el hilo principal. Es la operación
// más cara de toda la API por byte recibido, así que va aparte y más apretada.
const conversionHeic = crear({
  windowMs: 60 * 60 * 1000,
  max: 100,
  mensaje: 'Demasiadas conversiones de imagen seguidas. Espera un momento.',
});

// Escrituras clínicas: el body de /api/consultations admite 25 MB porque las
// fotos de ortodoncia viajan embebidas. Sin tope, una cuenta llena el disco de
// la base de datos —y ese es un incidente del que no se sale solo.
const escrituraClinica = crear({
  windowMs: 60 * 1000,
  max: 60,
  mensaje: 'Estás guardando demasiado rápido. Espera unos segundos.',
});

// Lecturas pesadas: informes, finanzas, índices de fotos. Consultan tablas
// enteras de la clínica y algunas transfieren blobs de imagen.
const lecturaPesada = crear({
  windowMs: 60 * 1000,
  max: 90,
  mensaje: 'Demasiadas consultas seguidas. Espera un momento.',
});

// IA: cada llamada se paga a OpenAI y mantiene un socket abierto mientras el
// modelo responde. Sin tope, el abuso se cobra en la factura antes que en el CPU.
const ia = crear({
  windowMs: 60 * 1000,
  max: 20,
  mensaje: 'Demasiadas consultas al asistente. Espera un momento.',
});

// Geocodificación autenticada: comparte la cola serializada de Nominatim con el
// alta pública (1 petición por segundo para todo el proceso). Llenar esa cola
// deja sin buscador de direcciones a todo el mundo.
const geocodificacion = crear({
  windowMs: 60 * 60 * 1000,
  max: 60,
  mensaje: 'Demasiadas búsquedas de dirección. Espera un momento.',
});

// Webhook de pagos: es público por definición (lo llama PayPal, no una persona).
// Cada petición con firma inválida deja igualmente una fila en payment_events y
// gasta una llamada de verificación contra PayPal, así que hay que acotarla.
// El tope es alto porque una tanda legítima de reintentos puede venir seguida.
const webhookPagos = crear({
  windowMs: 60 * 1000,
  max: 120,
  porIp: true,
  mensaje: 'Demasiados eventos seguidos.',
});

module.exports = {
  crear,
  claveUsuarioOIp,
  normalizarIp,
  loginTecho,
  credenciales,
  subidas,
  conversionHeic,
  escrituraClinica,
  lecturaPesada,
  ia,
  geocodificacion,
  webhookPagos,
};

/**
 * Envuelve un limitador para que solo cuente las peticiones que ESCRIBEN.
 * Sirve para montar un tope sobre un prefijo entero (/api/consultations) sin
 * castigar las lecturas, que son la mayoría y las baratas.
 */
function soloEscrituras(limitador) {
  const LECTURAS = ['GET', 'HEAD', 'OPTIONS'];
  return (req, res, next) => {
    if (LECTURAS.includes(req.method)) return next();
    return limitador(req, res, next);
  };
}

module.exports.soloEscrituras = soloEscrituras;
