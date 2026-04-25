const { OpenAI } = require('openai');
const { TOOL_DEFINITIONS } = require('./types');

class OpenAIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4o';
  }

  async chat(messages, systemPrompt) {
    try {
      // Smart tool filtering - only include relevant tools based on message content
      let relevantTools = [];
      const lastMessage = messages[messages.length - 1]?.content || '';
      const messageLower = lastMessage.toLowerCase();

      if (messageLower.includes('cita') || messageLower.includes('appointment')) {
        // Get appointment-related tools only
        relevantTools = TOOL_DEFINITIONS.filter(t =>
          t.name.includes('appointment') || t.name.includes('availability') || t.name.includes('today')
        );
      } else if (messageLower.includes('paciente') || messageLower.includes('patient')) {
        // Patient-related tools
        relevantTools = TOOL_DEFINITIONS.filter(t => t.name.includes('patient') || t.name.includes('register'));
      } else if (messageLower.includes('disponibilidad') || messageLower.includes('available')) {
        // Availability tools
        relevantTools = TOOL_DEFINITIONS.filter(t => t.name.includes('availability'));
      }

      // Always include transfer option as fallback
      if (!relevantTools.find(t => t.name === 'transfer_to_human')) {
        relevantTools.push(TOOL_DEFINITIONS.find(t => t.name === 'transfer_to_human'));
      }

      const tools = relevantTools.length > 0 ? relevantTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      })) : [];

      // Add system prompt as first message
      const messagesWithSystem = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 250,
        ...(tools.length > 0 && { tools }),
        messages: messagesWithSystem
      });

      // Log token usage
      console.log('[OpenAIClient] Token usage:', {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens
      });

      const message = response.choices[0].message;
      console.log('[OpenAIClient] Got response, content type:', typeof message.content);
      console.log('[OpenAIClient] Response message:', {
        role: message.role,
        content: message.content?.substring(0, 100),
        has_tool_calls: !!message.tool_calls?.length
      });

      return {
        id: response.id,
        content: message,
        stop_reason: response.choices[0].finish_reason,
        usage: response.usage
      };
    } catch (err) {
      console.error('[OpenAIClient] Error calling OpenAI API:', err.message, err.stack);
      throw err;
    }
  }

  extractToolCalls(content) {
    const toolCalls = [];

    if (content.tool_calls) {
      for (const toolCall of content.tool_calls) {
        if (toolCall.type === 'function') {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
      }
    }

    return toolCalls;
  }

  extractTextResponse(content) {
    if (!content) return '';
    // content is the message object from OpenAI
    return content.content || '';
  }
}

module.exports = OpenAIClient;
