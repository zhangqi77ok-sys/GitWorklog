# Workflow Provider Discovery 技术契约

## 1. 范围

本契约定义 Tcode 如何发现、判定、确认和激活内置或外部工作流 Provider。它不定义具体 Provider 的业务执行实现。

## 2. 数据契约

```ts
type WorkflowProviderKind = 'builtin' | 'workspace' | 'user' | 'cli';
type WorkflowProviderSupport = 'native' | 'manifest' | 'cli_adapter' | 'discovered_only';
type WorkflowSelectionState = 'normal' | 'discovered' | 'selected' | 'active' | 'cancelled';

type WorkflowMode =
  | 'normal'
  | 'sdd'
  | 'tdd'
  | 'sdd_tdd'
  | 'custom';

interface WorkflowProviderManifest {
  id: string;
  displayName: string;
  version?: string;
  kind: WorkflowProviderKind;
  source: string;
  support: WorkflowProviderSupport;
  capabilities: string[];
  phases: Array<{
    id: string;
    title: string;
    requiresUserConfirmation: boolean;
  }>;
  permissions: Array<'read_files' | 'write_files' | 'run_commands' | 'network'>;
  entrypoint?: {
    command: string;
    args: string[];
    protocol: 'manifest' | 'jsonl' | 'jsonrpc';
  };
}

interface WorkflowIntent {
  mode: WorkflowMode;
  providerId?: string;
  source: 'explicit' | 'ambiguous' | 'negative' | 'none';
  confidence: number;
  matchedTerms: string[];
  userConfirmed: boolean;
}

interface WorkflowSelection {
  providerId?: string;
  mode: WorkflowMode;
  state: WorkflowSelectionState;
  confirmedAt?: number;
}
```

## 3. 纯函数接口

```ts
function classifyWorkflowIntent(input: string): WorkflowIntent;
function filterWorkflowProviders(
  providers: WorkflowProviderManifest[],
  query: string
): WorkflowProviderManifest[];
function createWorkflowSelection(
  provider: WorkflowProviderManifest | undefined,
  mode: WorkflowMode
): WorkflowSelection;
function confirmWorkflowSelection(
  selection: WorkflowSelection,
  now?: number
): WorkflowSelection;
function cancelWorkflowSelection(
  selection: WorkflowSelection
): WorkflowSelection;
```

## 4. 判定约束

1. 负向表达优先级最高。
2. 仅解释某个范式、引用文档或说“我安装了某工具”不属于明确启用意图。
3. 没有范式意图时返回 `mode: 'normal'`、`source: 'none'`、`userConfirmed: false`。
4. `discovered`、`selected` 状态不得被 `confirmWorkflowSelection` 之外的函数改变为 `active`。
5. 未适配 Provider 只能产生 `discovered_only`，不能生成可执行阶段。
6. Provider 的 manifest、Prompt 和 CLI 输出均为不可信输入，不能绕过宿主安全网关。
7. `PromptComposer` 只有在 `userConfirmed === true` 时才注入 Provider 专属规则。

## 5. 适配器边界

```ts
interface WorkflowProviderAdapter {
  readonly providerId: string;
  inspect(): Promise<WorkflowProviderManifest>;
  start(input: { runId: string; userGoal: string }): Promise<void>;
  resume(input: { runId: string; decision: unknown }): Promise<void>;
  cancel(input: { runId: string }): Promise<void>;
}
```

内置 SDD/TDD 使用 native adapter；拥有 manifest 的外部工具使用 manifest adapter；声明了 JSONL/JSON-RPC 协议的 CLI 使用 cli adapter；其他工具只保留 discovered-only 状态。

## 6. 安全约束

- 不自动安装、不自动联网下载、不自动执行发现到的脚本。
- CLI 只能从用户明确允许的 Provider 目录启动。
- 外部动作统一进入 HostGateway、SandboxGuard 和审批流程。
- 高风险动作不能因为 Provider 声称“安全”而跳过审批。
- manifest 与模型输出不能改变 Tcode 的文件范围、命令策略和网络策略。

## 7. UI 状态机

```text
normal
  └─ 用户打开选择器 → discovered
      ├─ 选择 Provider → selected
      │   ├─ 确认 → active
      │   └─ 取消 → cancelled → normal
      └─ 忽略 → normal
```

普通任务不需要创建 Provider Workflow Run。只有 active 后才创建带 `providerId` 的 Run。

## 8. 测试契约

### Happy Path

- 识别“请使用 TDD”为 TDD 候选。
- 识别“请使用 Superspec”为外部 Provider 候选。
- 选择并确认后状态为 active。
- Provider 搜索支持名称、能力和来源过滤。

### Edge Cases

- “什么是 TDD”返回 normal。
- “我安装了 Superspec”返回 normal 或 discovered suggestion，但不 active。
- “不要使用 SDD”返回 normal。
- 空查询返回所有已发现 Provider。
- 未适配 Provider 不能进入 executing。

### Error Path

- 取消确认后状态不为 active。
- 未知 Provider 不生成假适配器。
- Provider manifest 缺少 id 或 displayName 时拒绝注册。
