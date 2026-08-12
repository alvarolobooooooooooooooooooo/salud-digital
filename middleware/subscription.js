// ── Guardián de suscripción ──
// Bloquea la API cuando la clínica no tiene suscripción activa. Se monta una
// sola vez sobre /api (antes de los routers), así ninguna ruta nueva se olvida
// de estar protegida.
//
// Como corre ANTES de los routers, req.user todavía no existe: aquí se decodifica
// el JWT por cuenta propia. No se valida la sesión contra user_sessions — de eso
// ya se encarga `authenticate` en cada router; aquí solo hace falta saber quién
// dice ser y a qué clínica pertenece.

const jwt = require('jsonwebtoken');
const { SECRET, COOKIE_NAME } = require('./auth');
const subscription = require('../lib/subscription');

// Rutas que deben seguir vivas SIN suscripción, o el usuario no podría ni
// entrar ni pagar. Las rutas públicas (reservas, confirmaciones de pacientes)
// tampoco dependen del pago del doctor para no romper enlaces ya enviados.
const EXEMPT_PREFIXES = [
  '/auth',                  // login / logout / me / 2FA
  '/billing',               // estado, alta y cancelación de la suscripción
  '/public',                // landing pública + reservas online
  '/confirmations/public',  // enlace de confirmación que ya recibió el paciente
];

function isExemptPath(pathname) {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function decodeUser(req) {
  let token = null;
  if (req.cookies && req.cookies[COOKIE_NAME]) token = req.cookies[COOKIE_NAME];
  else {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) token = h.slice(7);
  }
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

async function gate(req, res, next) {
  if (!subscription.enforcementEnabled()) return next();
  if (isExemptPath(req.path)) return next();

  const user = decodeUser(req);
  // Sin token válido no hay nada que cobrar: que sea el `authenticate` del router
  // quien devuelva el 401 con su mensaje de siempre.
  if (!user) return next();
  if (!subscription.ENFORCED_ROLES.includes(user.role)) return next();
  if (!user.clinic_id) return next();
  if (subscription.isExemptClinic(user.clinic_id)) return next();

  let access;
  try {
    access = await subscription.clinicHasAccess(user.clinic_id);
  } catch (err) {
    // Fallo de BD → se deja pasar. Un hipo de Postgres no puede dejar al doctor
    // fuera de su propia consulta; el cobro se revisa en el siguiente request.
    console.warn('[billing] no se pudo verificar la suscripción:', err.message);
    return next();
  }

  if (access.active) return next();

  res.status(402).json({
    error: 'Tu suscripción no está activa. Actívala para seguir usando la plataforma.',
    code: 'subscription_required',
    subscription_status: access.reason,
  });
}

module.exports = { gate, EXEMPT_PREFIXES };
