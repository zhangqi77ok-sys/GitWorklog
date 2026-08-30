import { describe, it, expect } from 'vitest';
import { computeCost, UsageLedger, addUsage, DEFAULT_PRICING } from '../../src/services/gateway/usage';
import type { TokenUsage, UsageRecord } from '../../src/services/gateway/types';

describe('Gateway v2 - Token-level billing', () => {
  it('computes cost precisely from input/output/cache tokens', () => {
    const usage: TokenUsage = { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 2_000_000, cacheWriteTokens: 100_000 };
    const pricing = { inputPerM: 2.5, outputPerM: 15, cacheReadPerM: 0.25, cacheWritePerM: 2.5 };
    const cost = computeCost(usage, pricing);
    // 2.5 + 7.5 + 0.5 + 0.25 = 10.75
    expect(cost).toBeCloseTo(10.75, 6);
  });

  it('falls back to 0.1x input rate for cache read and 1x for cache write when not specified', () => {
    const usage: TokenUsage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 };
    const cost = computeCost(usage, { inputPerM: 2, outputPerM: 10 });
    expect(cost).toBeCloseTo(2 + 0.2, 6);
  });

  it('returns zero for empty usage', () => {
    expect(computeCost({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, DEFAULT_PRICING['claude-sonnet-4-6'])).toBe(0);
  });

  it('aggregates usage records per account and per downstream key', () => {
    const base: Omit<UsageRecord, 'inputTokens'|'outputTokens'|'cacheReadTokens'|'cacheWriteTokens'|'costUsd'> = {
      id: 'u1', accountId: 'acct-claude-1', downstreamKeyId: 'key_1', model: 'claude-sonnet-4-6',
      sessionKey: 's1', startedAt: 1, finishedAt: 2, status: 'ok'
    };
    const ledger = new UsageLedger([
      { ...base, id: 'u1', inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 },
      { ...base, id: 'u2', accountId: 'acct-claude-1', downstreamKeyId: 'key_2', inputTokens: 2000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.005 },
      { ...base, id: 'u3', accountId: 'acct-grok-1', downstreamKeyId: 'key_1', inputTokens: 500, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.002 }
    ]);
    expect(ledger.byAccount('acct-claude-1')).toMatchObject({ inputTokens: 3000, outputTokens: 500 });
    expect(ledger.byKey('key_1')).toMatchObject({ inputTokens: 1500, outputTokens: 600 });
    expect(ledger.total()).toMatchObject({ inputTokens: 3500, outputTokens: 600 });
  });

  it('addUsage sums token counters', () => {
    const sum = addUsage({ inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
      { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 });
    expect(sum).toEqual({ inputTokens: 11, outputTokens: 22, cacheReadTokens: 33, cacheWriteTokens: 44 });
  });

  it('records an entry and lists it in order', () => {
    const ledger = new UsageLedger();
    ledger.record({
      id: 'u9', accountId: 'acct-codex-1', downstreamKeyId: 'key_9', model: 'gpt-5.1-codex',
      sessionKey: 's9', inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0,
      costUsd: 0.001, startedAt: 1, finishedAt: 2, status: 'ok'
    });
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0].id).toBe('u9');
  });
});
