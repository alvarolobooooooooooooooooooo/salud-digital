const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

function ensureReception(req, res, next) {
  if (!['receptionist', 'clinic_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}

router.get('/today-appointments', authenticate, ensureReception, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT a.id, a.scheduled_at, a.status, a.specialty, a.reason, a.checked_in_at, a.room_id,
            a.cost, a.payment_status, a.payment_method,
            p.id AS patient_id, p.name AS patient_name, p.phone AS patient_phone, p.identity_number,
            u.id AS doctor_id, u.name AS doctor_name,
            r.name AS room_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     LEFT JOIN clinic_rooms r ON r.id = a.room_id
     WHERE a.clinic_id = $1 AND DATE(a.scheduled_at) = $2
     ORDER BY a.scheduled_at`,
    [req.user.clinic_id, today]
  );
  res.json(result.rows);
});

router.get('/waiting-queue', authenticate, ensureReception, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT a.id, a.scheduled_at, a.checked_in_at, a.specialty, a.reason,
            p.id AS patient_id, p.name AS patient_name, p.phone AS patient_phone,
            u.id AS doctor_id, u.name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     WHERE a.clinic_id = $1 AND DATE(a.scheduled_at) = $2
       AND a.status = 'waiting' AND a.room_id IS NULL
     ORDER BY a.checked_in_at ASC NULLS LAST, a.scheduled_at`,
    [req.user.clinic_id, today]
  );
  res.json(result.rows);
});

router.post('/check-in/:appointmentId', authenticate, ensureReception, async (req, res) => {
  const appointmentId = parseInt(req.params.appointmentId, 10);
  if (!appointmentId || isNaN(appointmentId)) return res.status(400).json({ error: 'ID de cita inválido' });

  const result = await query(
    `UPDATE appointments
     SET status = 'waiting', checked_in_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND clinic_id = $2
     RETURNING id, status, checked_in_at`,
    [appointmentId, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(result.rows[0]);
});

router.get('/stats-today', authenticate, ensureReception, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const stats = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'waiting' AND room_id IS NULL) AS waiting,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
       COUNT(*) AS total,
       COALESCE(SUM(cost) FILTER (WHERE payment_status = 'paid' AND DATE(paid_at) = $2), 0) AS revenue_today,
       AVG(EXTRACT(EPOCH FROM (started_at - checked_in_at))/60)
         FILTER (WHERE started_at IS NOT NULL AND checked_in_at IS NOT NULL) AS avg_wait_min
     FROM appointments
     WHERE clinic_id = $1 AND DATE(scheduled_at) = $2`,
    [req.user.clinic_id, today]
  );
  res.json(stats.rows[0]);
});

router.get('/payments-pending', authenticate, ensureReception, async (req, res) => {
  const result = await query(
    `SELECT a.id, a.scheduled_at, a.specialty, a.cost, a.payment_status,
            a.ended_at, a.status, a.reason, a.payment_notes,
            p.id AS patient_id, p.name AS patient_name, p.phone AS patient_phone,
            u.name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     WHERE a.clinic_id = $1 AND a.status = 'completed' AND a.payment_status != 'paid'
     ORDER BY a.ended_at DESC NULLS LAST
     LIMIT 100`,
    [req.user.clinic_id]
  );
  res.json(result.rows);
});

router.get('/payments-today', authenticate, ensureReception, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT a.id, a.cost, a.payment_method, a.paid_at,
            p.name AS patient_name, u.name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     WHERE a.clinic_id = $1 AND a.payment_status = 'paid' AND DATE(a.paid_at) = $2
     ORDER BY a.paid_at DESC`,
    [req.user.clinic_id, today]
  );

  const totals = await query(
    `SELECT payment_method, COALESCE(SUM(cost), 0) AS total, COUNT(*) AS count
     FROM appointments
     WHERE clinic_id = $1 AND payment_status = 'paid' AND DATE(paid_at) = $2
     GROUP BY payment_method`,
    [req.user.clinic_id, today]
  );

  res.json({ payments: result.rows, totals: totals.rows });
});

router.post('/charge/:appointmentId', authenticate, ensureReception, async (req, res) => {
  const appointmentId = parseInt(req.params.appointmentId, 10);
  if (!appointmentId || isNaN(appointmentId)) return res.status(400).json({ error: 'ID de cita inválido' });

  const { cost, payment_method } = req.body;
  if (!cost || cost <= 0) return res.status(400).json({ error: 'Monto inválido' });
  if (!payment_method) return res.status(400).json({ error: 'Método de pago requerido' });

  const result = await query(
    `UPDATE appointments
     SET cost = $1, payment_method = $2, payment_status = 'paid',
         paid_at = CURRENT_TIMESTAMP, paid_by = $3
     WHERE id = $4 AND clinic_id = $5
     RETURNING id, cost, payment_method, paid_at`,
    [cost, payment_method, req.user.id, appointmentId, req.user.clinic_id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(result.rows[0]);
});

module.exports = router;
