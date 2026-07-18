# Loop 工程化产品 v1 开发任务拆解清单

## 1. 文档目的

本文档用于把《Loop 工程化产品架构 v1》拆成可执行的开发任务清单，目标是让项目可以直接进入实施阶段，而不是停留在概念设计阶段。

适用对象：

- 自己作为主开发时的实施清单
- 交给 AI 编码工具时的任务拆分依据
- 后续做里程碑管理与验收的执行底稿

## 2. v1 总目标

v1 只追求一件事：

`把 Task -> LoopRun -> Session -> Evidence -> Decision -> Action 这条闭环主链跑通。`

v1 不追求：

- 全自动高风险续跑
- 多工具接入
- 团队协作和权限体系
- 复杂规则 DSL

## 3. 里程碑划分

建议把 v1 拆成 6 个里程碑。

### M0：项目初始化

目标：

- 初始化桌面端、前端、后端、本地数据库和工程结构

交付结果：

- 可运行的基础工程
- 统一的类型定义和目录结构
- 可写入 SQLite 的最小数据层

### M1：任务与 LoopRun 基础模型

目标：

- 先把核心业务对象建起来

交付结果：

- Task 管理
- LoopRun 创建
- 基础状态流转

### M2：Session 接入与事件采集

目标：

- 能发现 Codex 会话并读取最近事件

交付结果：

- Session Discovery
- Session Event Store
- 基础时间线

### M3：上下文绑定与证据系统

目标：

- 让系统知道“这个会话对应什么任务”

交付结果：

- 任务目标绑定
- 文档绑定
- 计划步骤绑定
- Evidence 归档

### M4：分析与建议生成

目标：

- 做出第一版可用的“失败/停顿/偏题”分析

交付结果：

- 分析器
- 决策对象
- 建议文案生成

### M5：审核流与控制台

目标：

- 让整个系统具备人工接管和动作治理能力

交付结果：

- Review Queue
- Policy Center 基础版
- 审计与回放页面

## 4. 目录结构建议

建议 v1 就按模块拆分：

```text
apps/
  desktop/
  web/

packages/
  shared-types/
  db/
  core/
  connectors/
  evidence/
  analyzers/
  policy/
  action-engine/
```

说明：

- `apps/desktop`：Electron 外壳、桌面生命周期、托盘和本地应用入口
- `apps/web`：React UI
- `packages/shared-types`：Task、LoopRun、Session 等共享类型
- `packages/db`：SQLite schema、DAO、migration
- `packages/core`：运行时编排和状态机
- `packages/connectors`：Codex 接入层
- `packages/evidence`：证据抽取和事件归档
- `packages/analyzers`：规则分析器与 LLM 分析器
- `packages/policy`：策略和审核流
- `packages/action-engine`：建议与续跑动作执行

## 5. 任务清单

## 5.1 M0：项目初始化

### T001 初始化 Monorepo 结构

任务内容：

- 初始化 Node.js + TypeScript Monorepo
- 建立 `apps/` 和 `packages/` 结构
- 配置基础脚本

完成标准：

- 能在根目录运行统一的安装和开发命令

### T002 初始化桌面端壳

任务内容：

- 使用 Electron 搭建桌面端
- 建立主进程、渲染进程基础结构
- 预留托盘和通知扩展点

完成标准：

- 可启动桌面应用
- 能加载前端页面

### T003 初始化前端 UI

任务内容：

- 使用 React + TypeScript 初始化前端
- 建立基础路由和布局
- 创建空白页面：
  - Task Runs
  - Loop Detail
  - Policy Center
  - Review Queue
  - Replay & Audit
- 建立桌面端友好的三栏控制台：
  - 左侧导航与连接状态
  - 中央任务和 LoopRun 工作区
  - 右侧审核队列与策略说明
- 提供基础交互：
  - 新建 Task 并创建首条 LoopRun
  - 查看任务队列和选中任务
  - 对待审核 Review 执行 approve/reject

完成标准：

- 页面可切换
- 有统一布局和状态栏
- Electron 中加载本地构建产物时页面不空白
- 核心空状态必须提示下一步操作

### T004 初始化本地数据库

任务内容：

- 选用 SQLite
- 建立数据库连接层
- 初始化 migration 机制

完成标准：

- 可以创建数据库文件
- 可以执行第一版 schema 初始化

## 5.2 M1：任务与 LoopRun 基础模型

### T101 实现 Task 数据模型

任务内容：

- 创建 `tasks` 表
- 实现 Task CRUD
- 支持录入：
  - 标题
  - 目标
  - 约束
  - 成功标准
  - 风险等级

完成标准：

- 可以创建、查看、编辑、删除 Task

### T102 实现 LoopRun 数据模型

任务内容：

- 创建 `loop_runs` 表
- 支持从 Task 创建 LoopRun
- 维护 `initialized -> binding_context -> running` 基础状态

完成标准：

- 一个 Task 可创建一条 LoopRun
- LoopRun 状态可落库

### T103 实现 Task Runs 列表页

任务内容：

- 展示 Task 列表
- 展示每个 Task 的最新 LoopRun 状态
- 支持新建 Task
- 桌面端布局必须保留任务队列、当前 LoopRun 和 Review Gate 三个信息区

完成标准：

- 可以通过 UI 创建 Task
- 可以看到 LoopRun 基础状态
- 创建后刷新任务列表，不需要用户手动重启应用

## 5.3 M2：Session 接入与事件采集

### T201 实现 Session Discovery

任务内容：

- 扫描本地 Codex 会话
- 读取会话元数据
- 建立 Session 数据模型

完成标准：

