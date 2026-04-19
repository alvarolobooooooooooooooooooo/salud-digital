const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDoctorInvitation } = require('../utils/mailer');

router.get('/', authenticate, (req, res) => {
  let users;
  if (req.user.role === 'super_admin') {
    users = db.prepare(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id ORDER BY c.name, u.email"
    ).all();
  } else {
    users = db.prepare(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.clinic_id = ? ORDER BY u.email"
    ).all(req.user.clinic_id);
  }
  res.json(users);
});

router.get('/doctors', authenticate, (req, res) => {
  let doctors;
  if (req.user.role === 'super_admin') {
    doctors = db.prepare(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'doctor' ORDER BY c.name, u.email"
    ).all();
  } else {
    doctors = db.prepare(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'doctor' AND u.clinic_id = ? ORDER BY u.email"
    ).all(req.user.clinic_id);
  }
  res.json(doctors);
});

router.post('/', authenticate, requireRole('super_admin', 'clinic_admin'), (req, res) => {
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

  const clinic = db.prepare('SELECT id FROM clinics WHERE id = ?').get(assignedClinicId);
  if (!clinic) return res.status(400).json({ error: 'Clinic not found' });

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (email, password, role, clinic_id, name, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(email, hashed, role, assignedClinicId, name || '', specialty || '', phone || '');

    if (role === 'doctor') {
      const clinic = db.prepare('SELECT name FROM clinics WHERE id = ?').get(assignedClinicId);
      sendDoctorInvitation({
        to: email,
        doctorName: name || email,
        clinicName: clinic ? clinic.name : 'la clínica',
      }).catch(err => console.error('SendGrid error:', err.message));
    }

    res.json({ id: result.lastInsertRowid, email, role, clinic_id: assignedClinicId, name: name || '', specialty: specialty || '', phone: phone || '' });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

router.delete('/:id', authenticate, requireRole('super_admin', 'clinic_admin'), (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.prepare('SELECT id, role, clinic_id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'doctor') {
    return res.status(403).json({ error: 'Can only delete doctors' });
  }

  if (req.user.role === 'clinic_admin' && user.clinic_id !== req.user.clinic_id) {
    return res.status(403).json({ error: 'Can only delete doctors from your own clinic' });
  }

  db.prepare('UPDATE users SET clinic_id = NULL WHERE id = ?').run(userId);
  res.json({ success: true });
});

module.exports = router;
