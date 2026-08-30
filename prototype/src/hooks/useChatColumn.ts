import { useEffect, useState, useCallback } from 'react';
import { sessionActorManager, type SessionRuntimeInfo } from '../services/sessionActorManager';

export interface UseChatColumnRuntime {
  isStreaming: boolean;
  isGatePending: boolean;
  tokensStreamed: number;
  loopCount: number;
  currentPhase?: string;
  startedAt?: number;
  gate: SessionRuntimeInfo['gate'];
  abort: () => void;
}

/**
 * ChatColumn Hook 专项（D1 运行时状态线程化）：
 * 每个 ChatColumn 实例订阅自己 sessionId 的运行态（SessionActorManager 单例），
 * 流式旋转动画 / 门禁卡片 / 进度遥测全部按会话隔离，互不阻塞。
 */
export function useChatColumn(sessionId: string): UseChatColumnRuntime {
  const [runtime, setRuntime] = useState<SessionRuntimeInfo | undefined>(() =>
    sessionActorManager.getSessionRuntime(sessionId)
  );

  useEffect(() => {
    setRuntime(sessionActorManager.getSessionRuntime(sessionId));
    return sessionActorManager.subscribe(snapshot => {
      setRuntime(snapshot[sessionId]);
    });
  }, [sessionId]);

  const abort = useCallback(() => {
    sessionActorManager.abortSession(sessionId);
  }, [sessionId]);

  return {
    isStreaming: runtime?.status === 'streaming' || runtime?.status === 'gate_pending',
    isGatePending: runtime?.status === 'gate_pending',
    tokensStreamed: runtime?.tokensStreamed ?? 0,
    loopCount: runtime?.loopCount ?? 0,
    currentPhase: runtime?.currentPhase,
    startedAt: runtime?.startedAt,
    gate: runtime?.gate ?? null,
    abort
  };
}
