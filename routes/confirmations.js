const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Tokens URL-safe de 32 chars (16 bytes hex). Suficiente entropía contra
// fuerza bruta y permite que el endpoint público sea identificable sin
// requerir login del paciente.
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

// ───────────────────────── Configuración WhatsApp ─────────────────────────

// GET /api/confirmations/whatsapp-config
router.get('/whatsapp-config', authenticate, async (req, res) => {
  const result = await query(
    'SELECT whatsapp_enabled, whatsapp_number, whatsapp_confirmation_template, name FROM clinics WHERE id = $1',
    [req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
  res.json(result.rows[0]);
});

// PUT /api/confirmations/whatsapp-config  (solo clinic_admin)
router.put('/whatsapp-config', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const { whatsapp_confirmation_template } = req.body;
  await query(
    'UPDATE clinics SET whatsapp_confirmation_template = $1 WHERE id = $2',
    [whatsapp_confirmation_template || '', req.user.clinic_id]
  );
  res.json({ success: true });
});

// ───────────────────────── Listado para staff ─────────────────────────

// GET /api/confirmations  → cita + paciente + confirmación (si existe)
router.get('/', authenticate, async (req, res) => {
  let queryStr = `
    SELECT
      a.id AS appointment_id,
      a.scheduled_at,
      a.status AS appointment_status,
      p.id AS patient_id,
      p.name AS patient_name,
      p.phone,
      u.name AS doctor_name,
      c.id AS confirmation_id,
      c.token,
      c.status AS confirmation_status,
      c.sent_at,
      c.sent_by,
      sender.name AS sent_by_name,
      c.responded_at,
      c.message_content
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    LEFT JOIN appointment_confirmations c ON c.appointment_id = a.id
    LEFT JOIN users sender ON c.sent_by = sender.id
    WHERE a.clinic_id = $1
  `;
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  // Un doctor solo ve sus propias citas; clinic_admin ve toda la clínica.
  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at DESC';

  const result = await query(queryStr, params);
  res.json(result.rows);
});

// GET /api/confirmations/appointment/:appointmentId
router.get('/appointment/:appointmentId', authenticate, async (req, res) => {
  const apptCheck = await query(
    'SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.appointmentId, req.user.clinic_id]
  );
  if (apptCheck.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  const result = await query(
    `SELECT c.*, u.name AS sent_by_name FROM appointment_confirmations c
     LEFT JOIN users u ON c.sent_by = u.id
     WHERE c.appointment_id = $1`,
    [req.params.appointmentId]
  );
  res.json(result.rows[0] || null);
});

// ───────────────────────── Crear / reenviar ─────────────────────────

// POST /api/confirmations  → marca enviada y genera/refresca token
router.post('/', authenticate, async (req, res) => {
  const { appointment_id, message_content } = req.body;
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id es requerido' });

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const existing = await query(
    `SELECT id, token, status FROM appointment_confirmations WHERE appointment_id = $1`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    // Si ya respondió, no regeneramos token — solo actualizamos quién/cuándo
    // se reenvió el mensaje (útil para historial).
    await query(
      `UPDATE appointment_confirmations
       SET sent_at = CURRENT_TIMESTAMP, sent_by = $1, message_content = $2,
           status = CASE WHEN status IN ('confirmed','declined') THEN status ELSE 'sent' END
       WHERE id = $3`,
      [req.user.id, message_content || '', row.id]
    );
    return res.json({ id: row.id, token: row.token, success: true });
  }

  const token = newToken();
  const result = await query(
    `INSERT INTO appointment_confirmations
       (appointment_id, patient_id, clinic_id, token, status, sent_at, sent_by, message_content)
     VALUES ($1, $2, $3, $4, 'sent', CURRENT_TIMESTAMP, $5, $6)
     RETURNING id, token`,
    [appointment_id, appt.patient_id, appt.clinic_id, token, req.user.id, message_content || '']
  );
  res.json({ id: result.rows[0].id, token: result.rows[0].token, success: true });
});

// POST /api/confirmations/manual  → staff marca confirmada/declinada a mano
// (p. ej. el paciente confirmó por llamada)
router.post('/manual', authenticate, async (req, res) => {
  const { appointment_id, action } = req.body;
  if (!appointment_id || !['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'appointment_id y action (confirm|decline) son requeridos' });
  }

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
  const apptStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

  const existing = await query(
    `SELECT id FROM appointment_confirmations WHERE appointment_id = $1`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE appointment_confirmations
       SET status = $1, responded_at = CURRENT_TIMESTAMP, confirmed_via = 'manual'
       WHERE id = $2`,
      [newStatus, existing.rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO appointment_confirmations
         (appointment_id, patient_id, clinic_id, token, status, sent_at, sent_by, responded_at, confirmed_via)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP, 'manual')`,
      [appointment_id, appt.patient_id, appt.clinic_id, newToken(), newStatus, req.user.id]
    );
  }

  await query(
    'UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [apptStatus, appointment_id, req.user.clinic_id]
  );

  res.json({ success: true, status: newStatus });
});

// DELETE /api/confirmations/:id  → resetear (clinic_admin)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const result = await query(
    'SELECT appointment_id, status FROM appointment_confirmations WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });

  await query('DELETE FROM appointment_confirmations WHERE id = $1', [req.params.id]);

  // Si la cita estaba marcada como confirmada por esta confirmación, devolverla
  // a pending para no dejar estado inconsistente.
  if (result.rows[0].status === 'confirmed') {
    await query(
      `UPDATE appointments SET status = 'pending' WHERE id = $1 AND clinic_id = $2 AND status = 'confirmed'`,
      [result.rows[0].appointment_id, req.user.clinic_id]
    );
  }
  res.json({ success: true });
});

