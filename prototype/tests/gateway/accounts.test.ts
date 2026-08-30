import { describe, it, expect } from 'vitest';
import { AccountRegistry, assertAccountCredential } from '../../src/services/gateway/accounts';
import type { GatewayAccount, UpstreamCredential } from '../../src/services/gateway/types';

describe('Gateway v2 - AccountRegistry (multi-account per platform)', () => {
  it('adds multiple accounts per platform with stable ids', () => {
    const reg = new AccountRegistry();
    const a1 = reg.add({ platform: 'codex', label: 'codex-1', authType: 'oauth', credential: { authType: 'oauth', accessToken: 'at-1', refreshToken: 'rt-1' } });
    const a2 = reg.add({ platform: 'codex', label: 'codex-2', authType: 'refresh_token', credential: { authType: 'refresh_token', accessToken: 'at-2', refreshToken: 'rt-2' } });
    const c1 = reg.add({ platform: 'claude', label: 'claude-1', authType: 'api_key', credential: { authType: 'api_key', apiKey: 'sk-ant-1' } });
    expect(a1.id).toBe('acct-codex-1');
    expect(a2.id).toBe('acct-codex-2');
    expect(c1.id).toBe('acct-claude-1');
    expect(reg.byPlatform('codex')).toHaveLength(2);
    expect(reg.all()).toHaveLength(3);
  });

  it('removes and updates accounts', () => {
    const reg = new AccountRegistry();
    const a = reg.add({ platform: 'grok', label: 'grok-1', authType: 'api_key', credential: { authType: 'api_key', apiKey: 'xai-1' } });
    reg.update(a.id, { label: 'grok-main' });
    expect(reg.get(a.id)?.label).toBe('grok-main');
    reg.remove(a.id);
    expect(reg.get(a.id)).toBeUndefined();
  });

  it('fails closed for cloud accounts without usable credentials', () => {
    const base: GatewayAccount = {
      id: 'acct-codex-1', platform: 'codex', label: 'x', authType: 'oauth',
      credential: { authType: 'oauth' },
      baseUrl: 'https://chatgpt.com/backend-api/codex', enabled: true, status: 'active',
      quota: { refreshedAt: 0, limit: 100, used: 0, remaining: 100, windowHours: 24, source: 'unknown' },
      concurrency: { active: 0, max: 4 }, health: { consecutiveErrors: 0 }, models: [],
      stickySessionTtlMs: 3_600_000, createdAt: 0, updatedAt: 0
    };
    expect(() => assertAccountCredential({ ...base, authType: 'api_key', credential: { authType: 'api_key' } as UpstreamCredential })).toThrow(/api key/i);
    expect(() => assertAccountCredential({ ...base, authType: 'oauth', credential: { authType: 'oauth' } as UpstreamCredential })).toThrow(/access token/i);
    expect(() => assertAccountCredential({ ...base, authType: 'oauth', credential: { authType: 'oauth', accessToken: 'at' } as UpstreamCredential })).toThrow(/refresh token/i);
    expect(() => assertAccountCredential({ ...base, authType: 'refresh_token', credential: { authType: 'refresh_token' } as UpstreamCredential })).toThrow(/refresh token/i);
    expect(() => assertAccountCredential({ ...base, credential: { authType: 'oauth', accessToken: 'at', refreshToken: 'rt' } })).not.toThrow();
  });

  it('allows local accounts without credentials', () => {
    const reg = new AccountRegistry();
    const local = reg.add({ platform: 'local', label: 'ollama', authType: 'api_key', credential: { authType: 'api_key' }, baseUrl: 'http://127.0.0.1:11434/v1' });
    expect(() => assertAccountCredential(local)).not.toThrow();
  });

  it('tracks concurrency, errors and quota refresh', () => {
    const reg = new AccountRegistry();
    const a = reg.add({ platform: 'codex', label: 'c', authType: 'oauth', credential: { authType: 'oauth', accessToken: 'at', refreshToken: 'rt' } });
    reg.markConcurrency(a.id, +1);
    reg.markConcurrency(a.id, +1);
    expect(reg.get(a.id)?.concurrency.active).toBe(2);
    reg.markConcurrency(a.id, -1);
    expect(reg.get(a.id)?.concurrency.active).toBe(1);

    reg.markError(a.id, '429 rate limited');
    expect(reg.get(a.id)?.health.consecutiveErrors).toBe(1);
    reg.markError(a.id, '401');
    reg.markError(a.id, '500');
    expect(reg.get(a.id)?.status).toBe('error');
    reg.markSuccess(a.id);
    expect(reg.get(a.id)?.status).toBe('active');
    expect(reg.get(a.id)?.health.consecutiveErrors).toBe(0);

    reg.refreshQuota(a.id, { refreshedAt: 99, limit: 50, used: 10, remaining: 40, windowHours: 5, source: 'upstream' });
    expect(reg.get(a.id)?.quota.remaining).toBe(40);
  });
});

