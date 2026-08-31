import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSessionExecutionMode,
  saveSessionExecutionMode,
  clearSessionExecutionModes,
  resolveSessionExecutionMode
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

describe('session-level execution mode (SessionExecutionState)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSessionExecutionModes();
  });

  it('defaults to global mode when session has no override', () => {
    localStorage.setItem('tcode_execution_mode', 'swarm');
    expect(loadSessionExecutionMode('sess-a')).toBe('swarm');
  });

  it('save per-session override wins over global', () => {
    localStorage.setItem('tcode_execution_mode', 'act');
    saveSessionExecutionMode('sess-a', 'swarm');
    expect(loadSessionExecutionMode('sess-a')).toBe('swarm');
    // other sessions still use global
    expect(loadSessionExecutionMode('sess-b')).toBe('act');
  });

  it('resolveSessionExecutionMode(sessionId, global) returns per-session override or global', () => {
    saveSessionExecutionMode('sess-a', 'swarm');
    expect(resolveSessionExecutionMode('sess-a', 'act')).toBe('swarm');
    expect(resolveSessionExecutionMode('sess-b', 'act')).toBe('act');
  });

  it('clearSessionExecutionModes removes all overrides', () => {
    saveSessionExecutionMode('sess-a', 'swarm');
    clearSessionExecutionModes();
    expect(loadSessionExecutionMode('sess-a')).toBe('act');
  });
});