// ───────────────────────── Endpoints públicos (por token) ─────────────────────────
// No requieren autenticación: cualquiera con el link puede confirmar.
// El token es la "credencial" — la entropía (128 bits) es suficiente para que
// no se adivinen.

// GET /api/confirmations/public/:token  → datos de la cita para mostrar al paciente
router.get('/public/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ error: 'Token inválido' });
  }
  const result = await query(
    `SELECT
       c.id, c.token, c.status, c.responded_at,
       a.id AS appointment_id, a.scheduled_at, a.status AS appointment_status,
       p.name AS patient_name,
       u.name AS doctor_name,
       cl.name AS clinic_name, cl.phone AS clinic_phone, cl.brand_color
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     JOIN patients p ON c.patient_id = p.id
     JOIN users u ON a.doctor_id = u.id
     JOIN clinics cl ON c.clinic_id = cl.id
     WHERE c.token = $1`,
    [token]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });
  res.json(result.rows[0]);
});

// POST /api/confirmations/public/:token  → paciente confirma/declina
router.post('/public/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ error: 'Token inválido' });
  }
  const action = req.body && req.body.action;
  if (!['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action debe ser confirm o decline' });
  }

  const lookup = await query(
    `SELECT c.id, c.appointment_id, c.clinic_id, a.scheduled_at
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     WHERE c.token = $1`,
    [token]
  );
  if (lookup.rows.length === 0) return res.status(404).json({ error: 'Confirmación no encontrada' });
  const row = lookup.rows[0];

  // Permitimos que el paciente cambie su respuesta hasta el momento de la cita.
  if (new Date(row.scheduled_at) < new Date()) {
    return res.status(410).json({ error: 'Esta cita ya pasó' });
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
  const apptStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

  await query(
    `UPDATE appointment_confirmations
     SET status = $1, responded_at = CURRENT_TIMESTAMP, confirmed_via = 'patient_link'
     WHERE id = $2`,
    [newStatus, row.id]
  );
  await query(
    'UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [apptStatus, row.appointment_id, row.clinic_id]
  );

  res.json({ success: true, status: newStatus });
});

// ───────────────────────── Notificaciones para el doctor ─────────────────────────
// GET /api/confirmations/notifications  → confirmaciones del paciente (link público)
// para citas del doctor autenticado, de las últimas 48h. El frontend hace polling
// y compara contra IDs vistos en localStorage para sonar/disparar notificación nativa.
router.get('/notifications', authenticate, async (req, res) => {
  if (req.user.role !== 'doctor') {
    return res.json([]);
  }
  const result = await query(
    `SELECT
       c.id,
       c.status,
       c.responded_at,
       a.id AS appointment_id,
       a.scheduled_at,
       p.name AS patient_name
     FROM appointment_confirmations c
     JOIN appointments a ON c.appointment_id = a.id
     JOIN patients p ON c.patient_id = p.id
     WHERE a.clinic_id = $1
       AND a.doctor_id = $2
       AND c.confirmed_via = 'patient_link'
       AND c.responded_at IS NOT NULL
       AND c.responded_at >= (CURRENT_TIMESTAMP - INTERVAL '48 hours')
     ORDER BY c.responded_at DESC
     LIMIT 30`,
    [req.user.clinic_id, req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
