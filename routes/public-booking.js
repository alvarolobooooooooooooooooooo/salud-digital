const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { checkRoomCapacity } = require('../lib/room-capacity');
const { blockedReason } = require('../lib/availability-blocks');
const subscription = require('../lib/subscription');
const { searchAddress } = require('../lib/geocoding');
const { parseMapsUrl, resolveMapsShortLink } = require('../lib/maps-links');

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Un DNI de puros ceros/guiones no identifica a nadie: es el relleno de quien no
// tiene el número a mano. No sirve para reconocer a un paciente que vuelve.
function isFillerIdentity(identity) {
  return /^[0\s-]+$/.test(identity);
}

router.get('/clinic/:clinicId', async (req, res) => {
  const result = await query(
    `SELECT id, name, address, city, phone, brand_color, logo_url, landing_data,
            latitude, longitude, map_url, location_notes
       FROM clinics WHERE id = $1`,
    [req.params.clinicId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  const row = result.rows[0];
  const landingData = row.landing_data || {};
  const theme = (landingData && landingData.theme && typeof landingData.theme === 'object')
    ? { primary: landingData.theme.primary || null, accent: landingData.theme.accent || null }
    : null;
  res.json({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city || '',
    phone: row.phone,
    brand_color: row.brand_color || null,
    logo_url: row.logo_url || null,
    theme,
    // Ubicación: el paciente la necesita para llegar (mapa + Waze/Google Maps en
    // la confirmación de la reserva).
    latitude: row.latitude != null ? parseFloat(row.latitude) : null,
    longitude: row.longitude != null ? parseFloat(row.longitude) : null,
    map_url: row.map_url || '',
    location_notes: row.location_notes || '',
  });
});

router.get('/clinic/:clinicId/doctors', async (req, res) => {
  // Endpoint público: nunca exponer el email del doctor (PII). Para reservar
  // basta id, nombre y especialidad.
  const result = await query(
    `SELECT DISTINCT u.id, u.name, u.specialty
     FROM users u
     INNER JOIN doctor_availability da ON da.doctor_id = u.id
     WHERE u.clinic_id = $1 AND u.role = 'doctor' AND da.enabled = TRUE
     ORDER BY u.name`,
    [req.params.clinicId]
  );
  res.json(result.rows);
});

// Ruta pública: una fecha con forma correcta pero imposible ("2026-13-99")
// llegaba tal cual a Postgres y tumbaba el proceso, así que se valida que exista.
function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

router.get('/clinic/:clinicId/doctors/:doctorId/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date es requerido' });
  if (!isRealDate(date)) return res.status(400).json({ error: 'date inválida' });

  const doctorCheck = await query(
    `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
    [req.params.doctorId, req.params.clinicId]
  );
  if (doctorCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  const availResult = await query(
    `SELECT start_time, end_time, slot_duration FROM doctor_availability
     WHERE doctor_id = $1 AND day_of_week = $2 AND enabled = TRUE`,
    [req.params.doctorId, dayOfWeek]
  );

  if (availResult.rows.length === 0) return res.json([]);

  // Excepción de ese día concreto: día cerrado, u horas que el doctor quitó.
  const overrideResult = await query(
    `SELECT closed, blocked_times FROM doctor_day_overrides
      WHERE doctor_id = $1 AND override_date = $2`,
    [req.params.doctorId, date]
  );
  const override = overrideResult.rows[0];
  if (override && override.closed) return res.json([]);
  const blockedTimes = new Set(
    override && Array.isArray(override.blocked_times) ? override.blocked_times : []
  );

  const slots = [];
  for (const avail of availResult.rows) {
    const startMin = timeToMinutes(avail.start_time);
    const endMin = timeToMinutes(avail.end_time);
    const duration = avail.slot_duration || 30;
    for (let m = startMin; m + duration <= endMin; m += duration) {
      const t = minutesToTime(m);
      if (blockedTimes.has(t)) continue;
      slots.push(t);
    }
  }

  const occupiedResult = await query(
    `SELECT scheduled_at FROM appointments
     WHERE doctor_id = $1 AND scheduled_at::date = $2 AND status != 'cancelled'`,
    [req.params.doctorId, date]
  );

  const occupiedTimes = new Set(occupiedResult.rows.map(r => {
    const dt = new Date(r.scheduled_at);
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }));

  const result = slots.map(time => ({
    time,
    available: !occupiedTimes.has(time)
  }));

  res.json(result);
});

router.post('/clinic/:clinicId/booking', async (req, res) => {
  const { doctor_id, scheduled_at, patient_name, patient_identity, patient_phone, reason } = req.body || {};

  if (!doctor_id || !scheduled_at || !patient_name || !patient_identity || !patient_phone) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  // Validación estricta de inputs públicos para reducir abuso/bots
  const name = String(patient_name).trim().slice(0, 120);
  const identity = String(patient_identity).trim().slice(0, 40);
  const phoneDigits = String(patient_phone).replace(/\D/g, '').slice(0, 20);
  const reasonText = String(reason || '').trim().slice(0, 500);
  if (name.length < 3) return res.status(400).json({ error: 'Nombre inválido' });
  if (!/^\d{4}-\d{4}-\d{5}$|^[A-Z0-9-]{4,30}$/i.test(identity)) {
    return res.status(400).json({ error: 'Número de identidad inválido' });
  }
  if (phoneDigits.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(String(scheduled_at))) {
    return res.status(400).json({ error: 'Fecha/hora inválida' });
  }
  const apptDate = new Date(scheduled_at);
  if (isNaN(apptDate.getTime()) || apptDate.getTime() < Date.now() - 5 * 60 * 1000) {
    return res.status(400).json({ error: 'La fecha de la cita debe ser futura' });
  }

  const clinicId = parseInt(req.params.clinicId, 10);
  if (!clinicId) return res.status(400).json({ error: 'Clínica inválida' });
  const doctorId = parseInt(doctor_id, 10);
  if (!doctorId) return res.status(400).json({ error: 'Doctor inválido' });

  const clinicCheck = await query('SELECT id FROM clinics WHERE id = $1', [clinicId]);
  if (clinicCheck.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });

  // Esta ruta es pública y por tanto NO pasa por middleware/subscription.js, así
  // que el cobro se comprueba aquí a mano: sin ella, una clínica sin plan seguía
  // dando de alta pacientes y citas desde su propio enlace de reservas.
  // El mensaje es neutro a propósito: quien lo lee es un paciente, y el estado de
  // pago de la clínica no es asunto suyo.
  const permiso = await subscription.clinicCanWrite(clinicId);
  if (!permiso.allowed) {
    return res.status(403).json({
      error: 'Esta clínica no está recibiendo reservas en línea por el momento. Comunícate con ella directamente.',
      code: 'booking_unavailable',
    });
  }

  const doctorCheck = await query(
    `SELECT id, specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
    [doctorId, clinicId]
  );
  if (doctorCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

  // El listado de horas ya oculta lo que el doctor marcó como no disponible, pero
  // esta ruta es pública: sin comprobarlo aquí, un POST directo reservaba igual.
  // El paciente no tiene por qué saber el motivo, así que el mensaje es neutro.
  if (await blockedReason(doctorId, scheduled_at)) {
    return res.status(409).json({ error: 'Este horario ya no está disponible' });
  }

  const conflictCheck = await query(
    `SELECT id FROM appointments WHERE doctor_id = $1 AND scheduled_at = $2 AND status != 'cancelled'`,
    [doctorId, scheduled_at]
  );
  if (conflictCheck.rows.length > 0) {
    return res.status(409).json({ error: 'Este horario ya no está disponible' });
  }

  const cap = await checkRoomCapacity(clinicId, scheduled_at, null);
  if (!cap.ok) {
    return res.status(409).json({
      error: 'Este horario ya no está disponible',
      code: 'rooms_full',
    });
  }

  // IMPORTANTE: nunca sobrescribir nombre/teléfono de un paciente existente desde el endpoint
  // público — permitiría que un atacante con un DNI conocido secuestre PII del paciente real.
  // Si el DNI ya existe, asociamos la cita al registro existente sin tocar sus campos.
  //
  // Eso solo vale si el DNI identifica de verdad a UNA persona. En la práctica
  // "0000-0000-00000" es lo que se escribe cuando no se tiene el número a mano, y
  // acaba compartido por cientos de expedientes de la misma clínica. Reutilizar
  // "el primero que devuelva Postgres" —el SELECT ni siquiera ordenaba, así que
  // cambiaba solo— metía cada reserva nueva en el expediente de otra persona, y
  // encima enseñando su nombre y su teléfono, porque a propósito no los tocamos.
  // Regla: si el DNI es de relleno, o está repetido en la clínica, se abre
  // expediente nuevo. Un duplicado se junta después; una cita metida en el
  // expediente equivocado no se deshace.
  let patientId;
  const candidates = isFillerIdentity(identity)
    ? []
    : (await query(
        `SELECT id FROM patients WHERE identity_number = $1 AND clinic_id = $2 ORDER BY id LIMIT 2`,
        [identity, clinicId]
      )).rows;

  if (candidates.length === 1) {
    patientId = candidates[0].id;
  } else {
    const newPatient = await query(
      `INSERT INTO patients (name, identity_number, phone, clinic_id, age) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, identity, phoneDigits, clinicId, 0]
    );
    patientId = newPatient.rows[0].id;
  }

  const result = await query(
    `INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status, source, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [patientId, doctorId, clinicId, doctorCheck.rows[0].specialty || '', scheduled_at, 'pending', 'public_link', reasonText]
  );

  res.json({ appointment_id: result.rows[0].id, success: true });
});

// ── Landing pública por clínica ──────────────────────────────────────────────
// Resolución por slug (la URL pública /c/<slug> y este endpoint son los puntos
// públicos; nada aquí requiere autenticación). Solo se devuelve si está publicado.
router.get('/landing/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    return res.status(404).json({ error: 'Sitio no encontrado' });
  }
  const r = await query(
    `SELECT id, name, address, phone, email, city, brand_color, logo_url, website,
            landing_data, landing_template, landing_published
       FROM clinics WHERE slug = $1 AND landing_published = TRUE`,
    [slug]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Sitio no encontrado' });
  const c = r.rows[0];

  // Mostramos doctores activos solo si la clínica decidió que se vean
  const data = c.landing_data || {};
  let doctors = [];
  if (data.show_doctors !== false) {
    const docs = await query(
      `SELECT id, name, specialty, photo_url, bio
         FROM users WHERE clinic_id = $1 AND role = 'doctor'
         ORDER BY name`,
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

// Lead público (formulario de contacto de la landing). Rate-limit en server.js.
router.post('/landing/:slug/lead', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const { name, phone, email, message } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const r = await query(
    `SELECT id FROM clinics WHERE slug = $1 AND landing_published = TRUE`,
    [slug]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Sitio no encontrado' });

  const clean = {
    name: String(name).trim().slice(0, 120),
    phone: String(phone || '').replace(/[^\d+\-\s()]/g, '').slice(0, 30),
    email: String(email || '').trim().slice(0, 120),
    message: String(message || '').trim().slice(0, 1000),
  };
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!clean.phone && !clean.email) {
    return res.status(400).json({ error: 'Necesitamos un teléfono o email para contactarte.' });
  }

  await query(
    `INSERT INTO clinic_landing_leads (clinic_id, name, phone, email, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [r.rows[0].id, clean.name, clean.phone, clean.email, clean.message]
  );
  res.json({ success: true });
});

// GET /api/public/clinics/map — listado de pines para la página /mapa.
// Pública (sin auth). Incluye solo clínicas con coordenadas válidas y con el
// opt-out desactivado. landing_url se emite solo si la landing está publicada.
router.get('/clinics/map', async (req, res) => {
  const r = await query(
    `SELECT id, name, slug, address, city, phone, latitude, longitude,
            logo_url, brand_color, landing_published
       FROM clinics
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND show_on_public_map = TRUE`
  );
  const clinics = r.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug || null,
    address: row.address || '',
    city: row.city || '',
    phone: row.phone || '',
    lat: parseFloat(row.latitude),
    lng: parseFloat(row.longitude),
    logo_url: row.logo_url || null,
    brand_color: row.brand_color || '#0891b2',
    landing_url: (row.landing_published && row.slug) ? `/c/${row.slug}` : null,
  }));
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ clinics });
});

// ── Geocodificación para el alta de doctores ─────────────────────────────────
// Públicas porque el paso de ubicación del asistente de registro ocurre antes de
// que exista sesión. No tocan la base de datos ni exponen datos de clínicas: solo
// traducen texto o un enlace de Google Maps a coordenadas. El rate limit vive en
// server.js (/api/public/geo) y Nominatim se llama a través de la cola global.

router.get('/geo/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 3) return res.json({ results: [] });
  try {
    const results = await searchAddress(q, 6);
    res.json({ results });
  } catch (err) {
    // La cola de Nominatim tiene fondo (ver lib/geocoding.js). Cuando está
    // llena preferimos contestar y soltar la conexión antes que dejar al
    // cliente esperando minutos por una búsqueda de direcciones.
    if (err && err.colaLlena) {
      return res.status(503).json({
        error: 'El buscador de direcciones está ocupado. Intenta de nuevo en unos segundos.',
        code: 'geocoder_busy',
      });
    }
    throw err;
  }
});

router.get('/geo/resolve', async (req, res) => {
  const url = String(req.query.url || '').trim().slice(0, 600);
  if (!url) return res.status(400).json({ error: 'Falta el enlace' });

  const direct = parseMapsUrl(url);
  if (direct) return res.json({ ...direct, url });

  const resolved = await resolveMapsShortLink(url);
  if (!resolved) {
    return res.status(422).json({
      error: 'No pudimos leer las coordenadas de ese enlace. Marca el punto en el mapa.',
    });
  }
  res.json(resolved);
});

module.exports = router;
