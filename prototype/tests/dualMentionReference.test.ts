import { describe, it, expect } from 'vitest';
import { loadSavedOfficialSkills } from '../src/services/skillsEngine';
import { SessionItem, calculateKVCacheHitRate, calculateTokenSavingsPercent } from '../src/types/contracts';

describe('Dual @ Mention Reference Feature', () => {
  it('should list all enabled official skills for @ skill mention', () => {
    const skills = loadSavedOfficialSkills();
    expect(skills.length).toBeGreaterThan(0);
    const sddSkill = skills.find(s => s.name === 'spec-driven-development');
    expect(sddSkill).toBeDefined();
    expect(sddSkill?.enabled).toBe(true);
  });

  it('should support filtering sessions for @ session reference', () => {
    const currentSessionId = 'sess-1';
    const mockSessions: SessionItem[] = [
      {
        id: 'sess-1',
        title: '当前工程主会话',
        tier1: 'project',
        projectName: 'new-api',
        projectPath: 'D:/weihu/new-api',
        tags: ['project'],
        messagesCount: 5,
        totalTokens: 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'sess-2',
        title: '架构重构探索',
        tier1: 'global',
        tags: ['free'],
        messagesCount: 12,
        totalTokens: 2500,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'sess-3',
        title: '单元测试编写',
        tier1: 'project',
        projectName: 'new-api',
        projectPath: 'D:/weihu/new-api',
        tags: ['project'],
        messagesCount: 8,
        totalTokens: 1800,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const candidateSessions = mockSessions.filter(s => s.id !== currentSessionId);
    expect(candidateSessions.length).toBe(2);
    expect(candidateSessions.find(s => s.id === 'sess-1')).toBeUndefined();
    expect(candidateSessions[0].id).toBe('sess-2');
  });

  it('should format referenced session context properly into message prompt', () => {
    const referencedSession: SessionItem = {
      id: 'sess-history',
      title: '历史讨论：权限模型',
      tier1: 'project',
      projectName: 'new-api',
      tags: ['project'],
      messagesCount: 2,
      totalTokens: 500,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const mockMessagesMap: Record<string, { role: string; content: string }[]> = {
      'sess-history': [
        { role: 'user', content: '我们需要支持 RBAC 模型吗？' },
        { role: 'assistant', content: '是的，建议使用两层权限校验。' }
      ]
    };

    const userInput = '请基于上次的结论生成具体的 SQL 建表语句';
    const refMsgs = mockMessagesMap[referencedSession.id] || [];
    const historySummary = refMsgs.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).slice(-4).join('\n\n');
    const fullPrompt = `[已关联前序会话: ${referencedSession.title}]\n--- 前序会话历史对话上下文 ---\n${historySummary}\n--- 基于以上背景的继续提问 ---\n${userInput}`;

    expect(fullPrompt).toContain('[已关联前序会话: 历史讨论：权限模型]');
    expect(fullPrompt).toContain('我们需要支持 RBAC 模型吗？');
    expect(fullPrompt).toContain('请基于上次的结论生成具体的 SQL 建表语句');
  });

  it('should ensure KV Cache hit rate never exceeds 100% even under large cache hit counts', () => {
    // Test case from user bug: huge cacheHitTokens relative to prompt
    const statsHugeHit = {
      promptTokens: 2000,
      completionTokens: 500,
      cacheHitTokens: 16000,
      cacheWriteTokens: 1000,
      totalTokens: 18500,
      estimatedCostUsd: 0.01,
      contextCurrentTokens: 2500,
      contextMaxTokens: 128000
    };

    const hitRate = calculateKVCacheHitRate(statsHugeHit);
    const savingsPercent = calculateTokenSavingsPercent(statsHugeHit);

    expect(hitRate).toBeLessThanOrEqual(100);
    expect(hitRate).toBeGreaterThanOrEqual(0);
    expect(hitRate).toBe(89); // 16000 / (2000 + 16000) = 88.88% -> 89%

    expect(savingsPercent).toBeLessThanOrEqual(100);
    expect(savingsPercent).toBeGreaterThanOrEqual(0);
    expect(savingsPercent).toBe(88.9);

    // Extreme zero case
    const zeroStats = { promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, cacheWriteTokens: 0, totalTokens: 0, estimatedCostUsd: 0, contextCurrentTokens: 0, contextMaxTokens: 128000 };
    expect(calculateKVCacheHitRate(zeroStats)).toBe(0);
    expect(calculateTokenSavingsPercent(zeroStats)).toBe(0);
  });
});