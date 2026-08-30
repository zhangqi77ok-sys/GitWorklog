/**
 * Execution mode convergence (模块一): unify the user-facing intent into
 * 'act' (Agent Loop, fast) vs 'graph' (workflow graph with stage gates).
 * Replaces the legacy PipelineMode 'harness' | 'swarm' top-level toggle.
 */
export type ExecutionMode = 'act' | 'graph';

export interface ExecutionPolicy {
  dagType: '1-node-micro-loop' | 'n-node-workflow';
  systemPromptDirectives: string;
  allowedToolSet: string[];
  enableStageGate: boolean;
  workflowName?: string;
}

export interface WorkflowLike {
  name: string;
  blocks: Array<{ name?: string; allowedTools?: string[]; promptTemplate?: string }>;
}

const ACT_TOOLSET = ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];
const EXPLORE_TOOLSET = ['read_file', 'grep_search', 'find_by_name'];

export function resolveExecutionPolicy(
  mode: ExecutionMode,
  workflowId?: string,
  workflow?: WorkflowLike
): ExecutionPolicy {
  if (mode === 'act') {
    return {
      dagType: '1-node-micro-loop',
      systemPromptDirectives:
        '【Agent Loop 自主闭环模式】: 直接分析并定位问题，使用工具落地代码并自愈测试。无需产出冗余 Spec 文档。',
      allowedToolSet: ACT_TOOLSET,
      enableStageGate: false
    };
  }

  if (workflow && workflow.blocks.length > 0) {
    const first = workflow.blocks[0];
    return {
      dagType: 'n-node-workflow',
      systemPromptDirectives: `【Graph 工作流编排模式】: 已挂载积木工作流【${workflow.name}】，按阶段契约与门禁审批执行。`,
      allowedToolSet: first.allowedTools && first.allowedTools.length > 0 ? first.allowedTools : EXPLORE_TOOLSET,
      enableStageGate: true,
      workflowName: workflow.name
    };
  }

  // Graph mode without an explicit template -> autonomous dynamic graph planning.
  return {
    dagType: 'n-node-workflow',
    systemPromptDirectives:
      '【Graph 动态编排模式】: 这是一个复杂工程任务。在修改源码前，你必须先输出结构化任务图谱（Task Plan / DAG），对关键设计进行门禁确认，分步骤执行并在完成后给出测试自愈验证！',
    allowedToolSet: EXPLORE_TOOLSET,
    enableStageGate: true
  };
}

export function migratePipelineMode(saved: 'harness' | 'swarm' | undefined): ExecutionMode {
  if (saved === 'swarm') return 'graph';
  return 'act';
}

const STORAGE_KEY_EXECUTION_MODE = 'tcode_execution_mode';
const LEGACY_KEY_PIPELINE_MODE = 'tcode_pipeline_mode';

export function loadSavedExecutionMode(): ExecutionMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_EXECUTION_MODE);
      if (saved === 'act' || saved === 'graph') return saved;
      const legacy = localStorage.getItem(LEGACY_KEY_PIPELINE_MODE) as 'harness' | 'swarm' | null;
      if (legacy) return migratePipelineMode(legacy);
    }
  } catch (e) {}
  return 'act';
}

export function saveExecutionModeToStorage(mode: ExecutionMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_EXECUTION_MODE, mode);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tcode_execution_mode_updated', { detail: mode }));
      }
    }
  } catch (e) {}
}

const STORAGE_KEY_SESSION_MODES = 'tcode_session_execution_modes_v1';

function readSessionModes(): Record<string, ExecutionMode> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION_MODES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    }
  } catch (e) {}
  return {};
}

function writeSessionModes(modes: Record<string, ExecutionMode>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SESSION_MODES, JSON.stringify(modes));
    }
  } catch (e) {}
}

/**
 * 模块一 SessionExecutionState：每会话执行模式覆盖。
 * 缺省回退到全局模式（tcode_execution_mode）。
 */
export function loadSessionExecutionMode(sessionId: string): ExecutionMode {
  const modes = readSessionModes();
  if (modes[sessionId] === 'act' || modes[sessionId] === 'graph') {
    return modes[sessionId];
  }
  return loadSavedExecutionMode();
}

export function saveSessionExecutionMode(sessionId: string, mode: ExecutionMode): void {
  const modes = readSessionModes();
  modes[sessionId] = mode;
  writeSessionModes(modes);
}

export function resolveSessionExecutionMode(sessionId: string, globalMode: ExecutionMode): ExecutionMode {
  const modes = readSessionModes();
  if (modes[sessionId] === 'act' || modes[sessionId] === 'graph') {
    return modes[sessionId];
  }
  return globalMode;
}

export function clearSessionExecutionModes(): void {
  writeSessionModes({});
}

/**
 * Map an Alt+<key> keyboard shortcut to an execution mode.
 * Alt+1 -> 'act' (Agent Loop), Alt+2 -> 'graph' (Graph orchestration).
 * Returns null when the key does not map to a mode, so callers keep the
 * current selection untouched.
 */
export function executionModeFromShortcut(
  key: string,
  _current: ExecutionMode
): ExecutionMode | null {
  if (key === '1') return 'act';
  if (key === '2') return 'graph';
  return null;
}

/**
 * Build the system-prompt snippet that describes the active execution mode.
 * Replaces the legacy keyword-based ([Harness...]/[Swarm...]) prompt injection.
 */
export function buildModePromptSnippet(
  mode: ExecutionMode,
  workflowId?: string,
  workflow?: WorkflowLike
): string {
  const policy = resolveExecutionPolicy(mode, workflowId, workflow);
  const label = mode === 'act'
    ? '⚡ Agent Loop（极速执行）'
    : workflow && workflow.blocks.length > 0
      ? `🧩 Graph 编排 · ${workflow.name}`
      : '🧩 Graph 动态编排（未选模板）';
  return `【当前执行架构】: ${label}\n${policy.systemPromptDirectives}`;
}
