const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/', authenticate, async (req, res) => {
  let queryStr = `SELECT a.*, p.name AS patient_name, u.name AS doctor_name, u.email AS doctor_email FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.clinic_id = $1`;
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

router.put('/:id', authenticate, async (req, res) => {
  const { doctor_id, scheduled_at, status } = req.body;
  const apptResult = await query('SELECT id, doctor_id as current_doctor_id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

  const fields = [];
  const vals   = [];
  let paramIndex = 1;

  let specialty = null;
  if (doctor_id !== undefined) {
    const doctorResult = await query('SELECT specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3',
      [doctor_id, req.user.clinic_id, 'doctor']);
    if (doctorResult.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
    specialty = doctorResult.rows[0].specialty || '';
    fields.push(`doctor_id = $${paramIndex++}`);    vals.push(doctor_id);
    fields.push(`specialty = $${paramIndex++}`);    vals.push(specialty);
  }

  if (scheduled_at !== undefined) {
    fields.push(`scheduled_at = $${paramIndex++}`);
    vals.push(scheduled_at);
  }
  if (status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    vals.push(status);
  }

  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });

  vals.push(req.params.id);
  await query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = $${paramIndex}`, vals);
  res.json({ success: true });
});

router.get('/today', authenticate, async (req, res) => {
  const today = getLocalDateString();
  let queryStr = `SELECT a.*, p.name AS patient_name, u.name AS doctor_name, u.email AS doctor_email FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.clinic_id = $1 AND a.scheduled_at::date = $2`;
  const params = [req.user.clinic_id, today];
  let paramIndex = 3;

  if (req.user.role === 'doctor') {
    queryStr += ` AND a.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY a.scheduled_at';
  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.post('/', authenticate, async (req, res) => {
  if (req.user.role === 'clinic_admin') {
    return res.status(403).json({ error: 'Clinic admin cannot create appointments' });
  }
  const { patient_id, doctor_id, scheduled_at } = req.body;
  if (!patient_id || !doctor_id || !scheduled_at) {
    return res.status(400).json({ error: 'patient_id, doctor_id y scheduled_at son requeridos' });
  }

  const patientResult = await query('SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
    [patient_id, req.user.clinic_id]);
  if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

  const doctorResult = await query('SELECT specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3',
    [doctor_id, req.user.clinic_id, 'doctor']);
  if (doctorResult.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

  const result = await query(
    'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [patient_id, doctor_id, req.user.clinic_id, doctorResult.rows[0].specialty || '', scheduled_at, 'pending']
  );
  res.json({ id: result.rows[0].id });
});

router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'waiting', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const apptResult = await query('SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (apptResult.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  await query('UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3',
    [status, req.params.id, req.user.clinic_id]);
  res.json({ success: true });
});

router.delete('/:id', authenticate, async (req, res) => {
  const apptResult = await query('SELECT id FROM appointments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  if (apptResult.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  await query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
