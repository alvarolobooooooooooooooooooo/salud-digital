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
      const r = await query(
        `UPDATE user_sessions
            SET last_seen = CURRENT_TIMESTAMP
          WHERE jti = $1 AND revoked_at IS NULL
          RETURNING id`,
        [payload.jti]
      );
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

module.exports = { authenticate, requireRole, SECRET, COOKIE_NAME, authCookieOptions };
