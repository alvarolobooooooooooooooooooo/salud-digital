const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// Un doctor siempre edita su propio horario; un clinic_admin puede editar el de
// cualquier doctor de SU clínica (nunca de otra). Devuelve null si no procede,
// y en ese caso el handler ya respondió.
async function resolveDoctorId(req, res, requestedId, { adminNeedsDoctor = false } = {}) {
  if (req.user.role === 'clinic_admin' && requestedId) {
    const doctorCheck = await query(
      `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
      [requestedId, req.user.clinic_id]
    );
    if (doctorCheck.rows.length === 0) {
      res.status(404).json({ error: 'Doctor no encontrado' });
      return null;
    }
    return parseInt(requestedId, 10);
  }
  if (req.user.role === 'doctor') return req.user.id;
  // Un admin sin doctor_id solo puede leer lo suyo; para escribir tiene que
  // decir sobre qué doctor escribe.
  if (req.user.role === 'clinic_admin' && !adminNeedsDoctor) return req.user.id;
  res.status(403).json({ error: 'No autorizado' });
  return null;
}

// Leer el horario de un doctor lo puede hacer cualquiera del personal de su
// misma clínica: recepción agenda citas y necesita saber qué horas están
// bloqueadas. Escribir sigue siendo cosa del doctor o del admin.
const STAFF_ROLES = ['clinic_admin', 'doctor', 'receptionist'];

async function resolveDoctorIdForRead(req, res, requestedId) {
  if (requestedId) {
    if (!STAFF_ROLES.includes(req.user.role)) {
      res.status(403).json({ error: 'No autorizado' });
      return null;
    }
    const doctorCheck = await query(
      `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
      [requestedId, req.user.clinic_id]
    );
    if (doctorCheck.rows.length === 0) {
      res.status(404).json({ error: 'Doctor no encontrado' });
      return null;
    }
    return parseInt(requestedId, 10);
  }
  if (req.user.role === 'doctor' || req.user.role === 'clinic_admin') return req.user.id;
  res.status(403).json({ error: 'No autorizado' });
  return null;
}

// No basta con la forma: "2026-13-99" la cumple y hace reventar la query de
// Postgres, así que se comprueba que la fecha exista de verdad.
const isDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

router.get('/', authenticate, async (req, res) => {
  const doctorId = await resolveDoctorIdForRead(req, res, req.query.doctor_id);
  if (doctorId === null) return;

  const result = await query(
    `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration, enabled
     FROM doctor_availability WHERE doctor_id = $1 ORDER BY day_of_week`,
    [doctorId]
  );
  res.json(result.rows);
});

// Excepciones por fecha (día cerrado u horas quitadas) dentro de un rango.
// GET /api/doctor-availability/overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/overrides', authenticate, async (req, res) => {
  const doctorId = await resolveDoctorIdForRead(req, res, req.query.doctor_id);
  if (doctorId === null) return;

  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) {
    return res.status(400).json({ error: 'from y to deben ser fechas YYYY-MM-DD' });
  }

  const result = await query(
    `SELECT TO_CHAR(override_date, 'YYYY-MM-DD') AS date, closed, blocked_times
       FROM doctor_day_overrides
      WHERE doctor_id = $1 AND override_date BETWEEN $2 AND $3
      ORDER BY override_date`,
    [doctorId, from, to]
  );
  res.json(result.rows.map(r => ({
    date: r.date,
    closed: !!r.closed,
    blocked_times: Array.isArray(r.blocked_times) ? r.blocked_times : [],
  })));
});

router.put('/', authenticate, async (req, res) => {
  const doctorId = await resolveDoctorId(req, res, req.body.doctor_id, { adminNeedsDoctor: true });
  if (doctorId === null) return;

  const { availability } = req.body;
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'availability debe ser un array' });
  }

  await query('DELETE FROM doctor_availability WHERE doctor_id = $1', [doctorId]);

  for (const slot of availability) {
    if (!slot.enabled) continue;
    if (typeof slot.day_of_week !== 'number' || !slot.start_time || !slot.end_time) continue;

    await query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [doctorId, slot.day_of_week, slot.start_time, slot.end_time, slot.slot_duration || 30, true]
    );
  }

  res.json({ success: true });
});

// PUT /api/doctor-availability/overrides — guarda (o borra) la excepción de UN día.
// Body: { date, closed, blocked_times: ["09:00", …], doctor_id? }
router.put('/overrides', authenticate, async (req, res) => {
  const doctorId = await resolveDoctorId(req, res, req.body.doctor_id, { adminNeedsDoctor: true });
  if (doctorId === null) return;

  const { date } = req.body;
  if (!isDate(date)) return res.status(400).json({ error: 'date debe ser YYYY-MM-DD' });

  const closed = req.body.closed === true;
  const raw = Array.isArray(req.body.blocked_times) ? req.body.blocked_times : [];
  if (raw.length > 200) return res.status(400).json({ error: 'Demasiadas horas bloqueadas' });
  if (!raw.every(isTime)) return res.status(400).json({ error: 'Horas inválidas' });
  const blocked = [...new Set(raw)].sort();

  // Sin excepción real no dejamos fila: el día vuelve a seguir el horario semanal.
  if (!closed && blocked.length === 0) {
    await query(
      'DELETE FROM doctor_day_overrides WHERE doctor_id = $1 AND override_date = $2',
      [doctorId, date]
    );
    return res.json({ success: true, date, closed: false, blocked_times: [] });
  }

  await query(
    `INSERT INTO doctor_day_overrides (doctor_id, override_date, closed, blocked_times, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (doctor_id, override_date)
     DO UPDATE SET closed = EXCLUDED.closed,
                   blocked_times = EXCLUDED.blocked_times,
                   updated_at = CURRENT_TIMESTAMP`,
    [doctorId, date, closed, JSON.stringify(closed ? [] : blocked)]
  );

  res.json({ success: true, date, closed, blocked_times: closed ? [] : blocked });
});

module.exports = router;
