const { query } = require('../db');

class AuditService {
  async logAction(params) {
    try {
      const {
        user_id,
        clinic_id,
        action,
        status = 'pending',
        reason = null,
        tool_input = null,
        tool_output = null,
        error = null,
        duration_ms = null
      } = params;

      // Try to insert into audit_logs table if it exists
      try {
        await query(`
          INSERT INTO audit_logs (
            user_id, clinic_id, action, status, reason,
            tool_input, tool_output, error, duration_ms, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          user_id,
          clinic_id,
          action,
          status,
          reason,
          tool_input,
          tool_output,
          error,
          duration_ms
        ]);
      } catch (dbErr) {
        // Table might not exist yet, just log to console
        if (dbErr.message.includes('does not exist')) {
          console.log('[AuditService] audit_logs table not created yet, logging to console:', {
            user_id,
            clinic_id,
            action,
            status
          });
        } else {
          throw dbErr;
        }
      }
    } catch (err) {
      console.error('[AuditService] Error logging action:', err.message);
    }
  }

  async getActionHistory(userId, clinicId, limit = 50) {
    try {
      const result = await query(`
        SELECT
          id, user_id, clinic_id, action, status, reason,
          tool_input, tool_output, error, duration_ms, created_at
        FROM audit_logs
        WHERE user_id = $1 AND clinic_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `, [userId, clinicId, limit]);

      return result.rows;
    } catch (err) {
      console.error('[AuditService] Error fetching history:', err.message);
      return [];
    }
  }
}

module.exports = AuditService;
