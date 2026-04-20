const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/stats', authenticate, requireRole('super_admin'), (req, res) => {
  const clinics = db.prepare('SELECT COUNT(*) as count FROM clinics').get();
  const patients = db.prepare('SELECT COUNT(*) as count FROM patients').get();
  const doctors = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'").get();
  res.json({ clinics: clinics.count, patients: patients.count, doctors: doctors.count });
});

router.get('/', authenticate, requireRole('super_admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM clinics ORDER BY id').all());
});

router.post('/', authenticate, requireRole('super_admin'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Clinic name required' });
  try {
    const result = db.prepare('INSERT INTO clinics (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch {
    res.status(400).json({ error: 'Clinic name already exists' });
  }
});

module.exports = router;
