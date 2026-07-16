# Loop 工程化产品架构 v1

## 1. 产品定义

### 1.1 产品定位

该产品不是简单的会话监控器，也不是一个“看到 AI 停了就回复继续”的自动脚本。

它的定位应为：

`一个面向 AI 编码任务的 Loop Control Plane，用任务而不是会话作为核心对象，用策略和审核流控制自动化边界，用证据和回放支撑整个闭环。`

### 1.2 核心目标

产品的核心目标包括：

1. 发现并管理多个 Codex 会话
2. 以任务为中心组织 Loop 执行过程
3. 识别会话停顿、失败、偏题、完成候选等状态
4. 基于证据分析当前异常和进度
5. 通过策略系统和审核流安全介入
6. 在低风险场景下提供高质量建议或自动续跑
7. 为整个 Loop 过程提供回放、审计和反馈能力

### 1.3 非目标

第一版不做以下内容：

- 不做通用多 AI 平台聚合
- 不做团队级权限和协同治理
- 不做高风险场景全自动运行
- 不做复杂知识图谱
- 不做自动改写需求文档和计划文档
- 不做跨任务自动编排

## 2. 核心对象模型

### 2.1 Task

Task 代表一个真实开发目标，是整个系统的业务主对象。

建议字段：

- `task_id`
- `title`
- `description`
- `goal`
- `constraints_json`
- `success_criteria_json`
- `risk_profile`
- `template_type`
- `project_path`
- `created_at`
- `updated_at`

### 2.2 LoopRun

LoopRun 代表某个任务的一次完整执行闭环。

建议字段：

- `loop_run_id`
- `task_id`
- `status`
- `mode`
- `policy_id`
- `started_at`
- `ended_at`
- `outcome`
- `summary`

说明：

- 一个 Task 可以有多次 LoopRun
- 每次 LoopRun 都必须可以独立审计和回放

### 2.3 Session

Session 是 Codex 的具体执行线程或窗口，是 LoopRun 的执行载体。

建议字段：

- `session_id`
- `loop_run_id`
- `thread_id`
- `window_id`
- `title`
- `source_type`
- `status`
- `last_event_at`

说明：

- v1 可以按一个 LoopRun 绑定一个 Session 实现
- 模型层先保留一对多扩展空间

### 2.4 PlanStep

PlanStep 代表任务级实施计划步骤。

建议字段：

- `plan_step_id`
- `task_id`
- `title`
- `description`
- `order_index`
- `status`
- `related_files_json`
- `depends_on_json`

### 2.5 Evidence

Evidence 是所有分析与决策的证据基础。

建议字段：

- `evidence_id`
- `loop_run_id`
- `session_id`
- `evidence_type`
- `source_type`
- `source_ref`
- `snippet`
- `confidence`
- `related_event_ids_json`
- `created_at`

### 2.6 Decision

Decision 表示系统一次明确判断。

建议字段：

- `decision_id`
- `loop_run_id`
- `decision_type`
- `reason`
- `risk_level`
- `confidence`
- `evidence_ids_json`
- `created_at`

### 2.7 Action

Action 表示系统一次实际介入动作。

建议字段：

- `action_id`
- `loop_run_id`
- `decision_id`
- `action_type`
- `message`
- `status`
- `requires_review`
- `review_status`
- `executed_at`

### 2.8 Review

Review 是审核流记录。

建议字段：

- `review_id`
- `action_id`
- `review_type`
- `reviewer`
- `result`
- `comment`
- `created_at`

## 3. Loop 生命周期状态机

### 3.1 Task 状态

- `draft`
- `ready`
- `running`
- `blocked`
- `completed`
- `cancelled`

### 3.2 LoopRun 状态

- `initialized`
- `binding_context`
- `running`
- `waiting_input`
- `stalled`
- `failed`
- `needs_review`
- `resuming`
- `verifying`
- `completed`
- `aborted`

