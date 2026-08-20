const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, pool } = require('../db');
const { authenticate, SECRET, COOKIE_NAME, authCookieOptions } = require('../middleware/auth');
const { generateSecret, verifyTotp, otpauthUrl } = require('../lib/totp');
const vault = require('../lib/secret-vault');
const { isValidLatLng } = require('../lib/maps-links');
const presupuesto = require('../lib/password-budget');
const mailer = require('../utils/mailer');

// ── Hash señuelo para nivelar los tiempos del login ──
//
// Cuando el correo no existe se compara igualmente contra un hash, para que
// acertar un usuario y fallarlo tarden lo mismo. La idea estaba bien; la cadena
// que había escrita a mano no era un hash bcrypt válido (66 caracteres en vez
// de 60), así que `bcrypt.compare` la rechazaba de entrada:
//
//     correo inexistente → 0,1 ms
//     correo existente   → 118,8 ms
//
// Mil veces de diferencia, medible desde cualquier conexión: era un enumerador
// de usuarios. Y en una plataforma médica, la lista de quién tiene cuenta ya
// dice de más.
//
// Generarlo al arrancar garantiza que sea válido y del mismo coste que los
// reales. Cuesta ~100 ms una sola vez, al cargar el módulo.
const HASH_SENUELO = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

// Abre sesión: registra el jti en user_sessions, firma el JWT y deja la cookie
// HttpOnly puesta. Lo usan login y registro — el alta de cuenta deja al doctor
// ya dentro, sin obligarle a volver a escribir sus credenciales.
async function abrirSesion(user, req, res) {
  const jti = crypto.randomUUID();
  await query(
    'INSERT INTO user_sessions (jti, user_id, user_agent, ip) VALUES ($1, $2, $3, $4)',
    [jti, user.id, String(req.headers['user-agent'] || '').slice(0, 400), getClientIp(req).slice(0, 80)]
  );

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, clinic_id: user.clinic_id, jti },
    SECRET,
    { expiresIn: '24h' }
  );

  // Cookie HttpOnly = la fuente de verdad de la sesión; el token también se devuelve
  // en JSON para no romper código frontend legacy que aún lee localStorage.
  res.cookie(COOKIE_NAME, token, authCookieOptions());
  return token;
}

router.post('/login', async (req, res) => {
  const { email, password, code } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Escribe tu correo y tu contraseña.' });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // El presupuesto se pide ANTES de mirar la base y antes de hashear. Dos
  // motivos: no gastar CPU en una petición que se va a rechazar, y que la
  // respuesta sea idéntica exista o no la cuenta — comprobarlo después
  // convertiría el 503 en un enumerador de usuarios.
  if (!presupuesto.intentarGastar({ autenticado: false })) {
    return presupuesto.responderSinPresupuesto(res);
  }

  const result = await query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  const user = result.rows[0];
  const hashToCheck = user ? user.password : HASH_SENUELO;
  const ok = await bcrypt.compare(password, hashToCheck);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  if (!user.clinic_id && user.role === 'doctor') {
    return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador de tu clínica.' });
  }

  // Aprobación de la plataforma. Se comprueba DESPUÉS de validar la contraseña
  // a propósito: si respondiéramos antes, cualquiera podría averiguar qué
  // correos tienen una solicitud abierta sin conocer la clave.
  if (user.approval_status === 'pending') {
    return res.status(403).json({
      error: 'Tu cuenta todavía está en revisión. Te avisamos por correo en cuanto quede aprobada.',
      code: 'approval_pending',
    });
  }
  if (user.approval_status === 'rejected') {
    return res.status(403).json({
      error: user.approval_notes
        ? `Tu solicitud no fue aprobada: ${user.approval_notes}`
        : 'Tu solicitud de cuenta no fue aprobada. Escríbenos si crees que es un error.',
      code: 'approval_rejected',
    });
  }

  if (user.two_factor_enabled) {
    if (!code) {
      return res.status(401).json({ error: 'Código de verificación requerido', requires_2fa: true });
    }
    const decryptedSecret = vault.decrypt(user.two_factor_secret);
    if (!verifyTotp(code, decryptedSecret)) {
      return res.status(401).json({ error: 'Código de verificación incorrecto', requires_2fa: true });
    }
  }

  const token = await abrirSesion(user, req, res);
  res.json({ token, role: user.role, clinic_id: user.clinic_id });
});

// ── Alta de cuenta (registro público de doctores) ──
//
// El doctor crea su propio espacio: en una sola transacción nacen la clínica y
// su usuario. La cuenta NO queda utilizable de inmediato: nace 'pending' y
// espera a que el administrador de Salud Digital la acepte desde /admin.html.
// Hasta entonces el login responde 403 y no se abre ninguna sesión — quien se
// registra no llega a entrar, así que aquí tampoco se firma un JWT.
//
// Una vez aprobada, la cuenta sigue SIN suscripción, así que la plataforma se
// abre en modo solo lectura hasta que pague (ver middleware/subscription.js).
//
// El rol es 'doctor' y no 'clinic_admin' a propósito: es el único que puede
// atender citas y firmar consultas — que es para lo que se registra — y también
// está en OWNER_ROLES, así que puede contratar y cancelar la suscripción.

