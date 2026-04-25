const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDoctorInvitation } = require('../utils/mailer');

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

  const clinicResult = await query('SELECT name FROM clinics WHERE id = $1', [assignedClinicId]);
  const clinic = clinicResult.rows[0];
  if (!clinic) return res.status(400).json({ error: 'Clínica no encontrada' });

  const existingResult = await query('SELECT id, clinic_id FROM users WHERE email = $1', [email]);
  if (existingResult.rows.length > 0 && existingResult.rows[0].clinic_id !== null) {
    return res.status(400).json({ error: 'Este email ya tiene una cuenta activa' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await query(
      'INSERT INTO invitations (email, name, specialty, phone, clinic_id, token, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO UPDATE SET name=$2, specialty=$3, phone=$4, clinic_id=$5, token=$6, expires_at=$7',
      [email, name || '', specialty || '', phone || '', assignedClinicId, token, expiresAt]
    );
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

router.get('/:token', async (req, res) => {
  const invResult = await query(
    'SELECT i.*, c.name as clinic_name FROM invitations i JOIN clinics c ON i.clinic_id = c.id WHERE i.token = $1',
    [req.params.token]
  );
  const inv = invResult.rows[0];

  if (!inv) return res.status(404).json({ error: 'Invitación no válida o ya fue usada' });
  if (new Date(inv.expires_at) < new Date()) {
    await query('DELETE FROM invitations WHERE token = $1', [req.params.token]);
    return res.status(410).json({ error: 'Esta invitación ha expirado' });
  }

  res.json({ email: inv.email, name: inv.name, specialty: inv.specialty, clinicName: inv.clinic_name });
});

router.post('/:token/accept', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const invResult = await query('SELECT * FROM invitations WHERE token = $1', [req.params.token]);
  const inv = invResult.rows[0];
  if (!inv) return res.status(404).json({ error: 'Invitación no válida o ya fue usada' });
  if (new Date(inv.expires_at) < new Date()) {
    await query('DELETE FROM invitations WHERE token = $1', [req.params.token]);
    return res.status(410).json({ error: 'Esta invitación ha expirado' });
  }

  const existingResult = await query('SELECT id, clinic_id FROM users WHERE email = $1', [inv.email]);
  const hashed = bcrypt.hashSync(password, 10);

  try {
    if (existingResult.rows.length > 0) {
      const existingUser = existingResult.rows[0];
      if (existingUser.clinic_id !== null) {
        await query('DELETE FROM invitations WHERE token = $1', [req.params.token]);
        return res.status(400).json({ error: 'Este email ya tiene una cuenta. Inicia sesión.' });
      }
      await query(
        'UPDATE users SET password = $1, clinic_id = $2, specialty = $3, name = $4, phone = $5 WHERE id = $6',
        [hashed, inv.clinic_id, inv.specialty, inv.name, inv.phone, existingUser.id]
      );
    } else {
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [inv.email, hashed, 'doctor', inv.name, inv.clinic_id, inv.specialty, inv.phone]
      );
    }
    await query('DELETE FROM invitations WHERE token = $1', [req.params.token]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

module.exports = router;
