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
      // Convert tool definitions to OpenAI function format
      const tools = TOOL_DEFINITIONS.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));

      // Add system prompt as first message
      const messagesWithSystem = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        tools,
        messages: messagesWithSystem
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
