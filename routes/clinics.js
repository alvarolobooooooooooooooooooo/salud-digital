const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuid } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAndStore, searchAddress } = require('../lib/geocoding');
const { parseMapsUrl, resolveMapsShortLink, isValidLatLng } = require('../lib/maps-links');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Rechazo de tipo de archivo con un código propio. Sin él, multer entrega un
// Error pelado y el manejador global lo trata como fallo del servidor: el
// usuario veía "Internal server error" al subir un PDF donde iba una foto.
function tipoNoPermitido(mensaje) {
  const err = new Error(mensaje);
  err.code = 'INVALID_FILE_TYPE';
  return err;
}

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(tipoNoPermitido('Solo se permiten imágenes (JPEG, PNG, WebP)'));
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
            brand_color, currency, website, logo_url,
            latitude, longitude, show_on_public_map,
            map_url, location_notes, location_source
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  res.json(result.rows[0]);
});

// ── Ubicación de la clínica ──────────────────────────────────────────────────
// El pin lo edita quien atiende: clinic_admin (clínicas con varios doctores) y
// doctor (el alta por cuenta propia crea doctores dueños de su propio consultorio,
// así que si solo dejáramos clinic_admin no podrían corregir su propia ubicación).
// Recepción no entra: no es dato suyo.
const LOCATION_ROLES = ['clinic_admin', 'doctor'];

// PUT /api/clinics/me/location — guarda dirección + pin del mapa
router.put('/me/location', authenticate, requireRole(...LOCATION_ROLES), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });

  const b = req.body || {};
  const address = String(b.address || '').trim().slice(0, 300);
  const city = String(b.city || '').trim().slice(0, 120);
  const notes = String(b.location_notes || '').trim().slice(0, 500);
  const mapUrl = String(b.map_url || '').trim().slice(0, 600);

  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
    return res.status(400).json({ error: 'El enlace del mapa debe comenzar con http:// o https://' });
  }

  // Coordenadas: o vienen las dos y son válidas, o se limpia el pin.
  const hasCoords = b.latitude != null && b.longitude != null &&
    String(b.latitude) !== '' && String(b.longitude) !== '';
  if (hasCoords && !isValidLatLng(b.latitude, b.longitude)) {
    return res.status(400).json({ error: 'Las coordenadas no son válidas.' });
  }
  const lat = hasCoords ? Number(b.latitude) : null;
  const lng = hasCoords ? Number(b.longitude) : null;

  const showOnMap = typeof b.show_on_public_map === 'boolean' ? b.show_on_public_map : null;
  const showSql = showOnMap === null ? '' : ', show_on_public_map = $8';
  const params = [
    address, city, notes, mapUrl, lat, lng,
    req.user.clinic_id,
  ];
  if (showOnMap !== null) params.push(showOnMap);

  await query(
    `UPDATE clinics SET
       address = $1, city = $2, location_notes = $3, map_url = $4,
       latitude = $5, longitude = $6,
       location_source = CASE WHEN $5::double precision IS NULL THEN NULL ELSE 'manual' END,
       geocoded_at = NOW()${showSql}
     WHERE id = $7`,
    params
  );

  // Sin pin pero con dirección escrita: dejamos que Nominatim intente resolverla
  // en segundo plano, igual que hace el PUT general de la clínica.
  if (!hasCoords && (address || city)) {
    await query('UPDATE clinics SET geocoded_at = NULL WHERE id = $1', [req.user.clinic_id]);
    setImmediate(() => {
      geocodeAndStore(req.user.clinic_id, { address, city })
        .catch(err => console.warn('[geocode] failed for clinic', req.user.clinic_id, err.message));
    });
  }

  res.json({
    success: true,
    latitude: lat,
    longitude: lng,
    location_source: hasCoords ? 'manual' : null,
  });
});

