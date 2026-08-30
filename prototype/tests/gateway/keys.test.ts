import { describe, it, expect } from 'vitest';
import { DownstreamKeyStore, generateDownstreamKey, maskKey } from '../../src/services/gateway/keys';
import type { TokenUsage } from '../../src/services/gateway/types';

describe('Gateway v2 - Downstream key distribution', () => {
  it('generates keys with a stable prefix and maskable secret', () => {
    const key = generateDownstreamKey('team-a');
    expect(key.startsWith('sk-tcode-team-a-')).toBe(true);
    expect(key.length).toBeGreaterThan('sk-tcode-team-a-'.length + 8);
    const masked = maskKey(key);
    expect(masked).toContain('sk-tcode-team-a-');
    expect(masked).toContain('****');
    expect(masked).not.toContain(key.slice(-8));
  });

  it('issues, lists and revokes keys', () => {
    const store = new DownstreamKeyStore();
    const k = store.issue({ name: 'dev-1', groups: ['default'] });
    expect(store.list()).toHaveLength(1);
    expect(store.findByKey(k.key)?.id).toBe(k.id);
    store.revoke(k.id);
    expect(store.list()).toHaveLength(0);
  });

  it('validates key existence and enabled state', () => {
    const store = new DownstreamKeyStore();
    const k = store.issue({ name: 'dev-2' });
    const ok = store.validate(k.key);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.key.id).toBe(k.id);

    store.revoke(k.id);
    const missing = store.validate(k.key);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('not_found');

    const k2 = store.issue({ name: 'dev-3' });
    const updated = store.list().map(key => key.id === k2.id ? { ...key, enabled: false } : key);
    // simulate disable
    const s2 = new DownstreamKeyStore(updated);
    const disabled = s2.validate(k2.key);
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.reason).toBe('disabled');
  });

  it('enforces model allowlist', () => {
    const store = new DownstreamKeyStore();
    store.issue({ name: 'codex-only', modelAllowlist: ['gpt-5.1-codex'] });
    const key = store.list()[0].key;
    const allowed = store.validate(key, 'gpt-5.1-codex');
    expect(allowed.ok).toBe(true);
    const denied = store.validate(key, 'claude-sonnet-4-6');
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe('model_not_allowed');
  });

  it('enforces daily token budget', () => {
    const store = new DownstreamKeyStore();
    store.issue({ name: 'budgeted', dailyTokenBudget: 1000 });
    const key = store.list()[0];
    store.recordUsage(key.id, { inputTokens: 600, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    // 600 used + 500 pending = 1100 > 1000 -> rejected
    const over = store.validate(key.key, undefined, { inputTokens: 500, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe('budget_exceeded');
    // 600 used + 300 pending = 900 <= 1000 -> allowed
    const ok = store.validate(key.key, undefined, { inputTokens: 300, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(ok.ok).toBe(true);
  });

  it('tracks used tokens per key', () => {
    const store = new DownstreamKeyStore();
    const k = store.issue({ name: 'metered' });
    store.recordUsage(k.id, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5 });
    expect(store.getUsedTokens(k.id)).toMatchObject({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5 });
  });
});

describe('DownstreamKeyStore - update', () => {
  it('updates enabled/name/allowlist fields', () => {
    const store = new DownstreamKeyStore();
    const key = store.issue({ name: 'k1', modelAllowlist: ['m1'] });
    store.update(key.id, { enabled: false, name: 'k1-renamed', modelAllowlist: ['m2'] });
    const updated = store.list().find(k => k.id === key.id)!;
    expect(updated.enabled).toBe(false);
    expect(updated.name).toBe('k1-renamed');
    expect(updated.modelAllowlist).toEqual(['m2']);
  });

  it('validate rejects a disabled key after update', () => {
    const store = new DownstreamKeyStore();
    const key = store.issue({ name: 'k2' });
    store.update(key.id, { enabled: false });
    expect(store.validate(key.key)).toEqual({ ok: false, reason: 'disabled' });
  });
});
