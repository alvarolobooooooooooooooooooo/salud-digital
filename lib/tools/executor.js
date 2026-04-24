const tools = require('./registry');
const { TOOL_ACCESS } = require('../conversation/types');
const AuditService = require('../audit/service');

class ToolExecutor {
  async execute(toolName, toolInput, user) {
    // Validate user has access to this tool
    const userRole = user.role || 'patient';
    const allowedTools = TOOL_ACCESS[userRole] || [];

    if (!allowedTools.includes(toolName)) {
      const auditService = new AuditService();
      await auditService.logAction({
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: `DENIED_${toolName}`,
        status: 'denied',
        reason: 'Insufficient permissions',
        tool_input: JSON.stringify(toolInput)
      });

      return {
        success: false,
        error: `No tienes permiso para usar esta función: ${toolName}`
      };
    }

    // Execute the tool
    try {
      const auditService = new AuditService();
      const startTime = Date.now();

      const result = await tools[toolName](toolInput, user);

      const duration = Date.now() - startTime;

      // Log successful execution
      await auditService.logAction({
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: toolName,
        status: result.success ? 'success' : 'error',
        tool_input: JSON.stringify(toolInput),
        tool_output: result.success ? JSON.stringify(result.data) : result.error,
        duration_ms: duration
      });

      return result;
    } catch (err) {
      console.error(`[ToolExecutor] Error executing ${toolName}:`, err);

      const auditService = new AuditService();
      await auditService.logAction({
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: toolName,
        status: 'error',
        tool_input: JSON.stringify(toolInput),
        error: err.message
      });

      return {
        success: false,
        error: `Error ejecutando ${toolName}: ${err.message}`
      };
    }
  }

  async executeMultiple(toolCalls, user) {
    const results = [];
    for (const toolCall of toolCalls) {
      const result = await this.execute(toolCall.name, toolCall.input, user);
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result
      });
    }
    return results;
  }
}

module.exports = ToolExecutor;
