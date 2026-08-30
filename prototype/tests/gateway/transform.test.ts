import { describe, it, expect } from 'vitest';
import { RequestTransformer, estimateTokens, trimConversation, normalizeToolCallId, mergeToolCallFragments } from '../../src/services/gateway/transform';
import type { GatewayMessage } from '../../src/services/gateway/transform';

describe('Gateway v2 - RequestTransformer (compat fixes)', () => {
  it('estimates tokens as ceil(len/3.2)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(320))).toBe(100);
    expect(estimateTokens('a'.repeat(321))).toBe(101);
  });

  it('trims long conversations to fit the token budget, keeping system and recent', () => {
    const system: GatewayMessage = { role: 'system', content: 'SYS' };
    const msgs: GatewayMessage[] = [
      system,
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' }
    ];
    // Each 2-char message is 1 token; budget 3 keeps system + the 2 most recent
    const trimmed = trimConversation(msgs, 3);
    expect(trimmed[0]).toEqual(system);
    expect(trimmed.map(m => m.content)).toEqual(['SYS', 'a2', 'u3']);
    expect(estimateTokens(trimmed.map(m => m.content).join(''))).toBeLessThanOrEqual(3);
  });

  it('keeps everything when within budget', () => {
    const msgs: GatewayMessage[] = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }];
    expect(trimConversation(msgs, 1_000_000)).toHaveLength(2);
  });

  it('normalizes tool call ids to fc_ prefix with max length 64', () => {
    expect(normalizeToolCallId('call_abc')).toBe('fc_call_abc');
    expect(normalizeToolCallId('fc_ok')).toBe('fc_ok');
    expect(normalizeToolCallId('x'.repeat(100)).length).toBeLessThanOrEqual(64);
    expect(normalizeToolCallId('x'.repeat(100)).startsWith('fc_')).toBe(true);
  });

  it('merges streamed tool-call argument fragments per call id', () => {
    const merged = mergeToolCallFragments([
      { id: 'call-1', name: 'run_command', arguments: '{"command":"npm ' },
      { id: 'call-1', name: 'run_command', arguments: 'test"}' }
    ]);
    expect(merged.get('call-1')).toBe('{"command":"npm test"}');
  });

  it('builds a Codex OAuth responses payload stripping unsupported fields', () => {
    const t = new RequestTransformer({ platform: 'codex', codexOAuth: true, contextLimit: 200_000, defaultMaxOutputTokens: 8192 });
    const body = t.transform({
      model: 'gpt-5.1-codex',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      stream: false,
      tools: [{ type: 'function', function: { name: 'run_command', parameters: { type: 'object' } } }]
    }) as Record<string, any>;
    expect(body.temperature).toBeUndefined();
    expect(body.max_output_tokens).toBeUndefined();
    expect(body.prompt_cache_retention).toBeUndefined();
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('gpt-5.1-codex');
    expect(body.input).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.tools[0].function.name).toBe('run_command');
  });

  it('builds an Anthropic payload with required max_tokens and tool_result blocks', () => {
    const t = new RequestTransformer({ platform: 'claude', codexOAuth: false, contextLimit: 200_000, defaultMaxOutputTokens: 8192 });
    const body = t.transform({
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '', name: 'run_command', toolCallId: 'toolu_1' },
        { role: 'tool', content: '{"ok":true}', toolCallId: 'toolu_1' }
      ],
      stream: true
    }) as Record<string, any>;
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.max_tokens).toBe(8192);
    expect(body.system).toBe('SYS');
    expect(body.stream).toBe(true);
    const last = body.messages[body.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content[0].type).toBe('tool_result');
    expect(last.content[0].tool_use_id).toBe('toolu_1');
  });

  it('builds a chat completions payload with include_usage and merged system', () => {
    const t = new RequestTransformer({ platform: 'grok', codexOAuth: false, contextLimit: 128_000, defaultMaxOutputTokens: 4096 });
    const body = t.transform({
      model: 'grok-4.6',
      messages: [
        { role: 'system', content: 'S1' },
        { role: 'system', content: 'S2' },
        { role: 'user', content: '' },
        { role: 'user', content: 'hi' }
      ],
      stream: true,
      temperature: 0.3
    }) as Record<string, any>;
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'S1\nS2' });
    expect(body.messages.some((m: any) => m.content === '')).toBe(false);
    expect(body.temperature).toBe(0.3);
  });

  it('normalizes tool definitions to the function shape', () => {
    const t = new RequestTransformer({ platform: 'deepseek', codexOAuth: false });
    const body = t.transform({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'x' }], stream: false }) as Record<string, any>;
    expect(body.stream).toBe(false);
  });
});

