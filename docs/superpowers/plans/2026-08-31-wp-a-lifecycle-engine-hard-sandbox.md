# WP-A · 生命周期引擎（三大黄金不变量）+ 硬沙箱实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Agent Loop 收敛判定为"零工具调用=自然终结"的三大黄金不变量（闲聊单轮退出、验收不脑补），并为工作流阶段引入 allowedTools 白名单双层硬沙箱（协议过滤 + 运行时 403 结构化反馈）。

**Architecture:** 全部核心逻辑做成 agentLoop.ts 内的纯函数（shouldContinueLoop / resolveAllowedTools / filterToolDefs / executeSandboxAction），App.tsx 仅做外科式接线（替换 1588 自动续轮条件、executeActionOnHost 接硬校验、请求 tools 过滤）；验收清单删除关键词脑补，仅保留显式声明来源。

**Tech Stack:** TypeScript/React 19 + Vitest；沿用现有 agentLoop/contracts 契约；Python 宿主不变（本 WP 无宿主改动）。

## Global Constraints

- 前端测试命令：`node <npm-cli.js> test`（npm.ps1 被执行策略拦截，禁止裸 `npm`）。
- Python 测试用 `$VPY = E:\pro\agent-learning\.venv\Scripts\python.exe`（本 WP 无 Python 改动，仅回归）。
- 凭据纪律：源码/测试不得出现 `sk-[A-Za-z0-9_-]{16,}` 字面量；假凭据统一 `fake-api-key-0123456789abcdef`。
- lint 门禁：`eslint . --max-warnings=500`（0 errors）。
- 每个任务完成必须跑绿对应测试并 `git commit`；全部完成后按铁律 1.5 走 `scripts/run_acceptance.py` 一键闭环。
- 协议级工具解析（XML/fenced/tool-call）保持现状；只改收敛判定与验收来源，不改 parseAgentActions 协议解析。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `prototype/src/services/agentLoop.ts` | 修改 | 新增 `shouldContinueLoop`/`resolveAllowedTools`/`filterToolDefs`/`executeSandboxAction`；删除关键词脑补验收 |
| `prototype/src/App.tsx` | 修改 | 1588 续轮条件改用 `shouldContinueLoop`；`executeActionOnHost` 接 `executeSandboxAction`；请求 tools 经 `filterToolDefs` |
| `prototype/tests/loopConvergence.test.ts` | 新增 | 黄金不变量 1/2/3 测试 |
| `prototype/tests/sandboxPolicy.test.ts` | 新增 | 硬沙箱测试 |

---

### Task 1: `shouldContinueLoop` 纯函数（黄金不变量 1 + 2）

**Files:**
- Modify: `prototype/src/services/agentLoop.ts`
- Test: `prototype/tests/loopConvergence.test.ts`（新建，本任务先写收敛用例）

**Interfaces:**
- Consumes: `AgentAction`、`TargetAcceptanceItem`（agentLoop 已有）
- Produces:
  - `interface LoopContinueVerdict { continue: boolean; reason: 'natural_completion' | 'tool_driven' | 'max_turns' }`
  - `shouldContinueLoop(params: { actions: AgentAction[]; acceptanceItems: TargetAcceptanceItem[]; loopCount: number; maxTurns?: number }) => LoopContinueVerdict`

- [ ] **Step 1: 写失败测试**

