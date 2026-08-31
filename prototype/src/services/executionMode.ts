/**
 * Execution Mode: Dual Engine Architecture (Agent Loop vs Swarm)
 * - 'act' (Agent Loop): Single autonomous agent micro-loop (Think → Tool Call → Observe → Verify)
 * - 'swarm': Multi-agent concurrent collaboration network
 * 
 * Note: Engineering methodologies (SDD, TDD, Brainstorming, Code Review) belong to Skills Engine (.agents/skills/).
 */
export type ExecutionMode = 'act' | 'swarm';

export interface ExecutionPolicy {
  dagType: '1-node-micro-loop' | 'multi-agent-swarm';
  systemPromptDirectives: string;
  allowedToolSet: string[];
  enableStageGate: boolean;
  engineName: string;
}

const ACT_TOOLSET = ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];

export function resolveExecutionPolicy(mode: ExecutionMode): ExecutionPolicy {
  if (mode === 'swarm') {
    return {
      dagType: 'multi-agent-swarm',
      systemPromptDirectives:
        '【Swarm 多智能体并发协同模式】: 这是一个复杂团队工程任务。Lead Agent 负责任务拆解与调度，各专业 Subagents（架构师、编码员、测试自愈官、安全审查员）并发分工协作并归集交付！',
      allowedToolSet: ACT_TOOLSET,
      enableStageGate: false,
      engineName: '🐝 Swarm 多智能体协同'
    };
  }

  return {
    dagType: '1-node-micro-loop',
    systemPromptDirectives:
      '【Agent Loop 自主闭环模式】: 直接分析并定位问题，使用工具落地代码并自愈测试。以极速单智能体闭环交付。',
    allowedToolSet: ACT_TOOLSET,
    enableStageGate: false,
    engineName: '⚡ Agent Loop 极速执行'
  };
}

export function migratePipelineMode(saved: string | undefined): ExecutionMode {
  if (saved === 'swarm' || saved === 'graph') return 'swarm';
  return 'act';
}

const STORAGE_KEY_EXECUTION_MODE = 'tcode_execution_mode';
const LEGACY_KEY_PIPELINE_MODE = 'tcode_pipeline_mode';

export function loadSavedExecutionMode(): ExecutionMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_EXECUTION_MODE);
      if (saved === 'act' || saved === 'swarm') return saved;
      if (saved === 'graph') return 'swarm';
      const legacy = localStorage.getItem(LEGACY_KEY_PIPELINE_MODE);
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

export function loadSessionExecutionMode(sessionId: string): ExecutionMode {
  const modes = readSessionModes();
  if (modes[sessionId] === 'act' || modes[sessionId] === 'swarm') {
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
  if (modes[sessionId] === 'act' || modes[sessionId] === 'swarm') {
    return modes[sessionId];
  }
  return globalMode;
}

export function clearSessionExecutionModes(): void {
  writeSessionModes({});
}

/**
 * Map an Alt+<key> keyboard shortcut to an execution mode.
 * Alt+1 -> 'act' (Agent Loop), Alt+2 -> 'swarm' (Swarm Concurrency).
 */
export function executionModeFromShortcut(
  key: string,
  _current: ExecutionMode
): ExecutionMode | null {
  if (key === '1') return 'act';
  if (key === '2') return 'swarm';
  return null;
}

/**
 * Build the system-prompt snippet that describes the active execution engine.
 */
export function buildModePromptSnippet(mode: ExecutionMode): string {
  const policy = resolveExecutionPolicy(mode);
  return `【当前执行引擎】: ${policy.engineName}\n${policy.systemPromptDirectives}`;
}
