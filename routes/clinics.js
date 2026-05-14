const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuid } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const logoUpload = multer({
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

// Extract Cloudinary public_id from a secure_url (so we can delete the old asset).
// Example: https://res.cloudinary.com/<cloud>/image/upload/v123/clinics/5/logo-abcd
//   → "clinics/5/logo-abcd"
function publicIdFromUrl(url) {
  if (!url || !url.includes('/upload/')) return null;
  const afterUpload = url.split('/upload/')[1] || '';
  const noVersion = afterUpload.replace(/^v\d+\//, '');
  return noVersion.replace(/\.[^.]+$/, '');
}

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

// GET /api/clinics/me — full info for the current user's clinic
// Accessible to any authenticated member of the clinic (doctor, clinic_admin, receptionist)
router.get('/me', authenticate, async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const result = await query(
    `SELECT id, name, type, tax_id, address, city, phone, email, info,
            brand_color, currency, website, logo_url
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  res.json(result.rows[0]);
});

// POST /api/clinics/me/logo — upload/replace the clinic logo (clinic_admin only)
router.post('/me/logo', authenticate, requireRole('clinic_admin'), logoUpload.single('logo'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  try {
    // Delete previous logo from Cloudinary so we don't accumulate orphan assets
    const prev = await query('SELECT logo_url FROM clinics WHERE id = $1', [req.user.clinic_id]);
    const prevPublicId = publicIdFromUrl(prev.rows[0]?.logo_url);
    if (prevPublicId) {
      await cloudinary.uploader.destroy(prevPublicId).catch(() => {});
    }

    const publicId = `logo-${Date.now()}-${uuid().slice(0, 8)}`;
    const result = await uploadBufferToCloudinary(req.file.buffer, publicId, `clinics/${req.user.clinic_id}`);
    const url = result.secure_url;
    await query('UPDATE clinics SET logo_url = $1 WHERE id = $2', [url, req.user.clinic_id]);
    res.json({ logo_url: url });
  } catch (err) {
    console.error('Error uploading clinic logo:', err);
    res.status(500).json({ error: 'No se pudo subir el logo' });
  }
});

// DELETE /api/clinics/me/logo — remove the current clinic logo (clinic_admin only)
router.delete('/me/logo', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const prev = await query('SELECT logo_url FROM clinics WHERE id = $1', [req.user.clinic_id]);
  const publicId = publicIdFromUrl(prev.rows[0]?.logo_url);
  if (publicId) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
  await query("UPDATE clinics SET logo_url = '' WHERE id = $1", [req.user.clinic_id]);
  res.json({ success: true });
});

// PUT /api/clinics/me — update the current user's clinic (clinic_admin only)
router.put('/me', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });

  const { name, type, tax_id, address, city, phone, email, info, brand_color, currency, website } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'El nombre de la clínica es requerido' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo de contacto inválido' });
  }
  if (currency && !['HNL', 'USD'].includes(currency)) {
    return res.status(400).json({ error: 'Moneda no válida' });
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return res.status(400).json({ error: 'El sitio web debe comenzar con http:// o https://' });
  }

  try {
    await query(
      `UPDATE clinics SET
         name = $1, type = $2, tax_id = $3, address = $4, city = $5,
         phone = $6, email = $7, info = $8, brand_color = $9,
         currency = $10, website = $11
       WHERE id = $12`,
      [
        String(name).trim(),
        type || '',
        tax_id || '',
        address || '',
        city || '',
        phone || '',
        email || '',
        info || '',
        brand_color || '#0891b2',
        currency || 'HNL',
        website || '',
        req.user.clinic_id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe otra clínica con ese nombre' });
    }
    throw err;
  }
});

router.get('/plan/info', authenticate, async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'No clinic access' });

  const clinicResult = await query('SELECT * FROM clinics WHERE id = $1', [req.user.clinic_id]);
  if (clinicResult.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });

  const clinic = clinicResult.rows[0];

  const currentMonth = new Date();
  currentMonth.setDate(1);

  const patientsCount = await query('SELECT COUNT(*) as count FROM patients WHERE clinic_id = $1', [req.user.clinic_id]);
  const doctorsCount = await query("SELECT COUNT(*) as count FROM users WHERE clinic_id = $1 AND role = 'doctor'", [req.user.clinic_id]);
  const currentMonthConsultations = await query(
    'SELECT COUNT(*) as count FROM consultations WHERE clinic_id = $1 AND created_at >= $2',
    [req.user.clinic_id, currentMonth]
  );

  res.json({
    clinic_name: clinic.name,
    plan_type: clinic.plan_type || 'professional',
    plan_status: clinic.plan_status || 'active',
    plan_expires_at: clinic.plan_expires_at,
    billing_cycle: clinic.billing_cycle || 'monthly',
    stats: {
      total_patients: parseInt(patientsCount.rows[0].count),
      total_doctors: parseInt(doctorsCount.rows[0].count),
      consultations_this_month: parseInt(currentMonthConsultations.rows[0].count)
    }
  });
});

module.exports = router;