创建 `prototype/tests/loopConvergence.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { shouldContinueLoop } from '../src/services/agentLoop';
import type { AgentAction, TargetAcceptanceItem } from '../src/services/agentLoop';

const noActions: AgentAction[] = [];
const oneAction: AgentAction[] = [
  { id: 'a1', type: 'read_file', target: 'src/Login.tsx' } as unknown as AgentAction
];

describe('golden invariant 1 & 2 - loop convergence', () => {
  it('zero tool calls -> natural completion (chitchat single round)', () => {
    const v = shouldContinueLoop({ actions: noActions, acceptanceItems: [], loopCount: 1 });
    expect(v).toEqual({ continue: false, reason: 'natural_completion' });
  });

  it('tool calls -> tool-driven continuation', () => {
    const v = shouldContinueLoop({ actions: oneAction, acceptanceItems: [], loopCount: 1 });
    expect(v).toEqual({ continue: true, reason: 'tool_driven' });
  });

  it('acceptance items never force continuation (golden invariant 1)', () => {
    const fake = [{ id: 't1', description: '实现并验证: x', status: 'failed' } as unknown as TargetAcceptanceItem];
    const v = shouldContinueLoop({ actions: noActions, acceptanceItems: fake, loopCount: 1 });
    expect(v.reason).toBe('natural_completion');
  });

  it('max turns circuit breaker', () => {
    const v = shouldContinueLoop({ actions: oneAction, acceptanceItems: [], loopCount: 8, maxTurns: 8 });
    expect(v).toEqual({ continue: false, reason: 'max_turns' });
  });
});
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$node = (Get-Command node).Source
$npmCli = Join-Path (Split-Path $node) "node_modules\npm\bin\npm-cli.js"
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/loopConvergence.test.ts
Pop-Location
```

Expected: `shouldContinueLoop is not a function`（collection error 或 4 用例失败）。

- [ ] **Step 3: 最小实现**

在 `prototype/src/services/agentLoop.ts`（`resolveNoActionLoopStatus` 附近）新增：

```typescript
export interface LoopContinueVerdict {
  continue: boolean;
  reason: 'natural_completion' | 'tool_driven' | 'max_turns';
}

/**
 * Golden Invariant 1 & 2: loop continues ONLY when this round produced tool
 * calls. Zero tool calls = natural completion. acceptanceItems NEVER drive
 * continuation (anti-fabrication). maxTurns is the hard circuit breaker.
 */
export function shouldContinueLoop(params: {
  actions: AgentAction[];
  acceptanceItems: TargetAcceptanceItem[];
  loopCount: number;
  maxTurns?: number;
}): LoopContinueVerdict {
  const maxTurns = params.maxTurns ?? 8;
  if (params.loopCount >= maxTurns) return { continue: false, reason: 'max_turns' };
  if (!params.actions || params.actions.length === 0) {
    return { continue: false, reason: 'natural_completion' };
  }
  return { continue: true, reason: 'tool_driven' };
}
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/loopConvergence.test.ts
Pop-Location
```

Expected: 4 passed。

- [ ] **Step 5: 提交**

```powershell
git add prototype/src/services/agentLoop.ts prototype/tests/loopConvergence.test.ts
git commit -m "feat(loop): golden invariants 1+2 - shouldContinueLoop pure predicate (zero tools = natural completion)"
```

---

### Task 2: 验收清单唯一来源（黄金不变量 3）——删除关键词脑补

**Files:**
- Modify: `prototype/src/services/agentLoop.ts`（约 1091 行关键词自动标记块）
- Test: `prototype/tests/loopConvergence.test.ts`（追加用例）

**Interfaces:**
- Consumes: 无
- Produces: 删除 `/写入|修改|实现|修复/` 自动标记；验收项仅来自 `parseAcceptanceCriteria`（显式 `- [ ]`）与工作流 spec

- [ ] **Step 1: 追加失败测试**

在 `prototype/tests/loopConvergence.test.ts` 追加：

```typescript
import { verifyTargetAcceptance } from '../src/services/agentLoop';

describe('golden invariant 3 - acceptance items are explicit only', () => {
  it('keyword in description alone never auto-passes an item', () => {
    const items = [
      { id: 't1', description: '重构 Store 并写测试', status: 'failed', criteria: 'pass' }
    ] as unknown as TargetAcceptanceItem[];
    // A write happened to an unrelated file (no explicit target match)
    const actions = [{ id: 'a1', type: 'write_file', target: 'other.ts' }] as unknown as AgentAction[];
    const results = [
      { id: 'r1', actionId: 'a1', type: 'write_file', target: 'other.ts', status: 'success' }
    ] as unknown as Array<{ id: string; actionId: string; type: string; target: string; status: string }>;
    const updated = verifyTargetAcceptance(items, actions, results as never, []);
    expect(updated.items[0].status).toBe('failed');
  });

  it('explicit target match still associates evidence and passes', () => {
    const items = [
      { id: 't1', description: '改造 src/Store.ts', status: 'failed', criteria: 'pass' }
    ] as unknown as TargetAcceptanceItem[];
    const actions = [{ id: 'a1', type: 'write_file', target: 'src/Store.ts' }] as unknown as AgentAction[];
    const results = [
      { id: 'r1', actionId: 'a1', type: 'write_file', target: 'src/Store.ts', status: 'success' }
    ] as unknown as Array<{ id: string; actionId: string; type: string; target: string; status: string }>;
    const updated = verifyTargetAcceptance(items, actions, results as never, []);
    expect(updated.items[0].status).toBe('passed');
  });
});
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/loopConvergence.test.ts
Pop-Location
```

