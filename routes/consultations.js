const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: Get local date string (YYYY-MM-DD) in user's timezone
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET - Finance stats
router.get('/finances/summary', authenticate, (req, res) => {
  const now = new Date();
  const monthStart = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  let monthQuery = 'SELECT COALESCE(SUM(cost), 0) as total FROM consultations WHERE clinic_id = ? AND payment_status = \'paid\' AND created_at >= ? AND created_at <= ?';
  let totalQuery = 'SELECT COALESCE(SUM(cost), 0) as total FROM consultations WHERE clinic_id = ? AND payment_status = \'paid\'';
  let pendingQuery = 'SELECT COUNT(*) as count FROM consultations WHERE clinic_id = ? AND payment_status = \'pending\'';

  // Build parameters for each query
  const monthParams = [req.user.clinic_id, monthStart, monthEnd];
  const totalParams = [req.user.clinic_id];
  const pendingParams = [req.user.clinic_id];

  // Filter by doctor if user is a doctor
  if (req.user.role === 'doctor') {
    monthQuery += ' AND doctor_id = ?';
    totalQuery += ' AND doctor_id = ?';
    pendingQuery += ' AND doctor_id = ?';
    monthParams.push(req.user.id);
    totalParams.push(req.user.id);
    pendingParams.push(req.user.id);
  }

  const monthRevenue = db.prepare(monthQuery).get(...monthParams);
  const totalRevenue = db.prepare(totalQuery).get(...totalParams);
  const pendingCount = db.prepare(pendingQuery).get(...pendingParams);

  res.json({ month_revenue: monthRevenue.total, total_revenue: totalRevenue.total, pending_count: pendingCount.count });
});

// GET - Weekly income breakdown (last 7 days)
router.get('/finances/weekly', authenticate, (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let query = `
    SELECT DATE(created_at) as date, COALESCE(SUM(cost), 0) as total
    FROM consultations
    WHERE clinic_id = ? AND payment_status = 'paid' AND created_at >= ?
  `;
  const params = [req.user.clinic_id, getLocalDateString(sevenDaysAgo)];

  // Filter by doctor if user is a doctor
  if (req.user.role === 'doctor') {
    query += ' AND doctor_id = ?';
    params.push(req.user.id);
  }

  query += ' GROUP BY DATE(created_at) ORDER BY date ASC';

  const results = db.prepare(query).all(...params);

  // Fill in missing days with 0
  const dailyData = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    dailyData[dateStr] = 0;
  }

  results.forEach(r => {
    dailyData[r.date] = r.total;
  });

  const days = Object.keys(dailyData).sort();
  const values = days.map(d => dailyData[d]);

  res.json({ days, values });
});

