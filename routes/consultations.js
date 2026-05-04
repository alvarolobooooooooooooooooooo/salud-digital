const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/finances/summary', authenticate, async (req, res) => {
  const now = new Date();
  const monthStart = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  let monthQuery = 'SELECT COALESCE(SUM(cost), 0) as total FROM consultations WHERE clinic_id = $1 AND payment_status = \'paid\' AND created_at::date >= $2 AND created_at::date <= $3';
  let totalQuery = 'SELECT COALESCE(SUM(cost), 0) as total FROM consultations WHERE clinic_id = $1 AND payment_status = \'paid\'';
  let pendingQuery = 'SELECT COUNT(*) as count FROM consultations WHERE clinic_id = $1 AND payment_status = \'pending\'';

  const monthParams = [req.user.clinic_id, monthStart, monthEnd];
  const totalParams = [req.user.clinic_id];
  const pendingParams = [req.user.clinic_id];

  if (req.user.role === 'doctor') {
    monthQuery += ' AND doctor_id = $4';
    totalQuery += ' AND doctor_id = $2';
    pendingQuery += ' AND doctor_id = $2';
    monthParams.push(req.user.id);
    totalParams.push(req.user.id);
    pendingParams.push(req.user.id);
  }

  const monthResult = await query(monthQuery, monthParams);
  const totalResult = await query(totalQuery, totalParams);
  const pendingResult = await query(pendingQuery, pendingParams);

  res.json({
    month_revenue: parseFloat(monthResult.rows[0].total || 0),
    total_revenue: parseFloat(totalResult.rows[0].total || 0),
    pending_count: parseInt(pendingResult.rows[0].count || 0)
  });
});

