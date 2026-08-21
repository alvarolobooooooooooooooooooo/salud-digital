const jwt = require('jsonwebtoken');
const { query } = require('../db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres).');
}

const COOKIE_NAME = 'sd_token';
// Configuración de la cookie: HttpOnly cierra el robo desde JS (mitiga XSS),
// Secure obliga HTTPS en prod, SameSite=Lax basta como CSRF protection moderno
// para POSTs JSON (lax bloquea cross-site form posts pero deja pasar navegaciones
// desde links de invitación por email — necesario en este flujo).
function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function tokenFromRequest(req) {
  // Preferimos cookie (HttpOnly, no robable por XSS). Bearer header se mantiene
  // como fallback durante la migración para no desloguear a quien tiene sesiones viejas.
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

// Roles que trabajan DENTRO de la clínica y por tanto pueden tocar expedientes.
// Lo que no está en esta lista no es personal clínico y no tiene nada que hacer
// en /api salvo su propia sesión (ver middleware/clinical-access.js).
const CLINICAL_ROLES = ['super_admin', 'clinic_admin', 'doctor', 'receptionist'];

// Decodifica el JWT sin tocar la BD ni validar la sesión. Lo usan los guardianes
// que corren ANTES de los routers, cuando req.user todavía no existe. Devuelve
// null si no hay token o no verifica: en ese caso quien responde el 401 es
// `authenticate`, con su mensaje de siempre.
function decodeToken(req) {
  const token = tokenFromRequest(req);
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// ── Comprobar la sesión sin escribir en cada petición ──
// Antes, CADA petición autenticada ejecutaba un UPDATE de last_seen. Una sola
// pantalla de recepción son ~51 peticiones/min, así que la plataforma escribía
// en Postgres tantas veces como leía: WAL, autovacuum y una fila caliente por
// sesión, por cada refresco de cada pantalla abierta.
//
// La comprobación de REVOCACIÓN sí tiene que ir en cada petición: es lo que hace
// que cerrar sesión surta efecto al instante. La marca de ACTIVIDAD no. Esta
// sentencia hace las dos cosas de una vez y solo escribe si la marca está vieja;
// cuando no lo está el UPDATE no toca ninguna fila y Postgres cierra la
// transacción sin escribir WAL, así que sale casi tan barato como un SELECT.
//
// El intervalo tiene que quedar POR DEBAJO de la ventana de presencia del chat
// (routes/messaging.js: "online" = last_seen en los últimos 5 minutos), o los
// doctores parpadearían entre conectado y desconectado. Con 60 s la marca nunca
// se queda más de un minuto vieja y desaparece el ~98% de las escrituras.
const SESSION_TOUCH_SECONDS = Math.max(
  0,
  parseInt(process.env.SESSION_TOUCH_SECONDS || '60', 10) || 0,
);

const SQL_SESION_VIVA = `
  WITH viva AS (
    SELECT id, last_seen
      FROM user_sessions
     WHERE jti = $1 AND revoked_at IS NULL
  ), refrescada AS (
    UPDATE user_sessions u
       SET last_seen = CURRENT_TIMESTAMP
      FROM viva
     WHERE u.id = viva.id
       AND (viva.last_seen IS NULL
            OR viva.last_seen < CURRENT_TIMESTAMP - ($2 || ' seconds')::interval)
    RETURNING u.id
  )
  SELECT id FROM viva`;

async function authenticate(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (payload.jti) {
    try {
      const r = await query(SQL_SESION_VIVA, [payload.jti, SESSION_TOUCH_SECONDS]);
      if (r.rowCount === 0) {
        return res.status(401).json({ error: 'Session revoked' });
      }
    } catch {
      return res.status(401).json({ error: 'Session validation failed' });
    }
  }

  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  authenticate, requireRole, decodeToken, CLINICAL_ROLES,
  SECRET, COOKIE_NAME, authCookieOptions,
};
