# WP-B · UI 接线专项设计文档（B4–B8：ExecutionModeCapsule + StageGateCard + App 门禁挂起）

> 日期：2026-08-31
> 状态：已批准（用户确认「批准并开始」）
> 前置：`docs/superpowers/specs/2026-08-31-wp-b-stage-gate-mode-convergence-design.md`（模块五+模块一整体设计）
> 范围：本专项仅完成 UI 接线（B4–B8），纯逻辑层（B1–B3/B6）已入库。
> 关联铁律：铁律 0（docs/prototype 双向同步）、铁律 1（SDD+TDD）、铁律 1.5（打包+安装+真实桌面调用闭环）、铁律 2（暖色极简视觉）。

---

## 1. 目标

1. 对话栏顶部 Ribbon 的 `Harness 闭环 | Swarm 协同` 双态切换 → 替换为 `ExecutionModeCapsule`（`⚡ Agent Loop` / `🧩 Graph 动态编排 ⌄`），支持 `Alt+1` / `Alt+2` 快捷键。
2. 移除对话框独立工作流胶囊（冗余按钮），工作流选择并入 Graph 浮层；Graph 未选模板 → 动态图谱规划（Dynamic DAG Planner prompt 注入）。
3. Agent Loop 每轮结束后按 `shouldSuspendForGate` 判定挂起：弹出 `StageGateCard` 方案终审卡（批准/提意见/终止），未经批准绝不进入写码阶段；挂起期间输入框切换「输入修改意见」模式。
4. 全量 SDD+TDD 与铁律 1.5 闭环。

## 2. 非目标（Out of Scope）

- WP-C（会话并发）、WP-D（缓存接线）、WP-E（真并发 Swarm）本期不做。
- SwarmWorkbenchModal 与 SwarmSubagentContainer 保留不动（WP-E 将 Swarm 内化为 graph 工作流模板）。
- 不改变 agentLoop 收敛判定（WP-A 已定：golden invariants）。

## 3. 契约与纯函数（SDD）

### 3.1 `executionMode.ts` 新增
```typescript
// Alt+1 → 'act'，Alt+2 → 'graph'，其余返回 null（不改动当前模式）
export function executionModeFromShortcut(key: string, current: ExecutionMode): ExecutionMode | null;

// 基于 resolveExecutionPolicy 生成系统提示片段（替代 App.tsx 关键字式 modePromptSnippet）
export function buildModePromptSnippet(
  mode: ExecutionMode,
  workflowId?: string,
  workflow?: WorkflowLike
): string;
```

### 3.2 `stageGate.ts` 新增
```typescript
// 由工作流块 + 本轮产出组装 StageGateEvent 输入；非门禁块返回 null
export function createGateSuspensionFromBlock(
  block: { id?: string; name: string; gate?: { mode: 'approval' | 'none' }; requireUserReview?: boolean },
  round: { summary: string; taskBreakdown: string[]; specPath?: string },
  loopCount: number
): GateSuspension | null;
```

### 3.3 组件契约
- `ExecutionModeCapsuleProps { mode; activeWorkflow: ModularWorkflow; workflows: ModularWorkflow[]; onModeChange(m); onSelectWorkflow(wf); }`
- `StageGateCardProps { gate: StageGateEvent; onDecision(decision: StageGateDecision); onOpenSpec?(path); }`

## 4. 行为规格

### 4.1 ExecutionModeCapsule
- 双态胶囊：`[ ⚡ Agent Loop ]` / `[ 🧩 Graph 动态编排 ⌄ ]`；act 高亮绿/蓝，graph 高亮陶土橙（`#D96B27`）。
- Graph 态点击展开浮层：顶部「🛰 动态图谱规划（自动）」+ 工作流模板列表（`loadSavedWorkflows()`）+「🧩 积木拼装工作台」入口（dispatch `tcode_open_settings_tab` → workflows）。
- 选中模板后胶囊显示 `{icon} {name} ({blocks.length} 阶段)`。
- `Alt+1` / `Alt+2` 全局快捷键（App 级 keydown，经 `executionModeFromShortcut`），切换后 `saveExecutionModeToStorage` 持久化并广播 `tcode_execution_mode_updated`。

