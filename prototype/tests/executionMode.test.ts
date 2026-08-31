import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveExecutionPolicy,
  migratePipelineMode,
  loadSavedExecutionMode,
  saveExecutionModeToStorage,
  executionModeFromShortcut,
  buildModePromptSnippet
} from '../src/services/executionMode';

const mockStorage: Record<string, string> = {};
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  };
}

describe('execution mode policy', () => {
  it('act -> 1-node micro loop, no stage gate, act toolset', () => {
    const p = resolveExecutionPolicy('act');
    expect(p.dagType).toBe('1-node-micro-loop');
    expect(p.enableStageGate).toBe(false);
    expect(p.allowedToolSet).toContain('write_file');
    expect(p.systemPromptDirectives).toContain('Agent Loop');
  });

  it('swarm -> multi-agent concurrent collaboration policy', () => {
    const p = resolveExecutionPolicy('swarm');
    expect(p.dagType).toBe('multi-agent-swarm');
    expect(p.enableStageGate).toBe(false);
    expect(p.systemPromptDirectives).toContain('Swarm');
  });
});

describe('pipeline mode migration', () => {
  it('harness -> act, swarm -> swarm, undefined -> act', () => {
    expect(migratePipelineMode('harness')).toBe('act');
    expect(migratePipelineMode('swarm')).toBe('swarm');
    expect(migratePipelineMode(undefined)).toBe('act');
    expect(migratePipelineMode('bogus' as never)).toBe('act');
  });
});

describe('execution mode storage & migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads new key when present', () => {
    localStorage.setItem('tcode_execution_mode', 'swarm');
    expect(loadSavedExecutionMode()).toBe('swarm');
  });

  it('migrates legacy pipeline mode harness -> act', () => {
    localStorage.setItem('tcode_pipeline_mode', 'harness');
    expect(loadSavedExecutionMode()).toBe('act');
  });

  it('migrates legacy pipeline mode swarm -> swarm', () => {
    localStorage.setItem('tcode_pipeline_mode', 'swarm');
    expect(loadSavedExecutionMode()).toBe('swarm');
  });

  it('defaults to act when nothing stored', () => {
    expect(loadSavedExecutionMode()).toBe('act');
  });

  it('save writes new key', () => {
    saveExecutionModeToStorage('swarm');
    expect(localStorage.getItem('tcode_execution_mode')).toBe('swarm');
  });
});

describe('execution mode keyboard shortcut (Alt+1 / Alt+2)', () => {
  it('Alt+1 maps to act', () => {
    expect(executionModeFromShortcut('1', 'swarm')).toBe('act');
  });

  it('Alt+2 maps to swarm', () => {
    expect(executionModeFromShortcut('2', 'act')).toBe('swarm');
  });

  it('other keys return null and preserve current mode', () => {
    expect(executionModeFromShortcut('Enter', 'act')).toBeNull();
    expect(executionModeFromShortcut('q', 'swarm')).toBeNull();
  });

  it('switching to the same mode still returns the target mode', () => {
    expect(executionModeFromShortcut('1', 'act')).toBe('act');
  });
});

describe('buildModePromptSnippet', () => {
  it('act mode snippet names Agent Loop', () => {
    const snippet = buildModePromptSnippet('act');
    expect(snippet).toContain('Agent Loop');
  });

  it('swarm mode snippet names Swarm', () => {
    const snippet = buildModePromptSnippet('swarm');
    expect(snippet).toContain('Swarm');
  });
});
