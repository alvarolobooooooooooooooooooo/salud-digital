const { query } = require('../db');

const DEFAULT_SLOT_MINUTES = 30;

// 'YYYY-MM-DDTHH:MM…' → { date, minutes }. Si el string no trae la hora en el
// formato local que usa la app, se cae a la fecha local del Date.
function splitLocal(scheduledAt) {
  const s = String(scheduledAt || '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (m) return { date: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) };
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * Motivo por el que el doctor no atiende a esa hora, según lo que él mismo
 * marcó en Citas Online:
 *   'closed'   → cerró ese día concreto
 *   'blocked'  → quitó esa hora de ese día
 *   'dayoff'   → su horario semanal no incluye ese día
 *   'offhours' → la hora cae fuera de las franjas de su horario semanal
 *   null       → puede agendarse
 *
 * Una hora bloqueada tapa todo su turno (según slot_duration), así que una cita
 * a las 09:15 dentro de un turno bloqueado de 09:00 también queda bloqueada.
 *
 * El horario semanal vale igual por dentro (agenda, recepción, asistente) que
 * por el enlace público: si el doctor cambia sus horas de atención, dejan de
 * poder agendarse citas fuera de ellas en todas partes. Un doctor sin ninguna
 * fila en doctor_availability es uno que nunca configuró horario: ahí no se
 * restringe nada.
 */
async function blockedReason(doctorId, scheduledAt) {
  const parsed = splitLocal(scheduledAt);
  if (!parsed || !doctorId) return null;

  // La excepción del día manda sobre el horario semanal: es lo más concreto que
  // dijo el doctor sobre ESA fecha.
  const result = await query(
    `SELECT closed, blocked_times FROM doctor_day_overrides
      WHERE doctor_id = $1 AND override_date = $2`,
    [doctorId, parsed.date]
  );
  const override = result.rows[0];
  if (override && override.closed) return 'closed';

  const availRows = (await query(
    `SELECT day_of_week, start_time, end_time, slot_duration
       FROM doctor_availability WHERE doctor_id = $1 AND enabled = TRUE`,
    [doctorId]
  )).rows;

  const blocked = override && Array.isArray(override.blocked_times) ? override.blocked_times : [];
  if (blocked.length > 0) {
    const duration = Number(availRows[0] && availRows[0].slot_duration) || DEFAULT_SLOT_MINUTES;
    const hit = blocked.some(t => {
      const start = toMinutes(t);
      return parsed.minutes >= start && parsed.minutes < start + duration;
    });
    if (hit) return 'blocked';
  }

  // Sin filas = nunca configuró su horario; no se le impone ninguno.
  if (availRows.length === 0) return null;

  // A mediodía para que ningún cambio de horario mueva el día de la semana.
  const dow = new Date(`${parsed.date}T12:00:00`).getDay();
  const delDia = availRows.filter(r => Number(r.day_of_week) === dow);
  if (delDia.length === 0) return 'dayoff';

  const dentro = delDia.some(r =>
    parsed.minutes >= toMinutes(r.start_time) && parsed.minutes < toMinutes(r.end_time)
  );
  return dentro ? null : 'offhours';
}

const BLOCK_MESSAGES = {
  closed: 'El doctor cerró ese día en su disponibilidad.',
  blocked: 'El doctor marcó esa hora como no disponible.',
  dayoff: 'El doctor no atiende ese día según su horario de atención.',
  offhours: 'Esa hora queda fuera del horario de atención del doctor.',
};

// Responde 409 si la hora está bloqueada. Devuelve true si ya contestó.
async function rejectIfBlocked(res, doctorId, scheduledAt, extra = {}) {
  const reason = await blockedReason(doctorId, scheduledAt);
  if (!reason) return false;
  res.status(409).json({
    error: extra.message || BLOCK_MESSAGES[reason],
    code: 'doctor_blocked',
    reason,
  });
  return true;
}

module.exports = { blockedReason, rejectIfBlocked, BLOCK_MESSAGES, DEFAULT_SLOT_MINUTES };
