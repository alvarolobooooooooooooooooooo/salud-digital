const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Helper — obtiene la fecha local en formato YYYY-MM-DD según la zona horaria del servidor
function getLocalDateString() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: process.env.TZ || 'America/Chicago'
  });
}

// GET /api/assistant/today-appointments
// Solo doctores autenticados; devuelve citas propias de hoy con spoken_response
router.get('/today-appointments', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    console.log('[assistant] Request received. User:', req.user);
    const today = getLocalDateString();
    const doctorId  = req.user.id;
    const clinicId  = req.user.clinic_id;

    console.log('[assistant] Querying appointments for doctor:', doctorId, 'clinic:', clinicId, 'date:', today);

    // Consulta segura: siempre filtra por doctor_id y clinic_id del token (imposible consultar otro doctor)
    const result = await query(`
      SELECT
        a.id            AS appointment_id,
        a.scheduled_at,
        a.status,
        p.name          AS patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id  = $1
        AND a.clinic_id  = $2
        AND a.scheduled_at::date = $3
        AND a.status != 'cancelled'
      ORDER BY a.scheduled_at ASC
    `, [doctorId, clinicId, today]);

    console.log('[assistant] Database query result:', result.rows.length, 'appointments found');

    const appointments = result.rows.map(row => ({
      appointment_id: row.appointment_id,
      time: new Date(row.scheduled_at).toLocaleTimeString('es-HN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: process.env.TZ || 'America/Chicago'
      }),
      patient_name: row.patient_name,
      status: row.status
    }));

    // Generar frase natural conversacional
    let spoken_response;
    if (appointments.length === 0) {
      spoken_response = 'No tienes citas programadas para hoy.';
    } else {
      const first = appointments[0];
      const total = appointments.length;
      spoken_response = total === 1
        ? `Hoy tienes 1 cita. Es a las ${first.time} con ${first.patient_name}.`
        : `Hoy tienes ${total} citas. La primera es a las ${first.time} con ${first.patient_name}.`;
    }

    res.json({
      success: true,
      intent:  'get_todays_appointments',
      date:    today,
      total:   appointments.length,
      appointments,
      spoken_response
    });
  } catch (err) {
    console.error('[assistant] Error:', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Error al consultar las citas.', debug: err.message });
  }
});

// GET /api/assistant/last-appointment?patient_name=...
// Busca la última cita de un paciente para el doctor autenticado
router.get('/last-appointment', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { patient_name } = req.query;
    if (!patient_name || patient_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Patient name is required' });
    }

    const doctorId = req.user.id;
    const clinicId = req.user.clinic_id;

    console.log('[assistant] Searching last appointment for patient:', patient_name, 'doctor:', doctorId);

    // Buscar citas del paciente (case-insensitive, sin acentos)
    const result = await query(`
      SELECT
        a.id            AS appointment_id,
        a.scheduled_at,
        a.status,
        p.name          AS patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id  = $1
        AND a.clinic_id  = $2
        AND LOWER(UNACCENT(p.name)) LIKE LOWER(UNACCENT($3))
      ORDER BY a.scheduled_at DESC
      LIMIT 1
    `, [doctorId, clinicId, `%${patient_name}%`]);

    if (result.rows.length === 0) {
      const spoken_response = `No encontré citas de ${patient_name} en tu historial.`;
      return res.json({
        success: true,
        intent: 'get_last_appointment',
        patient_name,
        found: false,
        spoken_response
      });
    }

    const appointment = result.rows[0];
    const appointmentDate = new Date(appointment.scheduled_at);
    const dateStr = appointmentDate.toLocaleDateString('es-HN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: process.env.TZ || 'America/Chicago'
    });
    const timeStr = appointmentDate.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: process.env.TZ || 'America/Chicago'
    });

    const spoken_response = `La última cita de ${appointment.patient_name} fue el ${dateStr} a las ${timeStr}.`;

    res.json({
      success: true,
      intent: 'get_last_appointment',
      patient_name: appointment.patient_name,
      found: true,
      appointment: {
        appointment_id: appointment.appointment_id,
        date: dateStr,
        time: timeStr,
        status: appointment.status
      },
      spoken_response
    });
  } catch (err) {
    console.error('[assistant] Error:', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Error al consultar la cita.', debug: err.message });
  }
});

module.exports = router;