Expected: `keyword in description alone never auto-passes` 失败（当前 `/写入|修改|实现|修复/` 会把它标为 passed）。

- [ ] **Step 3: 最小实现**

在 `prototype/src/services/agentLoop.ts` 中定位以下结构（约 1091 行，在写盘结果证据链处理块内）：

```typescript
if (item.description.includes(wr.target) || /写入|修改|实现|修复/i.test(item.description)) {
```

改为仅保留显式目标匹配：

```typescript
if (item.description.includes(wr.target)) {
```

删除正则分支。同时检查 `parseAcceptanceCriteria` 仍是验收项唯一来源（保留）。

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/loopConvergence.test.ts
Pop-Location
```

Expected: 6 passed（4 + 2）。

- [ ] **Step 5: 提交**

```powershell
git add prototype/src/services/agentLoop.ts prototype/tests/loopConvergence.test.ts
git commit -m "feat(loop): golden invariant 3 - acceptance items from explicit declaration only, remove keyword auto-marking"
```

---

### Task 3: `resolveAllowedTools` + `filterToolDefs`（协议层过滤）

**Files:**
- Modify: `prototype/src/services/agentLoop.ts`
- Test: `prototype/tests/sandboxPolicy.test.ts`（新建）

**Interfaces:**
- Consumes: `AgentAction`、`ActionResult`（contracts）
- Produces:
  - `resolveAllowedTools(workflowBlock?: { allowedTools?: string[] }, mode?: string): string[]`
  - `filterToolDefs(tools: Array<{ name?: string; type?: string }>, allowedTools: string[]): Array<{ name?: string; type?: string }>`

- [ ] **Step 1: 写失败测试**

创建 `prototype/tests/sandboxPolicy.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { resolveAllowedTools, filterToolDefs } from '../src/services/agentLoop';

describe('hard tool sandbox - protocol layer', () => {
  it('resolveAllowedTools prefers workflow block whitelist', () => {
    expect(resolveAllowedTools({ allowedTools: ['read_file'] }, 'act')).toEqual(['read_file']);
    expect(resolveAllowedTools(undefined, 'plan')).toEqual(['read_file', 'grep_search', 'find_by_name']);
    expect(resolveAllowedTools(undefined, 'act')).toContain('write_file');
  });

  it('filterToolDefs trims tools array to whitelist', () => {
    const tools = [
      { name: 'read_file' },
      { name: 'write_file' },
      { name: 'run_command' }
    ];
    const kept = filterToolDefs(tools, ['read_file', 'run_command']);
    expect(kept.map(t => t.name)).toEqual(['read_file', 'run_command']);
  });
});
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/sandboxPolicy.test.ts
Pop-Location
```

Expected: `resolveAllowedTools is not a function`。

- [ ] **Step 3: 最小实现**

在 `prototype/src/services/agentLoop.ts` 新增：

```typescript
export function resolveAllowedTools(workflowBlock?: { allowedTools?: string[] }, mode?: string): string[] {
  if (workflowBlock?.allowedTools && workflowBlock.allowedTools.length > 0) {
    return workflowBlock.allowedTools;
  }
  switch (mode) {
    case 'plan':
      return ['read_file', 'grep_search', 'find_by_name'];
    case 'act':
    default:
      return ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];
  }
}

