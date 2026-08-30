/**
 * WP-E 模块六：真并发 Subagent 执行 —— 每 Agent 独立请求流 + 影子 cwd。
 * 失败互不阻塞（Promise.allSettled），事件经 agentEventStore 广播供 Master 遥测。
 */
import { agentEventStore } from './agentEventStore';

export interface SubagentRunSpec {
  id: string;
  role: string;
  modelId: string;
  prompt: string;
  shadowPath: string;
  signal?: AbortSignal;
}

export interface SubagentRunResult {
  id: string;
  role: string;
  success: boolean;
  summary: string;
  error?: string;
}

export type SubagentRunner = (spec: SubagentRunSpec) => Promise<{ success: boolean; summary: string }>;

/**
 * Run all subagents truly concurrently. Each spec carries its own shadow
 * workspace path (physical cwd) and its own AbortSignal for independent cancel.
 */
export async function runSubagentsConcurrently(
  specs: SubagentRunSpec[],
  runner: SubagentRunner
): Promise<SubagentRunResult[]> {
  const tasks = specs.map(async (spec) => {
    agentEventStore.emit({
      sessionId: 'swarm',
      runId: 'swarm-run',
      roundId: `sub-${spec.id}`,
      type: 'agent.started',
      source: 'agent',
      payload: { role: spec.role, id: spec.id, shadowPath: spec.shadowPath }
    });
    try {
      const out = await runner(spec);
      agentEventStore.emit({
        sessionId: 'swarm',
        runId: 'swarm-run',
        roundId: `sub-${spec.id}`,
        type: 'agent.completed',
        source: 'agent',
        payload: { role: spec.role, id: spec.id }
      });
      return { id: spec.id, role: spec.role, success: out.success, summary: out.summary };
    } catch (err: any) {
      agentEventStore.emit({
        sessionId: 'swarm',
        runId: 'swarm-run',
        roundId: `sub-${spec.id}`,
        type: 'agent.failed',
        source: 'agent',
        payload: { role: spec.role, id: spec.id, error: String(err?.message || err) }
      });
      return { id: spec.id, role: spec.role, success: false, summary: '', error: String(err?.message || err) };
    }
  });
  return Promise.all(tasks);
}
