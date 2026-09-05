// ── Guardián de clave temporal ──
//
// Cuando el administrador le pone una clave temporal a alguien, esa cuenta
// queda marcada (users.must_change_password). Hasta que la cambie, la API deja
// LEER pero no escribir.
//
// Podría bastar con el aviso de la pantalla, pero entonces la obligación sería
// un adorno: bastaría cerrar el modal —o llamar a la API desde fuera— para
// seguir trabajando meses con una contraseña que el operador de la plataforma
// conoce y que probablemente se dictó por WhatsApp. En una app con expedientes
// médicos eso no se sostiene.
//
// Mismo patrón exacto que middleware/legal.js: una sola vez sobre /api, antes
// de los routers, decodificando el JWT por su cuenta (req.user aún no existe).
// Y las lecturas pasan a propósito: hay que poder entrar y ver dónde se cambia
// la contraseña.

const { decodeToken } = require('./auth');
const { query } = require('../db');

// Lo que sigue vivo con el cambio pendiente:
//   /auth   → su sesión y, sobre todo, /auth/change-password
//   /legal  → aceptar los documentos. Puede haber dos muros a la vez (cuenta
//             nueva con clave temporal y términos sin aceptar); si este cerrara
//             también aquel, aceptar contestaría 409 y el aviso legal quedaría
//             sin salida.
//   /public → páginas y reservas públicas, ajenas a la sesión
//   /confirmations/public → enlace que el paciente ya tiene en su correo
//   /billing/webhook      → lo llama el procesador de pagos, no una persona
const PREFIJOS_EXENTOS = ['/auth', '/legal', '/public', '/confirmations/public', '/billing/webhook'];

const METODOS_DE_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

function esRutaExenta(pathname) {
  return PREFIJOS_EXENTOS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

async function gate(req, res, next) {
  if (esRutaExenta(req.path)) return next();
  if (METODOS_DE_LECTURA.includes(req.method)) return next();

  const user = decodeToken(req);
  if (!user) return next(); // sin token válido, el 401 lo da `authenticate`

  let pendiente = false;
  try {
    const r = await query('SELECT must_change_password FROM users WHERE id = $1', [user.id]);
    pendiente = !!(r.rows[0] && r.rows[0].must_change_password);
  } catch (err) {
    // Igual que el guardián legal: si la comprobación falla no se cierra la
    // plataforma entera. Una escritura de más pesa menos que dejar a todas las
    // clínicas sin trabajar por una base a medio migrar.
    console.error('[clave-temporal] no se pudo comprobar el estado:', err.message);
    return next();
  }

  if (!pendiente) return next();

  res.status(409).json({
    error: 'Estás usando una clave temporal. Cámbiala para poder guardar cambios.',
    code: 'password_change_required',
  });
}

module.exports = { gate };
