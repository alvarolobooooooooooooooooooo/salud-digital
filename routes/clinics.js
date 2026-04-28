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
  const result = await query(`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM users u WHERE u.clinic_id = c.id AND u.role = 'clinic_admin') as has_admin,
      (SELECT email FROM users u WHERE u.clinic_id = c.id AND u.role = 'clinic_admin' LIMIT 1) as admin_email
    FROM clinics c
    ORDER BY c.id
  `);
  res.json(result.rows);
});

router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const { name, address, chairs, specialties, phone, email } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre de la clínica es requerido' });
  try {
    const result = await query(
      'INSERT INTO clinics (name, address, chairs, specialties, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name.trim(), address || '', chairs || 1, specialties || '', phone || '', email || '']
    );
    res.json({ id: result.rows[0].id, name: name.trim() });
  } catch {
    res.status(400).json({ error: 'El nombre de la clínica ya existe' });
  }
});

module.exports = router;
