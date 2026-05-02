const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  let queryStr;
  let params;

  if (req.user.role === 'doctor') {
    queryStr = `SELECT DISTINCT p.* FROM patients p
      WHERE p.clinic_id = $1 AND (
        p.created_by = $2 OR
        p.id IN (SELECT DISTINCT patient_id FROM appointments WHERE doctor_id = $3 AND clinic_id = $4)
      )
      ORDER BY p.name`;
    params = [req.user.clinic_id, req.user.id, req.user.id, req.user.clinic_id];
  } else {
    queryStr = 'SELECT * FROM patients WHERE clinic_id = $1 ORDER BY name';
    params = [req.user.clinic_id];
  }

  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.get('/:id', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  const criticalResult = await query('SELECT * FROM critical_info WHERE patient_id = $1', [patient.id]);
  const critical_info = criticalResult.rows[0] || {};

  let consultations = [];
  if (req.user.role !== 'clinic_admin') {
    let queryStr = 'SELECT c.id, c.patient_id, c.notes, c.diagnosis, c.treatment, c.specialty, c.odontogram_state, c.cost, c.payment_status, c.lifestyle, c.procedures, c.radiography_notes, c.observations, c.doctor_id, c.visit_reason, c.created_at, c.clinic_id, u.name as doctor_name FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 AND c.clinic_id = $2';
    const params = [patient.id, req.user.clinic_id];
    let paramIndex = 3;

    if (req.user.role === 'doctor') {
      queryStr += ` AND c.doctor_id = $${paramIndex}`;
      params.push(req.user.id);
    }

    queryStr += ' ORDER BY c.created_at DESC';
    const consResult = await query(queryStr, params);
    consultations = consResult.rows;
  }

  res.json({ ...patient, critical_info, consultations });
});

router.post('/', authenticate, async (req, res) => {
  const { name, identity_number, age, birth_date, gender, phone } = req.body;
  if (!name || !identity_number) {
    return res.status(400).json({ error: 'name e identity_number son requeridos' });
  }

  let resolvedAge = parseInt(age) || 0;
  if (birth_date && !age) {
    const birth = new Date(birth_date);
    const today = new Date();
    resolvedAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) resolvedAge--;
  }

  const result = await query(
    'INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [
      name.trim(), identity_number.trim(), resolvedAge,
      birth_date || '', gender || '', phone || '',
      req.user.clinic_id, req.user.role === 'doctor' ? req.user.id : null
    ]
  );

  const patientId = result.rows[0].id;
  await query('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
    [patientId, '', '', '']);

  res.json({ id: patientId, name, identity_number, age: resolvedAge, birth_date, gender, phone, clinic_id: req.user.clinic_id });
});

router.put('/:id', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { name, birth_date, gender, phone } = req.body;

  await query('UPDATE patients SET name = $1, birth_date = $2, gender = $3, phone = $4 WHERE id = $5 AND clinic_id = $6',
    [name || patient.name, birth_date || patient.birth_date, gender || patient.gender, phone || patient.phone, patient.id, req.user.clinic_id]);

  res.json({ success: true });
});

router.put('/:id/critical-info', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { allergies = '', medications = '', conditions = '' } = req.body;
  const existingResult = await query('SELECT id FROM critical_info WHERE patient_id = $1', [patient.id]);

  if (existingResult.rows.length > 0) {
    await query('UPDATE critical_info SET allergies = $1, medications = $2, conditions = $3 WHERE patient_id = $4',
      [allergies, medications, conditions, patient.id]);
  } else {
    await query('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
      [patient.id, allergies, medications, conditions]);
  }
  res.json({ success: true });
});

router.get('/:id/consultations', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  if (req.user.role === 'doctor') {
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [patient.id, req.user.id, req.user.clinic_id]
    );
    if (parseInt(accessResult.rows[0].count) === 0) return res.status(403).json({ error: 'Access denied' });
  }

  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 5;

  let countQueryStr = 'SELECT COUNT(*) as count FROM consultations WHERE patient_id = $1 AND clinic_id = $2';
  let params = [patient.id, req.user.clinic_id];
  let paramIndex = 3;

  if (req.user.role === 'doctor') {
    countQueryStr += ` AND doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  const totalResult = await query(countQueryStr, params);
  const total = parseInt(totalResult.rows[0].count);

  let queryStr = 'SELECT c.*, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 AND c.clinic_id = $2';
  params = [patient.id, req.user.clinic_id];
  paramIndex = 3;

  if (req.user.role === 'doctor') {
    queryStr += ` AND c.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const consResult = await query(queryStr, params);

  res.json({ consultations: consResult.rows, total, offset, limit });
});

router.put('/:id/odontogram', authenticate, async (req, res) => {
  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]);
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { odontogram_state } = req.body;
  const odontoStr = typeof odontogram_state === 'string' ? odontogram_state : JSON.stringify(odontogram_state || {});

  await query('UPDATE patients SET odontogram_state = $1 WHERE id = $2 AND clinic_id = $3',
    [odontoStr, patient.id, req.user.clinic_id]);

  res.json({ success: true });
});

module.exports = router;
