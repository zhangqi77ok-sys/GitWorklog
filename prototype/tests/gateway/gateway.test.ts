import { describe, it, expect, vi } from 'vitest';
import { GatewayFacade } from '../../src/services/gateway/gateway';
import { AccountRegistry } from '../../src/services/gateway/accounts';
import { DownstreamKeyStore } from '../../src/services/gateway/keys';
import { UsageLedger } from '../../src/services/gateway/usage';
import { createSchedulerState } from '../../src/services/gateway/scheduler';
import type { GatewayAccount } from '../../src/services/gateway/types';

function sseResponse(events: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    }
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

function setup(accounts: GatewayAccount[], fetchImpl: typeof fetch) {
  const registry = new AccountRegistry(accounts);
  const keys = new DownstreamKeyStore();
  const issued = keys.issue({ name: 'dev' });
  const ledger = new UsageLedger();
  const facade = new GatewayFacade({
    registry,
    schedulerState: createSchedulerState(),
    keys,
    ledger,
    fetchImpl,
    resolveProxy: (url) => ({ url, headers: {} })
  });
  return { facade, keys, ledger, key: issued.key, registry };
}

const codexAccount: GatewayAccount = {
  id: 'acct-codex-1', platform: 'codex', label: 'codex-main', authType: 'oauth',
  credential: { authType: 'oauth', accessToken: 'at-1', refreshToken: 'rt-1' },
  baseUrl: 'https://chatgpt.com/backend-api/codex', enabled: true, status: 'active',
  quota: { refreshedAt: 0, limit: 100, used: 0, remaining: 100, windowHours: 24, source: 'unknown' },
  concurrency: { active: 0, max: 4 }, health: { consecutiveErrors: 0 }, models: [],
  stickySessionTtlMs: 3_600_000, createdAt: 0, updatedAt: 0
};

const claudeAccount: GatewayAccount = {
  ...codexAccount, id: 'acct-claude-1', platform: 'claude', label: 'claude-main', authType: 'api_key',
  credential: { authType: 'api_key', apiKey: 'sk-ant-1' }, baseUrl: 'https://api.anthropic.com/v1'
};

const baseRequest = {
  model: 'gpt-5.1-codex',
  platform: 'codex' as const,
  sessionKey: 'session-1',
  messages: [{ role: 'user' as const, content: 'hi' }]
};

describe('Gateway v2 - GatewayFacade pipeline', () => {
  it('streams a response end-to-end and records usage + cost', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe('gpt-5.1-codex');
      expect(body.stream).toBe(true);
      return sseResponse([
        'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
        'data: {"type":"response.completed","usage":{"input_tokens":10,"output_tokens":5}}\n\n',
        'data: [DONE]\n\n'
      ]);
    });
    const { facade, ledger, key } = setup([codexAccount], fetchMock as unknown as typeof fetch);

    const result = await facade.request({ ...baseRequest, downstreamKey: key, strategy: 'lru' });

    expect(result.content).toBe('Hello');
    expect(result.accountId).toBe('acct-codex-1');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0].status).toBe('ok');
  });

  it('rejects an unknown downstream key without any network call', async () => {
    const fetchMock = vi.fn();
    const { facade } = setup([codexAccount], fetchMock as unknown as typeof fetch);
    await expect(facade.request({ ...baseRequest, downstreamKey: 'sk-tcode-bogus-1234' })).rejects.toThrow(/invalid.*key|not_found/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails over to a healthy account when the first returns 429', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = String((init.headers as Record<string, string>).Authorization || '');
      calls.push(auth);
      if (auth.includes('at-1')) return new Response('rate limited', { status: 429 });
      return sseResponse([
        'data: {"type":"response.output_text.delta","delta":"ok"}\n\n',
        'data: {"type":"response.completed","usage":{"input_tokens":1,"output_tokens":1}}\n\n',
        'data: [DONE]\n\n'
      ]);
    });
    const second: GatewayAccount = { ...codexAccount, id: 'acct-codex-2', credential: { authType: 'oauth', accessToken: 'at-2', refreshToken: 'rt-2' }, health: { consecutiveErrors: 0 } };
    const { facade, key, registry } = setup([codexAccount, second], fetchMock as unknown as typeof fetch);

    const result = await facade.request({ ...baseRequest, downstreamKey: key, strategy: 'lru' });

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]).toContain('at-1');
    expect(calls[calls.length - 1]).toContain('at-2');
    expect(result.content).toBe('ok');
    expect(registry.get('acct-codex-1')?.health.consecutiveErrors).toBe(1);
  });

  it('reports an interrupted stream (EOF without termination) as a failure', async () => {
    const fetchMock = vi.fn(async () => sseResponse(['data: {"type":"response.output_text.delta","delta":"partial"}\n\n']));
    const { facade, key } = setup([codexAccount], fetchMock as unknown as typeof fetch);
    await expect(facade.request({ ...baseRequest, downstreamKey: key })).rejects.toThrow(/interrupted|termination|EOF|signal/i);
  });

  it('prepare() resolves an account and body without fetching; recordCompletion() records usage', async () => {
    const fetchMock = vi.fn();
    const { facade, ledger, key, registry } = setup([codexAccount], fetchMock as unknown as typeof fetch);
    const prepared = facade.prepare({
      model: 'gpt-5.1-codex', platform: 'codex', sessionKey: 's9',
      messages: [{ role: 'user', content: 'hi' }]
    });
    expect(prepared.accountId).toBe('acct-codex-1');
    expect(prepared.url).toContain('/responses');
    expect(prepared.headers.Authorization).toContain('at-1');
    expect(prepared.body.stream).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    facade.recordCompletion({
      accountId: 'acct-codex-1', downstreamKeyId: key, model: 'gpt-5.1-codex', sessionKey: 's9',
      usage: { inputTokens: 5, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 }, status: 'ok'
    });
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0].costUsd).toBeGreaterThan(0);
    expect(registry.get('acct-codex-1')?.health.consecutiveErrors).toBe(0);
  });

  it('routes Claude requests through the anthropic payload and api-key header', async () => {
    let captured: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | undefined;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      captured = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return sseResponse([
        'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
        'data: {"type":"message_stop"}\n\n'
      ]);
    });
    const { facade, key } = setup([claudeAccount], fetchMock as unknown as typeof fetch);
    const result = await facade.request({
      downstreamKey: key, model: 'claude-sonnet-4-6', platform: 'claude', sessionKey: 's2',
      messages: [{ role: 'user', content: 'hello' }]
    });
    expect(captured?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(captured?.headers['x-api-key']).toBe('sk-ant-1');
    expect(captured?.headers['anthropic-version']).toBe('2023-06-01');
    expect((captured?.body as Record<string, unknown>).max_tokens).toBeDefined();
    expect(result.content).toBe('hi');
  });
});


