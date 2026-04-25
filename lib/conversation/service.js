const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const OpenAIClient = require('./openai-client');
const ToolExecutor = require('../tools/executor');
const { SESSION_STATE } = require('./types');
const AuditService = require('../audit/service');

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

  getSystemPrompt(userRole = 'doctor') {
    const basePrompt = `Eres un asistente de inteligencia artificial para una plataforma de gestión de citas médicas. Tu objetivo es ayudar a los usuarios a gestionar sus citas, pacientes y disponibilidad de manera conversacional.

INSTRUCCIONES:
1. Habla siempre en español (español de Honduras)
2. Sé profesional pero amable
3. Cuando el usuario solicite una acción, usa las funciones disponibles (tools)
4. Proporciona respuestas claras y concisas
5. Si no puedes ayudar con algo, ofrece transferir a un operador humano
6. Nunca hagas suposiciones sobre datos que no tengas

FUNCIONES DISPONIBLES:
- get_today_appointments: Ver citas de hoy
- get_last_appointment: Ver última cita de un paciente
- get_availability: Ver horarios disponibles
- schedule_appointment: Agendar nueva cita
- reschedule_appointment: Cambiar fecha/hora de cita
- cancel_appointment: Cancelar cita
- register_patient: Registrar nuevo paciente
- transfer_to_human: Transferir a operador humano

Responde de manera natural y útil.`;

    return basePrompt;
  }

  async createSession(userId, clinicId, userRole = 'doctor') {
    try {
      console.log('[ConversationService] Creating session for user:', userId, 'clinic:', clinicId);
      const sessionId = uuidv4();
      const createdAt = new Date();

      // Try to insert into conversation_sessions table if it exists
      try {
        await query(`
          INSERT INTO conversation_sessions (
            id, user_id, clinic_id, user_role, state, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          sessionId,
          userId,
          clinicId,
          userRole,
          SESSION_STATE.ACTIVE,
          createdAt,
          createdAt
        ]);
        console.log('[ConversationService] Session persisted to DB:', sessionId);
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) {
          console.error('[ConversationService] DB Error:', dbErr.message);
          throw dbErr;
        }
        console.log('[ConversationService] conversation_sessions table not created, skipping persistence');
      }

      console.log('[ConversationService] Session created successfully:', sessionId);
      return {
        session_id: sessionId,
        user_id: userId,
        clinic_id: clinicId,
        state: SESSION_STATE.ACTIVE,
        created_at: createdAt
      };
    } catch (err) {
      console.error('[ConversationService] Error creating session:', err.message, err.stack);
      throw err;
    }
  }

  async processUserInput(sessionId, userMessage, userId, clinicId, userRole = 'doctor') {
    try {
      const messageId = uuidv4();

      // Get conversation history
      let messages = [];
      try {
        const result = await query(`
          SELECT role, content FROM conversation_messages
          WHERE session_id = $1
          ORDER BY created_at ASC
        `, [sessionId]);

        messages = result.rows.map(row => ({
          role: row.role,
          content: row.content
        }));
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) {
          throw dbErr;
        }
        // Table doesn't exist, start with empty history
      }

      // Add user message to history
      messages.push({
        role: 'user',
        content: userMessage
      });

      // Try to persist user message
      try {
        await query(`
          INSERT INTO conversation_messages (
            id, session_id, role, content, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
        `, [messageId, sessionId, 'user', userMessage]);
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) {
          throw dbErr;
        }
      }

      // Call Claude API
      const systemPrompt = this.getSystemPrompt(userRole);
      const claudeResponse = await this.getLLMClient().chat(messages, systemPrompt);

      // Check if OpenAI is calling tools (stop_reason can be 'tool_calls' for OpenAI)
      const toolCalls = this.getLLMClient().extractToolCalls(claudeResponse.content);
      console.log('[ConversationService] Tool calls found:', toolCalls.length);

      if (toolCalls.length > 0) {

        // Execute tools
        const toolResults = await this.toolExecutor.executeMultiple(toolCalls, {
          id: userId,
          clinic_id: clinicId,
          role: userRole
        });

        // Build tool results content for next OpenAI call
        // OpenAI expects content as array of text blocks, not tool_result type
        const toolResultContent = toolResults.map(result => ({
          type: 'text',
          text: `Tool: ${result.name}\nResult: ${JSON.stringify(result.result)}`
        }));

        // Add assistant response and tool results to messages
        const assistantMessage = {
          role: 'assistant',
          content: claudeResponse.content.content || '',
          tool_calls: claudeResponse.content.tool_calls
        };
        messages.push(assistantMessage);

        messages.push({
          role: 'user',
          content: toolResultContent
        });

        // Get final response from Claude after tool execution
        const finalResponse = await this.getLLMClient().chat(messages, systemPrompt);
        console.log('[ConversationService] Final response from LLM:', {
          stop_reason: finalResponse.stop_reason,
          content_type: typeof finalResponse.content,
          content_keys: Object.keys(finalResponse.content || {})
        });

        const finalText = this.getLLMClient().extractTextResponse(finalResponse.content);
        console.log('[ConversationService] Extracted text:', finalText?.substring(0, 100));

        // Persist final message
        try {
          await query(`
            INSERT INTO conversation_messages (
              id, session_id, role, content, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
          `, [uuidv4(), sessionId, 'assistant', finalText]);
        } catch (dbErr) {
          if (!dbErr.message.includes('does not exist')) {
            throw dbErr;
          }
        }

        return {
          session_id: sessionId,
          message_id: messageId,
          user_message: userMessage,
          assistant_response: finalText,
          tool_calls: toolCalls,
          tool_results: toolResults
        };
      } else {
        // No tool calls, just text response
        console.log('[ConversationService] No tool calls, extracting text from response');
        const responseText = this.getLLMClient().extractTextResponse(claudeResponse.content);
        console.log('[ConversationService] Extracted response text:', responseText?.substring(0, 100));

        // Persist assistant message
        try {
          await query(`
            INSERT INTO conversation_messages (
              id, session_id, role, content, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
          `, [uuidv4(), sessionId, 'assistant', responseText]);
        } catch (dbErr) {
          if (!dbErr.message.includes('does not exist')) {
            throw dbErr;
          }
        }

        return {
          session_id: sessionId,
          message_id: messageId,
          user_message: userMessage,
          assistant_response: responseText,
          tool_calls: [],
          tool_results: []
        };
      }
    } catch (err) {
      console.error('[ConversationService] Error processing input:', err);
      throw err;
    }
  }

  async closeSession(sessionId) {
    try {
      const now = new Date();

      try {
        await query(`
          UPDATE conversation_sessions
          SET state = $1, updated_at = $2
          WHERE id = $3
        `, [SESSION_STATE.CLOSED, now, sessionId]);
      } catch (dbErr) {
        if (!dbErr.message.includes('does not exist')) {
          throw dbErr;
        }
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
