/**
 * WP-C 会话级并发调度引擎（模块三）：
 * 每个会话拥有独立的运行态（SessionRuntimeInfo），流式/取消/门禁全部按 sessionId
 * 分发，彻底废除全局 isStreaming + 单例 abortController 导致的"一会话跑任务全 IDE 阻塞"。
 */
import type { GateSuspension, StageGateDecision } from './stageGate';

export type SessionRuntimeStatus = 'idle' | 'streaming' | 'gate_pending';

export interface SessionRuntimeInfo {
  sessionId: string;
  status: SessionRuntimeStatus;
  abortController: AbortController | null;
  loopCount: number;
  tokensStreamed: number;
  currentPhase?: string;
  startedAt?: number;
  gate: GateSuspension | null;
  gateResolve: ((decision: StageGateDecision) => void) | null;
}

export function createSessionRuntime(sessionId: string): SessionRuntimeInfo {
  return {
    sessionId,
    status: 'idle',
    abortController: null,
    loopCount: 0,
    tokensStreamed: 0,
    gate: null,
    gateResolve: null
  };
}

type RuntimeListener = (snapshot: Record<string, SessionRuntimeInfo>) => void;

class SessionActorManager {
  private runtimes = new Map<string, SessionRuntimeInfo>();
  private listeners = new Set<RuntimeListener>();

  public subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emitChange(): void {
    const snapshot: Record<string, SessionRuntimeInfo> = {};
    this.runtimes.forEach((rt, id) => { snapshot[id] = { ...rt }; });
    this.listeners.forEach(l => l(snapshot));
  }

  public getSessionRuntime(sessionId: string): SessionRuntimeInfo | undefined {
    return this.runtimes.get(sessionId);
  }

  public startSession(sessionId: string): SessionRuntimeInfo {
    const rt = this.runtimes.get(sessionId) ?? createSessionRuntime(sessionId);
    // New run: reset counters but keep the abort controller wired for the new run.
    rt.status = 'streaming';
    rt.loopCount = 0;
    rt.tokensStreamed = 0;
    rt.currentPhase = undefined;
    rt.startedAt = Date.now();
    rt.gate = null;
    rt.gateResolve = null;
    this.runtimes.set(sessionId, rt);
    this.emitChange();
    return rt;
  }

  public completeSession(sessionId: string): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.status = 'idle';
    rt.gate = null;
    rt.gateResolve = null;
    this.emitChange();
  }

  public abortSession(sessionId: string): boolean {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return false;
    if (rt.abortController) {
      rt.abortController.abort();
      rt.abortController = null;
    }
    // A pending stage gate is resolved as terminate so the paused loop can exit.
    if (rt.gateResolve) {
      rt.gateResolve({ approved: false });
      rt.gateResolve = null;
    }
    rt.gate = null;
    rt.status = 'idle';
    this.emitChange();
    return true;
  }

  public isSessionRunning(sessionId: string): boolean {
    return this.runtimes.get(sessionId)?.status === 'streaming' || this.runtimes.get(sessionId)?.status === 'gate_pending';
  }

  public anySessionRunning(): boolean {
    let running = false;
    this.runtimes.forEach(rt => {
      if (rt.status === 'streaming' || rt.status === 'gate_pending') running = true;
    });
    return running;
  }

  public setAbortController(sessionId: string, controller: AbortController): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.abortController = controller;
  }

  public bumpLoop(sessionId: string): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.loopCount += 1;
    this.emitChange();
  }

  public addTokensStreamed(sessionId: string, tokens: number): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.tokensStreamed += tokens;
    this.emitChange();
  }

  public setPhase(sessionId: string, phase: string | undefined): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.currentPhase = phase;
    this.emitChange();
  }

  public setGate(sessionId: string, gate: GateSuspension | null): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.gate = gate;
    if (gate) rt.status = 'gate_pending';
    this.emitChange();
  }

  public registerGateResolve(sessionId: string, resolve: (decision: StageGateDecision) => void): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    rt.gateResolve = resolve;
  }

  public resolveGate(sessionId: string, decision: StageGateDecision): void {
    const rt = this.runtimes.get(sessionId);
    if (!rt) return;
    if (rt.gateResolve) {
      rt.gateResolve(decision);
    }
    rt.gateResolve = null;
    rt.gate = null;
    rt.status = 'streaming';
    this.emitChange();
  }

  public reset(): void {
    this.runtimes.clear();
    this.listeners.clear();
  }
}

/** Singleton: the single source of truth for per-session runtime state. */
export const sessionActorManager = new SessionActorManager();
