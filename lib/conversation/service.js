const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const OpenAIClient = require('./openai-client');
const ToolExecutor = require('../tools/executor');
const { SESSION_STATE } = require('./types');
const AuditService = require('../audit/service');
const { INTENT, classifyIntent, getCannedResponse, INTENT_TOOLS } = require('./intent-classifier');

const SYSTEM_PROMPTS = {
  base: 'Asistente médico clínico. Responde en español (Honduras), breve y profesional. NO inventes datos médicos. Usa tools para datos reales.',
  general: 'Asistente médico. Responde breve en español. No inventes datos.',
  appointments: 'Asistente médico. Usa tools para consultar citas reales. Responde breve en español. No inventes.',
  patient: 'Asistente médico. Usa tools para datos de pacientes. Breve, en español. No inventes.',
  record: 'Asistente médico. Usa tools para expedientes. Resume claro y breve. No inventes datos clínicos.',
  action: 'Asistente médico de acciones. REGLAS ESTRICTAS:\n1. Si el usuario pide agendar/reprogramar/cancelar/registrar y tienes todos los datos (nombre, fecha, hora), LLAMA LA TOOL INMEDIATAMENTE. NO pidas confirmación previa.\n2. Si faltan datos (ej. solo dijo fecha sin hora), pregunta SOLO el dato faltante.\n3. Si el usuario confirma una acción previa ("sí", "agéndalo", "ok"), DEBES llamar la tool en este turno. NUNCA digas "ya lo hice" sin haber llamado la tool ahora.\n4. Reporta el resultado real de la tool. Si la tool falla, dilo claramente.\nResponde breve en español.'
};

const HISTORY_BY_INTENT = {
  [INTENT.GENERAL]: 0,
  [INTENT.APPOINTMENTS]: 2,
  [INTENT.PATIENT]: 2,
  [INTENT.RECORD]: 2,
  [INTENT.ACTION]: 6,
  [INTENT.UNKNOWN]: 2
};

const MAX_TOKENS_BY_INTENT = {
  [INTENT.GENERAL]: 150,
  [INTENT.APPOINTMENTS]: 250,
  [INTENT.PATIENT]: 250,
  [INTENT.RECORD]: 600,
  [INTENT.ACTION]: 300,
  [INTENT.UNKNOWN]: 250
};

class ConversationService {
  constructor() {
    this.llmClient = null;
    this.toolExecutor = new ToolExecutor();
    this.auditService = new AuditService();
  }

