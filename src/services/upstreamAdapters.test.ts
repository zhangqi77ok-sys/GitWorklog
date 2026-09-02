import { describe, it, expect } from 'vitest';
import {
  inferUpstreamProtocol,
  buildUpstreamRequest,
  parseSseLine,
} from './upstreamAdapters';

describe('Upstream Protocol Adapters Suite', () => {
  it('correctly infers protocol from baseUrl and model', () => {
    expect(inferUpstreamProtocol('https://api.anthropic.com/v1', 'claude-3-7-sonnet')).toBe('anthropic-messages');
    expect(inferUpstreamProtocol('https://api.openai.com/v1/responses', 'gpt-4.5-preview')).toBe('openai-responses');
    expect(inferUpstreamProtocol('https://api.openai.com/v1', 'gpt-4o')).toBe('openai-chat');
    expect(inferUpstreamProtocol('https://agentrouter.org/v1', 'deepseek-v4-flash')).toBe('openai-chat');
  });

  it('builds standard OpenAI Chat request with Bearer token', () => {
    const req = buildUpstreamRequest({
      protocol: 'openai-chat',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-live-12345',
      model: 'gpt-4o',
      systemPrompt: 'You are helpful assistant.',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(req.headers['Authorization']).toBe('Bearer sk-live-12345');
    const body = JSON.parse(req.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('builds Anthropic Messages request with x-api-key, system at root and max_tokens', () => {
    const req = buildUpstreamRequest({
      protocol: 'anthropic-messages',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant-api03-live-key',
      model: 'claude-3-7-sonnet-20250219',
      systemPrompt: 'You are an architecture reviewer.',
      messages: [{ role: 'user', content: 'Review this project' }],
      maxTokens: 4096,
    });

    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('sk-ant-api03-live-key');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(req.body);
    expect(body.model).toBe('claude-3-7-sonnet-20250219');
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('You are an architecture reviewer.');
    // Must NOT contain system role inside messages array
    expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(body.messages[0].content).toBe('Review this project');
  });

  it('builds OpenAI Responses API request with input and instructions', () => {
    const req = buildUpstreamRequest({
      protocol: 'openai-responses',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-5-responses',
      systemPrompt: 'System instructions',
      messages: [{ role: 'user', content: 'Generate code' }],
    });

    expect(req.url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(req.body);
    expect(body.instructions).toBe('System instructions');
    expect(body.input).toContain('user: Generate code');
  });

  it('parses OpenAI Chat SSE chunk with reasoning and content', () => {
    const raw = 'data: {"choices":[{"delta":{"reasoning_content":"Let me think...","content":"Hello world!"}}]}';
    const chunk = parseSseLine('openai-chat', raw);
    expect(chunk.thoughtDelta).toBe('Let me think...');
    expect(chunk.textDelta).toBe('Hello world!');
    expect(chunk.isDone).toBe(false);
  });

  it('parses Anthropic Messages SSE chunk with text_delta and thinking_delta', () => {
    const textRaw = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude text chunk."}}';
    const textChunk = parseSseLine('anthropic-messages', textRaw);
    expect(textChunk.textDelta).toBe('Claude text chunk.');

    const thinkRaw = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Claude thinking process..."}}';
    const thinkChunk = parseSseLine('anthropic-messages', thinkRaw);
    expect(thinkChunk.thoughtDelta).toBe('Claude thinking process...');

    const doneRaw = 'data: {"type":"message_stop"}';
    const doneChunk = parseSseLine('anthropic-messages', doneRaw);
    expect(doneChunk.isDone).toBe(true);
  });
});
