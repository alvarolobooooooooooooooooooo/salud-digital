// ── Guardián de acceso clínico ──
//
// Cierra /api a todo el que no sea personal de la clínica. Nace por un defecto
// concreto: el rol 'patient' existe en el esquema, puede iniciar sesión y entra
// a /paciente.html, pero NINGÚN handler comprobaba `role === 'patient'`. El
// patrón de autorización de la app es
//
//     if (req.user.role === 'doctor') { …restringir a lo suyo… }
//     else { …alcance de clínica completo… }
//
// así que un paciente caía siempre en el `else` y recibía el expediente entero
// de la clínica: lista de pacientes, alergias, diagnósticos, fotos clínicas, y
// permiso para escribirlos. Este guardián lo corta de raíz.
//
// Es una ALLOWLIST a propósito, no una lista de rutas prohibidas: un rol no
// clínico solo llega a su propia sesión. Si mañana se añade un rol nuevo, o una
// ruta nueva con PHI, quedan cerrados por defecto en vez de abiertos por olvido.
// Cuando el portal del paciente tenga API propia, se añade su prefijo a
// PREFIJOS_ABIERTOS y se resuelve el paciente DESDE EL TOKEN, nunca desde la URL.
//
// Se monta una sola vez sobre /api, antes de los routers, igual que el guardián
// de suscripción. Como corre antes, req.user todavía no existe y hay que
// decodificar el JWT por cuenta propia (decodeToken). La validación de sesión
// contra user_sessions sigue siendo cosa de `authenticate` en cada router: aquí
// solo hace falta saber qué rol dice tener quien llama.

const { decodeToken, CLINICAL_ROLES } = require('./auth');

// Lo único que alcanza un rol no clínico. Todo lo demás bajo /api es 403.
//   /auth                 → su propia sesión: login, logout, me, 2FA, contraseña
//   /public               → landing, reservas y mapa: son públicos de todas formas
//   /confirmations/public → enlace de confirmación que el paciente ya recibió
//   /invitations          → aceptar una invitación (el POST de alta ya exige admin)
//   /billing/webhook      → lo llama el procesador de pagos, no una persona
const PREFIJOS_ABIERTOS = [
  '/auth',
  '/public',
  '/confirmations/public',
  '/invitations',
  '/billing/webhook',
];

function esRutaAbierta(pathname) {
  return PREFIJOS_ABIERTOS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function gate(req, res, next) {
  if (esRutaAbierta(req.path)) return next();

  const user = decodeToken(req);
  // Sin token válido no hay rol que comprobar: que sea el `authenticate` del
  // router quien devuelva el 401 con su mensaje de siempre.
  if (!user) return next();

  if (!CLINICAL_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
}

module.exports = { gate, PREFIJOS_ABIERTOS };