  getLLMClient() {
    if (!this.llmClient) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured in environment');
      }
      this.llmClient = new OpenAIClient();
    }
    return this.llmClient;
  }

  getSystemPromptForIntent(intent) {
    return SYSTEM_PROMPTS[intent] || SYSTEM_PROMPTS.base;
  }

  async createSession(userId, clinicId, userRole = 'doctor') {
    try {
      const sessionId = uuidv4();
      const createdAt = new Date();

      try {
        await query(`
          INSERT INTO conversation_sessions (
            id, user_id, clinic_id, user_role, state, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [sessionId, userId, clinicId, userRole, SESSION_STATE.ACTIVE, createdAt, createdAt]);
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) throw dbErr;
      }

      return {
        session_id: sessionId,
        user_id: userId,
        clinic_id: clinicId,
        state: SESSION_STATE.ACTIVE,
        created_at: createdAt
      };
    } catch (err) {
      console.error('[ConversationService] Error creating session:', err.message);
      throw err;
    }
  }

  async getRecentHistory(sessionId, limit) {
    if (limit <= 0) return [];
    try {
      const result = await query(`
        SELECT role, content FROM conversation_messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);
      return result.rows.reverse().map(row => ({
        role: row.role,
        content: row.content
      }));
    } catch (dbErr) {
      if (!dbErr.message.includes('does not exist')) throw dbErr;
      return [];
    }
  }

  async persistMessage(sessionId, role, content) {
    try {
      await query(`
        INSERT INTO conversation_messages (id, session_id, role, content, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [uuidv4(), sessionId, role, content]);
    } catch (dbErr) {
      if (!dbErr.message.includes('does not exist')) throw dbErr;
    }
  }

  async processUserInput(sessionId, userMessage, userId, clinicId, userRole = 'doctor') {
    try {
      const messageId = uuidv4();

      // STEP 1: Classify intent locally (zero tokens)
      const intent = classifyIntent(userMessage);
      console.log(`[Intent] "${userMessage.substring(0, 50)}" → ${intent}`);

      // STEP 2: Persist user message
      await this.persistMessage(sessionId, 'user', userMessage);

      // STEP 3: Try canned response for general intent (zero tokens)
      if (intent === INTENT.GENERAL) {
        const canned = getCannedResponse(userMessage);
        if (canned) {
          console.log('[Tokens] intent=general canned=true tokens=0');
          await this.persistMessage(sessionId, 'assistant', canned);
          return {
            session_id: sessionId,
            message_id: messageId,
            user_message: userMessage,
            assistant_response: canned,
            tool_calls: [],
            tool_results: []
          };
        }
      }

      // STEP 4: Build minimal context based on intent
      const historyLimit = HISTORY_BY_INTENT[intent];
      const history = await this.getRecentHistory(sessionId, historyLimit);
      const messages = [...history, { role: 'user', content: userMessage }];

      // STEP 5: Get tools relevant to this intent only
      const toolNames = INTENT_TOOLS[intent] || [];
      const systemPrompt = this.getSystemPromptForIntent(intent);
      const maxTokens = MAX_TOKENS_BY_INTENT[intent];

      // STEP 6: Call LLM with focused context
      const response = await this.getLLMClient().chat(messages, systemPrompt, {
        toolNames,
        maxTokens,
        temperature: 0.2,
        intent
      });

      const toolCalls = this.getLLMClient().extractToolCalls(response.content);

      // STEP 7: If no tools called, return text directly
      if (toolCalls.length === 0) {
        const responseText = this.getLLMClient().extractTextResponse(response.content);
        await this.persistMessage(sessionId, 'assistant', responseText);
        return {
          session_id: sessionId,
          message_id: messageId,
          user_message: userMessage,
          assistant_response: responseText,
          tool_calls: [],
          tool_results: []
        };
      }

      // STEP 8: Execute tools
      const toolResults = await this.toolExecutor.executeMultiple(toolCalls, {
        id: userId,
        clinic_id: clinicId,
        role: userRole
      });

      // STEP 9: Second LLM call with tool results for natural response
      messages.push({
        role: 'assistant',
        content: response.content.content || '',
        tool_calls: response.content.tool_calls
      });
      for (const result of toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: result.id,
          content: JSON.stringify(result.result)
        });
      }

      const followUpPrompt = 'Asistente médico. Reporta al usuario el resultado real de la tool en español, breve. Si la tool falló, dilo claramente y sugiere qué hacer. NO inventes éxito.';
      const finalResponse = await this.getLLMClient().chat(messages, followUpPrompt, {
        toolNames: [],
        maxTokens,
        temperature: 0.2,
        intent: `${intent}+tools`
      });
      const finalText = this.getLLMClient().extractTextResponse(finalResponse.content);

      await this.persistMessage(sessionId, 'assistant', finalText);

      return {
        session_id: sessionId,
        message_id: messageId,
        user_message: userMessage,
        assistant_response: finalText,
        tool_calls: toolCalls,
        tool_results: toolResults
      };
    } catch (err) {
      console.error('[ConversationService] Error processing input:', err.message);
      throw err;
    }
  }

  async closeSession(sessionId) {
    try {
      const now = new Date();
      try {
        await query(`
          UPDATE conversation_sessions SET state = $1, updated_at = $2 WHERE id = $3
        `, [SESSION_STATE.CLOSED, now, sessionId]);
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) throw dbErr;
      }
      return { success: true, session_id: sessionId, state: SESSION_STATE.CLOSED };
    } catch (err) {
      console.error('[ConversationService] Error closing session:', err);
      throw err;
    }
  }

  async getSessionHistory(sessionId, limit = 50) {
    try {
      const result = await query(`
        SELECT id, role, content, created_at FROM conversation_messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);
      return result.rows.reverse();
    } catch (err) {
      console.error('[ConversationService] Error fetching history:', err);
      return [];
    }
  }
}

module.exports = ConversationService;
