import { WorkMode, PermissionPolicy } from '../types/contracts';

export interface RuntimeCapabilityMatrix {
  readFiles: boolean;
  searchFiles: boolean;
  inspectAst: boolean;
  writeFiles: boolean;
  runCommands: boolean;
  runTests: boolean;
  gitOperations: boolean;
  networkAccess: boolean;
  mcpAccess: boolean;
}

export interface RuntimeExecutionSpec {
  responseStyle: 'full' | 'concise' | 'laboratory';
  contextScope: 'workspace' | 'focused' | 'laboratory';
  verification: 'required' | 'selective' | 'manual';
  toolSelection: 'full' | 'minimal' | 'custom';
}

export interface RuntimePolicy {
  mode: WorkMode;
  policyVersion: string;
  isExperimental?: boolean;
  label: string;
  badge: string;
  tag: string;
  color: string;
  desc: string;
  allowedItems: string[];
  forbiddenItems: string[];
  suitableFor: string;
  capabilities: RuntimeCapabilityMatrix;
  execution: RuntimeExecutionSpec;
  approval: {
    writeFile: 'never' | 'risk_based' | 'always';
    runCommand: 'never' | 'risk_based' | 'always';
    network: 'never' | 'risk_based' | 'always';
  };
}

export const RUNTIME_POLICIES: Record<WorkMode, RuntimePolicy> = {
  act: {
    mode: 'act',
    policyVersion: 'v1.5',
    isExperimental: false,
    label: 'Act 落地执行',
    badge: '生产可用',
    tag: '生产落地',
    color: 'var(--accent)',
    desc: '允许读取工程、修改代码、执行命令与测试自愈，闭环验证目标。',
    allowedItems: ['读取文件与搜索', 'AST 结构化分析', '写入工作区业务代码', '执行终端命令与测试套件'],
    forbiddenItems: ['未经授权的高危破坏性指令 (如 rm -rf, 清空工作区)'],
    suitableFor: '日常代码开发、Bug 修复、特性实现与单元测试补全',
    capabilities: {
      readFiles: true,
      searchFiles: true,
      inspectAst: true,
      writeFiles: true,
      runCommands: true,
      runTests: true,
      gitOperations: true,
      networkAccess: false,
      mcpAccess: true
    },
    execution: {
      responseStyle: 'full',
      contextScope: 'workspace',
      verification: 'required',
      toolSelection: 'full'
    },
    approval: {
      writeFile: 'risk_based',
      runCommand: 'risk_based',
      network: 'always'
    }
  },
  plan: {
    mode: 'plan',
    policyVersion: 'v1.5',
    isExperimental: false,
    label: 'Plan 架构推演',
    badge: '生产可用',
    tag: '只读设计',
    color: '#9333EA',
    desc: '只读分析工程影响面与依赖关系，生成结构化 TaskPlan 计划，严禁写盘与命令。',
    allowedItems: ['读取工程文件', '检索符号与依赖', 'AST 骨架分析', '生成结构化 TaskPlan 计划'],
    forbiddenItems: ['写入业务代码文件 (宿主强制拦截)', '执行终端 Shell 命令 (宿主强制拦截)', '修改 Git 历史'],
    suitableFor: '复杂需求澄清、技术方案评审、跨模块重构影响面分析',
    capabilities: {
      readFiles: true,
      searchFiles: true,
      inspectAst: true,
      writeFiles: false,
      runCommands: false,
      runTests: false,
      gitOperations: false,
      networkAccess: false,
      mcpAccess: false
    },
    execution: {
      responseStyle: 'full',
      contextScope: 'workspace',
      verification: 'manual',
      toolSelection: 'minimal'
    },
    approval: {
      writeFile: 'never',
      runCommand: 'never',
      network: 'never'
    }
  },
  minimal: {
    mode: 'minimal',
    policyVersion: 'v1.5',
    isExperimental: true,
    label: 'Minimal 低噪极简',
    badge: '实验预览',
    tag: '低噪执行',
    color: '#10B981',
    desc: '聚焦用户提及目标文件，大幅降低中间冗余转轮与输出噪声，仍执行必要验证。',
    allowedItems: ['读取目标关联文件', '修改目标指定文件', '执行相关测试套件', '输出简明关键结果'],
    forbiddenItems: ['全量工程盲目扫描', '冗余思考长篇废话', '未经确认的高危命令'],
    suitableFor: '明确单文件小修小改、简单函数优化、快速验证',
    capabilities: {
      readFiles: true,
      searchFiles: false,
      inspectAst: true,
      writeFiles: true,
      runCommands: true,
      runTests: true,
      gitOperations: false,
      networkAccess: false,
      mcpAccess: false
    },
    execution: {
      responseStyle: 'concise',
      contextScope: 'focused',
      verification: 'selective',
      toolSelection: 'minimal'
    },
    approval: {
      writeFile: 'risk_based',
      runCommand: 'risk_based',
      network: 'never'
    }
  },
  creator: {
    mode: 'creator',
    policyVersion: 'v1.5',
    isExperimental: true,
    label: 'Creator 实验室',
    badge: '实验预览',
    tag: '生态实验室',
    color: '#2563EB',
    desc: 'Prompt、Rule 规则与 MCP 工具独立调试实验室，与正式业务工程物理隔离。',
    allowedItems: ['编辑与预览 System Prompt', '编写与测试 Rule 规则', '调试 MCP 工具与技能', '写入 .codemind/lab 隔离区'],
    forbiddenItems: ['直接修改正式业务代码', '执行任意未隔离终端命令'],
    suitableFor: '定制专属智能体技能、微调提示词策略、验证 MCP 工具链',
    capabilities: {
      readFiles: true,
      searchFiles: false,
      inspectAst: false,
      writeFiles: false,
      runCommands: false,
      runTests: false,
      gitOperations: false,
      networkAccess: false,
      mcpAccess: true
    },
    execution: {
      responseStyle: 'laboratory',
      contextScope: 'laboratory',
      verification: 'manual',
      toolSelection: 'custom'
    },
    approval: {
      writeFile: 'always',
      runCommand: 'always',
      network: 'always'
    }
  }
};

export function getRuntimePolicy(mode: WorkMode): RuntimePolicy {
  return RUNTIME_POLICIES[mode] || RUNTIME_POLICIES.act;
}