// GET /api/clinics/geo/search?q=… — autocompletado de direcciones (Nominatim vía
// servidor, para no exponer al navegador ni saltarse el rate limit de su ToS).
router.get('/geo/search', authenticate, requireRole(...LOCATION_ROLES), async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 3) return res.json({ results: [] });
  try {
    const results = await searchAddress(q, 6);
    res.json({ results });
  } catch (err) {
    // Cola de Nominatim llena (ver lib/geocoding.js): contestamos y soltamos la
    // conexión en vez de dejar al cliente esperando su turno durante minutos.
    if (err && err.colaLlena) {
      return res.status(503).json({
        error: 'El buscador de direcciones está ocupado. Intenta de nuevo en unos segundos.',
        code: 'geocoder_busy',
      });
    }
    throw err;
  }
});

// GET /api/clinics/geo/resolve?url=… — convierte un enlace de Google Maps (incluidos
// los acortados de "Compartir") en coordenadas.
router.get('/geo/resolve', authenticate, requireRole(...LOCATION_ROLES), async (req, res) => {
  const url = String(req.query.url || '').trim().slice(0, 600);
  if (!url) return res.status(400).json({ error: 'Falta el enlace' });

  const direct = parseMapsUrl(url);
  if (direct) return res.json({ ...direct, url });

  const resolved = await resolveMapsShortLink(url);
  if (!resolved) {
    return res.status(422).json({
      error: 'No pudimos leer las coordenadas de ese enlace. Marca el punto directamente en el mapa.',
    });
  }
  res.json(resolved);
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

  const { name, type, tax_id, address, city, phone, email, info, brand_color, currency, website, show_on_public_map } = req.body || {};

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

  // address/city/show_on_public_map son opcionales: desde que existe la pestaña
  // Ubicación, quien las edita es PUT /me/location. Si la petición no las trae,
  // se dejan como están en vez de borrarlas.
  const prevRow = await query(
    'SELECT address, city, location_source FROM clinics WHERE id = $1',
    [req.user.clinic_id]
  );
  const prev = prevRow.rows[0] || {};
  const sendsAddress = Object.prototype.hasOwnProperty.call(req.body || {}, 'address');
  const sendsCity = Object.prototype.hasOwnProperty.call(req.body || {}, 'city');
  const newAddress = sendsAddress ? (address || '') : (prev.address || '');
  const newCity = sendsCity ? (city || '') : (prev.city || '');

  // Si la dirección o ciudad cambió, invalidamos lat/lng para que el geocoding
  // se re-dispare (el helper respeta el rate limit de Nominatim). Salvo que el
  // pin esté puesto a mano: ahí manda la persona, no el geocoder.
  const pinnedByHand = prev.location_source === 'manual';
  const addressChanged = !pinnedByHand &&
    ((prev.address || '') !== newAddress || (prev.city || '') !== newCity);

  try {
    const showFlagSql = (typeof show_on_public_map === 'boolean')
      ? ', show_on_public_map = $13' : '';
    const invalidateGeoSql = addressChanged
      ? ', latitude = NULL, longitude = NULL, geocoded_at = NULL' : '';
    const params = [
      String(name).trim(),
      type || '',
      tax_id || '',
      newAddress,
      newCity,
      phone || '',
      email || '',
      info || '',
      brand_color || '#0891b2',
      currency || 'HNL',
      website || '',
      req.user.clinic_id,
    ];
    if (typeof show_on_public_map === 'boolean') params.push(show_on_public_map);
    await query(
      `UPDATE clinics SET
         name = $1, type = $2, tax_id = $3, address = $4, city = $5,
         phone = $6, email = $7, info = $8, brand_color = $9,
         currency = $10, website = $11${showFlagSql}${invalidateGeoSql}
       WHERE id = $12`,
      params
    );
    if (addressChanged && (newAddress || newCity)) {
      // Fire-and-forget: no bloqueamos el response esperando a Nominatim.
      setImmediate(() => {
        geocodeAndStore(req.user.clinic_id, { address: newAddress, city: newCity })
          .catch(err => console.warn('[geocode] failed for clinic', req.user.clinic_id, err.message));
      });
    }
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe otra clínica con ese nombre' });
    }
    throw err;
  }
});