### 4.2 ChatColumn 改造
- 删除 Ribbon 的 Harness/Swarm 切换（含 `handlePipelineModeSelect`、`handleStartSwarm`、`swarmGoal`、`activeRunId`、`swarmStages` 等旧 UI 状态）；删除独立工作流胶囊。
- `pipelineMode` 相关 `tcode_pipeline_mode_updated` 监听移除；消息渲染中 `pipelineMode === 'swarm'` 分支改为按 `executionMode === 'graph'` 或保留 auditTag 判断（旧消息兼容）。
- 门禁挂起期间：
  - 输入框上方显示横幅 `⛔ 流程已挂起：方案终审中`；
  - 点击终审卡「💬 提修改意见」→ 输入框切换「输入修改意见」模式（placeholder、send=提交意见 → `onGateFeedback`），正常发送被拦截；
  - 批准/终止 → 退出反馈模式。

### 4.3 App.tsx 接线
- 新增 `executionMode` state（`loadSavedExecutionMode()` 初始化），监听 `tcode_execution_mode_updated`；磁盘恢复（`diskPipelineMode`）时写新键并广播。
- `Alt+1/Alt+2` keydown → `executionModeFromShortcut` → 更新模式。
- `modePromptSnippet` 由关键字式替换为 `buildModePromptSnippet(executionMode, activeWorkflowId, activeWorkflow)`；`auditTag` 改为 `⚡ Agent Loop · 极速执行` / `🧩 Graph 编排 · {workflow.name}`。
- 门禁挂起（循环内每轮 `finalContent` 产出后）：
  1. `shouldSuspendForGate(currentBlock, true)` 为真 → `createGateSuspensionFromBlock` → `setActiveGate(suspension)`；
  2. `await gateDecisionPromise`（由 `onGateDecision` resolve）；
  3. `resolveGateDecision(decision)`：
     - `proceed` → 继续循环；
     - `revise` → 推入用户意见 feedback 消息，继续循环；
     - `terminate` → `currentLoopStatus='blocked'`，退出循环（不写码）。
  - `isStreaming` 挂起期间保持 true；停止按钮在挂起时等价于「终止」。

## 5. 测试（B8，TDD Red→Green）

| 测试文件 | 用例 |
|---|---|
| `tests/executionMode.test.ts` | `executionModeFromShortcut`：Alt+1→act / Alt+2→graph / 其他→null / 保持当前模式；`buildModePromptSnippet`：act 含 Agent Loop / graph+workflow 含工作流名 / graph+动态 含「任务图谱」 |
| `tests/stageGate.test.ts` | `createGateSuspensionFromBlock`：门禁块→active suspension（含 specPath、taskBreakdown）；非门禁块→null；空 taskBreakdown 边界 |
| 全量回归 | `vitest run`、`tsc -b`、`vite build`、`eslint` |

## 6. 验收（铁律 1.5）

1. `python build_installer.py` → `dist/Tcode-Setup.exe` + `release/Tcode-Setup-v1.5.0.exe`；
2. 静默安装至独立目录 → 启动 `Tcode.exe`；
3. `GET http://127.0.0.1:8010/health` → 200；`GET http://127.0.0.1:8010/` → 完整 HTML；
4. 真实模型调用（`/api/proxy` 上游真实响应）：需 `TCODE_TEST_API_KEY`，未配置则 fail-closed 明确提示，不静默 fallback；
5. 手动验收：Alt+1/2 切换胶囊；Graph 未选模板 → 动态轨道；SDD 工作流 → spec 产出后门禁挂起 → 未批准不写码。
