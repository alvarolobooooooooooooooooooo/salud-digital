const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { checkRoomCapacity } = require('../lib/room-capacity');

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

router.get('/clinic/:clinicId', async (req, res) => {
  const result = await query('SELECT id, name, address, phone FROM clinics WHERE id = $1',
    [req.params.clinicId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
  res.json(result.rows[0]);
});

router.get('/clinic/:clinicId/doctors', async (req, res) => {
  const result = await query(
    `SELECT DISTINCT u.id, u.name, u.email, u.specialty
     FROM users u
     INNER JOIN doctor_availability da ON da.doctor_id = u.id
     WHERE u.clinic_id = $1 AND u.role = 'doctor' AND da.enabled = TRUE
     ORDER BY u.name`,
    [req.params.clinicId]
  );
  res.json(result.rows);
});

router.get('/clinic/:clinicId/doctors/:doctorId/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date es requerido' });

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

  const slots = [];
  for (const avail of availResult.rows) {
    const startMin = timeToMinutes(avail.start_time);
    const endMin = timeToMinutes(avail.end_time);
    const duration = avail.slot_duration || 30;
    for (let m = startMin; m + duration <= endMin; m += duration) {
      slots.push(minutesToTime(m));
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

  const doctorCheck = await query(
    `SELECT id, specialty FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'`,
    [doctorId, clinicId]
  );
  if (doctorCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

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
  let patientId;
  const existingPatient = await query(
    `SELECT id FROM patients WHERE identity_number = $1 AND clinic_id = $2`,
    [identity, clinicId]
  );

  if (existingPatient.rows.length > 0) {
    patientId = existingPatient.rows[0].id;
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

module.exports = router;
