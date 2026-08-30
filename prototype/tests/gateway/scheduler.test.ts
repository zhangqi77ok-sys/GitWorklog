import { describe, it, expect } from 'vitest';
import { selectAccount, createSchedulerState, bindSticky, markAccountUsed, isAccountAvailable } from '../../src/services/gateway/scheduler';
import type { GatewayAccount, RouteRequest, SchedulerState } from '../../src/services/gateway/types';

const now = 1_000_000_000_000;

function account(overrides: Partial<GatewayAccount> & { id: string; platform: GatewayAccount['platform'] }): GatewayAccount {
  return {
    label: overrides.id,
    authType: 'api_key',
    credential: { authType: 'api_key', apiKey: 'sk-test' },
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

describe('Gateway v2 - RouteScheduler', () => {
  it('isAccountAvailable excludes disabled/error/quota-exhausted/concurrency-full accounts', () => {
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex' }), now)).toBe(true);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', enabled: false }), now)).toBe(false);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', status: 'error' }), now)).toBe(false);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', status: 'quota_exhausted' }), now)).toBe(false);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', concurrency: { active: 4, max: 4 } }), now)).toBe(false);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', quota: { refreshedAt: now, limit: 10, used: 10, remaining: 0, windowHours: 24, source: 'upstream' } }), now)).toBe(false);
    expect(isAccountAvailable(account({ id: 'a', platform: 'codex', health: { consecutiveErrors: 3 } }), now)).toBe(false);
  });

  it('picks the least recently used account on a new session (round-robin)', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex' }),
      account({ id: 'acct-codex-3', platform: 'codex' })
    ];
    const state = createSchedulerState();
    markAccountUsed(state, 'acct-codex-2', now - 100);
    markAccountUsed(state, 'acct-codex-1', now - 50);
    const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now);
    expect(decision.account.id).toBe('acct-codex-3');
    expect(decision.reason).toBe('round_robin');
  });

  it('reuses the sticky account for the same session within TTL', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex' })
    ];
    const state = createSchedulerState();
    bindSticky(state, 'session-1', 'acct-codex-2', 3_600_000, now);
    markAccountUsed(state, 'acct-codex-2', now);
    const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex', sessionKey: 'session-1' }, state, now);
    expect(decision.account.id).toBe('acct-codex-2');
    expect(decision.reason).toBe('sticky');
  });

  it('falls back when the sticky account becomes unavailable', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex', status: 'quota_exhausted' })
    ];
    const state = createSchedulerState();
    bindSticky(state, 'session-1', 'acct-codex-2', 3_600_000, now);
    const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex', sessionKey: 'session-1' }, state, now);
    expect(decision.account.id).toBe('acct-codex-1');
    expect(decision.reason).toBe('round_robin');
  });

  it('honors the user-preferred account when available', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex' })
    ];
    const state = createSchedulerState();
    const decision = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex', preferredAccountId: 'acct-codex-2' }, state, now);
    expect(decision.account.id).toBe('acct-codex-2');
    expect(decision.reason).toBe('preferred');
  });

  it('excludes failed accounts on failover retry', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex' })
    ];
    const state = createSchedulerState();
    const first = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now);
    const second = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex', excludeAccountIds: [first.account.id] }, state, now);
    expect(second.account.id).not.toBe(first.account.id);
    expect(second.reason).toBe('failover');
  });

  it('throws a structured error when no account is available', () => {
    const state = createSchedulerState();
    expect(() => selectAccount([], { model: 'gpt-5.1-codex', platform: 'codex' }, state, now)).toThrow(/no available account/i);
  });

  it('tracks LRU recency on every selection', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex' }),
      account({ id: 'acct-codex-2', platform: 'codex' })
    ];
    const state = createSchedulerState();
    markAccountUsed(state, 'acct-codex-1', now - 1000);
    const d1 = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now);
    expect(d1.account.id).toBe('acct-codex-2');
    const d2 = selectAccount(pool, { model: 'gpt-5.1-codex', platform: 'codex' }, state, now + 1);
    expect(d2.account.id).toBe('acct-codex-1');
  });

  it('does not route to accounts whose model whitelist excludes the requested model', () => {
    const pool = [
      account({ id: 'acct-codex-1', platform: 'codex', models: ['gpt-5.1-codex'] }),
      account({ id: 'acct-codex-2', platform: 'codex', models: ['gpt-5-codex'] })
    ];
    const state = createSchedulerState();
    const decision = selectAccount(pool, { model: 'gpt-5-codex', platform: 'codex' }, state, now);
    expect(decision.account.id).toBe('acct-codex-2');
  });
});

// keep SchedulerState referenced for type surface
const _s: SchedulerState = createSchedulerState();
void _s;