// El alta por cuenta propia es solo para podología: es la única especialidad
// que se ofrece en public/registro.html y la única que se acepta aquí, para que
// nadie cree una cuenta con otra ficha de consulta llamando a la API directo.
// Las clínicas ya existentes con otra especialidad no se tocan: esta lista solo
// valida el registro. La cadena es la misma exacta que usa el resto de la app
// para enrutar la consulta (public/citas.html); comparar con === es la
// convención vigente aquí, así que cualquier variante de acento o minúsculas
// rompe el enrutado.
const ESPECIALIDADES = ['Podología'];

// clinics.name es UNIQUE en el esquema. Dos doctores pueden llamar igual a su
// consultorio con toda legitimidad ("Clínica Dental"), así que en vez de
// rechazar el registro se numera el repetido.
async function nombreDeClinicaLibre(client, base) {
  for (let i = 1; i <= 60; i++) {
    const intento = i === 1 ? base : `${base} (${i})`;
    const r = await client.query('SELECT 1 FROM clinics WHERE LOWER(name) = LOWER($1)', [intento]);
    if (r.rowCount === 0) return intento;
  }
  return `${base} (${crypto.randomBytes(3).toString('hex')})`;
}

router.post('/register', async (req, res) => {
  const b = req.body || {};
  const nombre = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  const password = String(b.password || '');
  const especialidad = String(b.specialty || '').trim();
  const clinica = String(b.clinic_name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const telefono = String(b.phone || '').trim().slice(0, 40);
  const ciudad = String(b.city || '').trim().slice(0, 80);
  const direccion = String(b.address || '').trim().slice(0, 300);
  const referencias = String(b.location_notes || '').trim().slice(0, 500);
  const enlaceMapa = /^https?:\/\//i.test(String(b.map_url || '').trim())
    ? String(b.map_url).trim().slice(0, 600) : '';
  // El paso de ubicación del alta es opcional: si no marcó el pin, la clínica se
  // crea sin coordenadas y el geocoder de fondo intentará resolver la dirección.
  const pin = isValidLatLng(b.latitude, b.longitude)
    ? { lat: Number(b.latitude), lng: Number(b.longitude) }
    : null;

  if (nombre.length < 3) return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'El correo electrónico no es válido.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (!ESPECIALIDADES.includes(especialidad)) {
    return res.status(400).json({ error: 'Selecciona una especialidad de la lista.' });
  }
  if (clinica.length < 3) {
    return res.status(400).json({ error: 'Escribe el nombre de tu clínica o consultorio.' });
  }

  const yaExiste = await query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
  if (yaExiste.rowCount > 0) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro.' });
  }

  if (!presupuesto.intentarGastar({ autenticado: false })) {
    return presupuesto.responderSinPresupuesto(res);
  }
  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const nombreClinica = await nombreDeClinicaLibre(client, clinica);
    const c = await client.query(
      `INSERT INTO clinics (name, address, chairs, specialties, phone, email, city,
                            latitude, longitude, map_url, location_notes,
                            location_source, geocoded_at)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        nombreClinica, direccion, especialidad, telefono, email, ciudad,
        pin ? pin.lat : null,
        pin ? pin.lng : null,
        enlaceMapa,
        referencias,
        pin ? 'manual' : null,
        pin ? new Date() : null,
      ]
    );
    const clinicId = c.rows[0].id;
    await client.query(
      `INSERT INTO users (email, password, role, name, clinic_id, specialty, phone,
                          approval_status, approval_requested_at)
       VALUES ($1, $2, 'doctor', $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)`,
      [email, hash, nombre, clinicId, especialidad, telefono]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Carreras contra los índices únicos: dos altas simultáneas con el mismo
    // correo, o con el mismo nombre de clínica entre la comprobación y el INSERT.
    if (err && err.code === '23505') {
      const porEmail = String(err.constraint || err.detail || '').includes('email');
      return res.status(409).json({
        error: porEmail
          ? 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro.'
          : 'Ese nombre de clínica se acaba de ocupar. Cámbialo un poco e intenta de nuevo.',
      });
    }
    console.error('[auth] registro fallido:', err);
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo en un momento.' });
  } finally {
    client.release();
  }

  // Aviso al administrador de la plataforma. Best-effort: la solicitud ya está
  // guardada y aparece igual en su bandeja, así que un fallo del correo no puede
  // devolver un error a quien acaba de registrarse.
  mailer
    .sendSignupPendingAlert({
      doctorName: nombre,
      clinicName: clinica,
      email,
      specialty: especialidad,
      city: ciudad,
    })
    .catch(() => {});

  res.status(202).json({
    pending: true,
    status: 'pending_approval',
    message: 'Recibimos tu solicitud. Te avisaremos por correo en cuanto el equipo de Salud Digital la apruebe.',
  });
});

router.post('/logout', authenticate, async (req, res) => {
  if (req.user.jti) {
    await query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE jti = $1', [req.user.jti]);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/sessions', authenticate, async (req, res) => {
  const r = await query(
    `SELECT id, jti, user_agent, ip, created_at, last_seen
       FROM user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_seen DESC`,
    [req.user.id]
  );
  const currentJti = req.user.jti;
  res.json(r.rows.map(s => ({
    id: s.id,
    user_agent: s.user_agent || '',
    ip: s.ip || '',
    created_at: s.created_at,
    last_seen: s.last_seen,
    current: s.jti === currentJti
  })));
});

router.delete('/sessions/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });
  const r = await query(
    'UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id',
    [id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Sesión no encontrada.' });
  res.json({ ok: true });
});

router.post('/sessions/revoke-others', authenticate, async (req, res) => {
  const r = await query(
    `UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND revoked_at IS NULL AND jti <> $2
      RETURNING id`,
    [req.user.id, req.user.jti || '']
  );
  res.json({ ok: true, revoked: r.rowCount });
});

router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone,
            u.photo_url, c.name as clinic_name
       FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
      WHERE u.id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/change-password', authenticate, async (req, res) => {
  const { current, new_password } = req.body;
  if (!current || !new_password) return res.status(400).json({ error: 'Faltan campos requeridos.' });
  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  // Esta ruta gasta DOS operaciones (comprobar la actual y hashear la nueva),
  // así que pide dos fichas. Va con `autenticado`, que puede echar mano de la
  // reserva: quien ya está dentro tiene que poder cambiar su contraseña incluso
  // mientras una avalancha de inicios de sesión anónimos consume el resto.
  if (!presupuesto.intentarGastar({ autenticado: true }) ||
      !presupuesto.intentarGastar({ autenticado: true })) {
    return presupuesto.responderSinPresupuesto(res);
  }

  const result = await query('SELECT id, password FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const ok = await bcrypt.compare(current, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
  // Revocar todas las otras sesiones — si cambian la contraseña, asumir compromiso de las demás
  await query(
    `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND revoked_at IS NULL AND jti <> $2`,
    [req.user.id, req.user.jti || '']
  );
  res.json({ ok: true });
});

router.get('/2fa/status', authenticate, async (req, res) => {
  const result = await query('SELECT two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
  res.json({ enabled: !!result.rows[0]?.two_factor_enabled });
});

router.post('/2fa/setup', authenticate, async (req, res) => {
  const result = await query('SELECT email, two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (user.two_factor_enabled) return res.status(400).json({ error: '2FA ya está habilitado.' });

  const secret = generateSecret();
  // Persistimos cifrado pero devolvemos el plaintext al usuario (necesita el QR/secret base32).
  await query('UPDATE users SET two_factor_pending_secret = $1 WHERE id = $2', [vault.encrypt(secret), req.user.id]);

  const url = otpauthUrl({ secret, label: user.email, issuer: 'SaludDigital' });
  res.json({ secret, otpauth_url: url });
});

router.post('/2fa/enable', authenticate, async (req, res) => {
  const { code } = req.body;
  const result = await query(
    'SELECT two_factor_pending_secret, two_factor_enabled FROM users WHERE id = $1',
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (user.two_factor_enabled) return res.status(400).json({ error: '2FA ya está habilitado.' });
  if (!user.two_factor_pending_secret) {
    return res.status(400).json({ error: 'No hay configuración pendiente. Inicia el proceso de nuevo.' });
  }
  const pendingPlain = vault.decrypt(user.two_factor_pending_secret);
  if (!verifyTotp(code, pendingPlain)) {
    return res.status(401).json({ error: 'Código incorrecto. Verifica la hora de tu dispositivo y vuelve a intentar.' });
  }

  // Re-cifrar al copiar al campo definitivo (idempotente si ya venía cifrado).
  await query(
    'UPDATE users SET two_factor_secret = $1, two_factor_enabled = TRUE, two_factor_pending_secret = NULL WHERE id = $2',
    [vault.encrypt(pendingPlain), req.user.id]
  );
  res.json({ ok: true });
});

router.post('/2fa/disable', authenticate, async (req, res) => {
  const { password, code } = req.body;
  const result = await query(
    'SELECT password, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (!user.two_factor_enabled) return res.status(400).json({ error: '2FA no está habilitado.' });

  let verified = false;
  if (password) {
    // Otro punto que gasta bcrypt, así que también pasa por el presupuesto.
    // Va como `autenticado`: quien está desactivando su 2FA ya tiene sesión.
    if (!presupuesto.intentarGastar({ autenticado: true })) {
      return presupuesto.responderSinPresupuesto(res);
    }
    verified = await bcrypt.compare(password, user.password);
  }
  if (!verified && code) {
    const decryptedSecret = vault.decrypt(user.two_factor_secret);
    if (verifyTotp(code, decryptedSecret)) verified = true;
  }

  if (!verified) {
    return res.status(401).json({ error: 'Verificación fallida. Ingresa tu contraseña o un código TOTP válido.' });
  }

  await query(
    'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = FALSE, two_factor_pending_secret = NULL WHERE id = $1',
    [req.user.id]
  );
  res.json({ ok: true });
});

module.exports = router;
