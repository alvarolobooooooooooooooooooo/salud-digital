const Anthropic = require('anthropic');
const { TOOL_DEFINITIONS } = require('./types');

class ClaudeClient {
  constructor() {
    this.client = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = 'claude-3-5-sonnet-20241022';
  }

  async chat(messages, systemPrompt) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages
      });

      return {
        id: response.id,
        content: response.content,
        stop_reason: response.stop_reason,
        usage: response.usage
      };
    } catch (err) {
      console.error('[ClaudeClient] Error calling Claude API:', err.message);
      throw err;
    }
  }

  extractToolCalls(content) {
    const toolCalls = [];
    for (const block of content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input
        });
      }
    }
    return toolCalls;
  }

  extractTextResponse(content) {
    let text = '';
    for (const block of content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }
    return text;
  }
}

module.exports = ClaudeClient;