export function filterToolDefs(
  tools: Array<{ name?: string; type?: string }>,
  allowedTools: string[]
): Array<{ name?: string; type?: string }> {
  return (tools || []).filter(t => allowedTools.includes(t.name || '') || allowedTools.includes(t.type || ''));
}
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/sandboxPolicy.test.ts
Pop-Location
```

Expected: 2 passed。

- [ ] **Step 5: 提交**

```powershell
git add prototype/src/services/agentLoop.ts prototype/tests/sandboxPolicy.test.ts
git commit -m "feat(sandbox): resolveAllowedTools + filterToolDefs protocol-layer whitelist (WP-A module 4)"
```

---

### Task 4: `executeSandboxAction`（运行时硬校验，403 结构化反馈）

**Files:**
- Modify: `prototype/src/services/agentLoop.ts`
- Test: `prototype/tests/sandboxPolicy.test.ts`（追加）

**Interfaces:**
- Consumes: `AgentAction`、`ActionResult`、`hostExecutor: (a: AgentAction) => Promise<ActionResult>`
- Produces: `executeSandboxAction(action: AgentAction, allowedTools: string[], executeHost: (a: AgentAction) => Promise<ActionResult>): Promise<ActionResult>`

- [ ] **Step 1: 追加失败测试**

在 `prototype/tests/sandboxPolicy.test.ts` 追加：

```typescript
import { executeSandboxAction } from '../src/services/agentLoop';
import type { AgentAction, ActionResult } from '../src/types/contracts';

