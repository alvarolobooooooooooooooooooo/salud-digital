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

module.exports = router;
