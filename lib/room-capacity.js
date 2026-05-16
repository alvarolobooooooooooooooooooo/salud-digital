const { query } = require('../db');

const APPT_SLOT_MINUTES = 30;

async function checkRoomCapacity(clinicId, scheduledAt, excludeApptId) {
  const roomCountRes = await query('SELECT COUNT(*)::int AS n FROM clinic_rooms WHERE clinic_id = $1', [clinicId]);
  const roomCount = roomCountRes.rows[0].n;
  if (roomCount === 0) return { ok: true, roomCount, overlapping: 0 };

  const params = [clinicId, scheduledAt, `${APPT_SLOT_MINUTES} minutes`];
  let sql = `SELECT COUNT(*)::int AS n FROM appointments
             WHERE clinic_id = $1
               AND status <> 'cancelled'
               AND scheduled_at::timestamp < ($2::timestamp + $3::interval)
               AND ($2::timestamp) < (scheduled_at::timestamp + $3::interval)`;
  if (excludeApptId) {
    sql += ' AND id <> $4';
    params.push(excludeApptId);
  }
  const overlapRes = await query(sql, params);
  const overlapping = overlapRes.rows[0].n;
  return { ok: overlapping < roomCount, roomCount, overlapping };
}

module.exports = { checkRoomCapacity, APPT_SLOT_MINUTES };