- 可以列出可发现的会话
- 至少展示：
  - 标题
  - threadId
  - projectPath
  - 最后活跃时间

### T202 实现 Session 绑定到 LoopRun

任务内容：

- 支持将一个 Session 绑定到某个 LoopRun
- 保存绑定关系

完成标准：

- 在 Task Detail 中可以选择会话进行绑定

### T203 实现 Session Event Store

任务内容：

- 创建 `session_events` 表
- 采集并保存最近消息、错误、工具调用、状态变化

完成标准：

- 能按时间顺序存储最近事件
- 能从数据库读取时间线

### T204 实现基础状态识别

任务内容：

- 对 Session 做基础状态归一化：
  - running
  - waiting_input
  - failed
  - interrupted
  - idle

完成标准：

- Session 列表页能看到基础状态

## 5.4 M3：上下文绑定与证据系统

### T301 实现 ThreadContext

任务内容：

- 创建 `thread_contexts` 表
- 保存：
  - goal
  - constraints
  - success criteria

完成标准：

- 每个 LoopRun 可以维护自己的上下文

### T302 实现 Document Binding

任务内容：

- 创建 `document_bindings` 表
- 支持绑定：
  - 主方案文档
  - 实施计划文档

完成标准：

- 可从本地选择文档并绑定
- 可查看已绑定文档列表

### T303 实现 PlanStep 管理

任务内容：

- 创建 `plan_steps` 表
- 支持手动录入计划步骤
- 支持状态维护

完成标准：

- UI 中可新增、编辑、删除计划步骤

### T304 实现 Evidence 表与抽取逻辑

任务内容：

- 创建 `evidences` 表
- 从事件中抽取基础证据

证据类型先支持：

- `last_message`
- `tool_error`
- `tool_result`
- `idle_window`
- `plan_step_match`

完成标准：

- 某次异常分析时能看到结构化证据

## 5.5 M4：分析与建议生成

### T401 实现 Error Analyzer

任务内容：

- 基于最近错误和工具结果识别失败类型

完成标准：

- 能输出：
  - 错误分类
  - 可能根因
  - 优先修复方向

### T402 实现 Progress Analyzer

任务内容：

- 基于事件节奏识别是否空转

v1 规则建议：

- 最近 2 轮无推进信号
- 当前不在等待用户输入
- 最近窗口进入静止期

完成标准：

- 能输出是否 `stalled`

### T403 实现 Plan Alignment Analyzer

任务内容：

- 判断当前行为是否明显偏离任务目标或计划步骤

完成标准：

- 至少能识别明显偏题场景

### T404 实现 Risk Analyzer

任务内容：

- 输出风险等级：
  - low
  - medium
  - high

v1 先用规则实现

完成标准：

- 每次分析结论都附带风险等级

### T405 实现 Decision 生成

任务内容：

- 创建 `decisions` 表
- 根据分析器结果生成 Decision

完成标准：

- 每次异常都有结构化 Decision 记录

### T406 实现 Suggestion Builder

任务内容：

- 生成结构化建议文案
- 生成结构化 resume prompt

完成标准：

- UI 上能看到可直接发送的建议内容

## 5.6 M5：审核流与控制台

### T501 实现 Policy 基础模型

任务内容：

- 创建 `policies` 表
- 支持 3 套内置策略：
  - Read Only
  - Conservative
  - Balanced

完成标准：

- 每个 LoopRun 可选择一个 Policy

### T502 实现 Rule 基础模型

任务内容：

- 创建 `rules` 表
- 支持启用/禁用
- 支持优先级

完成标准：

- 可看到系统内置规则列表

### T503 实现 Review Queue

任务内容：

- 创建 `reviews` 表
- 对高风险动作进入待审核队列
- 在桌面控制台右侧 inspector 中展示待审核项
- 支持 approve/reject 并刷新审核队列

完成标准：

- UI 可显示待审核动作
- 可批准或拒绝
- 审核动作需要同步更新对应 Action 状态

### T504 实现 Action 记录

任务内容：

- 创建 `actions` 表
- 记录系统建议、人工确认、续跑动作

完成标准：

- 每次动作都能在时间线和审计页看到

### T505 实现 Replay & Audit 页面

任务内容：

- 展示：
  - 事件时间线
  - 证据
  - 决策
  - 动作
  - 审核结果

完成标准：

- 可完整回放一次“异常 -> 分析 -> 建议/审核 -> 动作”的流程

## 6. v1 验收标准

v1 验收建议按下面 8 条执行：

1. 可以创建 Task
2. 可以为 Task 创建 LoopRun
3. 可以发现 Codex Session 并绑定到 LoopRun
4. 可以采集最近事件并落库
5. 可以绑定目标、文档、计划步骤
6. 可以识别失败、停顿、偏题中的至少 3 类场景
7. 可以生成结构化建议并进入审核流
8. 可以完整查看一次 Loop 的证据、决策、动作和审计记录

## 7. 建议的开发顺序

如果由一个人或一个 AI 编码工具连续推进，推荐顺序如下：

1. M0 项目初始化
2. M1 核心对象和数据库
3. M2 Session 发现与事件采集
4. M3 上下文与证据
5. M4 分析器与建议生成
6. M5 策略、审核流和控制台

推荐原则：

- 先把数据链打通
- 再做分析
- 最后再做自动化动作

## 8. 后续文档建议

在本清单之后，建议继续补充这 3 份文档：

1. `数据库表 SQL 草案`
2. `前后端目录结构设计`
3. `首批 API / IPC 接口定义`

这样就能从“任务清单”继续推进到“真正开工”阶段。
