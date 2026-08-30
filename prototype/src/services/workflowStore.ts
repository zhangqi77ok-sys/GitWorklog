/**
 * ────────────────────────────────────────────────────────────
 * 🧩 MODULAR LEGO WORKFLOW STORE & EXECUTION ENGINE
 * ────────────────────────────────────────────────────────────
 * 
 * Manages modular block-based workflows, persistence to .codemind/workflows.json,
 * and step-by-step prompt injection & gate policies for the Agent Loop.
 */

export type LegoBlockCategory = 'inspect' | 'spec' | 'gate' | 'code' | 'tool';

export interface LegoBlock {
  id: string;
  type: string;
  category: LegoBlockCategory;
  name: string;
  icon: string;
  color: string;
  promptTemplate: string;
  allowedTools: string[];
  artifactPath?: string;
  requireUserReview?: boolean;
  requireRedTestFailure?: boolean;
}

export interface ModularWorkflow {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'sdd' | 'tdd' | 'hybrid' | 'custom' | 'adapter';
  enabled: boolean;
  isDefault: boolean;
  blocks: LegoBlock[];
}

const STORAGE_KEY_WORKFLOWS = 'tcode_modular_workflows_v1';
const STORAGE_KEY_ACTIVE_WF = 'tcode_active_workflow_id_v1';

export const DEFAULT_BLOCK_PALETTE: Record<string, Omit<LegoBlock, 'id'>> = {
  'inspect': {
    type: 'inspect',
    category: 'inspect',
    name: '代码现状与依赖探查',
    icon: '🔎',
    color: '#3B82F6',
    promptTemplate: '【阶段 1 现状审查铁律】: 必须先使用 read_file 与 RepoMap 审查现有代码结构与依赖，输出深入的根因分析报告，严禁在此阶段直接修改任何源码！',
    allowedTools: ['read_file']
  },
  'repomap': {
    type: 'repomap',
    category: 'inspect',
    name: 'RepoMap 骨架注入',
    icon: '🧭',
    color: '#3B82F6',
    promptTemplate: '【阶段 1 拓扑注入】: 在 System Prompt 中注入当前工程 <2k Tokens 紧凑骨架图谱，精准命中目标符号与依赖。',
    allowedTools: ['read_file']
  },
  'spec': {
    type: 'spec',
    category: 'spec',
    name: 'Spec 契约与原型生成',
    icon: '📄',
    color: '#F97316',
    promptTemplate: '【阶段 2 契约生成铁律】: 必须产出包含接口契约、任务拆解与验收清单的 .codemind/specs/{id}.md 规范文档。',
    allowedTools: ['write_file'],
    artifactPath: '.codemind/specs/{feature_id}.md'
  },
  'tasks': {
    type: 'tasks',
    category: 'spec',
    name: '任务清单结构化拆解',
    icon: '📋',
    color: '#F97316',
    promptTemplate: '【阶段 2 任务清单】: 结构化拆解本次需求的具体落地子步骤与验收标准。',
    allowedTools: ['write_file']
  },
  'gate-user': {
    type: 'gate-user',
    category: 'gate',
    name: '用户方案确认门禁 (Gate)',
    icon: '🚦',
    color: '#EF4444',
    promptTemplate: '【质量门禁】: 挂起推演流程，弹出确认卡片，必须经用户点击「确认方案」方可放行。',
    allowedTools: [],
    requireUserReview: true
  },
  'gate-red': {
    type: 'gate-red',
    category: 'gate',
    name: 'TDD 红灯先决门禁 (Red Gate)',
    icon: '🔴',
    color: '#EF4444',
    promptTemplate: '【TDD 红灯先决条件】: 编码前必须在 tests/ 目录先编写失败断言，在终端执行并捕获到一次失败测试断言证据！',
    allowedTools: ['run_command', 'write_file'],
    requireRedTestFailure: true
  },
  'code': {
    type: 'code',
    category: 'code',
    name: '代码落地与测试自愈',
    icon: '💾',
    color: '#10B981',
    promptTemplate: '【阶段 3 代码落地】: 严格按照已确认的 Spec/测试用例编写代码，并通过全量测试验收。',
    allowedTools: ['write_file', 'run_command']
  },
  'test-run': {
    type: 'test-run',
    category: 'code',
    name: '自动化测试自愈',
    icon: '🧪',
    color: '#10B981',
    promptTemplate: '【阶段 4 测试自愈】: 运行 pytest 或 npm test，如果失败则自动启动重构自愈循环。',
    allowedTools: ['run_command']
  }
};

export const NORMAL_WORKFLOW: ModularWorkflow = {
  id: 'normal',
  name: '普通自由任务',
  icon: '💬',
  description: '标准对话模式：不启用 SDD、TDD 或额外阶段约束，自由发挥',
  category: 'custom',
  enabled: true,
  isDefault: false,
  blocks: []
};