### 3.3 Session 状态

- `discovered`
- `watching`
- `running`
- `interrupted`
- `failed`
- `idle`
- `closed`

### 3.4 核心流转

1. 创建 Task
2. 绑定目标、约束、成功标准
3. 创建 LoopRun
4. 绑定 Session
5. 进入 `running`
6. 持续采集事件和证据
7. 检测停顿、失败、偏题、完成候选
8. 进入分析与决策流程
9. 根据策略和审核流执行观察、建议、续跑、转人工
10. 进入验证阶段
11. 满足成功标准后完成闭环

### 3.5 状态机原则

- `stalled` 不是最终状态，只是异常状态
- `failed` 不等于结束，应允许恢复
- `needs_review` 是治理门
- `verifying` 必须独立存在，用来区分“看起来完成”和“真正完成”

## 4. 策略系统与审核流

## 4.1 设计原则

系统所有自动行为都不能写死在代码逻辑里，而应由策略系统和审核流驱动。

原则包括：

- 默认内置一套可用策略
- 策略可查看、启停、调参、覆盖
- 高风险动作默认不自动放行
- 每次动作必须可审计

### 4.2 Policy

Policy 是一套 Loop 运行制度。

建议字段：

- `policy_id`
- `name`
- `scope_type`
- `mode`
- `risk_threshold`
- `auto_resume_enabled`
- `auto_resume_limit`
- `cooldown_seconds`
- `requires_review_on_high_risk`
- `config_json`

### 4.3 默认内置策略

建议内置以下策略模板：

- `Read Only`
- `Conservative`
- `Balanced`
- `Aggressive`
- `Strict Review`

### 4.4 Rule

Rule 负责识别条件并触发动作候选。

建议字段：

- `rule_id`
- `policy_id`
- `name`
- `enabled`
- `priority`
- `condition_json`
- `action_json`
- `risk_level`
- `description`

### 4.5 v1 推荐内置规则

- 连续两轮无推进，判定为 `stalled`
- 最近工具返回失败，判定为 `failed`
- 当前改动明显超出计划范围，判定为 `off_track`
- 连续自动续跑超过上限，切换为 `manual_review`
- 命中敏感操作，标记 `high_risk_block`

### 4.6 审核流 ReviewFlow

审核流建议分三层：

#### 系统审核

- 基于规则、证据、风险分生成候选动作

#### 策略审核

- 检查当前 Policy 是否允许执行该动作

#### 人工审核

- 适用于高风险、冲突、连续失败和严格审查任务

### 4.7 默认需要人工审核的场景

- 高风险动作
- 连续失败超过阈值
- 连续自动续跑超过 2 次
- 涉及删除、迁移、鉴权、生产配置
- 用户手动标记为严格审查

### 4.8 动作类型

- `observe`
- `suggest`
- `resume_with_prompt`
- `pause_loop`
- `request_manual_takeover`
- `mark_completed_candidate`

## 5. 系统模块划分

### 5.1 Connector Core

职责：

- 会话发现
- 会话事件读取
- 状态同步
- 发消息能力适配

子模块建议：

- `codex-session-discovery`
- `codex-event-reader`
- `codex-reply-adapter`

### 5.2 Loop Runtime

职责：

- 创建和维护 LoopRun
- 关联 Session
- 驱动状态机
- 触发分析流程

子模块建议：

- `run-manager`
- `state-machine`
- `watcher-orchestrator`

### 5.3 Context System

职责：

- 绑定任务上下文
- 绑定文档
- 管理计划步骤
- 管理文档版本

子模块建议：

- `task-binder`
- `document-binder`
- `plan-step-manager`

### 5.4 Evidence System

职责：

- 归档原始事件
- 生成结构化证据
- 提供回放能力

子模块建议：

- `event-store`
- `evidence-builder`
- `replay-service`

### 5.5 Analysis Engine

职责：

