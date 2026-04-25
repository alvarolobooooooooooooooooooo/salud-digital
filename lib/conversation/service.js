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
    return `Asistente médico. Habla en español (Honduras). Sé breve. Usa tools solo si se pide datos concretos. Responde sin BD para preguntas generales.`;
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

      // Get conversation history (last 1 message max - ultra minimal)
      let messages = [];
      try {
        const result = await query(`
          SELECT role, content FROM conversation_messages
          WHERE session_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [sessionId]);

        // Reverse to maintain chronological order
        messages = result.rows.reverse().map(row => ({
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

        // Add assistant response with tool_calls to messages
        const assistantMessage = {
          role: 'assistant',
          content: claudeResponse.content.content || '',
          tool_calls: claudeResponse.content.tool_calls
        };
        messages.push(assistantMessage);

        // Add tool result messages (one per tool call)
        // OpenAI requires role: 'tool' to respond to tool_calls
        for (const result of toolResults) {
          messages.push({
            role: 'tool',
            tool_call_id: result.id,
            content: JSON.stringify(result.result)
          });
        }

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
