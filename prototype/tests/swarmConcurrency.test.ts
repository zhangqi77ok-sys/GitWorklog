import { describe, it, expect, beforeEach, vi } from 'vitest';
import { worktreeManager } from '../src/services/worktreeManager';
import { evaluateSubagentAction, DEFAULT_ROLE_BOUNDARIES } from '../src/services/swarmSteering';
import { SwarmMaster } from '../src/services/swarmMaster';
import { createTwoPhaseMerge, collectPatch, markTestsPassed, markTestsFailed, applyPatches, resolveMerge } from '../src/services/twoPhaseMerge';
import { runSubagentsConcurrently } from '../src/services/swarmExecution';
import { createSwarmRunRuntime, disposeSwarmRunRuntime } from '../src/services/swarmRuntime';

describe('WP-E worktreeManager - shadow workspace lifecycle', () => {
  beforeEach(() => {
    worktreeManager.reset();
    vi.restoreAllMocks();
  });

  it('createShadow posts to host and registers shadow path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, shadowPath: 'C:/ws/shadow-fe', id: 'shadow-fe' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const shadow = await worktreeManager.createShadow('C:/ws/proj', 'shadow-fe');
    expect(shadow.shadowPath).toBe('C:/ws/shadow-fe');
    expect(fetchMock).toHaveBeenCalledWith('/api/git/worktree/create', expect.objectContaining({ method: 'POST' }));
    expect(worktreeManager.getShadowPath('shadow-fe')).toBe('C:/ws/shadow-fe');
  });

  it('createShadow rejects on host failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'X' }) }));
    await expect(worktreeManager.createShadow('C:/ws/proj', 'shadow-x')).rejects.toThrow();
  });

  it('removeShadow calls host remove and clears registration', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    worktreeManager['shadows'].set('shadow-a', { id: 'shadow-a', shadowPath: 'C:/ws/shadow-a', createdAt: 1 });
    await worktreeManager.removeShadow('C:/ws/proj', 'shadow-a');
    expect(fetchMock).toHaveBeenCalledWith('/api/git/worktree/remove', expect.anything());
    expect(worktreeManager.getShadowPath('shadow-a')).toBeUndefined();
  });
});

describe('WP-E swarm steering - role x path boundary rules', () => {
  it('frontend agent writing server path is a violation with intervention', () => {
    const v = evaluateSubagentAction('frontend', 'write_file', 'server/db.sql');
    expect(v.allowed).toBe(false);
    expect(v.intervention).toContain('Master 纠偏');
    expect(v.reason).toContain('越权');
  });

  it('frontend agent writing src path is allowed', () => {
    const v = evaluateSubagentAction('frontend', 'write_file', 'src/Login.tsx');
    expect(v.allowed).toBe(true);
  });

  it('backend agent writing server path is allowed', () => {
    const v = evaluateSubagentAction('backend', 'write_file', 'server/api.py');
    expect(v.allowed).toBe(true);
  });

  it('read_file and run_command are not boundary-restricted', () => {
    expect(evaluateSubagentAction('frontend', 'read_file', 'server/db.sql').allowed).toBe(true);
    expect(evaluateSubagentAction('frontend', 'run_command', 'pytest tests/').allowed).toBe(true);
  });

  it('unknown role defaults to allowed', () => {
    expect(evaluateSubagentAction('mystery_role', 'write_file', 'anything/x.ts').allowed).toBe(true);
  });

  it('DEFAULT_ROLE_BOUNDARIES covers core roles', () => {
    const roles = DEFAULT_ROLE_BOUNDARIES.map(b => b.role);
    expect(roles).toContain('frontend');
    expect(roles).toContain('backend');
  });
});

