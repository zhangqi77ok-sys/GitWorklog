import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectAccount, createSchedulerState } from '../../src/services/gateway/scheduler';
import { probeAccount, AccountProbeScheduler } from '../../src/services/gateway/probe';
import { AccountRegistry } from '../../src/services/gateway/accounts';
import type { GatewayAccount } from '../../src/services/gateway/types';

const now = 1_000_000_000_000;

function account(overrides: Partial<GatewayAccount> & { id: string; platform: GatewayAccount['platform'] }): GatewayAccount {
  return {
    label: overrides.id,
    authType: 'api_key',
    credential: { authType: 'api_key', apiKey: 'sk-probe-test' },
    baseUrl: 'https://example.com/v1',
    enabled: true,
    status: 'active',
    quota: { refreshedAt: now, limit: 100, used: 0, remaining: 100, windowHours: 24, source: 'unknown' },
    concurrency: { active: 0, max: 4 },
    health: { consecutiveErrors: 0 },
    models: [],
    stickySessionTtlMs: 3_600_000,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function okResponse(status: number): Response {
  return new Response(status === 200 ? '{"data":[]}' : '', { status, headers: { 'content-type': 'application/json' } });
}

describe('Gateway v2 - probability scheduling (1/N rotation)', () => {
  it('selectAccount with strategy=probability picks each account with ~1/N chance', () => {
    const pool = [
      account({ id: 'acct-1', platform: 'codex' }),
      account({ id: 'acct-2', platform: 'codex' })
    ];
    let count1 = 0;
    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const state = createSchedulerState();
      const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now, { strategy: 'probability' });
      if (decision.account.id === 'acct-1') count1++;
    }
    expect(count1).toBeGreaterThan(60);   // 30% lower bound
    expect(count1).toBeLessThan(140);     // 70% upper bound
  });

  it('probability selection only draws from available + model-capable candidates', () => {
    const pool = [
      account({ id: 'acct-a', platform: 'codex', models: ['gpt-5.1-codex'] }),
      account({ id: 'acct-b', platform: 'codex', models: ['other-model'], status: 'quota_exhausted' }),
      account({ id: 'acct-c', platform: 'codex', models: ['gpt-5.1-codex'] })
    ];
    for (let i = 0; i < 50; i++) {
      const state = createSchedulerState();
      const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now, { strategy: 'probability' });
      expect(['acct-a', 'acct-c']).toContain(decision.account.id);
    }
  });

  it('keeps sticky and preferred priority above probability rotation', () => {
    const pool = [
      account({ id: 'acct-1', platform: 'codex' }),
      account({ id: 'acct-2', platform: 'codex' })
    ];
    const state = createSchedulerState();
    state.stickySessions['sess-1'] = { accountId: 'acct-2', expiresAt: now + 1000 };
    const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex', sessionKey: 'sess-1' }, state, now, { strategy: 'probability' });
    expect(decision.account.id).toBe('acct-2');
    expect(decision.reason).toBe('sticky');
  });
});

describe('Gateway v2 - account health probe', () => {
  it('probeAccount maps HTTP 200 to active and writes back success', async () => {
    const registry = new AccountRegistry([account({ id: 'acct-1', platform: 'codex' })]);
    const acct = registry.get('acct-1')!;
    const result = await probeAccount(acct, { fetchImpl: async () => okResponse(200) });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('active');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    const updated = registry.get('acct-1')!;
    expect(updated.health.consecutiveErrors).toBe(0);
    expect(updated.status).toBe('active');
  });

  it('probeAccount maps HTTP 401 to expired and writes back status', async () => {
    const registry = new AccountRegistry([account({ id: 'acct-1', platform: 'codex' })]);
    const acct = registry.get('acct-1')!;
    const result = await probeAccount(acct, { fetchImpl: async () => okResponse(401), registry });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('expired');
    expect(registry.get('acct-1')!.status).toBe('expired');
  });

  it('probeAccount maps HTTP 429 to quota_exhausted', async () => {
    const registry = new AccountRegistry([account({ id: 'acct-1', platform: 'codex' })]);
    const acct = registry.get('acct-1')!;
    const result = await probeAccount(acct, { fetchImpl: async () => okResponse(429), registry });
    expect(result.status).toBe('quota_exhausted');
    expect(registry.get('acct-1')!.status).toBe('quota_exhausted');
  });

  it('probeAccount maps network failure to error', async () => {
    const registry = new AccountRegistry([account({ id: 'acct-1', platform: 'codex' })]);
    const acct = registry.get('acct-1')!;
    const result = await probeAccount(acct, { fetchImpl: async () => { throw new Error('network down'); }, registry });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/network down/i);
  });
});

describe('Gateway v2 - AccountProbeScheduler (5-minute refresh)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('probes all enabled accounts immediately on start and then on interval', async () => {
    const registry = new AccountRegistry([
      account({ id: 'acct-1', platform: 'codex' }),
      account({ id: 'acct-2', platform: 'codex', enabled: false })
    ]);
    const calls: string[] = [];
    const probe = vi.fn(async (a: GatewayAccount) => {
      calls.push(a.id);
      return { ok: true, status: 'active' as const, latencyMs: 1, probedAt: Date.now() };
    });
    const scheduler = new AccountProbeScheduler({ registry, probe: probe as any, intervalMs: 300_000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(['acct-1']);   // only enabled account probed immediately

    calls.length = 0;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(calls).toEqual(['acct-1']);   // interval round also probes enabled only

    calls.length = 0;
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(calls).toEqual([]);           // stopped: no more probes
  });

  it('updates registry status from probe results', async () => {
    const registry = new AccountRegistry([account({ id: 'acct-1', platform: 'codex' })]);
    const probe = vi.fn(async () => ({ ok: false, status: 'quota_exhausted' as const, latencyMs: 1, probedAt: Date.now() }));
    const scheduler = new AccountProbeScheduler({ registry, probe: probe as any, intervalMs: 300_000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();
    expect(registry.get('acct-1')!.status).toBe('quota_exhausted');
  });
});
