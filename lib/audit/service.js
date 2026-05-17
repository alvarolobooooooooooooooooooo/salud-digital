const { query } = require('../db');
const vault = require('../secret-vault');

// Envoltura silenciosa: si la clave de cifrado no está configurada, persistimos
// en texto claro (con un warning) — preferible a perder auditoría completamente.
function maybeEncrypt(val) {
  if (val == null) return null;
  if (!vault.isAvailable()) return val;
  try { return vault.encrypt(String(val)); } catch { return val; }
}
function maybeDecrypt(val) {
  if (val == null) return null;
  try { return vault.decrypt(val); } catch { return val; }
}

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
          maybeEncrypt(tool_input),
          maybeEncrypt(tool_output),
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

      // Descifrar tool_input/tool_output al servir; transparente para llamadores legacy.
      return result.rows.map(r => ({
        ...r,
        tool_input: maybeDecrypt(r.tool_input),
        tool_output: maybeDecrypt(r.tool_output),
      }));
    } catch (err) {
      console.error('[AuditService] Error fetching history:', err.message);
      return [];
    }
  }

  // Purga logs más viejos que `days`. Útil para limitar el blast-radius si
  // la BD se compromete: lo más antiguo que un atacante puede leer queda acotado.
  async purgeOlderThan(days = 90) {
    const safeDays = Number.isFinite(Number(days)) && Number(days) > 0 ? parseInt(days, 10) : 90;
    try {
      const r = await query(
        `DELETE FROM audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
        [String(safeDays)]
      );
      return { deleted: r.rowCount, days: safeDays };
    } catch (err) {
      console.error('[AuditService] Error purging logs:', err.message);
      return { deleted: 0, days: safeDays, error: err.message };
    }
  }
}

module.exports = AuditService;
