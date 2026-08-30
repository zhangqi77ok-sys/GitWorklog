# WP-B / WP-C / WP-D / WP-E 工程改造分析与实施计划

> 日期：2026-08-31
> 来源：TCODE-ENG-SPEC-2026-08（模块一/三/五/六/七）+ 代码库现状核实
> 顺序：WP-A（模块二+四，已出设计）→ WP-B（模块五+一）→ WP-C（模块三）→ WP-D（模块七）→ WP-E（模块六）
> 说明：本文档为各 WP 的分析与任务级计划；每个 WP 实施前按 SDD+TDD 细化（Red/Green/Commit）并遵循铁律 1.5 闭环。

---

## WP-B：Stage Gate 质量门禁（模块五）+ 顶层模式收敛（模块一）

### B.1 目标
1. **模块一**：废除顶部 `Harness/Swarm` 切换，前台统一为 `⚡ Agent Loop（极速执行）` 与 `🧩 Graph 编排（阶段图谱）` 两种用户意图模式；未选模板时自动进入"动态图谱规划"。
2. **模块五**：在工作流阶段结束处实现显式流程挂起（Stage Gate），弹出方案终审卡（批准/提意见/终止），未经用户批准绝不写代码；挂起期间持久化快照。

### B.2 现状核实
- 已有 `pipelineMode.ts`（harness/swarm 状态）、`SwarmPipelineBar`（顶部 Swarm 协同条）、`WorkMode='act'|'plan'|'minimal'|'creator'`、`ModularWorkflowStudio`/`workflowStore`/`TaskGraphScheduler`。
- 已有 `ActionApprovalModal`（单动作确认）、`OptionsCard`、`TargetStepProgressCard`；缺"阶段结束挂起 + 方案终审卡 + 快照"。
- 对话栏存在多余工作流按钮，未与积木工作流闭环。

### B.3 方案
- **模块一（收敛）**：新增 `ExecutionMode = 'act' | 'graph'` 契约；`resolveExecutionPolicy(mode, workflowId)` 纯函数（act → 1-node-micro-loop + 无门禁；graph → n-node-workflow + 门禁 + 动态 DAG 指令）；UI 双态胶囊 + `Alt+1/Alt+2`；删除顶部 Harness/Swarm 切换与多余工作流按钮；Swarm 工作流内化为 graph 模式下的工作流模板（与 WP-E 衔接）。
- **模块五（门禁）**：`StageGateEvent` 契约（gateId/stageName/specPath/summary/taskBreakdown/resolve）；阶段完成判定纯函数 `shouldSuspendForGate(stage, acceptance)`；挂起状态机（Phase → Awaiting_Approval → 批准/提意见/终止）；沉浸式终审卡 + 挂起期间输入框切换"输入修改意见"模式；快照持久化（复用 git checkpoint）。

### B.4 任务清单
1. `executionMode.ts`：`ExecutionMode/ExecutionModeConfig/SessionExecutionState` 类型 + 持久化（session 级）。
2. `resolveExecutionPolicy(mode, workflowId)` 纯函数 + 动态 DAG 指令模板。
3. 迁移 `pipelineMode` → `executionMode`（harness→act；swarm→graph 工作流）；兼容旧存储。
4. UI：双态胶囊（`[ ⚡ Agent Loop ]` / `[ 🧩 Graph 动态编排 ⌄ ]`）+ Graph 浮层模板选择 + `Alt+1/2` 快捷键；移除 SwarmPipelineBar 顶层切换与冗余按钮。
5. Graph 未选模板 → 动态 DAG planner prompt 注入 + 对话流直出【动态执行轨道】渲染。
6. `stageGate.ts`：`StageGateEvent` + `shouldSuspendForGate` 纯函数 + 挂起状态机。
7. 终审卡组件（批准/提意见/终止）+ 挂起期间输入框模式切换 + 快照持久化。
8. 测试：executionMode/resolveExecutionPolicy/shouldSuspendForGate/迁移兼容；UI 快捷键。

### B.5 测试与验收
- 纯函数单测（执行策略映射、门禁判定、旧数据迁移）。
- 集成：切 Graph 未选模板 → 动态轨道出现；spec 产出 → 门禁挂起 → 未批准不写码。
- 铁律 1.5 闭环 + `Alt+1/2` 快捷键验证。

### B.6 风险
- pipelineMode 迁移影响面广（App/ChatColumn/存储），需兼容旧数据并全量回归。
- 门禁与 WP-A 的收敛引擎联动：仅在 graph 模式启用门禁，act 模式保持零流程冗余。

---

