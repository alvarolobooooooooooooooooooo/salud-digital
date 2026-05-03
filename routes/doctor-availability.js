const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  let doctorId = req.user.id;

  if (req.user.role === 'clinic_admin' && req.query.doctor_id) {
    const doctorCheck = await query(
      `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
      [req.query.doctor_id, req.user.clinic_id]
    );
    if (doctorCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
    doctorId = parseInt(req.query.doctor_id);
  } else if (req.user.role !== 'doctor' && req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const result = await query(
    `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration, enabled
     FROM doctor_availability WHERE doctor_id = $1 ORDER BY day_of_week`,
    [doctorId]
  );
  res.json(result.rows);
});

router.put('/', authenticate, async (req, res) => {
  let doctorId = req.user.id;

  if (req.user.role === 'clinic_admin' && req.body.doctor_id) {
    const doctorCheck = await query(
      `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
      [req.body.doctor_id, req.user.clinic_id]
    );
    if (doctorCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
    doctorId = parseInt(req.body.doctor_id);
  } else if (req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { availability } = req.body;
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'availability debe ser un array' });
  }

  await query('DELETE FROM doctor_availability WHERE doctor_id = $1', [doctorId]);

  for (const slot of availability) {
    if (!slot.enabled) continue;
    if (typeof slot.day_of_week !== 'number' || !slot.start_time || !slot.end_time) continue;

    await query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [doctorId, slot.day_of_week, slot.start_time, slot.end_time, slot.slot_duration || 30, true]
    );
  }

  res.json({ success: true });
});

module.exports = router;
