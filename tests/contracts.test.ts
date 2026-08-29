import { describe, it, expect } from 'vitest';
import {
  getContextGaugeLevel,
  calculateTokenSavingsPercent,
  getWindowBreakpoint,
  TokenStats
} from '../src/types/contracts';

describe('SDD Contract - Token Telemetry & Gauge Algorithm', () => {
  it('should evaluate context gauge levels correctly (green, yellow, red)', () => {
    // Under 60% is safe (green)
    expect(getContextGaugeLevel(40000, 128000)).toBe('safe');
    expect(getContextGaugeLevel(70000, 128000)).toBe('safe');

    // Between 60% and 80% is warning (yellow)
    expect(getContextGaugeLevel(80000, 128000)).toBe('warning');
    expect(getContextGaugeLevel(100000, 128000)).toBe('warning');

    // 80% and above is danger (red)
    expect(getContextGaugeLevel(103000, 128000)).toBe('danger');
    expect(getContextGaugeLevel(125000, 128000)).toBe('danger');
  });

  it('should calculate KV cache saving percentage accurately', () => {
    const stats: TokenStats = {
      promptTokens: 1200,
      completionTokens: 300,
      cacheHitTokens: 10800,
      cacheWriteTokens: 0,
      estimatedCostUsd: 0.024,
      contextCurrentTokens: 12000,
      contextMaxTokens: 128000
    };
    // 10800 / (1200 + 10800) = 10800 / 12000 = 90%
    expect(calculateTokenSavingsPercent(stats)).toBe(90);
  });
});

describe('SDD Contract - Responsive Breakpoint System', () => {
  it('should detect all 4 desktop scale breakpoints correctly', () => {
    expect(getWindowBreakpoint(2560)).toBe('ultrawide');
    expect(getWindowBreakpoint(1920)).toBe('standard');
    expect(getWindowBreakpoint(1200)).toBe('laptop');
    expect(getWindowBreakpoint(800)).toBe('split_half');
  });
});
