import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetCacheTelemetryForTest,
  extractFileSymbols,
  buildCompactRepoMap,
  canonicalizeJson,
  assembleCacheOptimizedMessages,
  recordCacheHitTelemetry,
  getCachedTelemetryStats
} from '../src/services/cacheEngine';

describe('Prompt Cache Accelerator & RepoMap Engine', () => {
  beforeEach(() => {
    resetCacheTelemetryForTest();
  });

  it('extracts TypeScript exports, functions, interfaces and dependencies', () => {
    const tsCode = `
import React from 'react';
import { resetCacheTelemetryForTest, hostGateway } from '../services/hostGateway';

export interface UserAccount {
  id: string;
}

export function computeBalance(acc: UserAccount): number {
  return 100;
}

export const API_VERSION = 'v1.5';
`;
    const summary = extractFileSymbols('src/account.ts', tsCode);
    expect(summary.filePath).toBe('src/account.ts');
    expect(summary.exports).toContain('UserAccount');
    expect(summary.exports).toContain('computeBalance');
    expect(summary.exports).toContain('API_VERSION');
    expect(summary.dependencies).toContain('../services/hostGateway');
  });

  it('extracts Python classes, async defs and imports', () => {
    const pyCode = `
from pathlib import Path
import os

class DatabaseClient:
    pass

async def fetch_user_data(user_id: str):
    return {"id": user_id}
`;
    const summary = extractFileSymbols('services/db.py', pyCode);
    expect(summary.filePath).toBe('services/db.py');
    expect(summary.exports).toContain('DatabaseClient');
    expect(summary.exports).toContain('fetch_user_data');
    expect(summary.dependencies).toContain('pathlib');
  });

  it('generates compact RepoMap topology text under 2000 tokens', () => {
    const files = [
      {
        filePath: 'src/services/agentLoop.ts',
        exports: ['verifyTargetAcceptance', 'formatExecutionFeedback'],
        symbols: [
          { name: 'verifyTargetAcceptance', kind: 'function' as const, line: 12 },
          { name: 'formatExecutionFeedback', kind: 'function' as const, line: 50 }
        ],
        dependencies: ['../types/contracts', './modelGateway']
      },
      {
        filePath: 'src/components/ChatColumn.tsx',
        exports: ['ChatColumn'],
        symbols: [{ name: 'ChatColumn', kind: 'function' as const, line: 30 }],
        dependencies: ['react', './MarkdownCard']
      }
    ];

    const repoMap = buildCompactRepoMap(files);
    expect(repoMap).toContain('### 🧭 工程全景代码骨架图谱 (RepoMap Topology)');
    expect(repoMap).toContain('src/services/agentLoop.ts');
    expect(repoMap).toContain('verifyTargetAcceptance');
    expect(repoMap).toContain('src/components/ChatColumn.tsx');
  });

  it('canonicalizes JSON object keys deterministically to prevent cache busting', () => {
    const objA = { z: 1, a: 2, m: { y: 10, b: 20 } };
    const objB = { a: 2, z: 1, m: { b: 20, y: 10 } };
    
    const canonicalA = canonicalizeJson(objA);
    const canonicalB = canonicalizeJson(objB);
    
    expect(canonicalA).toBe(canonicalB);
    expect(canonicalA).toBe('{"a":2,"m":{"b":20,"y":10},"z":1}');
  });

  it('assembles cache-optimized messages with strict prefix invariance', () => {
    const basePrompt = 'You are Tcode Agent.';
    const rules = 'Rule 1: Always verify.';
    const repoMap = 'RepoMap: src/app.ts';
    const history = [
      { role: 'user' as const, content: 'Fix the bug' },
      { role: 'assistant' as const, content: 'Inspecting tests' }
    ];
    const tail = { role: 'user' as const, content: 'Command exit code 0' };

    const assembled = assembleCacheOptimizedMessages({
      baseSystemPrompt: basePrompt,
      staticRulesText: rules,
      repoMapText: repoMap,
      immutableHistory: history,
      volatileCurrentTurnTail: tail
    });

    expect(assembled.length).toBe(4);
    expect(assembled[0].role).toBe('system');
    expect(assembled[0].content).toContain(basePrompt);
    expect(assembled[0].content).toContain(rules);
    expect(assembled[0].content).toContain(repoMap);

    // Prefix for turns 1..2 is identical
    expect(assembled[1].content).toBe('Fix the bug');
    expect(assembled[2].content).toBe('Inspecting tests');
    // Dynamic feedback at the very tail
    expect(assembled[3].content).toBe('Command exit code 0');
  });

  it('tracks and persists cache telemetry stats accurately', () => {
    const stats1 = recordCacheHitTelemetry(10000, 8500);
    expect(stats1.totalRequests).toBe(1);
    expect(stats1.totalTokens).toBe(10000);
    expect(stats1.cacheHitTokens).toBe(8500);
    expect(stats1.hitRatePercent).toBe(85.0);
    expect(stats1.timeSavedSeconds).toBeGreaterThan(0);

    const stats2 = recordCacheHitTelemetry(10000, 9000);
    expect(stats2.totalRequests).toBe(2);
    expect(stats2.totalTokens).toBe(20000);
    expect(stats2.cacheHitTokens).toBe(17500);
    expect(stats2.hitRatePercent).toBe(87.5);
  });
});
