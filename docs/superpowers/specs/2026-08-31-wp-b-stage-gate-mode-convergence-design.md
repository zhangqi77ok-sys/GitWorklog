# WP-B · Stage Gate 质量门禁（模块五）+ 顶层模式收敛（模块一）设计文档

> 日期：2026-08-31
> 状态：已确认（源自 TCODE-ENG-SPEC-2026-08 模块五+模块一；用户已批准 WP-B/C/D/E 分析计划）
> 关联铁律：铁律 1（SDD+TDD）、铁律 1.5（打包+安装+真实桌面调用闭环）

---

## 1. 背景与问题（实测证据）

- **模块一**：顶部/对话栏存在 `Harness 闭环 | Swarm 协同` 切换（`ChatColumn.tsx` 头部按钮 + `SwarmPipelineBar`），属底层拓扑实现术语，用户心智分裂；对话框工具栏存在多余工作流按钮，未与积木工作流完全闭环。
- **模块五**：系统只在单个危险写文件时弹确认（`ActionApprovalModal`），缺少**阶段结束时的显式流程挂起**——方案分析完可能直接擅自写代码，无"方案终审卡 + 快照持久化"。

## 2. 目标与非目标

### 2.1 目标
1. 前台统一为两种用户意图模式：`⚡ Agent Loop（极速执行）` 与 `🧩 Graph 编排（阶段图谱）`；移除顶部 Harness/Swarm 切换。
2. Graph 未选模板时自动进入"动态图谱规划"（Dynamic DAG Planning），不强加死板模板。
3. 工作流阶段结束处实现 Stage Gate：弹出方案终审卡（批准/提意见/终止），未经批准绝不进入写码阶段；挂起期间输入框切换"输入修改意见"模式；快照持久化。
4. 全量通过 SDD+TDD 与铁律 1.5。

### 2.2 非目标
- 模块二/四已由 WP-A 完成；模块三/六/七后续。
- 真并发 Swarm（模块六）独立专项；本 WP 只做模式收敛，Swarm 内化为 graph 工作流模板（衔接 WP-E）。
- 不改变 agentLoop 收敛判定（WP-A 已定）。

## 3. 总体架构

```text
prototype/src/
├── services/
│   ├── executionMode.ts     # 新增：ExecutionMode 契约 + resolveExecutionPolicy + 旧 pipelineMode 迁移
│   ├── stageGate.ts         # 新增：StageGateEvent 契约 + shouldSuspendForGate + 挂起状态机
│   └── workflowStore.ts     # 修改：LegoBlock 增加 gate 配置（可选）
├── components/
│   ├── ExecutionModeCapsule.tsx  # 新增：双态胶囊 + Graph 浮层
│   ├── StageGateCard.tsx         # 新增：方案终审卡
│   └── ChatColumn.tsx            # 修改：移除 Harness/Swarm 切换，接入胶囊与门禁卡
├── App.tsx                  # 修改：executionMode 状态、动态 DAG 指令注入、门禁挂起接线
tests/
├── executionMode.test.ts    # 新增
└── stageGate.test.ts        # 新增
```

## 4. 详细设计

### 4.1 模块一：模式收敛

**契约（executionMode.ts）**
```typescript
export type ExecutionMode = 'act' | 'graph';

export interface ExecutionModeConfig {
  mode: ExecutionMode;
  activeWorkflowId?: string;   // 仅 mode === 'graph' 时生效；缺省 = 动态编排
}

export interface ExecutionPolicy {
  dagType: '1-node-micro-loop' | 'n-node-workflow';
  systemPromptDirectives: string;
  allowedToolSet: string[];
  enableStageGate: boolean;
  workflow?: unknown;
}
```

**纯函数**
```typescript
export function resolveExecutionPolicy(mode: ExecutionMode, workflowId?: string, workflow?: { name: string; blocks: unknown[] }): ExecutionPolicy
// act → { dagType:'1-node-micro-loop', enableStageGate:false, allowedToolSet: 默认 act 集, directives: '【Agent Loop 自主闭环模式】...' }
// graph + workflow → { dagType:'n-node-workflow', enableStageGate:true, allowedToolSet: 首块 allowedTools, directives: getWorkflowPromptDirectives(workflow, 0) }
// graph + 无 workflow → { dagType:'n-node-workflow', enableStageGate:true, allowedToolSet: 探查只读集, directives: '【Graph 动态编排模式】...' }
```

**迁移**
- `PipelineMode 'harness' → ExecutionMode 'act'`；`'swarm' → 'graph'`（关联默认 swarm 工作流模板，衔接 WP-E）。
- 保留旧存储键 `tcode_pipeline_mode` 读取兼容；写入新键 `tcode_execution_mode`。

