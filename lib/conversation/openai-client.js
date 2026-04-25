const { OpenAI } = require('openai');
const { TOOL_DEFINITIONS } = require('./types');

class OpenAIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4o-mini';
  }

  async chat(messages, systemPrompt, options = {}) {
    const {
      toolNames = null,
      maxTokens = 250,
      temperature = 0.2,
      intent = 'unknown'
    } = options;

    try {
      let tools = [];
      if (toolNames && toolNames.length > 0) {
        tools = TOOL_DEFINITIONS
          .filter(t => toolNames.includes(t.name))
          .map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema
            }
          }));
      }

      const messagesWithSystem = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const requestParams = {
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: messagesWithSystem
      };

      if (tools.length > 0) {
        requestParams.tools = tools;
      }

      const response = await this.client.chat.completions.create(requestParams);
      const message = response.choices[0].message;
      const usage = response.usage;

      const tokenWarning = usage.total_tokens > 600 && intent === 'general' ? ' ⚠️ HIGH' : '';
      console.log(`[Tokens] intent=${intent} model=${this.model} tools=${tools.length} in=${usage.prompt_tokens} out=${usage.completion_tokens} total=${usage.total_tokens}${tokenWarning}`);

      return {
        id: response.id,
        content: message,
        stop_reason: response.choices[0].finish_reason,
        usage
      };
    } catch (err) {
      console.error('[OpenAIClient] Error:', err.message);
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
    return content.content || '';
  }
}

module.exports = OpenAIClient;
