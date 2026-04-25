const { query } = require('../db');

// Tool implementations - each returns { success, data, error }
const tools = {
  get_today_appointments: async (params, user) => {
    try {
      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: process.env.TZ || 'America/Chicago'
      });

      const result = await query(`
        SELECT
          a.id            AS appointment_id,
          a.scheduled_at,
          a.status,
          p.name          AS patient_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.doctor_id = $1
          AND a.clinic_id = $2
          AND a.scheduled_at::date = $3
          AND a.status != 'cancelled'
        ORDER BY a.scheduled_at ASC
      `, [user.id, user.clinic_id, today]);

      const appointments = result.rows.map(row => ({
        appointment_id: row.appointment_id,
        time: new Date(row.scheduled_at).toLocaleTimeString('es-HN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
          timeZone: process.env.TZ || 'America/Chicago'
        }),
        patient_name: row.patient_name,
        status: row.status
      }));

      return {
        success: true,
        data: {
          total: appointments.length,
          appointments,
          message: appointments.length === 0
            ? 'No tienes citas programadas para hoy.'
            : `Tienes ${appointments.length} cita${appointments.length > 1 ? 's' : ''} hoy.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error consultando citas: ${err.message}`
      };
    }
  },

  get_last_appointment: async (params, user) => {
    try {
      const { patient_name } = params;
      if (!patient_name || patient_name.trim().length === 0) {
        return { success: false, error: 'El nombre del paciente es requerido' };
      }

      const result = await query(`
        SELECT
          a.id            AS appointment_id,
          a.scheduled_at,
          a.status,
          p.name          AS patient_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.doctor_id = $1
          AND a.clinic_id = $2
          AND LOWER(p.name) LIKE LOWER($3)
        ORDER BY a.scheduled_at DESC
        LIMIT 1
      `, [user.id, user.clinic_id, `%${patient_name}%`]);

      if (result.rows.length === 0) {
        return {
          success: true,
          data: {
            found: false,
            message: `No encontré citas de ${patient_name} en tu historial.`
          }
        };
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

      return {
        success: true,
        data: {
          found: true,
          patient_name: appointment.patient_name,
          date: dateStr,
          time: timeStr,
          status: appointment.status,
          message: `La última cita de ${appointment.patient_name} fue el ${dateStr} a las ${timeStr}.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error consultando última cita: ${err.message}`
      };
    }
  },

  get_availability: async (params, user) => {
    try {
      const { date } = params;
      if (!date) {
        return { success: false, error: 'La fecha es requerida en formato YYYY-MM-DD' };
      }

      // Default: 8am-6pm, 30-min slots, weekdays only
      const dateObj = new Date(date);
      if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
        return {
          success: true,
          data: {
            available_slots: [],
            message: 'No hay disponibilidad en fin de semana.'
          }
        };
      }

      const slots = [];
      for (let hour = 8; hour < 18; hour++) {
        for (let min of [0, 30]) {
          slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        }
      }

      // Check for existing appointments on this date for this doctor
      const result = await query(`
        SELECT a.scheduled_at FROM appointments a
        WHERE a.doctor_id = $1
          AND a.clinic_id = $2
          AND a.scheduled_at::date = $3
          AND a.status != 'cancelled'
        ORDER BY a.scheduled_at
      `, [user.id, user.clinic_id, date]);

      const bookedTimes = result.rows.map(row => {
        const d = new Date(row.scheduled_at);
        return d.toLocaleTimeString('es-HN', {
          hour: '2-digit', minute: '2-digit', hour12: false,
          timeZone: process.env.TZ || 'America/Chicago'
        });
      });

      const availableSlots = slots.filter(slot => !bookedTimes.includes(slot));

      return {
        success: true,
        data: {
          date,
          available_slots: availableSlots,
          total: availableSlots.length,
          message: `Tienes ${availableSlots.length} espacios disponibles el ${date}.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error consultando disponibilidad: ${err.message}`
      };
    }
  },

  schedule_appointment: async (params, user) => {
    try {
      const { patient_name, date, time } = params;
      console.log(`[schedule_appointment] CALLED user=${user.id} clinic=${user.clinic_id} patient="${patient_name}" date=${date} time=${time}`);

      if (!patient_name || !date || !time) {
        return { success: false, error: 'Paciente, fecha y hora son requeridos' };
      }

      // Find patient by partial name match (case insensitive)
      const patientResult = await query(`
        SELECT id, name FROM patients
        WHERE clinic_id = $1 AND LOWER(name) LIKE LOWER($2)
        ORDER BY LENGTH(name) ASC
        LIMIT 5
      `, [user.clinic_id, `%${patient_name}%`]);

      if (patientResult.rows.length === 0) {
        console.log(`[schedule_appointment] Patient "${patient_name}" NOT FOUND in clinic ${user.clinic_id}`);
        return { success: false, error: `Paciente "${patient_name}" no encontrado. Verifica el nombre o regístralo primero.` };
      }

      if (patientResult.rows.length > 1) {
        const matches = patientResult.rows.map(r => r.name).join(', ');
        console.log(`[schedule_appointment] Ambiguous "${patient_name}" → ${matches}`);
        return {
          success: false,
          error: `Hay varios pacientes que coinciden con "${patient_name}": ${matches}. Especifica el nombre completo.`
        };
      }

      const patient = patientResult.rows[0];
      const patientId = patient.id;
      // Construct date in Honduras timezone (UTC-6, no DST)
      const scheduledAt = new Date(`${date}T${time}:00-06:00`);

      const result = await query(`
        INSERT INTO appointments (doctor_id, patient_id, clinic_id, scheduled_at, status)
        VALUES ($1, $2, $3, $4, 'scheduled')
        RETURNING id, scheduled_at
      `, [user.id, patientId, user.clinic_id, scheduledAt]);

      console.log(`[schedule_appointment] SUCCESS appointment_id=${result.rows[0].id} stored_at=${result.rows[0].scheduled_at}`);

      return {
        success: true,
        data: {
          appointment_id: result.rows[0].id,
          patient_name: patient.name,
          date,
          time,
          message: `Cita agendada con ${patient.name} el ${date} a las ${time}.`
        }
      };
    } catch (err) {
      console.error(`[schedule_appointment] ERROR:`, err);
      return {
        success: false,
        error: `Error agendando cita: ${err.message}`
      };
    }
  },

  reschedule_appointment: async (params, user) => {
    try {
      const { appointment_id, new_date, new_time } = params;
      console.log(`[reschedule_appointment] CALLED user=${user.id} appt=${appointment_id} → ${new_date} ${new_time}`);
      if (!appointment_id || !new_date || !new_time) {
        return { success: false, error: 'ID de cita, nueva fecha y hora son requeridos' };
      }

      const scheduledAt = new Date(`${new_date}T${new_time}:00-06:00`);

      const result = await query(`
        UPDATE appointments
        SET scheduled_at = $1
        WHERE id = $2 AND doctor_id = $3 AND clinic_id = $4
        RETURNING id
      `, [scheduledAt, appointment_id, user.id, user.clinic_id]);

      if (result.rows.length === 0) {
        console.log(`[reschedule_appointment] NOT FOUND appt=${appointment_id}`);
        return { success: false, error: 'Cita no encontrada o no tienes permiso' };
      }
      console.log(`[reschedule_appointment] SUCCESS appt=${appointment_id}`);

      return {
        success: true,
        data: {
          appointment_id,
          new_date,
          new_time,
          message: `Cita reprogramada para ${new_date} a las ${new_time}.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error reprogramando cita: ${err.message}`
      };
    }
  },

  cancel_appointment: async (params, user) => {
    try {
      const { appointment_id } = params;
      console.log(`[cancel_appointment] CALLED user=${user.id} appt=${appointment_id}`);
      if (!appointment_id) {
        return { success: false, error: 'ID de cita es requerido' };
      }

      const result = await query(`
        UPDATE appointments
        SET status = 'cancelled'
        WHERE id = $1 AND doctor_id = $2 AND clinic_id = $3
        RETURNING id
      `, [appointment_id, user.id, user.clinic_id]);

      if (result.rows.length === 0) {
        console.log(`[cancel_appointment] NOT FOUND appt=${appointment_id}`);
        return { success: false, error: 'Cita no encontrada o no tienes permiso' };
      }
      console.log(`[cancel_appointment] SUCCESS appt=${appointment_id}`);

      return {
        success: true,
        data: {
          appointment_id,
          message: `Cita cancelada.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error cancelando cita: ${err.message}`
      };
    }
  },

  register_patient: async (params, user) => {
    try {
      const { name, email, phone } = params;
      if (!name || !email || !phone) {
        return { success: false, error: 'Nombre, email y teléfono son requeridos' };
      }

      const result = await query(`
        INSERT INTO patients (clinic_id, name, email, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [user.clinic_id, name, email, phone]);

      return {
        success: true,
        data: {
          patient_id: result.rows[0].id,
          name,
          email,
          phone,
          message: `Paciente ${name} registrado exitosamente.`
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error registrando paciente: ${err.message}`
      };
    }
  },

  transfer_to_human: async (params, user) => {
    return {
      success: true,
      data: {
        message: 'Te estoy transfiriendo a un operador humano. Por favor espera.',
        transfer_requested: true
      }
    };
  }
};

module.exports = tools;
