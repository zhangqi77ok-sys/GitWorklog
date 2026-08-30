import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sessionActorManager,
  createSessionRuntime,
  type SessionRuntimeInfo
} from '../src/services/sessionActorManager';

describe('session actor manager - runtime lifecycle', () => {
  beforeEach(() => {
    sessionActorManager.reset();
  });

  it('createSessionRuntime starts idle with zeroed counters', () => {
    const rt = createSessionRuntime('sess-a');
    expect(rt.sessionId).toBe('sess-a');
    expect(rt.status).toBe('idle');
    expect(rt.loopCount).toBe(0);
    expect(rt.tokensStreamed).toBe(0);
    expect(rt.abortController).toBeNull();
    expect(rt.gate).toBeNull();
    expect(rt.gateResolve).toBeNull();
  });

  it('startSession creates a streaming runtime and reports running', () => {
    const rt = sessionActorManager.startSession('sess-a');
    expect(rt.status).toBe('streaming');
    expect(sessionActorManager.isSessionRunning('sess-a')).toBe(true);
    expect(sessionActorManager.anySessionRunning()).toBe(true);
  });

  it('startSession on an existing session resets counters for a new run', () => {
    sessionActorManager.startSession('sess-a');
    sessionActorManager.bumpLoop('sess-a');
    sessionActorManager.addTokensStreamed('sess-a', 100);
    const rt = sessionActorManager.startSession('sess-a');
    expect(rt.loopCount).toBe(0);
    expect(rt.tokensStreamed).toBe(0);
    expect(rt.status).toBe('streaming');
  });

  it('completeSession returns runtime to idle', () => {
    sessionActorManager.startSession('sess-a');
    sessionActorManager.completeSession('sess-a');
    expect(sessionActorManager.isSessionRunning('sess-a')).toBe(false);
    expect(sessionActorManager.getSessionRuntime('sess-a')?.status).toBe('idle');
  });

  it('abortSession aborts the controller and resolves a pending gate as terminate', () => {
    const ctrl = new AbortController();
    sessionActorManager.startSession('sess-a');
    sessionActorManager.setAbortController('sess-a', ctrl);
    const gateResolve = vi.fn();
    sessionActorManager.registerGateResolve('sess-a', gateResolve);
    const aborted = sessionActorManager.abortSession('sess-a');
    expect(aborted).toBe(true);
    expect(ctrl.signal.aborted).toBe(true);
    expect(gateResolve).toHaveBeenCalledWith({ approved: false });
    expect(sessionActorManager.isSessionRunning('sess-a')).toBe(false);
  });

  it('aborting an unknown session returns false', () => {
    expect(sessionActorManager.abortSession('nope')).toBe(false);
  });
});

describe('session actor manager - stage gate per session', () => {
  beforeEach(() => {
    sessionActorManager.reset();
  });

  it('setGate + registerGateResolve + resolveGate flows a decision', () => {
    sessionActorManager.startSession('sess-a');
    const gate = { active: true, gate: { gateId: 'g1' } } as never;
    sessionActorManager.setGate('sess-a', gate as never);
    const resolver = vi.fn();
    sessionActorManager.registerGateResolve('sess-a', resolver);
    sessionActorManager.resolveGate('sess-a', { approved: true });
    expect(resolver).toHaveBeenCalledWith({ approved: true });
    expect(sessionActorManager.getSessionRuntime('sess-a')?.gateResolve).toBeNull();
  });
});

describe('session actor manager - concurrency isolation', () => {
  beforeEach(() => {
    sessionActorManager.reset();
  });

  it('aborting session A leaves session B streaming', () => {
    sessionActorManager.startSession('sess-a');
    sessionActorManager.startSession('sess-b');
    sessionActorManager.abortSession('sess-a');
    expect(sessionActorManager.isSessionRunning('sess-a')).toBe(false);
    expect(sessionActorManager.isSessionRunning('sess-b')).toBe(true);
    expect(sessionActorManager.anySessionRunning()).toBe(true);
  });

  it('subscribe notifies on mutations and unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = sessionActorManager.subscribe(listener);
    sessionActorManager.startSession('sess-a');
    expect(listener).toHaveBeenCalled();
    const callsAfterStart = listener.mock.calls.length;
    unsub();
    sessionActorManager.completeSession('sess-a');
    expect(listener.mock.calls.length).toBe(callsAfterStart);
  });
});

describe('session actor manager - telemetry counters', () => {
  beforeEach(() => {
    sessionActorManager.reset();
  });

  it('bumpLoop and addTokensStreamed accumulate per session', () => {
    sessionActorManager.startSession('sess-a');
    sessionActorManager.bumpLoop('sess-a');
    sessionActorManager.bumpLoop('sess-a');
    sessionActorManager.addTokensStreamed('sess-a', 250);
    sessionActorManager.addTokensStreamed('sess-a', 350);
    const rt = sessionActorManager.getSessionRuntime('sess-a') as SessionRuntimeInfo;
    expect(rt.loopCount).toBe(2);
    expect(rt.tokensStreamed).toBe(600);
  });

  it('setPhase records the current phase', () => {
    sessionActorManager.startSession('sess-a');
    sessionActorManager.setPhase('sess-a', 'modify');
    expect(sessionActorManager.getSessionRuntime('sess-a')?.currentPhase).toBe('modify');
  });
});
