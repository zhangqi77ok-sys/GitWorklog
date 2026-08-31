// Tcode Telemetry ???? (extracted from contracts.ts)
import type { ContextGaugeLevel, KVCacheMetrics, TokenRoiStats, TokenStats } from './contractsTypes';

export function calculateKVCacheMetrics(
  messagesCount: number,
  systemPromptLength: number = 850,
  rulesCount: number = 5,
  skillsCount: number = 1
): KVCacheMetrics {
  // Static Immutable Prefix: System Prompt (850) + Rules (5 * 120) + Skill (280) + Workspace File Tree (350)
  const prefixTokens = systemPromptLength + (rulesCount * 120) + (skillsCount * 280) + 350;
  
  // Dynamic history accumulated per turn
  const historyTokens = Math.max(0, (messagesCount - 1) * 620);
  
  // Turn cache hit: if turn > 1, prefix + history are hit
  const turnCacheHitTokens = messagesCount > 1 ? prefixTokens + historyTokens : 0;
  const totalCacheHitTokens = Math.max(0, messagesCount > 1 ? (messagesCount - 1) * prefixTokens + historyTokens : 0);
  
  // Cost saved: ¥0.000001 per token cached (DeepSeek / Claude 90% discount)
  const savedCostYuan = Number((totalCacheHitTokens * 0.0000018).toFixed(4));
  const savingsPercentage = totalCacheHitTokens > 0 ? 89.5 : 0;
  const latencySpeedup = totalCacheHitTokens > 0 ? '2.8x' : '1.0x';

  return {
    prefixTokens,
    historyTokens,
    turnCacheHitTokens,
    totalCacheHitTokens,
    savedCostYuan,
    savingsPercentage,
    latencySpeedup
  };
}

export function calculateTokenRoi(stats: TokenStats): TokenRoiStats {
  const totalTokens = (stats.promptTokens || 0) + (stats.completionTokens || 0) + (stats.cacheHitTokens || 0);
  const cacheHitRate = totalTokens > 0 ? (stats.cacheHitTokens / totalTokens) * 100 : 0;
  const boundedHitRate = Math.min(100, Math.max(0, Math.round(cacheHitRate * 10) / 10));
  const savedCost = (stats.cacheHitTokens / 1000000) * 2.5; // ~$2.5 per 1M tokens saved
  const linesGenerated = Math.round((stats.completionTokens || 0) / 12);

  return {
    promptTokens: stats.promptTokens,
    completionTokens: stats.completionTokens,
    cacheHitTokens: stats.cacheHitTokens,
    cacheHitRatePercent: boundedHitRate,
    estimatedCostUsd: stats.estimatedCostUsd,
    savedCostUsd: Math.round(savedCost * 1000) / 1000,
    linesGeneratedApprox: linesGenerated
  };
}

// 1. Calculate percentage of input tokens saved by KV Cache (Strictly bounded [0, 100])
export function calculateTokenSavingsPercent(stats: TokenStats): number {
  const totalPrompt = (stats.promptTokens || 0) + (stats.cacheHitTokens || 0);
  if (totalPrompt <= 0) return 0;
  const rate = (stats.cacheHitTokens / totalPrompt) * 100;
  return Math.min(100, Math.max(0, Math.round(rate * 10) / 10));
}

// 2. Standard KV Cache Hit Rate (Integer percentage bounded [0, 100])
export function calculateKVCacheHitRate(stats: TokenStats): number {
  const totalPrompt = (stats.promptTokens || 0) + (stats.cacheHitTokens || 0);
  if (totalPrompt <= 0) return 0;
  const rate = (stats.cacheHitTokens / totalPrompt) * 100;
  return Math.min(100, Math.max(0, Math.round(rate)));
}












export function getContextGaugeLevel(current: number, max: number): ContextGaugeLevel {
  if (max <= 0) return 'safe';
  const ratio = current / max;
  if (ratio >= 0.8) return 'danger';
  if (ratio >= 0.6) return 'warning';
  return 'safe';
}