// GET - Pending consultations for table
router.get('/finances/pending', authenticate, (req, res) => {
  let query = 'SELECT c.id, c.created_at, p.name as patient_name, p.phone, c.cost FROM consultations c JOIN patients p ON c.patient_id = p.id WHERE c.clinic_id = ? AND c.payment_status = \'pending\'';
  const params = [req.user.clinic_id];

  // Filter by doctor if user is a doctor
  if (req.user.role === 'doctor') {
    query += ' AND c.doctor_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY c.created_at DESC LIMIT 50';
  const consultations = db.prepare(query).all(...params);

  res.json(consultations);
});

// GET - Breakdown by doctor (clinic_admin only)
router.get('/finances/by-doctor', authenticate, (req, res) => {
  if (req.user.role === 'doctor') {
    return res.status(403).json({ error: 'Only clinic admin can view this' });
  }

  const query = `
    SELECT
      u.id as doctor_id,
      u.name as doctor_name,
      u.specialty,
      COUNT(DISTINCT c.id) as consultation_count,
      COALESCE(SUM(CASE WHEN c.payment_status = 'paid' THEN c.cost ELSE 0 END), 0) as paid_amount,
      COALESCE(SUM(CASE WHEN c.payment_status = 'pending' THEN c.cost ELSE 0 END), 0) as pending_amount,
      COALESCE(SUM(c.cost), 0) as total_amount
    FROM users u
    LEFT JOIN consultations c ON u.id = c.doctor_id AND c.clinic_id = ? AND u.clinic_id = ?
    WHERE u.clinic_id = ? AND u.role = 'doctor'
    GROUP BY u.id
    ORDER BY total_amount DESC
  `;

  const doctors = db.prepare(query).all(req.user.clinic_id, req.user.clinic_id, req.user.clinic_id);
  res.json(doctors);
});

// POST - Create consultation
router.post('/', authenticate, (req, res) => {
  const { patient_id, notes, diagnosis, treatment, specialty, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, appointment_id } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id required' });

  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND clinic_id = ?')
    .get(patient_id, req.user.clinic_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const odontoStr = typeof odontogram_state === 'string' ? odontogram_state : JSON.stringify(odontogram_state || {});
  const lifestyleStr = typeof lifestyle === 'string' ? lifestyle : JSON.stringify(lifestyle || {});
  const costNum = Number(cost) || 0;
  console.log('Received cost:', cost, 'Converted to:', costNum);

  const result = db.prepare(
    'INSERT INTO consultations (patient_id, notes, diagnosis, treatment, specialty, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, clinic_id, appointment_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(patient_id, notes || '', diagnosis || '', treatment || '', specialty || '', odontoStr, costNum, payment_status || 'pending', lifestyleStr, procedures || '', radiography_notes || '', observations || '', doctor_id || null, visit_reason || '', req.user.clinic_id, appointment_id || null);

  res.json({ id: result.lastInsertRowid, patient_id, notes, diagnosis, treatment });
});

// GET - Retrieve consultation by appointment_id (specific route before generic :id)
router.get('/appointment/:appointment_id', authenticate, (req, res) => {
  const { appointment_id } = req.params;

  // First try to find by appointment_id
  let query = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.appointment_id = ? AND c.clinic_id = ?';
  let params = [appointment_id, req.user.clinic_id];

  if (req.user.role === 'doctor') {
    query += ' AND c.doctor_id = ?';
    params.push(req.user.id);
  }

  let consultation = db.prepare(query).get(...params);

  // If not found, get the appointment's patient and find their most recent consultation
  if (!consultation) {
    const appointment = db.prepare('SELECT patient_id, doctor_id FROM appointments WHERE id = ? AND clinic_id = ?')
      .get(appointment_id, req.user.clinic_id);

    if (appointment && (req.user.role !== 'doctor' || appointment.doctor_id === req.user.id)) {
      query = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = ? AND c.clinic_id = ?';
      params = [appointment.patient_id, req.user.clinic_id];

      if (req.user.role === 'doctor') {
        query += ' AND c.doctor_id = ?';
        params.push(req.user.id);
      }

      query += ' ORDER BY c.created_at DESC LIMIT 1';
      consultation = db.prepare(query).get(...params);
    }
  }

  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  try { consultation.odontogram_state = JSON.parse(consultation.odontogram_state || '{}'); } catch {}
  try { consultation.lifestyle = JSON.parse(consultation.lifestyle || '{}'); } catch {}

  res.json(consultation);
});

// GET - Retrieve single consultation by ID
router.get('/:id', authenticate, (req, res) => {
  const { id } = req.params;

  let query = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.id = ? AND c.clinic_id = ?';
  const params = [id, req.user.clinic_id];

  if (req.user.role === 'doctor') {
    query += ' AND c.doctor_id = ?';
    params.push(req.user.id);
  }

  const consultation = db.prepare(query).get(...params);

  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  try { consultation.odontogram_state = JSON.parse(consultation.odontogram_state || '{}'); } catch {}
  try { consultation.lifestyle = JSON.parse(consultation.lifestyle || '{}'); } catch {}

  res.json(consultation);
});

// PUT - Update consultation
router.put('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ? AND clinic_id = ?')
    .get(id, req.user.clinic_id);
  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  // Solo actualizar campos que explícitamente se envíen en el request
  let notes = consultation.notes;
  let diagnosis = consultation.diagnosis;
  let treatment = consultation.treatment;
  let odontogram_state = consultation.odontogram_state;
  let cost = consultation.cost;
  let payment_status = consultation.payment_status;
  let lifestyle = consultation.lifestyle;
  let procedures = consultation.procedures;
  let radiography_notes = consultation.radiography_notes;
  let observations = consultation.observations;
  let doctor_id = consultation.doctor_id;
  let visit_reason = consultation.visit_reason;

  if ('notes' in req.body) notes = req.body.notes || '';
  if ('diagnosis' in req.body) diagnosis = req.body.diagnosis || '';
  if ('treatment' in req.body) treatment = req.body.treatment || '';
  if ('odontogram_state' in req.body) odontogram_state = typeof req.body.odontogram_state === 'string' ? req.body.odontogram_state : JSON.stringify(req.body.odontogram_state || {});
  if ('cost' in req.body) cost = Number(req.body.cost) || 0;
  if ('payment_status' in req.body) payment_status = req.body.payment_status || 'pending';
  if ('lifestyle' in req.body) lifestyle = typeof req.body.lifestyle === 'string' ? req.body.lifestyle : JSON.stringify(req.body.lifestyle || {});
  if ('procedures' in req.body) procedures = req.body.procedures || '';
  if ('radiography_notes' in req.body) radiography_notes = req.body.radiography_notes || '';
  if ('observations' in req.body) observations = req.body.observations || '';
  if ('doctor_id' in req.body) doctor_id = req.body.doctor_id || null;
  if ('visit_reason' in req.body) visit_reason = req.body.visit_reason || '';

  db.prepare('UPDATE consultations SET notes = ?, diagnosis = ?, treatment = ?, odontogram_state = ?, cost = ?, payment_status = ?, lifestyle = ?, procedures = ?, radiography_notes = ?, observations = ?, doctor_id = ?, visit_reason = ? WHERE id = ? AND clinic_id = ?')
    .run(notes, diagnosis, treatment, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, id, req.user.clinic_id);

  res.json({ success: true });
});

module.exports = router;