## WP-C：会话级并发调度引擎（模块三）

### C.1 目标
- 废除全局 `isStreaming` + 单例 `abortControllerRef` 导致的"一个会话跑任务全 IDE 阻塞 + 取消竞态"。
- 会话 A 跑重构时，会话 B 可立即并发提问，两边独立流式渲染与取消。

### C.2 现状核实
- `App.tsx`：`agentLoopCancelledRef` 全局单例；`handleSendMessage` 单飞行循环；sessions/currentSessionId 已按会话管理（可复用）。
- `ChatColumn`：`isStreaming` 组件内全局布尔（非按会话）。

### C.3 方案
- `sessionActorManager.ts`：`SessionRuntimeInfo { sessionId, status, abortController, loopCount, tokensStreamed, currentPhase }` + 单例 `SessionActorManager`（startSessionStream/abortSession/isSessionRunning/emitChange）。
- App.tsx 循环改用 per-session actor（abort 按 sessionId 分发）；ChatColumn 的 isStreaming 改为来自 actor 状态（props/订阅）。
- 多会话并发 UI：每会话独立旋转动画与进度；取消只中止目标会话。

### C.4 任务清单
1. `SessionRuntimeInfo` + `SessionActorManager` 单例 + 变更订阅（event emitter）。
2. App.tsx：handleSendMessage 循环接入 actor（按 sessionId 建/取/中止 controller）。
3. ChatColumn：isStreaming 由全局布尔改为订阅 actor 状态（per-session）。
4. 取消竞态修复：abort 仅中止目标会话的流与循环。
5. 多会话并发 UI：会话树运行态指示 + 独立动画。
6. 测试：actor 状态机（start/abort/isRunning/并发多会话）、取消隔离。

### C.5 测试与验收
- 单测：SessionActorManager 并发/取消/状态流转。
- 集成：会话 A 运行中切会话 B 提问 → B 并发响应、A 不受影响。
- 铁律 1.5 闭环。

### C.6 风险
- ChatColumn 状态重构（isStreaming 引用点多），需逐一核对（约 15 处引用）。
- 并发流式依赖宿主 ThreadingTCPServer（WP1 已就绪）。

---

## WP-D：缓存与代码索引系统接线（模块七）

### D.1 目标
- 现状：`cacheEngine.ts` 已实现 `buildCompactRepoMap/extractFileSymbols/assembleCacheOptimizedMessages/recordCacheHitTelemetry/getCachedTelemetryStats`，但**未接线**（无任何调用方）。
- 目标：把 RepoMap 拓扑压缩接入探查阶段 prompt；`assembleCacheOptimizedMessages` 接入消息组装（前缀字节级不变）；缓存遥测接入顶部 HUD/TokenAnalyticsModal。
- 明确："85%~92% KV 命中"为营销性指标，以实际遥测为准（DeepSeek/Claude 的前缀缓存行为由服务端决定）。

### D.2 现状核实
- `cacheEngine.ts`（8.5KB）函数齐全；`contextTelemetry.ts`（9.5KB）、`TokenAnalyticsModal.tsx`（9.4KB）存在。
- grep 确认：四个 cache 函数均无外部调用（仅定义处出现）。

### D.3 方案
- 探查阶段（act 模式首轮 / graph 探查节点）在 prompt 前注入 `buildCompactRepoMap(extractFileSymbols(...))` 骨架（<2k tokens）。
- 消息组装改走 `assembleCacheOptimizedMessages`（System Prompt + Global Rules + RepoMap 置于最前端，字节级稳定）。
- `recordCacheHitTelemetry` 在模型响应 usage 回传处接线（input_tokens/cached_tokens）；HUD 展示总 Token/KV 命中率/TTFT（TTFT 由前端记录首块延迟）。

### D.4 任务清单
1. 接入点勘察：App.tsx 消息组装处 + 模型 usage 回传处 + HUD 数据源。
2. RepoMap 注入：探查阶段构建文件摘要（复用 FileExplorer/目录扫描）→ 注入 prompt。
3. `assembleCacheOptimizedMessages` 替换现有消息组装。
4. 遥测接线：usage.cached_tokens → recordCacheHitTelemetry；TTFT 记录。
5. HUD：TokenAnalyticsModal/顶部胶囊展示 3 指标（总 Token/KV 命中率/TTFT）。
6. 测试：cacheEngine 函数单测（部分已有 cacheAndRepoMap.test.ts）+ 组装前缀不变性 + 遥测累计。

### D.5 测试与验收
- 单测：repo map 压缩体积上限、前缀字节级不变、遥测命中率计算。
- 集成：真实调用后 HUD 出现 3 指标。
- 铁律 1.5 闭环。

