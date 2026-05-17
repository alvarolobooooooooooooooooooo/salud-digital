const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const AuditService = require('../lib/audit/service');

// Solo super_admin: los audit_logs contienen PHI (nombres de pacientes, citas, etc.).
// Ningún rol clínico debe verlos.
router.get('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const audit = new AuditService();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const userId = parseInt(req.query.user_id, 10);
  const clinicId = parseInt(req.query.clinic_id, 10);
  if (!userId || !clinicId) return res.status(400).json({ error: 'user_id y clinic_id son requeridos' });
  const rows = await audit.getActionHistory(userId, clinicId, limit);
  res.json(rows);
});

// Purga manual de retención. La purga programada también corre en background (server.js).
router.post('/purge', authenticate, requireRole('super_admin'), async (req, res) => {
  const audit = new AuditService();
  const days = parseInt(req.body && req.body.days, 10) || 90;
  const result = await audit.purgeOlderThan(days);
  res.json(result);
});

module.exports = router;
