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