describe('hard tool sandbox - runtime enforcement', () => {
  const host = async (): Promise<ActionResult> => ({ status: 'success' } as ActionResult);

  it('rejects out-of-scope tool with structured 403 without throwing', async () => {
    const action = { id: 'a1', type: 'write_file', target: 'x.ts' } as unknown as AgentAction;
    const res = await executeSandboxAction(action, ['read_file'], host);
    expect(res.status).toBe('rejected');
    expect(res.error).toBe('PERMISSION_RESTRICTED');
    expect(String(res.output)).toContain('403');
    expect(String(res.output)).toContain('write_file');
  });

  it('passes allowed tool through to host executor', async () => {
    const action = { id: 'a1', type: 'read_file', target: 'x.ts' } as unknown as AgentAction;
    const res = await executeSandboxAction(action, ['read_file'], host);
    expect(res.status).toBe('success');
  });
});
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/sandboxPolicy.test.ts
Pop-Location
```

Expected: `executeSandboxAction is not a function`。

- [ ] **Step 3: 最小实现**

在 `prototype/src/services/agentLoop.ts` 新增：

```typescript
export async function executeSandboxAction(
  action: AgentAction,
  allowedTools: string[],
  executeHost: (a: AgentAction) => Promise<ActionResult>
): Promise<ActionResult> {
  if (!allowedTools.includes(action.type)) {
    return {
      actionId: action.id,
      type: action.type,
      target: action.target,
      status: 'rejected',
      output: `【权限安全保护 403】: 当前工作流阶段受安全策略约束，仅允许使用 [${allowedTools.join(', ')}]，已拦截未经授权的 [${action.type}] 动作。请先完成当前阶段要求！`,
      error: 'PERMISSION_RESTRICTED'
    };
  }
  return executeHost(action);
}
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/sandboxPolicy.test.ts
Pop-Location
```

Expected: 4 passed。

- [ ] **Step 5: 提交**

```powershell
git add prototype/src/services/agentLoop.ts prototype/tests/sandboxPolicy.test.ts
git commit -m "feat(sandbox): executeSandboxAction runtime hard check with structured 403 feedback (no throw)"
```

---

### Task 5: App.tsx 外科式接线（循环收敛 + 硬沙箱）

**Files:**
- Modify: `prototype/src/App.tsx`

**Interfaces:**
- Consumes: `shouldContinueLoop`、`executeSandboxAction`、`filterToolDefs`、`resolveAllowedTools`
- Produces: 无新导出（行为变更）

- [ ] **Step 1: 替换自动续轮条件**

定位 `App.tsx` 约 1588 行：

```typescript
if (frozenRunMode === 'act' && hasUnfinishedWork && (hasInspectActions || hasNotWrittenCode) && loopCount <= 4 && !agentLoopCancelledRef.current) {
```

替换为基于 `shouldContinueLoop` 的收敛判定。在每轮流式结束、解析出 `actions` 后：

```typescript
const verdict = shouldContinueLoop({ actions, acceptanceItems, loopCount });
if (!verdict.continue) {
  currentLoopStatus = verdict.reason === 'max_turns' ? 'resource_limit' : 'completed';
  addLog('INFO', 'AgentLoop', `[Loop #${loopCount}] ${verdict.reason === 'natural_completion' ? '模型已给出完整答复，自然收敛（零工具调用）' : '达到最大轮次熔断'}`);
  break;
}
```

删除旧的 `hasUnfinishedWork` 强制续轮分支。保留取消信号与审批挂起逻辑。

- [ ] **Step 2: 硬沙箱接线**

1. 在动作执行处（`executeActionOnHost` 调用点附近）解析当前阶段白名单：

```typescript
const allowedTools = resolveAllowedTools(activeWorkflowBlock, frozenRunMode);
```

2. 将 `executeActionOnHost(action, frozenRunMode)` 调用改为：

```typescript
result = await executeSandboxAction(action, allowedTools, (a) => executeActionOnHost(a, frozenRunMode));
```

3. 在构建 LLM 请求（gateway `req.tools` / `buildGatewayRequestBody` 传入处）前过滤：

```typescript
const filteredTools = filterToolDefs(toolDefs, allowedTools);
```

（`toolDefs` 为现有请求工具定义数组；传入位置以实际调用点为准。）

- [ ] **Step 3: 验证（类型 + 回归 + lint）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli run build
& $node $npmCli test
& $node $npmCli run lint
Pop-Location
```

Expected: tsc 0 error、全量 Vitest 全绿（现 302 + 新增 8 = 310）、lint 0 errors。

- [ ] **Step 4: 提交**

```powershell
git add prototype/src/App.tsx
git commit -m "feat(loop): wire golden-invariant convergence and hard sandbox into App.tsx loop"
```

---

### Task 6: 全量回归 + 铁律 1.5 一键闭环

**Files:**
- Test: 无新增（如 README 需补充说明则一并提交）

- [ ] **Step 1: 前端全量测试 + lint**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test
& $node $npmCli run lint
Pop-Location
```

Expected: 全绿、0 errors。

- [ ] **Step 2: Python 回归（宿主未改，仅确认无回归）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests -q
Pop-Location
```

Expected: 49 passed。

- [ ] **Step 3: 一键闭环**

```powershell
Push-Location E:\pro\agent-learning
& $VPY scripts\run_acceptance.py
Pop-Location
```

Expected: 13 passed / 0 failed（含打包、静默安装+时间戳核对、探活、Token、代理白名单、Air-Gap）。

- [ ] **Step 4: 真实验收（可选，需真实凭据）**

配置 `TCODE_TEST_API_KEY` 后，在真实桌面端发送"你好"：验证**单轮收敛**（0 工具调用即 completed，不触发第 2 轮）；在只读工作流阶段让模型尝试写文件：验证收到 403 结构化反馈并自愈、前端 0 红屏。

- [ ] **Step 5: 提交收尾（如有 README 变更）并推送**

```powershell
git push origin main
```

---

## 验收清单（Done Definition）

- [ ] Task 1：`shouldContinueLoop` 4 项单测绿（闲聊单轮/工具驱动/验收不驱动续轮/maxTurns 熔断）。
- [ ] Task 2：关键词脑补删除；显式目标匹配仍关联证据；验收仅显式来源（2 项单测绿）。
- [ ] Task 3：`resolveAllowedTools`/`filterToolDefs` 2 项单测绿。
- [ ] Task 4：`executeSandboxAction` 越权 403 结构化拒绝（不抛异常）+ 合法放行（2 项单测绿）。
- [ ] Task 5：App.tsx 接线后 tsc 0 error、全量 Vitest 全绿、lint 0 errors。
- [ ] Task 6：一键闭环 13/13；真实桌面"你好"单轮收敛 + 只读阶段越权 403 自愈（有凭据时验证）。
- [ ] 全部提交并推送，工作区干净。
