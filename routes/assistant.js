const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkRoomCapacity } = require('../lib/room-capacity');
const { blockedReason, BLOCK_MESSAGES } = require('../lib/availability-blocks');
const { normalizarFechaHora, rangoDelDia } = require('../lib/dia-local');

// Cómo se lo decimos por voz. Los motivos los pone lib/availability-blocks.js.
const SPOKEN_BLOCK = {
  closed:   () => `Ese día lo tenés cerrado en tu disponibilidad. Elegí otro día.`,
  blocked:  (time) => `Marcaste las ${time} como no disponible. Elegí otra hora.`,
  dayoff:   () => `Ese día no lo atendés según tu horario de atención. Elegí otro día.`,
  offhours: (time) => `Las ${time} quedan fuera de tu horario de atención. Elegí otra hora.`,
};

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
    const today = getLocalDateString();
    const dia = rangoDelDia(today);
    const doctorId  = req.user.id;
    const clinicId  = req.user.clinic_id;

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
        AND a.scheduled_at >= $3 AND a.scheduled_at < $4
        AND a.status != 'cancelled'
      ORDER BY a.scheduled_at ASC
    `, [doctorId, clinicId, dia.desde, dia.hasta]);

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
    res.status(500).json({ success: false, error: 'Error al consultar las citas.' });
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

    // Buscar citas del paciente (case-insensitive)
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
        AND LOWER(p.name) LIKE LOWER($3)
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
    console.error('[assistant] Error in last-appointment:', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Error al consultar la cita.' });
  }
});

// GET /api/assistant/availability?date=YYYY-MM-DD
router.get('/availability', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Fecha requerida en formato YYYY-MM-DD' });
    }

    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.json({
        success: true, intent: 'get_availability', date,
        available_slots: [], total: 0,
        spoken_response: `El ${date} es fin de semana, no hay disponibilidad.`
      });
    }

    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (const min of [0, 30]) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }

    const dia = rangoDelDia(date);
    const result = await query(`
      SELECT scheduled_at FROM appointments
      WHERE doctor_id = $1 AND clinic_id = $2
        AND scheduled_at >= $3 AND scheduled_at < $4 AND status != 'cancelled'
    `, [req.user.id, req.user.clinic_id, dia.desde, dia.hasta]);

    const bookedTimes = result.rows.map(row =>
      new Date(row.scheduled_at).toLocaleTimeString('es-HN', {
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: process.env.TZ || 'America/Chicago'
      })
    );
    const availableSlots = slots.filter(s => !bookedTimes.includes(s));

    let spoken_response;
    if (availableSlots.length === 0) {
      spoken_response = `No tienes espacios disponibles el ${date}.`;
    } else {
      const first3 = availableSlots.slice(0, 3).join(', ');
      spoken_response = `El ${date} tienes ${availableSlots.length} espacios disponibles. Los primeros son: ${first3}.`;
    }

    res.json({ success: true, intent: 'get_availability', date, available_slots: availableSlots, total: availableSlots.length, spoken_response });
  } catch (err) {
    console.error('[assistant] Error in availability:', err.message);
    res.status(500).json({ success: false, error: 'Error al consultar disponibilidad.' });
  }
});

// POST /api/assistant/schedule  body: { patient_name, date, time }
router.post('/schedule', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { patient_name, date, time } = req.body;
    if (!patient_name || !date || !time) {
      return res.status(400).json({ success: false, error: 'Nombre del paciente, fecha y hora son requeridos' });
    }

    const patientResult = await query(`
      SELECT id, name FROM patients
      WHERE clinic_id = $1 AND LOWER(name) LIKE LOWER($2)
      ORDER BY LENGTH(name) ASC LIMIT 5
    `, [req.user.clinic_id, `%${patient_name}%`]);

    if (patientResult.rows.length === 0) {
      return res.json({
        success: false,
        error: `Paciente "${patient_name}" no encontrado.`,
        spoken_response: `No encontré al paciente ${patient_name} en esta clínica. ¿Está registrado?`
      });
    }

    if (patientResult.rows.length > 1) {
      const names = patientResult.rows.map(r => r.name).join(', ');
      return res.json({
        success: false,
        error: 'Varios pacientes coinciden',
        matches: patientResult.rows.map(r => ({ id: r.id, name: r.name })),
        spoken_response: `Hay varios pacientes que coinciden con "${patient_name}": ${names}. Especifica el nombre completo.`
      });
    }

    const patient = patientResult.rows[0];

    // Una sola representación para todo el handler. Antes había tres: se
    // comprobaba el bloqueo con la hora de pared, la sala con la hora UTC, y se
    // guardaba un objeto Date que el driver serializaba con desfase horario
    // (`…-06:00`). Tres formas distintas del mismo instante en catorce líneas, y
    // ninguna coincidía con lo que escriben las demás rutas.
    const cuando = normalizarFechaHora(`${date}T${time}`);
    if (!cuando) {
      return res.json({
        success: false,
        error: 'Fecha u hora inválidas',
        spoken_response: 'No entendí bien la fecha o la hora. ¿Me las repetís?',
      });
    }

    // Lo que el doctor bloqueó en su disponibilidad vale también por voz.
    const bloqueo = await blockedReason(req.user.id, cuando);
    if (bloqueo) {
      return res.json({
        success: false,
        error: BLOCK_MESSAGES[bloqueo],
        spoken_response: SPOKEN_BLOCK[bloqueo]
          ? SPOKEN_BLOCK[bloqueo](time)
          : SPOKEN_BLOCK.blocked(time)
      });
    }

    const cap = await checkRoomCapacity(req.user.clinic_id, cuando, null);
    if (!cap.ok) {
      return res.json({
        success: false,
        error: 'No hay salas disponibles en ese horario.',
        spoken_response: `No hay salas disponibles a las ${time}. Ya hay ${cap.overlapping} citas ocupando las ${cap.roomCount} salas.`
      });
    }

    const result = await query(`
      INSERT INTO appointments (doctor_id, patient_id, clinic_id, scheduled_at, status)
      VALUES ($1, $2, $3, $4, 'scheduled') RETURNING id
    `, [req.user.id, patient.id, req.user.clinic_id, cuando]);

    res.json({
      success: true, intent: 'schedule_appointment',
      appointment_id: result.rows[0].id,
      patient_name: patient.name, date, time,
      spoken_response: `Listo. Cita agendada con ${patient.name} el ${date} a las ${time}.`
    });
  } catch (err) {
    console.error('[assistant] Error in schedule:', err.message);
    res.status(500).json({ success: false, error: 'Error al agendar la cita.' });
  }
});

module.exports = router;