// ── Landing pública por clínica ──────────────────────────────────────────────
// Esquema permitido en landing_data. Mantengo una lista cerrada para que un POST
// malicioso no inyecte campos arbitrarios al JSONB.
const LANDING_DEFAULTS = {
  hero: {
    eyebrow: '',
    title: '',
    subtitle: '',
    cta_label: 'Agendar cita',
    cta_secondary_label: 'Conocer más',
    image_url: '',
  },
  about: {
    title: 'Sobre nosotros',
    body: '',
    highlights: [], // [{ icon, title, text }]
  },
  services: [], // [{ name, description, price, duration, icon }]
  gallery: [],  // [{ url, alt }]
  testimonials: [], // [{ name, text, rating }]
  faq: [], // [{ q, a }]
  hours: [], // [{ day, open, close, closed }]
  location: {
    address: '',
    city: '',
    maps_url: '',
    directions: '',
  },
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
    show_contact_form: true,
  },
  social: {
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
  },
  seo: {
    meta_title: '',
    meta_description: '',
  },
  theme: {
    primary: '',     // override de brand_color para landing si la clínica quiere
    accent: '#0ea5e9',
    font: 'inter',
  },
  show_doctors: true,
  show_online_booking: true,
};

const TEMPLATE_WHITELIST = ['aurora', 'serenity', 'clinical'];

// Deep merge defensivo: respeta el shape de LANDING_DEFAULTS, descarta keys que no
// estén en el esquema esperado. Esto es la barrera real contra basura en el JSONB.
function sanitizeLanding(input) {
  const result = JSON.parse(JSON.stringify(LANDING_DEFAULTS));
  if (!input || typeof input !== 'object') return result;

  function setStr(target, key, val, max = 500) {
    if (typeof val === 'string') target[key] = val.slice(0, max);
  }
  function setBool(target, key, val) {
    if (typeof val === 'boolean') target[key] = val;
  }

  if (input.hero && typeof input.hero === 'object') {
    setStr(result.hero, 'eyebrow', input.hero.eyebrow, 80);
    setStr(result.hero, 'title', input.hero.title, 140);
    setStr(result.hero, 'subtitle', input.hero.subtitle, 400);
    setStr(result.hero, 'cta_label', input.hero.cta_label, 40);
    setStr(result.hero, 'cta_secondary_label', input.hero.cta_secondary_label, 40);
    setStr(result.hero, 'image_url', input.hero.image_url, 600);
  }
  if (input.about && typeof input.about === 'object') {
    setStr(result.about, 'title', input.about.title, 80);
    setStr(result.about, 'body', input.about.body, 2000);
    if (Array.isArray(input.about.highlights)) {
      result.about.highlights = input.about.highlights.slice(0, 8).map(h => ({
        icon: typeof h?.icon === 'string' ? h.icon.slice(0, 30) : 'sparkles',
        title: typeof h?.title === 'string' ? h.title.slice(0, 60) : '',
        text: typeof h?.text === 'string' ? h.text.slice(0, 200) : '',
      })).filter(h => h.title || h.text);
    }
  }
  if (Array.isArray(input.services)) {
    result.services = input.services.slice(0, 30).map(s => ({
      name: typeof s?.name === 'string' ? s.name.slice(0, 80) : '',
      description: typeof s?.description === 'string' ? s.description.slice(0, 280) : '',
      price: typeof s?.price === 'string' ? s.price.slice(0, 30) : '',
      duration: typeof s?.duration === 'string' ? s.duration.slice(0, 30) : '',
      icon: typeof s?.icon === 'string' ? s.icon.slice(0, 30) : 'stethoscope',
    })).filter(s => s.name);
  }
  if (Array.isArray(input.gallery)) {
    result.gallery = input.gallery.slice(0, 30).map(g => ({
      url: typeof g?.url === 'string' ? g.url.slice(0, 600) : '',
      alt: typeof g?.alt === 'string' ? g.alt.slice(0, 120) : '',
    })).filter(g => g.url);
  }
  if (Array.isArray(input.testimonials)) {
    result.testimonials = input.testimonials.slice(0, 20).map(t => ({
      name: typeof t?.name === 'string' ? t.name.slice(0, 60) : '',
      text: typeof t?.text === 'string' ? t.text.slice(0, 400) : '',
      rating: Number.isFinite(Number(t?.rating)) ? Math.max(1, Math.min(5, Math.round(Number(t.rating)))) : 5,
    })).filter(t => t.name && t.text);
  }
  if (Array.isArray(input.faq)) {
    result.faq = input.faq.slice(0, 30).map(f => ({
      q: typeof f?.q === 'string' ? f.q.slice(0, 140) : '',
      a: typeof f?.a === 'string' ? f.a.slice(0, 800) : '',
    })).filter(f => f.q && f.a);
  }
  if (Array.isArray(input.hours)) {
    result.hours = input.hours.slice(0, 7).map(h => ({
      day: typeof h?.day === 'string' ? h.day.slice(0, 20) : '',
      open: typeof h?.open === 'string' ? h.open.slice(0, 10) : '',
      close: typeof h?.close === 'string' ? h.close.slice(0, 10) : '',
      closed: !!h?.closed,
    })).filter(h => h.day);
  }
  if (input.location && typeof input.location === 'object') {
    setStr(result.location, 'address', input.location.address, 200);
    setStr(result.location, 'city', input.location.city, 80);
    setStr(result.location, 'maps_url', input.location.maps_url, 600);
    setStr(result.location, 'directions', input.location.directions, 400);
  }
  if (input.contact && typeof input.contact === 'object') {
    setStr(result.contact, 'phone', input.contact.phone, 30);
    setStr(result.contact, 'whatsapp', input.contact.whatsapp, 30);
    setStr(result.contact, 'email', input.contact.email, 120);
    setBool(result.contact, 'show_contact_form', input.contact.show_contact_form);
  }
  if (input.social && typeof input.social === 'object') {
    setStr(result.social, 'facebook', input.social.facebook, 200);
    setStr(result.social, 'instagram', input.social.instagram, 200);
    setStr(result.social, 'tiktok', input.social.tiktok, 200);
    setStr(result.social, 'youtube', input.social.youtube, 200);
  }
  if (input.seo && typeof input.seo === 'object') {
    setStr(result.seo, 'meta_title', input.seo.meta_title, 80);
    setStr(result.seo, 'meta_description', input.seo.meta_description, 200);
  }
  if (input.theme && typeof input.theme === 'object') {
    setStr(result.theme, 'primary', input.theme.primary, 24);
    setStr(result.theme, 'accent', input.theme.accent, 24);
    setStr(result.theme, 'font', input.theme.font, 24);
  }
  setBool(result, 'show_doctors', input.show_doctors);
  setBool(result, 'show_online_booking', input.show_online_booking);

  return result;
}

