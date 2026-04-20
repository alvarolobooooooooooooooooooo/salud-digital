const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDoctorInvitation } = require('../utils/mailer');

// POST /api/invitations — create invitation (replaces user creation for doctors)
router.post('/', authenticate, requireRole('super_admin', 'clinic_admin'), async (req, res) => {
  const { email, name, specialty, phone, clinic_id } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Email y nombre son requeridos' });

  let assignedClinicId;
  if (req.user.role === 'clinic_admin') {
    assignedClinicId = req.user.clinic_id;
  } else {
    if (!clinic_id) return res.status(400).json({ error: 'clinic_id requerido' });
    assignedClinicId = clinic_id;
  }

  const clinic = db.prepare('SELECT name FROM clinics WHERE id = ?').get(assignedClinicId);
  if (!clinic) return res.status(400).json({ error: 'Clínica no encontrada' });

  // Check if already a user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Este email ya tiene una cuenta activa' });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    db.prepare(
      'INSERT OR REPLACE INTO invitations (email, name, specialty, phone, clinic_id, token, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(email, name || '', specialty || '', phone || '', assignedClinicId, token, expiresAt);
  } catch (err) {
    return res.status(400).json({ error: 'Error al crear invitación' });
  }

  try {
    await sendDoctorInvitation({ to: email, doctorName: name, clinicName: clinic.name, token });
    res.json({ success: true, message: 'Invitación enviada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar el correo. Verifica la configuración de SendGrid.' });
  }
});

// GET /api/invitations/:token — validate token and return invitation info
router.get('/:token', (req, res) => {
  const inv = db.prepare(
    'SELECT i.*, c.name as clinic_name FROM invitations i JOIN clinics c ON i.clinic_id = c.id WHERE i.token = ?'
  ).get(req.params.token);

  if (!inv) return res.status(404).json({ error: 'Invitación no válida o ya fue usada' });
  if (new Date(inv.expires_at) < new Date()) {
    db.prepare('DELETE FROM invitations WHERE token = ?').run(req.params.token);
    return res.status(410).json({ error: 'Esta invitación ha expirado' });
  }

  res.json({ email: inv.email, name: inv.name, specialty: inv.specialty, clinicName: inv.clinic_name });
});

// POST /api/invitations/:token/accept — create user and delete invitation
router.post('/:token/accept', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const inv = db.prepare('SELECT * FROM invitations WHERE token = ?').get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitación no válida o ya fue usada' });
  if (new Date(inv.expires_at) < new Date()) {
    db.prepare('DELETE FROM invitations WHERE token = ?').run(req.params.token);
    return res.status(410).json({ error: 'Esta invitación ha expirado' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(inv.email);
  if (existing) {
    db.prepare('DELETE FROM invitations WHERE token = ?').run(req.params.token);
    return res.status(400).json({ error: 'Este email ya tiene una cuenta. Inicia sesión.' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  try {
    db.prepare(
      'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(inv.email, hashed, 'doctor', inv.name, inv.clinic_id, inv.specialty, inv.phone);
    db.prepare('DELETE FROM invitations WHERE token = ?').run(req.params.token);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

module.exports = router;