### D.6 风险
- 符号提取为**正则近似**（非 Tree-sitter），大项目骨架可能含噪声——作为 v1 可接受，真 Tree-sitter 列为后续专项。
- 前缀不变性需保证注入内容确定性（canonicalizeJson 已备）。

---

## WP-E：真并发 Swarm（模块六）

### E.1 目标
- 从"单模型串行文字扮演"升级为真并发：影子工作区隔离（git worktree）+ Master 实时遥测纠偏 + 两阶段合并（测试绿灯后落盘）。
- 与 WP-B 的模块一衔接：Swarm 作为 Graph 模式下的一种工作流。

### E.2 现状核实
- `TaskGraphValidator`（DAG 校验）已存在；`agentEventStore`（事件总线）已存在——**可复用为遥测总线**。
- `multiRoleAgentRunner`/`swarmScheduler`/`SwarmSubagentContainer` 为串行编排。
- 宿主 `desktop_app.py`：仅有 git status/checkpoint/revert/diff，**无 worktree 端点**——需新增（受 WP1 路径沙箱/Token 保护）。

### E.3 方案
- 宿主新增 `/api/git/worktree/create|list|remove`（`git worktree add ../shadow-<id> HEAD`，注册进 path_sandbox 根，Token 鉴权）。
- 前端 `worktreeManager.ts`：为每个 Subagent 分配影子工作区（读写路径指向影子目录）。
- Master 纠偏：订阅 `agentEventStore` 的 action 事件，`onSubagentAction` 越界（如前端改 server/）→ `master.sendIntervention(id, msg)` 中断纠偏。
- 两阶段提交：各 Subagent 交付 diff patch → Master 合并 → 全量回归测试 → 绿灯后落盘主工作区（git apply）。
- `SwarmSubagentContainer`/`multiRoleAgentRunner` 改造为真实并发（每 Agent 独立请求流 + 影子 cwd）。

### E.4 任务清单
1. 宿主 worktree 端点（create/list/remove）+ 沙箱注册 + 集成测试。
2. `worktreeManager.ts`：影子区生命周期管理。
3. 遥测总线接线：agentEventStore 的 action 事件 → Master 监听。
4. Master 纠偏逻辑：越界规则（role × path 前缀）+ sendIntervention。
5. 两阶段合并：diff patch 收集 → 合并 → 全量回归 → 落盘。
6. `SwarmSubagentContainer`/runner 真并发改造（独立流 + 影子 cwd）。
7. 测试：worktree 端点、纠偏规则、合并门禁。

### E.5 测试与验收
- Python：worktree create/list/remove（真实 git 仓库临时目录）+ 越界路径 403。
- 前端：纠偏规则单测、两阶段合并状态机。
- 集成：双 Agent 影子区并发写文件不覆盖；越界被 Master 拦截；合并前测试必须绿灯。
- 铁律 1.5 闭环。

### E.6 风险（最高）
- git worktree 需在用户工程内创建影子目录——必须纳入路径沙箱并确保清理。
- 真并发 + 合并冲突是复杂工程，建议独立专项、分阶段实施（先隔离+纠偏，后 2PC 合并）。
- 与 WP-C 并发调度有交互（多会话 × 多 Subagent），需统一 Actor 模型。

---

## 进度标记（2026-08-31）

- **WP-A（模块二+四）**：✅ 已完成并推送（黄金不变量 + 硬沙箱）。
- **WP-B（模块五+一）**：✅ 纯逻辑层完成并推送（executionMode/stageGate 契约、策略、迁移、requireUserReview 兼容，16 项新测试）；⏸️ **UI 接线待专项**（B4-B8：ExecutionModeCapsule + Alt+1/2、移除 Harness/Swarm 切换、Graph 动态编排注入、StageGateCard、App 门禁挂起）。
- **WP-C/D/E**：未开始。
## 汇总路线图

| WP | 模块 | 依赖 | 规模/风险 |
|---|---|---|---|
| A | 二+四（生命周期引擎+硬沙箱） | 无 | 中/低（已出设计） |
| B | 五+一（门禁+模式收敛） | A | 中/中 |
| C | 三（会话并发） | A | 中/中 |
| D | 七（缓存接线） | 无 | 小/低 |
| E | 六（真并发 Swarm） | B+C+宿主 worktree | 大/高 |

每 WP 实施时：SDD 契约 → TDD 红绿 → 铁律 1.5（打包/安装/真实调用/一键 `run_acceptance.py`）→ 提交推送。