function isValidSlug(s) {
  return typeof s === 'string' && /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(s);
}

// GET /api/clinics/me/landing — devuelve toda la config para que la edite el admin
router.get('/me/landing', authenticate, async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const r = await query(
    `SELECT id, name, slug, brand_color, logo_url, landing_data, landing_template, landing_published
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  const row = r.rows[0];
  res.json({
    clinic_id: row.id,
    clinic_name: row.name,
    slug: row.slug || '',
    brand_color: row.brand_color || '#0891b2',
    logo_url: row.logo_url || '',
    template: TEMPLATE_WHITELIST.includes(row.landing_template) ? row.landing_template : 'aurora',
    published: !!row.landing_published,
    data: sanitizeLanding(row.landing_data || {}),
  });
});

// PUT /api/clinics/me/landing — persiste cambios (clinic_admin)
router.put('/me/landing', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const body = req.body || {};
  const clean = sanitizeLanding(body.data || {});
  const template = TEMPLATE_WHITELIST.includes(body.template) ? body.template : 'aurora';

  await query(
    `UPDATE clinics SET landing_data = $1, landing_template = $2 WHERE id = $3`,
    [JSON.stringify(clean), template, req.user.clinic_id]
  );
  res.json({ success: true, data: clean, template });
});

// PUT /api/clinics/me/landing/slug — establece o cambia el slug público.
// Validamos formato y unicidad antes de escribir.
router.put('/me/landing/slug', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const raw = String((req.body && req.body.slug) || '').trim().toLowerCase();
  if (!isValidSlug(raw)) {
    return res.status(400).json({
      error: 'Slug inválido. Usa 3-40 caracteres: minúsculas, números y guiones (sin espacios).',
    });
  }
  // Reservados por colisión con rutas estáticas del app
  const RESERVED = new Set([
    'admin', 'api', 'login', 'dashboard', 'agendar', 'confirmar', 'app', 'uploads',
    'index', 'landing', 'public', 'static', 'assets', 'mi-sitio', 'plan', 'help'
  ]);
  if (RESERVED.has(raw)) return res.status(400).json({ error: 'Ese slug está reservado, elige otro.' });

  const dup = await query('SELECT id FROM clinics WHERE slug = $1 AND id <> $2', [raw, req.user.clinic_id]);
  if (dup.rows.length > 0) return res.status(409).json({ error: 'Ese slug ya está en uso por otra clínica.' });

  await query('UPDATE clinics SET slug = $1 WHERE id = $2', [raw, req.user.clinic_id]);
  res.json({ success: true, slug: raw });
});

// POST /api/clinics/me/landing/publish — toggle de publicado. Requiere slug.
router.post('/me/landing/publish', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const desired = !!(req.body && req.body.published);
  if (desired) {
    const r = await query('SELECT slug FROM clinics WHERE id = $1', [req.user.clinic_id]);
    if (!r.rows[0]?.slug) {
      return res.status(400).json({ error: 'Configura un slug antes de publicar tu sitio.' });
    }
  }
  await query('UPDATE clinics SET landing_published = $1 WHERE id = $2', [desired, req.user.clinic_id]);
  res.json({ success: true, published: desired });
});

// POST /api/clinics/me/landing/image — subida de imágenes (hero, galería).
// Devuelve url de Cloudinary. Llamamos múltiples veces para galería.
router.post('/me/landing/image', authenticate, requireRole('clinic_admin'), logoUpload.single('image'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });
  try {
    const slot = (req.body && req.body.slot) || 'gallery';
    const publicId = `${slot}-${Date.now()}-${uuid().slice(0, 8)}`;
    const result = await uploadBufferToCloudinary(req.file.buffer, publicId, `clinics/${req.user.clinic_id}/landing`);
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Error uploading landing image:', err);
    res.status(500).json({ error: 'No se pudo subir la imagen' });
  }
});

// GET /api/clinics/me/landing/preview — payload con la misma forma que el endpoint
// público, pero sin requerir landing_published. Usado por el iframe del editor.
router.get('/me/landing/preview', authenticate, async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const r = await query(
    `SELECT id, name, address, phone, email, city, brand_color, logo_url, website,
            landing_data, landing_template
       FROM clinics WHERE id = $1`,
    [req.user.clinic_id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  const c = r.rows[0];
  const data = sanitizeLanding(c.landing_data || {});
  let doctors = [];
  if (data.show_doctors !== false) {
    const docs = await query(
      `SELECT id, name, specialty, photo_url, bio FROM users
        WHERE clinic_id = $1 AND role = 'doctor' ORDER BY name`,
      [c.id]
    );
    doctors = docs.rows;
  }
  res.json({
    clinic: {
      id: c.id,
      name: c.name,
      address: c.address || '',
      city: c.city || '',
      phone: c.phone || '',
      email: c.email || '',
      brand_color: c.brand_color || '#0891b2',
      logo_url: c.logo_url || '',
      website: c.website || '',
    },
    template: c.landing_template || 'aurora',
    data,
    doctors,
  });
});

// GET /api/clinics/me/landing/leads — bandeja de leads del formulario público
router.get('/me/landing/leads', authenticate, requireRole('clinic_admin'), async (req, res) => {
  if (!req.user.clinic_id) return res.status(403).json({ error: 'Sin clínica asignada' });
  const r = await query(
    `SELECT id, name, phone, email, message, status, created_at
       FROM clinic_landing_leads WHERE clinic_id = $1
       ORDER BY created_at DESC LIMIT 200`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
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
