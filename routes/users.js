const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuid } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendDoctorInvitation } = require('../utils/mailer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP)'));
  },
});

function uploadBufferToCloudinary(buffer, publicId, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, folder, resource_type: 'image', overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function publicIdFromUrl(url) {
  if (!url || !url.includes('/upload/')) return null;
  const afterUpload = url.split('/upload/')[1] || '';
  const noVersion = afterUpload.replace(/^v\d+\//, '');
  return noVersion.replace(/\.[^.]+$/, '');
}

function parseJsonArray(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET /api/users/me — full profile for the currently authenticated user
router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.specialty, u.phone,
            u.admin_role, u.location, u.bio, u.license, u.experience, u.shift,
            u.photo_url, u.languages, u.focus,
            c.name AS clinic_name
       FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
      WHERE u.id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  user.languages = parseJsonArray(user.languages);
  user.focus = parseJsonArray(user.focus);
  res.json(user);
});

// PUT /api/users/me — update the current user's editable profile fields
router.put('/me', authenticate, async (req, res) => {
  const b = req.body || {};

  if (b.name !== undefined && !String(b.name).trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  if (b.email !== undefined) {
    if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
      return res.status(400).json({ error: 'Correo inválido' });
    }
  }
  if (b.experience !== undefined && b.experience !== null && b.experience !== '') {
    const n = Number(b.experience);
    if (!Number.isFinite(n) || n < 0 || n > 80) {
      return res.status(400).json({ error: 'Años de experiencia inválidos' });
    }
  }

  const current = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const u = current.rows[0];
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  const next = {
    name: b.name !== undefined ? String(b.name).trim() : u.name,
    email: b.email !== undefined ? String(b.email).trim().toLowerCase() : u.email,
    specialty: b.specialty !== undefined ? (b.specialty || '') : u.specialty,
    phone: b.phone !== undefined ? (b.phone || '') : u.phone,
    admin_role: b.admin_role !== undefined ? (b.admin_role || '') : u.admin_role,
    location: b.location !== undefined ? (b.location || '') : u.location,
    bio: b.bio !== undefined ? (b.bio || '') : u.bio,
    license: b.license !== undefined ? (b.license || '') : u.license,
    experience: b.experience !== undefined && b.experience !== '' ? Number(b.experience) : (u.experience || 0),
    shift: b.shift !== undefined ? (b.shift || '') : u.shift,
    languages: b.languages !== undefined ? JSON.stringify(Array.isArray(b.languages) ? b.languages : []) : (u.languages || '[]'),
    focus: b.focus !== undefined ? JSON.stringify(Array.isArray(b.focus) ? b.focus : []) : (u.focus || '[]'),
  };

  try {
    await query(
      `UPDATE users SET
         name = $1, email = $2, specialty = $3, phone = $4,
         admin_role = $5, location = $6, bio = $7, license = $8,
         experience = $9, shift = $10, languages = $11, focus = $12
       WHERE id = $13`,
      [
        next.name, next.email, next.specialty, next.phone,
        next.admin_role, next.location, next.bio, next.license,
        next.experience, next.shift, next.languages, next.focus,
        req.user.id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ese correo ya está en uso por otra cuenta' });
    }
    throw err;
  }
});

// POST /api/users/me/photo — upload/replace the current user's profile photo
router.post('/me/photo', authenticate, photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });
  try {
    const prev = await query('SELECT photo_url FROM users WHERE id = $1', [req.user.id]);
    const prevPublicId = publicIdFromUrl(prev.rows[0]?.photo_url);
    if (prevPublicId) {
      await cloudinary.uploader.destroy(prevPublicId).catch(() => {});
    }
    const publicId = `photo-${Date.now()}-${uuid().slice(0, 8)}`;
    const result = await uploadBufferToCloudinary(req.file.buffer, publicId, `users/${req.user.id}`);
    const url = result.secure_url;
    await query('UPDATE users SET photo_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ photo_url: url });
  } catch (err) {
    console.error('Error uploading user photo:', err);
    res.status(500).json({ error: 'No se pudo subir la foto' });
  }
});

// DELETE /api/users/me/photo — remove the current user's profile photo
router.delete('/me/photo', authenticate, async (req, res) => {
  const prev = await query('SELECT photo_url FROM users WHERE id = $1', [req.user.id]);
  const publicId = publicIdFromUrl(prev.rows[0]?.photo_url);
  if (publicId) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
  await query("UPDATE users SET photo_url = '' WHERE id = $1", [req.user.id]);
  res.json({ success: true });
});

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

router.get('/receptionists', authenticate, async (req, res) => {
  if (!['super_admin', 'clinic_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  let result;
  if (req.user.role === 'super_admin') {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'receptionist' ORDER BY c.name, u.email"
    );
  } else {
    result = await query(
      "SELECT u.id, u.email, u.role, u.name, u.clinic_id, u.phone, c.name as clinic_name FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id WHERE u.role = 'receptionist' AND u.clinic_id = $1 ORDER BY u.email",
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
    if (!['doctor', 'receptionist'].includes(role)) {
      return res.status(403).json({ error: 'Clinic admin can only create doctors or receptionists' });
    }
    assignedClinicId = req.user.clinic_id;
  } else {
    if (!['clinic_admin', 'doctor', 'receptionist'].includes(role)) {
      return res.status(400).json({ error: 'Role must be clinic_admin, doctor or receptionist' });
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

  if (!['doctor', 'receptionist'].includes(user.role)) {
    return res.status(403).json({ error: 'Can only delete doctors or receptionists' });
  }

  if (req.user.role === 'clinic_admin' && user.clinic_id !== req.user.clinic_id) {
    return res.status(403).json({ error: 'Can only delete users from your own clinic' });
  }

  await query('UPDATE users SET clinic_id = NULL WHERE id = $1', [userId]);
  res.json({ success: true });
});

module.exports = router;