- 识别失败
- 识别空转
- 识别偏题
- 识别完成候选
- 输出带证据的分析结果

子模块建议：

- `error-analyzer`
- `progress-analyzer`
- `alignment-analyzer`
- `completion-analyzer`
- `risk-analyzer`

### 5.6 Policy Engine

职责：

- 加载策略
- 执行规则
- 判断动作许可

子模块建议：

- `policy-loader`
- `rule-evaluator`
- `review-gate`

### 5.7 Action Engine

职责：

- 生成建议
- 构建续跑 Prompt
- 执行动作
- 记录动作结果

子模块建议：

- `suggestion-builder`
- `resume-prompt-builder`
- `action-dispatcher`

### 5.8 Desktop Console

职责：

- 展示总览
- 展示详情
- 展示策略和审核流
- 展示审计和回放

页面建议：

- `Task Runs`
- `Loop Detail`
- `Policy Center`
- `Review Queue`
- `Replay & Audit`

## 6. 数据库模型

### 6.1 v1 数据库选型

v1 采用 SQLite 即可，满足单机桌面端需求。

### 6.2 核心表

- `tasks`
- `loop_runs`
- `sessions`
- `thread_contexts`
- `document_bindings`
- `plan_steps`
- `session_events`
- `evidences`
- `decisions`
- `actions`
- `reviews`
- `policies`
- `rules`
- `feedbacks`

### 6.3 核心关系

- `tasks 1:n loop_runs`
- `loop_runs 1:n sessions`
- `loop_runs 1:n session_events`
- `loop_runs 1:n evidences`
- `loop_runs 1:n decisions`
- `decisions 1:n actions`
- `actions 1:n reviews`

### 6.4 Feedbacks

为了支持误判治理和策略迭代，建议额外保留反馈表。

建议字段：

- `feedback_id`
- `loop_run_id`
- `target_type`
- `target_id`
- `feedback_type`
- `comment`
- `created_at`

## 7. v1 MVP 范围

### 7.1 v1 必做

1. 任务创建
   - 手动创建任务
   - 填写目标、约束、成功标准

2. 上下文绑定
   - 绑定一份主方案文档
   - 绑定一份实施计划
   - 录入计划步骤

3. 会话发现
   - 扫描 Codex 会话
   - 选择会话绑定到 LoopRun

4. Loop 运行监控
   - 展示当前状态
   - 展示最近消息、错误、事件

5. 基础分析
   - 失败检测
   - 停顿检测
   - 偏题预警
   - 完成候选检测

6. 建议生成
   - 生成结构化建议
   - 生成人工可确认的续跑消息

7. 审核流
   - 支持人工批准或拒绝动作
   - 高风险默认禁止自动执行

8. 审计回放
   - 查看分析证据
   - 查看建议记录
   - 查看动作记录

### 7.2 v1 暂不做

- 多工具接入
- 多会话协同决策
- 全自动高风险 Loop
- 复杂 DSL 规则编辑器
- 团队权限系统
- 云同步
- 自动改写任务文档

### 7.3 v1 成功标准

v1 达标标准建议为：

- 能用任务驱动而不是纯会话驱动
- 能识别并展示 Loop 当前状态
- 能给出带证据的建议
- 能通过审核流安全介入
- 能完整回放一次 Loop 异常到恢复过程

## 8. 后续演进方向

### 8.1 v2 方向

- 低风险自动续跑
- 策略中心增强
- 连续失败自动降级
- 误判反馈回路
- 更强的审计与回放

### 8.2 v3 方向

- 多 Connector 接入
- 多工具支持
- 可插拔分析器
- 团队级策略模板
- Headless 守护进程模式

## 9. 结论

v1 的核心不是“自动续跑多聪明”，而是先把下面这条主链打通：

`Task -> LoopRun -> Session -> Evidence -> Decision -> Action`

只要这条链稳定，后续再往上加自动续跑、模板系统、策略系统、更多接入层，整体架构都会顺。