describe('WP-E swarm master - telemetry bus steering', () => {
  it('registers subagents and records interventions on violations', () => {
    const master = new SwarmMaster();
    master.registerSubagent('fe-1', 'frontend', 'shadow-fe');
    const v = master.onSubagentAction('fe-1', { type: 'write_file', path: 'server/db.sql' });
    expect(v).not.toBeNull();
    expect(master.getInterventions('fe-1')).toHaveLength(1);
    expect(master.hasViolations()).toBe(true);
  });

  it('allowed actions are not recorded as interventions', () => {
    const master = new SwarmMaster();
    master.registerSubagent('fe-1', 'frontend', 'shadow-fe');
    const v = master.onSubagentAction('fe-1', { type: 'write_file', path: 'src/Login.tsx' });
    expect(v?.allowed).toBe(true);
    expect(master.getInterventions('fe-1')).toHaveLength(0);
  });

  it('unknown subagent action is ignored safely', () => {
    const master = new SwarmMaster();
    expect(master.onSubagentAction('nope', { type: 'write_file', path: 'x.ts' })).toBeNull();
  });
});

describe('WP-E two-phase merge gate (2PC)', () => {
  it('cannot apply patches before tests pass', () => {
    const s = createTwoPhaseMerge();
    const s2 = collectPatch(s, 'patch-1');
    expect(applyPatches(s2).phase).toBe('test');
  });

  it('collect -> tests green -> apply -> complete', () => {
    let s = createTwoPhaseMerge();
    s = collectPatch(s, 'patch-1');
    s = collectPatch(s, 'patch-2');
    s = markTestsPassed(s);
    const applied = applyPatches(s);
    expect(applied.phase).toBe('apply');
    expect(resolveMerge(applied).phase).toBe('complete');
  });

  it('tests red -> failed with no apply', () => {
    let s = createTwoPhaseMerge();
    s = collectPatch(s, 'patch-1');
    s = markTestsFailed(s);
    expect(applyPatches(s).phase).toBe('failed');
    expect(s.applied).toBe(false);
  });
});

describe('WP-E swarm run runtime facade', () => {
  beforeEach(() => {
    worktreeManager.reset();
    vi.restoreAllMocks();
  });

  it('creates shadow workspaces + master + 2PC merge in one unit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, shadowPath: 'C:/ws/shadow-fe', id: 'shadow-fe' })
    }));
    const runtime = await createSwarmRunRuntime('C:/ws/proj', [
      { id: 'fe-1', role: 'frontend' },
      { id: 'be-1', role: 'backend' }
    ]);
    expect(runtime.shadows).toHaveLength(2);
    expect(runtime.master).toBeInstanceOf(Object);
    expect(runtime.merge.phase).toBe('collect');
    expect(runtime.projectPath).toBe('C:/ws/proj');
  });

  it('dispose removes all shadows', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/create')) {
        return { ok: true, json: async () => ({ success: true, shadowPath: 'C:/ws/shadow-x', id: 'shadow-x' }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const runtime = await createSwarmRunRuntime('C:/ws/proj', [{ id: 'x', role: 'coder' }]);
    expect(runtime.shadows).toHaveLength(1);
    await disposeSwarmRunRuntime(runtime);
    expect(runtime.shadows).toHaveLength(0);
  });
});

describe('WP-E concurrent subagent execution', () => {
  it('runs all subagents concurrently and returns per-agent results', async () => {
    const runner = vi.fn(async (spec: any) => ({ success: true, summary: `done ${spec.id}` }));
    const results = await runSubagentsConcurrently([
      { id: 'fe-1', role: 'frontend', modelId: 'm1', prompt: 'p1', shadowPath: 'C:/ws/shadow-fe' },
      { id: 'be-1', role: 'backend', modelId: 'm1', prompt: 'p2', shadowPath: 'C:/ws/shadow-be' }
    ], runner as never);
    expect(results).toHaveLength(2);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('propagates per-subagent failure without blocking others', async () => {
    const runner = vi.fn(async (spec: any) => {
      if (spec.id === 'fe-1') throw new Error('boom');
      return { success: true, summary: 'ok' };
    });
    const results = await runSubagentsConcurrently([
      { id: 'fe-1', role: 'frontend', modelId: 'm1', prompt: 'p1', shadowPath: 'C:/ws/shadow-fe' },
      { id: 'be-1', role: 'backend', modelId: 'm1', prompt: 'p2', shadowPath: 'C:/ws/shadow-be' }
    ], runner as never);
    const fe = results.find(r => r.id === 'fe-1')!;
    expect(fe.success).toBe(false);
    expect(fe.error).toContain('boom');
    expect(results.find(r => r.id === 'be-1')!.success).toBe(true);
  });
});
