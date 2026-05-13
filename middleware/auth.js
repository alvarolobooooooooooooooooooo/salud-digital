const jwt = require('jsonwebtoken');
const { query } = require('../db');

const SECRET = process.env.JWT_SECRET || 'salud-digital-jwt-secret-2024';

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
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

module.exports = { authenticate, requireRole, SECRET };
