import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGatewayState, saveGatewayState, GATEWAY_STORAGE_KEY, clearGatewayState } from '../../src/services/gateway/store';
import { AccountRegistry } from '../../src/services/gateway/accounts';
import { DownstreamKeyStore } from '../../src/services/gateway/keys';
import { UsageLedger } from '../../src/services/gateway/usage';
import { createSchedulerState } from '../../src/services/gateway/scheduler';

const storageMap: Record<string, string> = {};

beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in storageMap ? storageMap[k] : null),
    setItem: (k: string, v: string) => { storageMap[k] = String(v); },
    removeItem: (k: string) => { delete storageMap[k]; },
    clear: () => { for (const k of Object.keys(storageMap)) delete storageMap[k]; }
  };
});

beforeEach(() => { for (const k of Object.keys(storageMap)) delete storageMap[k]; });

describe('Gateway v2 - persistence store', () => {
  it('round-trips accounts, keys, usage and scheduler state', () => {
    const registry = new AccountRegistry();
    registry.add({ platform: 'codex', label: 'c1', authType: 'oauth', credential: { authType: 'oauth', accessToken: 'at', refreshToken: 'rt' } });
    const keys = new DownstreamKeyStore();
    keys.issue({ name: 'dev', modelAllowlist: ['gpt-5.1-codex'], dailyTokenBudget: 1000 });
    const ledger = new UsageLedger();
    ledger.record({ id: 'u1', accountId: 'acct-codex-1', downstreamKeyId: 'key_x', model: 'gpt-5.1-codex', sessionKey: 's', inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01, startedAt: 1, finishedAt: 2, status: 'ok' });
    const scheduler = createSchedulerState();
    scheduler.stickySessions['session-1'] = { accountId: 'acct-codex-1', expiresAt: 999 };

    saveGatewayState({ accounts: registry.all(), keys: keys.list(), usage: ledger.list(), scheduler });

    const loaded = loadGatewayState();
    expect(loaded).not.toBeNull();
    expect(loaded?.accounts).toHaveLength(1);
    expect(loaded?.accounts[0].id).toBe('acct-codex-1');
    expect(loaded?.keys[0].modelAllowlist).toEqual(['gpt-5.1-codex']);
    expect(loaded?.usage[0].costUsd).toBeCloseTo(0.01);
    expect(loaded?.scheduler.stickySessions['session-1'].accountId).toBe('acct-codex-1');
  });

  it('returns null when nothing is saved', () => {
    expect(loadGatewayState()).toBeNull();
  });

  it('clears persisted state', () => {
    saveGatewayState({ accounts: [], keys: [], usage: [], scheduler: createSchedulerState() });
    expect(loadGatewayState()).not.toBeNull();
    clearGatewayState();
    expect(loadGatewayState()).toBeNull();
  });

  it('uses the documented storage key', () => {
    expect(GATEWAY_STORAGE_KEY).toBe('codemind_gateway_v2');
  });
});
