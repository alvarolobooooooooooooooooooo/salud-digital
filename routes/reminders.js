const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// GET /api/reminders/whatsapp-config
// Returns the clinic's WhatsApp config: enabled, number, template
router.get('/whatsapp-config', authenticate, async (req, res) => {
  const result = await query(
    'SELECT whatsapp_enabled, whatsapp_number, whatsapp_template, name FROM clinics WHERE id = $1',
    [req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
  res.json(result.rows[0]);
});

// PUT /api/reminders/whatsapp-config
// Update the clinic's WhatsApp config (clinic_admin only)
router.put('/whatsapp-config', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin' && req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { whatsapp_enabled, whatsapp_number, whatsapp_template } = req.body;

  // Normalize the phone number: only digits
  const normalizedNumber = (whatsapp_number || '').replace(/\D/g, '');
  if (whatsapp_enabled && normalizedNumber && !/^\d{8,15}$/.test(normalizedNumber)) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido. Use formato internacional sin +, espacios ni guiones.' });
  }

  await query(
    'UPDATE clinics SET whatsapp_enabled = $1, whatsapp_number = $2, whatsapp_template = $3 WHERE id = $4',
    [!!whatsapp_enabled, normalizedNumber, whatsapp_template || '', req.user.clinic_id]
  );
  res.json({ success: true });
});

// GET /api/reminders
// List all reminders for the clinic, joined with appointment/patient data
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
      r.id AS reminder_id,
      r.status AS reminder_status,
      r.sent_at,
      r.sent_by,
      sender.name AS sent_by_name,
      r.message_content,
      r.channel
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    LEFT JOIN appointment_reminders r ON r.appointment_id = a.id AND r.channel = 'whatsapp'
    LEFT JOIN users sender ON r.sent_by = sender.id
    WHERE a.clinic_id = $1
  `;
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at DESC';

  const result = await query(queryStr, params);
  res.json(result.rows);
});

// GET /api/reminders/appointment/:appointmentId
// Get the reminder (if any) for a specific appointment
router.get('/appointment/:appointmentId', authenticate, async (req, res) => {
  const apptCheck = await query(
    'SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.appointmentId, req.user.clinic_id]
  );
  if (apptCheck.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  const result = await query(
    `SELECT r.*, u.name AS sent_by_name FROM appointment_reminders r
     LEFT JOIN users u ON r.sent_by = u.id
     WHERE r.appointment_id = $1 AND r.channel = 'whatsapp'
     ORDER BY r.created_at DESC LIMIT 1`,
    [req.params.appointmentId]
  );
  res.json(result.rows[0] || null);
});

// POST /api/reminders
// Mark a reminder as manually sent
router.post('/', authenticate, async (req, res) => {
  const { appointment_id, message_content } = req.body;
  if (!appointment_id) {
    return res.status(400).json({ error: 'appointment_id es requerido' });
  }

  const apptResult = await query(
    'SELECT id, patient_id, clinic_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [appointment_id, req.user.clinic_id]
  );
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  // Check if a reminder already exists; update or create
  const existing = await query(
    `SELECT id FROM appointment_reminders WHERE appointment_id = $1 AND channel = 'whatsapp'`,
    [appointment_id]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE appointment_reminders
       SET status = 'manual_sent', sent_at = CURRENT_TIMESTAMP, sent_by = $1, message_content = $2
       WHERE id = $3`,
      [req.user.id, message_content || '', existing.rows[0].id]
    );
    res.json({ id: existing.rows[0].id, success: true });
  } else {
    const result = await query(
      `INSERT INTO appointment_reminders
        (appointment_id, patient_id, clinic_id, channel, status, sent_at, sent_by, message_content)
       VALUES ($1, $2, $3, 'whatsapp', 'manual_sent', CURRENT_TIMESTAMP, $4, $5)
       RETURNING id`,
      [appointment_id, appt.patient_id, appt.clinic_id, req.user.id, message_content || '']
    );
    res.json({ id: result.rows[0].id, success: true });
  }
});

// DELETE /api/reminders/:id
// Reset a reminder back to pending (delete the record)
router.delete('/:id', authenticate, async (req, res) => {
  const result = await query(
    'SELECT id FROM appointment_reminders WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Recordatorio no encontrado' });

  await query('DELETE FROM appointment_reminders WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