export const INITIAL_MODULAR_WORKFLOWS: ModularWorkflow[] = [
  {
    id: 'sdd-workflow',
    name: 'SDD · Spec 规范驱动开发',
    icon: '📐',
    description: '规格先行契约化开发：先产出需求与设计，确认后落盘',
    category: 'sdd',
    enabled: true,
    isDefault: false,
    blocks: [
      { id: 'b-1', ...DEFAULT_BLOCK_PALETTE['inspect'] },
      { id: 'b-2', ...DEFAULT_BLOCK_PALETTE['spec'] },
      { id: 'b-3', ...DEFAULT_BLOCK_PALETTE['gate-user'] },
      { id: 'b-4', ...DEFAULT_BLOCK_PALETTE['code'] }
    ]
  },
  {
    id: 'tdd-workflow',
    name: 'TDD · 测试驱动自愈工作流',
    icon: '🧪',
    description: '严格测试先行闭环：先编写失败单测捕获证据，再编写最小功能代码',
    category: 'tdd',
    enabled: true,
    isDefault: false,
    blocks: [
      { id: 'b-1', ...DEFAULT_BLOCK_PALETTE['inspect'] },
      { id: 'b-2', ...DEFAULT_BLOCK_PALETTE['gate-red'] },
      { id: 'b-3', ...DEFAULT_BLOCK_PALETTE['code'] },
      { id: 'b-4', ...DEFAULT_BLOCK_PALETTE['test-run'] }
    ]
  },
  {
    id: 'hybrid-sdd-tdd',
    name: 'SDD + TDD · 完整闭环工作流',
    icon: '💎',
    description: '全生命周期质量闭环：先产出需求契约，经用户确认后执行 TDD 红绿灯自测',
    category: 'hybrid',
    enabled: true,
    isDefault: true,
    blocks: [
      { id: 'b-1', ...DEFAULT_BLOCK_PALETTE['inspect'] },
      { id: 'b-2', ...DEFAULT_BLOCK_PALETTE['spec'] },
      { id: 'b-3', ...DEFAULT_BLOCK_PALETTE['gate-user'] },
      { id: 'b-4', ...DEFAULT_BLOCK_PALETTE['gate-red'] },
      { id: 'b-5', ...DEFAULT_BLOCK_PALETTE['code'] },
      { id: 'b-6', ...DEFAULT_BLOCK_PALETTE['test-run'] }
    ]
  },
  {
    id: 'speckit-workflow',
    name: 'SpecKit · 本地 CLI 适配器',
    icon: '📦',
    description: '自动桥接本地安装的 speckit CLI，通过命令行执行 Spec 生成与验证',
    category: 'adapter',
    enabled: true,
    isDefault: false,
    blocks: [
      { id: 'b-1', ...DEFAULT_BLOCK_PALETTE['inspect'] },
      {
        id: 'b-2',
        type: 'speckit-cli',
        category: 'tool',
        name: '调用 SpecKit CLI',
        icon: '📦',
        color: '#F97316',
        promptTemplate: '【SpecKit CLI 适配器】: 调用本地 speckit run 命令生成规格与任务拆解。',
        allowedTools: ['run_command']
      },
      { id: 'b-3', ...DEFAULT_BLOCK_PALETTE['gate-user'] }
    ]
  }
];

let memoryWorkflows: ModularWorkflow[] | null = null;
let memoryActiveId: string = 'hybrid-sdd-tdd';

export function loadSavedWorkflows(): ModularWorkflow[] {
  if (memoryWorkflows) return memoryWorkflows;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_WORKFLOWS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryWorkflows = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {}
  memoryWorkflows = INITIAL_MODULAR_WORKFLOWS;
  return INITIAL_MODULAR_WORKFLOWS;
}

export function saveWorkflowsToStorage(workflows: ModularWorkflow[]): void {
  memoryWorkflows = workflows;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_WORKFLOWS, JSON.stringify(workflows));
    }
    // Async save to disk .codemind/workflows.json
    if (typeof fetch !== 'undefined') {
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'workflows', data: workflows })
      }).catch(() => {});
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tcode_workflows_updated', { detail: workflows }));
    }
  } catch (e) {}
}

export function getActiveWorkflowId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_WF) || memoryActiveId || 'hybrid-sdd-tdd';
    }
  } catch (e) {}
  return memoryActiveId || 'hybrid-sdd-tdd';
}

export function setActiveWorkflowId(id: string): void {
  memoryActiveId = id;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ACTIVE_WF, id);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tcode_active_workflow_changed', { detail: id }));
    }
  } catch (e) {}
}

export function getActiveWorkflow(): ModularWorkflow {
  const activeId = getActiveWorkflowId();
  if (activeId === 'normal' || activeId === 'none') {
    return NORMAL_WORKFLOW;
  }
  const list = loadSavedWorkflows();
  return list.find(w => w.id === activeId) || NORMAL_WORKFLOW;
}

/**
 * Gets prompt directives for the current turn based on the active workflow's current block step.
 */
export function getWorkflowPromptDirectives(workflow: ModularWorkflow, currentStepIndex: number): string {
  if (!workflow || !workflow.blocks || workflow.blocks.length === 0) return '';
  const block = workflow.blocks[Math.min(currentStepIndex, workflow.blocks.length - 1)];
  return `### 🧩 当前生效工作流: 【${workflow.name}】 (步骤 ${currentStepIndex + 1}/${workflow.blocks.length}: ${block.name})
${block.promptTemplate}`;
}

/**
 * Gets allowed tool list for the current block step in the workflow.
 */
export function getWorkflowAllowedTools(workflow: ModularWorkflow, currentStepIndex: number): string[] {
  if (!workflow || !workflow.blocks || workflow.blocks.length === 0) {
    return ['read_file', 'write_file', 'run_command'];
  }
  const block = workflow.blocks[Math.min(currentStepIndex, workflow.blocks.length - 1)];
  return block.allowedTools && block.allowedTools.length > 0 ? block.allowedTools : ['read_file', 'write_file', 'run_command'];
}