**UI（ExecutionModeCapsule）**
- 对话输入框左侧双态胶囊：`[ ⚡ Agent Loop ]`（绿/蓝高亮）/ `[ 🧩 Graph 动态编排 ⌄ ]`（橙高亮，选中模板时显示 `[ 📐 SDD · 4 阶段 ⌄ ]`）。
- 快捷键：`Alt+1` → act；`Alt+2` → graph。
- 移除 ChatColumn 头部 Harness/Swarm 按钮与 `SwarmPipelineBar` 顶层切换（SwarmPipelineBar 组件保留供 graph 工作流内部渲染）。

**Graph 动态编排**
- mode=graph 且未选模板：System Prompt 注入动态 DAG 指令（"先输出结构化任务图谱 Task Plan/DAG，对关键设计门禁确认，分步执行并测试自愈"）；对话流直出【动态执行轨道】渲染（复用 TaskGraphScheduler 的 DAG 视图）。

### 4.2 模块五：Stage Gate

**契约（stageGate.ts）**
```typescript
export interface StageGateDecision { approved: boolean; feedback?: string }

export interface StageGateEvent {
  gateId: string;
  stageName: string;
  specPath?: string;
  summary: string;
  taskBreakdown: string[];
  resolve: (decision: StageGateDecision) => void;
}

export interface GateSuspension {
  active: boolean;
  gate?: StageGateEvent;
  sourceRunId?: string;
}
```

**纯函数**
```typescript
export function shouldSuspendForGate(block: { gate?: { mode: 'approval' | 'none' } }, stageCompleted: boolean): boolean
// block.gate?.mode === 'approval' && stageCompleted → true
```

**挂起状态机**
```text
Phase_N → (阶段完成) → shouldSuspendForGate=true → Awaiting_Approval
  → 批准 → Phase_{N+1}（带方案继续）
  → 提意见 → 回到 Phase_N（带反馈重新推演）
  → 终止 → 结束任务
```

**LegoBlock 扩展**
```typescript
export interface LegoBlock {
  // ...现有字段
  gate?: { mode: 'approval' | 'none'; reason?: string };
}
```
SDD 工作流的 spec 产出块（Phase 2）默认 `gate.mode='approval'`。

**UI（StageGateCard）**
- 对话流最底部直出高亮卡片：`[ ✓ 确认方案并放行编码 ]`（主）/ `[ ✍️ 提出修改意见 ]`（次）/ 终止。
- 挂起期间输入框切换为"输入修改意见"模式。
- 批准时持久化快照（复用 git checkpoint）。

**App.tsx 接线**
- 循环中：当前块阶段完成后 `shouldSuspendForGate(currentBlock, stageCompleted)` → 创建 GateSuspension → 等待用户决策（挂起循环）→ 按决策继续/重推/终止。

## 5. 测试计划（SDD+TDD）

### 5.1 `tests/executionMode.test.ts`
| 用例 | 断言 |
|---|---|
| resolveExecutionPolicy act | 1-node-micro-loop、enableStageGate=false、act 工具集 |
| resolveExecutionPolicy graph+workflow | n-node-workflow、enableStageGate=true、首块 allowedTools、workflow 指令 |
| resolveExecutionPolicy graph 未选模板 | 动态编排指令含"任务图谱/DAG"、只读工具集 |
| 迁移 harness→act / swarm→graph | 旧键兼容读取、新键写入 |

### 5.2 `tests/stageGate.test.ts`
| 用例 | 断言 |
|---|---|
| shouldSuspendForGate approval+完成 | true |
| shouldSuspendForGate none/未完成 | false |
| 挂起状态机 | 批准→放行；提意见→回到当前阶段；终止→结束 |
| 旧数据 | 无 gate 配置的 block 默认不挂起 |

### 5.3 回归与铁律 1.5
- 全量 Vitest（现 310 + 新增）、Python 49、lint 0 errors。
- 一键 `run_acceptance.py` 13/13。
- 真实桌面：切 Graph 未选模板 → 动态轨道出现；SDD 工作流 spec 产出 → 门禁挂起 → 未批准不写码；Alt+1/2 快捷键生效。

## 6. 验收标准（Done Definition）
- [ ] 顶部 Harness/Swarm 切换移除；双态胶囊 + Alt+1/2 生效。
- [ ] Graph 未选模板自动动态编排（动态轨道渲染）。
- [ ] SDD 工作流 spec 产出后门禁挂起，弹终审卡；未批准绝不进入写码；提意见带回退重推；快照持久化。
- [ ] executionMode/stageGate 纯函数测试全绿；全量回归 + 一键闭环通过。
- [ ] 全部提交并推送，工作区干净。

## 7. 范围外（后续 WP）
- WP-C（会话并发）/ WP-D（缓存接线）/ WP-E（真并发 Swarm）。
- 真 Tree-sitter RepoMap。
