const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDoctorInvitation } = require('../utils/mailer');

router.get('/', authenticate, async (req, res) => {
  let result;
  if (req.user.role === 'super_admin') {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id ORDER BY c.name, u.email"
    );
  } else {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.clinic_id = $1 ORDER BY u.email",
      [req.user.clinic_id]
    );
  }
  res.json(result.rows);
});

router.get('/doctors', authenticate, async (req, res) => {
  let result;
  if (req.user.role === 'super_admin') {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'doctor' ORDER BY c.name, u.email"
    );
  } else {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'doctor' AND u.clinic_id = $1 ORDER BY u.email",
      [req.user.clinic_id]
    );
  }
  res.json(result.rows);
});

router.post('/', authenticate, requireRole('super_admin', 'clinic_admin'), async (req, res) => {
  const { email, password, role, clinic_id, name, specialty, phone } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role required' });
  }

  let assignedClinicId;
  if (req.user.role === 'clinic_admin') {
    if (role !== 'doctor') return res.status(403).json({ error: 'Clinic admin can only create doctors' });
    assignedClinicId = req.user.clinic_id;
  } else {
    if (!['clinic_admin', 'doctor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be clinic_admin or doctor' });
    }
    if (!clinic_id) return res.status(400).json({ error: 'clinic_id required' });
    assignedClinicId = clinic_id;
  }

  const clinicResult = await query('SELECT id FROM clinics WHERE id = $1', [assignedClinicId]);
  if (clinicResult.rows.length === 0) return res.status(400).json({ error: 'Clinic not found' });

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = await query(
      'INSERT INTO users (email, password, role, clinic_id, name, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [email, hashed, role, assignedClinicId, name || '', specialty || '', phone || '']
    );

    if (role === 'doctor') {
      const clinicResult = await query('SELECT name FROM clinics WHERE id = $1', [assignedClinicId]);
      const clinic = clinicResult.rows[0];
      sendDoctorInvitation({
        to: email,
        doctorName: name || email,
        clinicName: clinic ? clinic.name : 'la clínica',
      }).catch(err => console.error('SendGrid error:', err.message));
    }

    res.json({
      id: result.rows[0].id,
      email,
      role,
      clinic_id: assignedClinicId,
      name: name || '',
      specialty: specialty || '',
      phone: phone || ''
    });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

router.delete('/:id', authenticate, requireRole('super_admin', 'clinic_admin'), async (req, res) => {
  const userId = parseInt(req.params.id);
  const userResult = await query('SELECT id, role, clinic_id FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'doctor') {
    return res.status(403).json({ error: 'Can only delete doctors' });
  }

  if (req.user.role === 'clinic_admin' && user.clinic_id !== req.user.clinic_id) {
    return res.status(403).json({ error: 'Can only delete doctors from your own clinic' });
  }

  await query('UPDATE users SET clinic_id = NULL WHERE id = $1', [userId]);
  res.json({ success: true });
});

module.exports = router;
