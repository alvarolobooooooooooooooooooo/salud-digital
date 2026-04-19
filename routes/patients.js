const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  const patients = db.prepare(
    'SELECT * FROM patients WHERE clinic_id = ? ORDER BY name'
  ).all(req.user.clinic_id);
  res.json(patients);
});

router.get('/:id', authenticate, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const critical_info = db.prepare('SELECT * FROM critical_info WHERE patient_id = ?').get(patient.id) || {};

  let consultations = [];
  if (req.user.role !== 'clinic_admin') {
    consultations = db.prepare(
      'SELECT c.id, c.patient_id, c.notes, c.diagnosis, c.treatment, c.specialty, c.odontogram_state, c.cost, c.payment_status, c.lifestyle, c.procedures, c.radiography_notes, c.observations, c.doctor_id, c.visit_reason, c.created_at, c.clinic_id, u.name as doctor_name FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = ? AND c.clinic_id = ? ORDER BY c.created_at DESC'
    ).all(patient.id, req.user.clinic_id);
  }

  res.json({ ...patient, critical_info, consultations });
});

router.post('/', authenticate, (req, res) => {
  const { name, identity_number, age, birth_date, gender, phone } = req.body;
  if (!name || !identity_number) {
    return res.status(400).json({ error: 'name e identity_number son requeridos' });
  }

  // Calculate age from birth_date if not provided
  let resolvedAge = parseInt(age) || 0;
  if (birth_date && !age) {
    const birth = new Date(birth_date);
    const today = new Date();
    resolvedAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) resolvedAge--;
  }

  const result = db.prepare(
    'INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name.trim(), identity_number.trim(), resolvedAge,
    birth_date || '', gender || '', phone || '',
    req.user.clinic_id
  );

  db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
    .run(result.lastInsertRowid, '', '', '');

  res.json({ id: result.lastInsertRowid, name, identity_number, age: resolvedAge, birth_date, gender, phone, clinic_id: req.user.clinic_id });
});

router.put('/:id', authenticate, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { name, birth_date, gender, phone } = req.body;
  db.prepare('UPDATE patients SET name = ?, birth_date = ?, gender = ?, phone = ? WHERE id = ? AND clinic_id = ?')
    .run(name || patient.name, birth_date || patient.birth_date, gender || patient.gender, phone || patient.phone, patient.id, req.user.clinic_id);

  res.json({ success: true });
});

router.put('/:id/critical-info', authenticate, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { allergies = '', medications = '', conditions = '' } = req.body;
  const existing = db.prepare('SELECT id FROM critical_info WHERE patient_id = ?').get(patient.id);

  if (existing) {
    db.prepare('UPDATE critical_info SET allergies = ?, medications = ?, conditions = ? WHERE patient_id = ?')
      .run(allergies, medications, conditions, patient.id);
  } else {
    db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
      .run(patient.id, allergies, medications, conditions);
  }
  res.json({ success: true });
});

router.get('/:id/consultations', authenticate, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 5;

  const total = db.prepare('SELECT COUNT(*) as count FROM consultations WHERE patient_id = ? AND clinic_id = ?')
    .get(patient.id, req.user.clinic_id);

  const consultations = db.prepare('SELECT c.*, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = ? AND c.clinic_id = ? ORDER BY c.created_at DESC LIMIT ? OFFSET ?')
    .all(patient.id, req.user.clinic_id, limit, offset);

  res.json({ consultations, total: total.count, offset, limit });
});

router.put('/:id/odontogram', authenticate, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(req.params.id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const { odontogram_state } = req.body;
  const odontoStr = typeof odontogram_state === 'string' ? odontogram_state : JSON.stringify(odontogram_state || {});

  db.prepare('UPDATE patients SET odontogram_state = ? WHERE id = ? AND clinic_id = ?')
    .run(odontoStr, patient.id, req.user.clinic_id);

  res.json({ success: true });
});

module.exports = router;
