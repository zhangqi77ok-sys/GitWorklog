# Harness / Swarm 显式执行引擎契约

## 1. 问题与结论

当前原型把 Harness 与 Swarm 放在顶部小控件中，但默认值是 `swarm`，按钮只改变局部 React 状态，既没有接入发送链，也没有创建 `TaskGraphScheduler` Run。用户看到的是 Swarm 标签，实际却仍可能走主 Agent Loop，造成“自动触发”或“已经在运行”的误解。

本契约将“选择执行引擎”和“启动一次运行”严格分开：

- **选择不是启动**：点击 Harness/Swarm 只改变下一次任务的目标执行引擎，不创建 Run、不改变运行中任务。
- **默认 Harness**：当前主 Agent Loop 已接入 Harness，因此首次进入会话显示 Harness；不能因关键词、任务复杂度、安装了某个工具或项目规则而自动切到 Swarm。
- **Swarm 必须显式启动**：用户先选择 Swarm，再确认目标并点击“启动 Swarm Run”；在此之前只显示“已选择 / 等待启动”。
- **状态必须真实**：只有 `TaskGraphScheduler.startSwarmRun()` 成功返回 `runId` 后才显示“运行中”。未接入、配置失败或启动失败必须显示“未接入/不可用”或“启动失败”，不得伪造 running。
- **自动策略不是隐式默认**：未来如提供“自动建议”，必须作为独立、明确的用户选项；自动建议只能展示候选并等待确认，不能静默启动或覆盖用户选择。本轮不提供自动策略入口。

## 2. 状态契约

```ts
type PipelineMode = 'harness' | 'swarm';
type PipelineExecutionStatus =
  | 'ready'          // Harness 已选，主 Agent Loop 可执行
  | 'awaiting_start' // Swarm 已选，尚未点击启动
  | 'running'        // 已拿到真实 runId
  | 'unavailable';   // 当前 Swarm 后端未接入或启动失败
```

约束：

| 用户动作 | mode | status | 是否创建 run |
| --- | --- | --- | --- |
| 首次打开 | `harness` | `ready` | 否 |
| 点击 Harness | `harness` | `ready` | 否 |
| 点击 Swarm | `swarm` | `awaiting_start` | 否 |
| 在 Swarm 工作台点击启动，调度器可用 | `swarm` | `running` | 是 |
| 在 Swarm 工作台点击启动，调度器不可用/失败 | `swarm` | `unavailable` | 否或失败后无有效 run |
| 关键词、复杂度、规则、已安装 Provider 变化 | 不变 | 不变 | 否 |

切换引擎只影响下一次未开始的任务。已运行的 Run 不因顶部选择变化而改道；停止、取消和恢复另由 Run 控件负责。

## 3. 原型交互验收

1. 顶部使用明确文案“执行引擎”，两个选项均可见，不依赖横向滚动或小于 11px 的文字。
2. Harness 选中时展示“已选择 · 可直接发送”；发送沿现有主 Agent Loop 执行。
3. Swarm 选中时展示“已选择 · 等待启动”；输入需求后不得直接调用主 Agent Loop，而是进入 Swarm 工作台确认。
4. Swarm 工作台展示目标、当前状态和唯一的“启动 Swarm Run”动作。打开工作台本身不得创建 Run。
5. 启动成功后展示真实 `activeRunId`，并监听现有 Agent 事件更新产物；启动失败有可见错误。
6. 没有用户点击“启动 Swarm Run”时，不得出现“运行中”、角色已开始执行或虚假的进度。

## 4. 正式落地顺序

1. 先复用本契约的纯函数状态模型和测试。
2. 将 ChatColumn 的引擎选择接到单一状态源，默认 Harness。
3. 将 Swarm 启动动作接入 `RuntimeConfigResolver.resolveCurrentConfig()` 与 `taskGraphScheduler.startSwarmRun()`。
4. 以 `activeRunId` 驱动 `SwarmWorkbenchModal`，禁止仅凭打开弹窗推断运行状态。
5. 补充端到端验收：选择不启动、显式启动、失败提示、Harness 正常发送、窗口宽度变窄时两个选项仍可见。

## 5. 非目标

本轮不根据任务语义自动选择 Harness/Swarm，不把 Superspec、SpecKit、SDD/TDD 等工作流 Provider 当作执行引擎，也不把 Provider 的发现/确认状态当成 Swarm 启动授权。
