const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const result = await query(
    `SELECT r.id, r.name, r.status, r.current_appointment_id, r.occupied_since,
            a.patient_id, a.doctor_id, a.scheduled_at,
            p.name AS patient_name, u.name AS doctor_name
     FROM clinic_rooms r
     LEFT JOIN appointments a ON a.id = r.current_appointment_id
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE r.clinic_id = $1
     ORDER BY r.id`,
    [req.user.clinic_id]
  );
  res.json(result.rows);
});

router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') return res.status(403).json({ error: 'No autorizado' });
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const result = await query(
    'INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ($1, $2, $3) RETURNING *',
    [req.user.clinic_id, name.trim(), 'free']
  );
  res.json(result.rows[0]);
});

// PUT /api/rooms/count — set the total number of rooms for the clinic (clinic_admin only).
// Reconciles clinic_rooms to match the target: adds auto-named rooms when growing,
// removes free rooms when shrinking. Never deletes a room that is in use.
// Must be declared before '/:id' so it isn't captured as an id param.
router.put('/count', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') return res.status(403).json({ error: 'No autorizado' });

  const target = parseInt(req.body.count, 10);
  if (!Number.isInteger(target) || target < 0 || target > 100) {
    return res.status(400).json({ error: 'Cantidad de salas inválida (0–100).' });
  }

  const clinicId = req.user.clinic_id;
  const existing = await query(
    'SELECT id, name, status, current_appointment_id FROM clinic_rooms WHERE clinic_id = $1 ORDER BY id',
    [clinicId]
  );
  const current = existing.rows.length;

  if (target > current) {
    const toAdd = target - current;
    const usedNums = new Set();
    existing.rows.forEach(r => {
      const m = /^Sala\s+(\d+)$/i.exec((r.name || '').trim());
      if (m) usedNums.add(parseInt(m[1], 10));
    });
    const values = [];
    const params = [clinicId];
    let n = 1;
    for (let i = 0; i < toAdd; i++) {
      while (usedNums.has(n)) n++;
      usedNums.add(n);
      params.push(`Sala ${n}`);
      values.push(`($1, $${params.length}, 'free')`);
    }
    await query(`INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ${values.join(', ')}`, params);
  } else if (target < current) {
    const toRemove = current - target;
    const inUse = r => r.status === 'occupied' || r.current_appointment_id != null;
    const removable = existing.rows.filter(r => !inUse(r));
    if (removable.length < toRemove) {
      return res.status(400).json({
        error: 'No se pueden eliminar salas en uso. Libera las salas ocupadas antes de reducir la cantidad.',
      });
    }
    // Remove the most recently created free rooms first (highest id).
    const idsToDelete = removable.slice(-toRemove).map(r => r.id);
    await query('DELETE FROM clinic_rooms WHERE clinic_id = $1 AND id = ANY($2::int[])', [clinicId, idsToDelete]);
  }

  const updated = await query(
    'SELECT id, name, status FROM clinic_rooms WHERE clinic_id = $1 ORDER BY id',
    [clinicId]
  );
  res.json({ count: updated.rows.length, rooms: updated.rows });
});

router.put('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID de sala inválido' });
  const { name } = req.body;
  const result = await query(
    'UPDATE clinic_rooms SET name = $1 WHERE id = $2 AND clinic_id = $3 RETURNING *',
    [name, id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
  res.json(result.rows[0]);
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'clinic_admin') return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID de sala inválido' });
  const result = await query(
    'DELETE FROM clinic_rooms WHERE id = $1 AND clinic_id = $2 RETURNING id',
    [id, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
  res.json({ success: true });
});

router.post('/:id/assign', authenticate, async (req, res) => {
  if (!['receptionist', 'clinic_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const roomId = parseInt(req.params.id, 10);
  if (!roomId || isNaN(roomId)) return res.status(400).json({ error: 'ID de sala inválido' });

  const { appointment_id } = req.body;
  if (!appointment_id) return res.status(400).json({ error: 'appointment_id requerido' });
  const apptId = parseInt(appointment_id, 10);
  if (!apptId || isNaN(apptId)) return res.status(400).json({ error: 'ID de cita inválido' });

  const room = await query(
    'SELECT * FROM clinic_rooms WHERE id = $1 AND clinic_id = $2',
    [roomId, req.user.clinic_id]
  );
  if (room.rows.length === 0) return res.status(404).json({ error: 'Sala no encontrada' });
  if (room.rows[0].status !== 'free') return res.status(400).json({ error: 'Sala no disponible' });

  const appt = await query(
    'SELECT * FROM appointments WHERE id = $1 AND clinic_id = $2',
    [apptId, req.user.clinic_id]
  );
  if (appt.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

  await query(
    `UPDATE clinic_rooms SET status = 'occupied', current_appointment_id = $1, occupied_since = CURRENT_TIMESTAMP WHERE id = $2`,
    [apptId, roomId]
  );
  await query(
    `UPDATE appointments SET status = 'in_progress', room_id = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [roomId, apptId]
  );

  res.json({ success: true });
});

router.post('/:id/release', authenticate, async (req, res) => {
  if (!['receptionist', 'clinic_admin', 'doctor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const roomId = parseInt(req.params.id, 10);
  if (!roomId || isNaN(roomId)) return res.status(400).json({ error: 'ID de sala inválido' });

  const room = await query(
    'SELECT * FROM clinic_rooms WHERE id = $1 AND clinic_id = $2',
    [roomId, req.user.clinic_id]
  );
  if (room.rows.length === 0) return res.status(404).json({ error: 'Sala no encontrada' });

  const apptId = room.rows[0].current_appointment_id;
  if (apptId) {
    await query(
      `UPDATE appointments SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [apptId]
    );
  }

  await query(
    `UPDATE clinic_rooms SET status = 'free', current_appointment_id = NULL, occupied_since = NULL WHERE id = $1`,
    [roomId]
  );

  res.json({ success: true });
});

module.exports = router;
