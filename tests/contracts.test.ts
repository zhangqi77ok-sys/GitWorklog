import { describe, it, expect } from 'vitest';
import {
  getContextGaugeLevel,
  calculateTokenSavingsPercent,
  getWindowBreakpoint,
  addTagToSession,
  removeTagFromSession,
  renameSession,
  SessionItem,
  TokenStats
} from '../src/types/contracts';

describe('SDD Contract - Token Telemetry & Gauge Algorithm', () => {
  it('should evaluate context gauge levels correctly', () => {
    expect(getContextGaugeLevel(40000, 128000)).toBe('safe');
    expect(getContextGaugeLevel(80000, 128000)).toBe('warning');
    expect(getContextGaugeLevel(110000, 128000)).toBe('danger');
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
    expect(calculateTokenSavingsPercent(stats)).toBe(90);
  });
});

describe('SDD Contract - Session Operations (Tags, Rename, Hierarchy)', () => {
  const sampleSession: SessionItem = {
    id: 's-1',
    tier1: 'project',
    title: '原标题',
    projectId: 'proj-1',
    projectName: 'agent-learning',
    tags: ['feat'],
    messagesCount: 5,
    totalTokens: 1000,
    createdAt: 1000,
    updatedAt: 1000
  };

  it('should add and remove tags properly', () => {
    const withNewTag = addTagToSession(sampleSession, '#refactor');
    expect(withNewTag.tags).toContain('refactor');
    expect(withNewTag.tags.length).toBe(2);

    const withoutTag = removeTagFromSession(withNewTag, 'feat');
    expect(withoutTag.tags).not.toContain('feat');
    expect(withoutTag.tags).toContain('refactor');
  });

  it('should rename session cleanly', () => {
    const renamed = renameSession(sampleSession, '全新架构重构');
    expect(renamed.title).toBe('全新架构重构');
  });
});
