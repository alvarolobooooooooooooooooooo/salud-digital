const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: Get local date string (YYYY-MM-DD) in user's timezone
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/', authenticate, (req, res) => {
  let query = `
    SELECT a.*, p.name AS patient_name, u.name AS doctor_name, u.email AS doctor_email
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    WHERE a.clinic_id = ?
  `;
  const params = [req.user.clinic_id];

  if (req.user.role === 'doctor') {
    query += ' AND a.doctor_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY a.scheduled_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.put('/:id', authenticate, (req, res) => {
  const { doctor_id, scheduled_at, status } = req.body;
  const appt = db.prepare('SELECT id, doctor_id as current_doctor_id FROM appointments WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const fields = [];
  const vals   = [];

  let specialty = null;
  if (doctor_id !== undefined) {
    const doctor = db.prepare('SELECT specialty FROM users WHERE id = ? AND clinic_id = ? AND role = ?')
      .get(doctor_id, req.user.clinic_id, 'doctor');
    if (!doctor) return res.status(404).json({ error: 'Doctor no encontrado' });
    specialty = doctor.specialty || '';
    fields.push('doctor_id = ?');    vals.push(doctor_id);
    fields.push('specialty = ?');    vals.push(specialty);
  }

  if (scheduled_at !== undefined) { fields.push('scheduled_at = ?'); vals.push(scheduled_at); }
  if (status       !== undefined) { fields.push('status = ?');       vals.push(status); }
  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
  db.prepare(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ success: true });
});

router.get('/today', authenticate, (req, res) => {
  const today = getLocalDateString();
  let query = `
    SELECT a.*, p.name AS patient_name, u.name AS doctor_name, u.email AS doctor_email
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN users u ON a.doctor_id = u.id
    WHERE a.clinic_id = ? AND DATE(a.scheduled_at) = ?
  `;
  const params = [req.user.clinic_id, today];

  if (req.user.role === 'doctor') {
    query += ' AND a.doctor_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY a.scheduled_at';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.post('/', authenticate, (req, res) => {
  if (req.user.role === 'clinic_admin') {
    return res.status(403).json({ error: 'Clinic admin cannot create appointments' });
  }
  const { patient_id, doctor_id, scheduled_at } = req.body;
  if (!patient_id || !doctor_id || !scheduled_at) {
    return res.status(400).json({ error: 'patient_id, doctor_id y scheduled_at son requeridos' });
  }
  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND clinic_id = ?')
    .get(patient_id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const doctor = db.prepare('SELECT specialty FROM users WHERE id = ? AND clinic_id = ? AND role = ?')
    .get(doctor_id, req.user.clinic_id, 'doctor');
  if (!doctor) return res.status(404).json({ error: 'Doctor no encontrado' });

  const result = db.prepare(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(patient_id, doctor_id, req.user.clinic_id, doctor.specialty || '', scheduled_at, 'pending');
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'waiting', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });
  db.prepare('UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?').run(status, req.params.id, req.user.clinic_id);
  res.json({ success: true });
});

router.delete('/:id', authenticate, (req, res) => {
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