router.get('/finances/weekly', authenticate, async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let queryStr = `SELECT created_at::date as date, COALESCE(SUM(cost), 0) as total FROM consultations WHERE clinic_id = $1 AND payment_status = 'paid' AND created_at::date >= $2`;
  const params = [req.user.clinic_id, getLocalDateString(sevenDaysAgo)];
  let paramIndex = 3;

  if (req.user.role === 'doctor') {
    queryStr += ` AND doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' GROUP BY created_at::date ORDER BY date ASC';
  const results = await query(queryStr, params);

  const dailyData = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    dailyData[dateStr] = 0;
  }

  results.rows.forEach(r => {
    const dateStr = r.date.toISOString ? r.date.toISOString().split('T')[0] : r.date;
    dailyData[dateStr] = parseFloat(r.total || 0);
  });

  const days = Object.keys(dailyData).sort();
  const values = days.map(d => dailyData[d]);

  res.json({ days, values });
});

router.get('/finances/pending', authenticate, async (req, res) => {
  let queryStr = 'SELECT c.id, c.created_at, p.name as patient_name, p.phone, c.cost FROM consultations c JOIN patients p ON c.patient_id = p.id WHERE c.clinic_id = $1 AND c.payment_status = \'pending\'';
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  if (req.user.role === 'doctor') {
    queryStr += ` AND c.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY c.created_at DESC LIMIT 50';
  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.get('/finances/paid', authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;

  let queryStr = 'SELECT c.id, c.created_at, p.name as patient_name, p.phone, c.cost, u.name as doctor_name FROM consultations c JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.clinic_id = $1 AND c.payment_status = \'paid\'';
  const params = [req.user.clinic_id];
  let paramIndex = 2;

  if (startDate) {
    queryStr += ` AND c.created_at::date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    queryStr += ` AND c.created_at::date <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (req.user.role === 'doctor') {
    queryStr += ` AND c.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  queryStr += ' ORDER BY c.created_at DESC LIMIT 100';
  const result = await query(queryStr, params);
  res.json(result.rows);
});

router.get('/finances/by-doctor', authenticate, async (req, res) => {
  if (req.user.role === 'doctor') {
    return res.status(403).json({ error: 'Only clinic admin can view this' });
  }

  const queryStr = `SELECT u.id as doctor_id, u.name as doctor_name, u.specialty, COUNT(DISTINCT c.id) as consultation_count, COALESCE(SUM(CASE WHEN c.payment_status = 'paid' THEN c.cost ELSE 0 END), 0) as paid_amount, COALESCE(SUM(CASE WHEN c.payment_status = 'pending' THEN c.cost ELSE 0 END), 0) as pending_amount, COALESCE(SUM(c.cost), 0) as total_amount FROM users u LEFT JOIN consultations c ON u.id = c.doctor_id AND c.clinic_id = $1 AND u.clinic_id = $2 WHERE u.clinic_id = $3 AND u.role = 'doctor' GROUP BY u.id ORDER BY total_amount DESC`;

  const result = await query(queryStr, [req.user.clinic_id, req.user.clinic_id, req.user.clinic_id]);
  res.json(result.rows);
});

router.post('/', authenticate, async (req, res) => {
  const { patient_id, notes, diagnosis, treatment, specialty, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, appointment_id, payment_notes, consent_id } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id required' });

  const patientResult = await query('SELECT * FROM patients WHERE id = $1 AND clinic_id = $2', [patient_id, req.user.clinic_id]);
  if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

  const odontoStr = typeof odontogram_state === 'string' ? odontogram_state : JSON.stringify(odontogram_state || {});
  const lifestyleStr = typeof lifestyle === 'string' ? lifestyle : JSON.stringify(lifestyle || {});
  const costNum = Number(cost) || 0;

  const result = await query(
    'INSERT INTO consultations (patient_id, notes, diagnosis, treatment, specialty, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, clinic_id, appointment_id, payment_notes, consent_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id',
    [patient_id, notes || '', diagnosis || '', treatment || '', specialty || '', odontoStr, costNum, payment_status || 'pending', lifestyleStr, procedures || '', radiography_notes || '', observations || '', doctor_id || null, visit_reason || '', req.user.clinic_id, appointment_id || null, payment_notes || '', consent_id || null]
  );

  if (appointment_id) {
    await query(
      'UPDATE appointments SET payment_notes = $1 WHERE id = $2 AND clinic_id = $3',
      [payment_notes || '', appointment_id, req.user.clinic_id]
    );
  }

  res.json({ id: result.rows[0].id, patient_id, notes, diagnosis, treatment });
});

router.get('/appointment/:appointment_id', authenticate, async (req, res) => {
  const { appointment_id } = req.params;

  let queryStr = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.appointment_id = $1 AND c.clinic_id = $2';
  let params = [appointment_id, req.user.clinic_id];
  let paramIndex = 3;

  if (req.user.role === 'doctor') {
    queryStr += ` AND c.doctor_id = $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
  }

  let result = await query(queryStr, params);
  let consultation = result.rows[0];

  if (!consultation) {
    const appointmentResult = await query('SELECT patient_id, doctor_id FROM appointments WHERE id = $1 AND clinic_id = $2', [appointment_id, req.user.clinic_id]);
    if (appointmentResult.rows.length > 0) {
      const appointment = appointmentResult.rows[0];
      if (req.user.role !== 'doctor' || appointment.doctor_id === req.user.id) {
        queryStr = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 AND c.clinic_id = $2';
        params = [appointment.patient_id, req.user.clinic_id];
        paramIndex = 3;

        if (req.user.role === 'doctor') {
          queryStr += ` AND c.doctor_id = $${paramIndex}`;
          params.push(req.user.id);
          paramIndex++;
        }

        queryStr += ' ORDER BY c.created_at DESC LIMIT 1';
        result = await query(queryStr, params);
        consultation = result.rows[0];
      }
    }
  }

  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  try { consultation.odontogram_state = JSON.parse(consultation.odontogram_state || '{}'); } catch {}
  try { consultation.lifestyle = JSON.parse(consultation.lifestyle || '{}'); } catch {}

  res.json(consultation);
});

router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  let queryStr = 'SELECT c.*, p.name as patient_name, u.name as doctor_name, u.email as doctor_email FROM consultations c LEFT JOIN patients p ON c.patient_id = p.id LEFT JOIN users u ON c.doctor_id = u.id WHERE c.id = $1 AND c.clinic_id = $2';
  const params = [id, req.user.clinic_id];

  if (req.user.role === 'doctor') {
    queryStr += ' AND c.doctor_id = $3';
    params.push(req.user.id);
  }

  const result = await query(queryStr, params);
  const consultation = result.rows[0];

  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  try { consultation.odontogram_state = JSON.parse(consultation.odontogram_state || '{}'); } catch {}
  try { consultation.lifestyle = JSON.parse(consultation.lifestyle || '{}'); } catch {}

  res.json(consultation);
});

