import type { ModelPricing, TokenUsage, UsageRecord } from './types';

// Fallback pricing table (USD per 1M tokens). Source: official list prices,
// used only when a dynamic pricing sync is unavailable.
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  // Codex / OpenAI
  'gpt-5.1-codex': { inputPerM: 2.5, outputPerM: 15, cacheReadPerM: 0.25, cacheWritePerM: 2.5 },
  'gpt-5-codex': { inputPerM: 1.25, outputPerM: 10, cacheReadPerM: 0.125, cacheWritePerM: 1.25 },
  'gpt-5': { inputPerM: 1.25, outputPerM: 10, cacheReadPerM: 0.125, cacheWritePerM: 1.25 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10, cacheReadPerM: 0.25, cacheWritePerM: 2.5 },
  // Claude
  'claude-sonnet-4-6': { inputPerM: 3, outputPerM: 15, cacheReadPerM: 0.3, cacheWritePerM: 3.75 },
  'claude-sonnet-4': { inputPerM: 3, outputPerM: 15, cacheReadPerM: 0.3, cacheWritePerM: 3.75 },
  'claude-opus-4-6': { inputPerM: 15, outputPerM: 75, cacheReadPerM: 1.5, cacheWritePerM: 18.75 },
  'claude-haiku-4-5': { inputPerM: 1, outputPerM: 5, cacheReadPerM: 0.1, cacheWritePerM: 1.25 },
  // Grok / xAI
  'grok-4.6': { inputPerM: 3, outputPerM: 15, cacheReadPerM: 0.3, cacheWritePerM: 3 },
  'grok-4.5': { inputPerM: 3, outputPerM: 15, cacheReadPerM: 0.3, cacheWritePerM: 3 },
  // Gemini
  'gemini-3-pro': { inputPerM: 1.25, outputPerM: 10, cacheReadPerM: 0.0625, cacheWritePerM: 1.25 },
  'gemini-3-flash': { inputPerM: 0.3, outputPerM: 2.5, cacheReadPerM: 0.03, cacheWritePerM: 0.3 },
  // DeepSeek / OpenAI-compatible
  'deepseek-v4-flash': { inputPerM: 0.27, outputPerM: 1.1, cacheReadPerM: 0.07 },
  'deepseek-chat': { inputPerM: 0.27, outputPerM: 1.1, cacheReadPerM: 0.07 },
  'deepseek-reasoner': { inputPerM: 0.55, outputPerM: 2.19 },
  'mimo-v2.5-free': { inputPerM: 0, outputPerM: 0 }
};

export function computeCost(usage: TokenUsage, pricing: ModelPricing): number {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerM;
  const cacheReadRate = pricing.cacheReadPerM ?? pricing.inputPerM * 0.1;
  const cacheWriteRate = pricing.cacheWritePerM ?? pricing.inputPerM;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * cacheReadRate;
  const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * cacheWriteRate;
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens
  };
}

export const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

function sum(records: UsageRecord[]): TokenUsage {
  return records.reduce<TokenUsage>((acc, r) => addUsage(acc, {
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    cacheReadTokens: r.cacheReadTokens,
    cacheWriteTokens: r.cacheWriteTokens
  }), { ...EMPTY_USAGE });
}

export class UsageLedger {
  private records: UsageRecord[];

  public constructor(records: UsageRecord[] = []) {
    this.records = [...records];
  }

  public record(rec: UsageRecord): void {
    this.records.push(rec);
  }

  public list(): UsageRecord[] {
    return [...this.records];
  }

  public byAccount(accountId: string): TokenUsage {
    return sum(this.records.filter(r => r.accountId === accountId));
  }

  public byKey(keyId: string): TokenUsage {
    return sum(this.records.filter(r => r.downstreamKeyId === keyId));
  }

  public total(): TokenUsage {
    return sum(this.records);
  }
}
