const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/stats', authenticate, requireRole('super_admin'), async (req, res) => {
  const clinics = await query('SELECT COUNT(*) as count FROM clinics');
  const patients = await query('SELECT COUNT(*) as count FROM patients');
  const doctors = await query("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'");
  res.json({
    clinics: parseInt(clinics.rows[0].count),
    patients: parseInt(patients.rows[0].count),
    doctors: parseInt(doctors.rows[0].count)
  });
});

router.get('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const result = await query('SELECT * FROM clinics ORDER BY id');
  res.json(result.rows);
});

router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Clinic name required' });
  try {
    const result = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', [name.trim()]);
    res.json({ id: result.rows[0].id, name: name.trim() });
  } catch {
    res.status(400).json({ error: 'Clinic name already exists' });
  }
});

module.exports = router;