router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const consultationResult = await query('SELECT * FROM consultations WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  const consultation = consultationResult.rows[0];
  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

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
  let payment_notes = consultation.payment_notes;
  let consent_id = consultation.consent_id;

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
  if ('payment_notes' in req.body) payment_notes = req.body.payment_notes || '';
  if ('consent_id' in req.body) consent_id = req.body.consent_id || null;

  await query('UPDATE consultations SET notes = $1, diagnosis = $2, treatment = $3, odontogram_state = $4, cost = $5, payment_status = $6, lifestyle = $7, procedures = $8, radiography_notes = $9, observations = $10, doctor_id = $11, visit_reason = $12, payment_notes = $13, consent_id = $14 WHERE id = $15 AND clinic_id = $16',
    [notes, diagnosis, treatment, odontogram_state, cost, payment_status, lifestyle, procedures, radiography_notes, observations, doctor_id, visit_reason, payment_notes, consent_id, id, req.user.clinic_id]);

  res.json({ success: true });
});

// ── Image Upload Endpoints ──
const uploadDir = path.join(__dirname, '..', 'uploads', 'consultations');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${uuid()}${ext}`;
    cb(null, filename);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP)'));
    }
  }
});

router.post('/:id/images', authenticate, imageUpload.array('images', 10), async (req, res) => {
  const { id } = req.params;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  const consultationResult = await query('SELECT * FROM consultations WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  if (consultationResult.rows.length === 0) {
    req.files.forEach(f => fs.unlink(path.join(uploadDir, f.filename), () => {}));
    return res.status(404).json({ error: 'Consultation not found' });
  }

  try {
    const savedImages = [];
    for (const file of req.files) {
      const result = await query(
        'INSERT INTO consultation_images (consultation_id, clinic_id, filename, original_name) VALUES ($1, $2, $3, $4) RETURNING id, filename, original_name',
        [id, req.user.clinic_id, file.filename, file.originalname]
      );
      savedImages.push(result.rows[0]);
    }
    res.json(savedImages);
  } catch (err) {
    req.files.forEach(f => fs.unlink(path.join(uploadDir, f.filename), () => {}));
    res.status(500).json({ error: 'Error saving images' });
  }
});

router.get('/:id/images', authenticate, async (req, res) => {
  const { id } = req.params;
  const result = await query('SELECT id, filename, original_name, created_at FROM consultation_images WHERE consultation_id = $1 AND clinic_id = $2 ORDER BY created_at DESC', [id, req.user.clinic_id]);
  res.json(result.rows);
});

router.delete('/images/:imageId', authenticate, async (req, res) => {
  const { imageId } = req.params;
  const imageResult = await query('SELECT * FROM consultation_images WHERE id = $1 AND clinic_id = $2', [imageId, req.user.clinic_id]);
  if (imageResult.rows.length === 0) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const image = imageResult.rows[0];
  const filePath = path.join(uploadDir, image.filename);

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await query('DELETE FROM consultation_images WHERE id = $1', [imageId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting image' });
  }
});

module.exports = router;
