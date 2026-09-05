# Tcode (Next-Gen AI Agentic Studio)

新一代开源 AI 编程桌面工作台，基于 **Wails v2 + Go 原生微内核 + Vue 3 + TypeScript**，采用 **Inner/Outer Loop 统一双环执行内核**、**Rail 能力插件体系** 与 **Swarm Flow 算子化多智能体编排流**，严格遵循暖米白（`#FAF8F5`）、工作台米灰（`#F4EFEA`）与陶土暖橙（`#D96B27`）的极简工程人机美学规范。

---

## 🏛️ 一、核心架构设计 (Unified Dual-Loop & SwarmFlow Architecture)

Tcode 打破了单体硬编码调度逻辑，将 Agent 的执行循环、能力轨道、多智能体协同编排与表现层彻底解耦：

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Tcode Frontend (Vue 3 + TypeScript)                      │
│      [ 单焦点主工作区 (智能对话 / Monaco编辑器 聚合切换) | Diff 对比 | 终端抽屉 | 纯净空状态 ]       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Wails v2 原生 IPC / Typed Event Streams
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          Tcode Go Native Microkernel (Wails v2 Engine)                 │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Swarm Flow 算子化多智能体编排流 (Swarm Flow Operators)            │  │
│  │    budget() ➔ parallel() ➔ compact() ➔ pipeline() ➔ agent_session() ➔ human() ➔ 🏆 return │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 驱动所有 Agent 节点运行同一套执行内核       │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      Unified Dual-Loop Engine (统一双环执行内核)                   │  │
│  │                                                                                  │  │
│  │    🔄 Outer Loop: 状态评估与多轮收敛 (判断是否再来一轮 / 终止准则 / 预算核销)          │  │
│  │        │                                                                         │  │
│  │        ▼                                                                         │  │
│  │    ⚡ Inner Loop: 单轮四步闭环 (Observe ➔ Reason ➔ Act ➔ Verify)                  │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 生命周期固定钩子链式分发                    │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                       Rail Plugin Ecosystem (能力即插件，挂载在固定钩子)           │  │
│  │  ┌───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐ │  │
│  │  │ 🛡️ SafetyRail │ 🧠 MemoryRail │ 🔌 ToolRail   │ 🗺️ PlanningRail│ 📊 ObsRail   │ │  │
│  │  │  Priority 100 │  Priority 80  │  Priority 60  │  Priority 40  │  Priority 20 │ │  │
│  │  │  • on_before_act│ • on_after_obs│ • dispatch    │ • subtasks    │ • live trace │ │  │
│  │  │  • 越界指令阻断 │ • RepoMap注入 │ • MCP协议通信 │ • DAG拓扑编排 │ • SSE事件流  │ │  │
│  │  └───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 二、三大核心技术亮点与设计哲学

### 1. Inner Loop / Outer Loop：同一套执行内核，覆盖所有场景
* **统一调度**：不论是独立工作的单个 Agent、被委派处理子任务的 Agent，还是 Swarm 团队里的一名成员，跑的都是同一套执行内核：
  * **Inner Loop (内层执行闭环)**：负责单轮迭代的 `Observe (观察)` ➔ `Reason (推理)` ➔ `Act (行动)` ➔ `Verify (验证)`；
  * **Outer Loop (外层循环收敛)**：判断任务是否真正完成、是否满足终止准则、根据验证结论判断“要不要再来一轮（Self-Healing）”。
* **零重构成本**：开发者不需要为每一种使用场景重新设计一套调度逻辑。

### 2. Rail 机制：能力即插件，想接就接
* **能力挂载在生命周期钩子上**：安全策略、记忆管理、任务规划、工具治理、语义理解、可观测事件……全部以 `Rail` 形式挂载在执行生命周期的固定钩子上：
  * `on_before_observe` / `on_after_observe`
  * `on_before_reason` / `on_after_reason`
  * `on_before_act` / `on_after_act`
  * `on_before_verify` / `on_after_verify`
  * `on_outer_loop_check`
* **优先级裁决 (Priority Chain)**：通过 `priority: u32` 决定谁先谁后、谁能覆盖谁（例如 `SafetyRail` 拥有 P-100 最高裁决权，可直接阻断不安全命令）；
* **极低扩展成本**：想加一条自定义规则、接一个内部工具，完全不用改动执行内核，照着 `RailHandler` 接口实现一个 handler 即可。

### 3. Swarm Flow：可自由拼装的编排算子流
多智能体协同不是一套固定的拓扑，而是一组像函数式流水线一样的自由编排算子：
* **`budget()`**：查询剩余 Token / 成本预算与并发配额，自适应决定 Worker 扇出系数；
* **`parallel()` (Launch Barrier Synchronization)**：并发派发至 $N$ 个 Worker，执行栅栏同步等待全部分支生成候选完毕；
* **`compact()` (Filter Empty Results)**：过滤空结果与异常失败分支，保留健康候选集；
* **`pipeline()` (Streaming Review)**：流式传递结果至复核流水线，独立审查打分；
* **`agent_session()` (Stateful Arbiter)**：有状态仲裁者智能体，聚合候选方案与审查评分，决选最优方案；
* **`human()` (Human Fallback)**：当仲裁者置信度不足（$<80\%$）或存在高危操作时，优雅唤起人工兜底介入；
* **`return` (Final Result)**：交付确认产物，完成端到端闭环。

---

## 🌟 三、工作台系统功能矩阵

### 1. 单焦点主工作区聚合切换 (Single-Focus Primary Workspace)
* **告别三列挤压**：彻底解决“对话 + 编辑器同时平铺”导致的屏幕局促感，采用 Cursor / Windsurf 一线规范的聚焦视图切换；
* **顶栏一键平滑三态流转**：
  * `[💬 智能对话 (Chat)]`：全宽舒适阅读与任务编排，主视口宽阔；
  * `[◫ 双栏协同 (Split)]`：左侧对话流 + 右侧代码/Diff 比对双栏对照审查，兼顾即时沟通与文件改动审查；
  * `[📝 代码工作区 (Editor)]`：全宽展示 Monaco 代码编辑器、Diff 双栏比对视窗与终端；
* **顺滑联动**：点击左侧文件树时自动切至代码工作区；在对话中审查 Diff 时自动无缝切入「双栏协同」。

### 2. 底部集成式可折叠终端抽屉 (Integrated Terminal Drawer)
* **全局快捷唤起**：全局支持快捷键 **`Ctrl + \``**（反引号）瞬间唤起或隐藏抽屉，顶栏与活动栏均配置快捷入口；
* **三维一体控制台**：
  * `$_ pwsh 命令行终端`：支持用户手动键入指令（`go test`, `git status`, `cargo check` 等），与 Agent 沙箱物理环境同构；
  * `⚡ Agent 执行链路 (SSE Trace)`：流式推送微内核 Inner Loop 状态、算子分发事件与 Token 开销；
  * `🛰️ Go 微内核运行状态`：实时呈现 Goroutine 活跃数、零泄漏内存监控与影子 Git 保护状态。

### 3. 动态多平台模型网关 (对齐 sub2api 业界规范)
* **厂商与认证强联动矩阵**：覆盖 Anthropic Claude, OpenAI, Google Gemini, DeepSeek, SiliconFlow, Kimi, Zhipu GLM 与本地 Ollama；不同厂商动态展示支持的认证类型（原生支持 API Key、Sub2 订阅池、Cap 凭据包、OAuth 2.0、代理反代等）；
* **动态凭据输入表单**：
  * **API Key**：显隐式密钥输入 + 自定义 Header 注入；
  * **Sub2 订阅**：Sub2 订阅链接解析 + 节点刷新周期 (TTL) + 账号池实时拉取同步 + 故障自动熔断与额度感知轮询；
  * **Cap 凭据包**：Session Token / Claude setup-token / Cookie 下拉选择 + 多行凭据文本域粘贴；
  * **OAuth 2.0**：Client ID/Secret + 系统本地重定向回调 + 一键调起浏览器官方授权登录；
  * **Proxy 代理**：中转端点 + 访问令牌（本地 Ollama 可留空）+ 协议模拟转换；
* **极速探活测速**：一键真实连通性测试，毫秒级返回 HTTP 状态码与首字延迟（TTFT）；支持自动拉取端点可用模型列表。

### 4. MCP 协议深度治理中心 (Model Context Protocol)
* **传输协议双引擎**：完整支持 `stdio`（本地子进程：command、动态参数 args、环境变量 Key-Value 动态表）与 `sse`（远程网络端点 HTTP/SSE 连接）；
* **服务探活与工具探测**：一键在线测试连通性，自动探测 MCP Server 暴露的工具清单（如 `read_file`, `list_tools`, `call_tool`）；
* **生态兼容**：支持 Claude Desktop JSON 配置文件 (`claude_desktop_config.json`) 一键导入与一键挂载预设（Postgres, SQLite, GitHub, Brave Search）。

### 5. 高频生产级 Git 控制中枢与微内核安全防护 (Advanced Git Control Center & Shadow Snapshots)
* **双层暂存管理**：`Staged Changes` 与 `Working Changes` 双层清晰分离，支持单文件/全部暂存、取消暂存、放弃修改与行级 Diff 联动；
* **AI 语义化 Commit 提炼**：一键通过 AI 深度分析当前暂存代码 Diff，自动打字提炼符合 Conventional Commits 规范的语义化说明，支持 Commit / Commit & Push；
* **分支管理与检出**：顶栏分支徽标一键弹出分支列表，支持分支即时检索与检出新分支 (`git checkout -b`)；
* **微内核影子快照回退**：Agent 修改任何文件前，系统自动在本地建立影子快照，支持随时一键秒级无损回退与 Git Stash 储藏恢复。

### 6. 多模型使用量与 Token 效能监控大盘 (Model Usage & Analytics Cockpit)
* **活动栏专属入口与抽屉速览**：一键切入全景监控大盘，侧边栏常驻今日消耗概览与占比条；
* **四维核心 KPI 矩阵**：今日 Token 吞吐（输入/输出明细）、预估花费（双币种折算与限额水位）、平均首字延迟 (TTFT)、Prompt Cache 缓存节省率（展示提示词前缀缓存节约的 Tokens 与资金）；
* **多模型明细与 24 小时吞吐波形走势**：各模型占比柱状进度条与每小时吞吐时序波形图；
* **实时微内核调度审计流**：流式记录最近底层算子、所用模型、In/Out Tokens 明细与延迟耗时，支持导出 CSV 审计报表。

### 7. Agent Skill 技能与提示词引擎 (Prompt & Skill Hub)
* **多源导入与一键激活**：支持直接从本地文件系统拖拽/选取 `SKILL.md` 规约文件与目录，自动解析 Frontmatter 元数据；同时内置官方专家技能市场（Go 微内核调优、UI/UX 规范先行、TDD 测试治理、分布式架构守卫）；
* **指令驱动触发**：支持在对话框中以 `/` 触发词（如 `/review`, `/tdd`, `/security`, `/perf`）精准调用；
* **多行 Markdown 系统级指令**：支持舒适编辑系统提示词，规范角色契约、执行流、审查清单与输出格式；
* **业界经典预设一键套用**：内置 Thermo-Nuclear 架构审查专家、TDD 红绿重构测试生成器、全维白盒安全守卫、性能与并发调优专家模版。

### 8. 纯净零数据初始状态与配置原子写 (Zero Demo, Clean Empty State & Atomic Store)
* **根绝所有隐含假数据**：彻底清理系统首次启动对 MCP/Skill/Rule 默认预埋伪数据的潜藏逻辑，所有未配置项默认均严格为纯净空切片 `make([]T, 0)`；
* **事务级原子配置持久化 (`atomicWriteConfig`)**：摒弃直接裸写 `os.WriteFile` 的竞态隐患，全面采用“临时文件写入 + 磁盘同步 + 原子重命名”的写入隔离机制，杜绝 Windows 下多协程并发写入导致的文件锁冲突与 JSON 撕裂。

### 9. 生产级前后端基础工程框架与原生双轨上游驱动 (Base Framework & Dual-Track Upstream Drivers)
* **后端 Go 插件式微内核 (`backend/`)**：
  * **强类型 SPI 契约 (`pkg/plugin/v1/`)**：规范 `Plugin`、`ProviderPlugin` (带背压通道)、`ToolPlugin` (入参 Schema 校验)、`RailPlugin` (多阶段拦截与阻断)；
  * **分段锁注册中心 (`internal/host/registry.go`)**：无全局大锁，支持高并发读取与按优先级降序调度；
  * **Panic 隔离看门狗 (`internal/host/guard.go`)**：结合 `recover()` 与 `debug.Stack()` 捕获插件堆栈，保障微内核常驻守护进程 100% 高可用；
  * **OpenAI 与 Claude 双轨原生上游驱动**：中立规范层 (`pkg/protocol/canonical.go`) 抹平协议差异，原生支持 OpenAI Chat Completions 协议族（GPT-4o、DeepSeek、SiliconFlow）与 Anthropic Claude Messages API 官方协议（支持 Claude 3.7 Thinking 深度思考流与 Prompt Caching 用量审计）。
* **前端 Vue 3 现代工程 (`frontend/`)**：
  * 基于 **Vue 3 + TypeScript 5.5 (Strict) + Vite 6 + Tailwind CSS v4**；
  * 完整落地 Warm Minimalist 调色盘（`#FAF8F5` / `#F4EFEA` / `#D96B27`）与 16:9 人机工学单焦点视口布局；
  * 顶栏单焦点切换胶囊（`💬 对话` / `◫ 双栏协同` / `📝 代码区`）、48px 侧边活动栏、生产级双层 Git 源码控制面板与集成终端抽屉（`Ctrl + \`` 全局快捷唤起）。

### 10. 全链路推理流可控中断与进程树生命周期隔离 (Controllable Streaming & Process Tree Isolation)
* **前端至底层无阻塞中断闭环 (`CancelAgentStream`)**：
  * 前端输入区流式推理时自动呈现高亮脉冲的中断按钮 `■`（支持快捷键或一键点击）；
  * Wails IPC 瞬态派发 `CancelAgentStream` 信号，后端原子取消 `agentCancel` 上下文，实时切断正在进行的大模型 SSE 网络请求与长循环；
  * 同步广播 `agent:interrupted` 事件并记录当前轮已生成的思考与文本进度，优雅退回就绪态。
* **Windows 孤儿子进程树递归强杀守卫**：
  * 在受控沙箱与终端工具的同步/流式执行层，统一注入 `execCtx.Done()` 守护协程；
  * 借助 `taskkill /F /T /PID <pid>` 深度强杀顶层 `cmd.exe` 下属整棵子进程树，彻底根除后台孤儿 node/test 进程挂死与 CPU 耗尽风险。
* **Windows 原生单文件安装向导与异步自删除卸载器**：
  * 单文件安装程序支持图形交互与 `/S` / `--silent-install-dir` 纯静默无头安装；
  * 卸载器基于独立临时批处理脚本实现无残留异步延时文件解绑与目录自删除，全链路无控制台弹窗闪烁（`0x08000000`）。
* **前端流式解码与人机交互 (`frontend/src/`)**：
  * **流式客户端 (`core/transport/sseClient.ts`)**：基于 `ReadableStream` 逐帧解析，解决 UTF-8 多字节分片乱码；
  * **深度思考折叠卡片 (`app/chat/ThinkingBlock.tsx`)**：思考中呼吸指示灯 + 思考完毕紧凑折叠，支持随时展开查阅思维链；
  * **平滑打字机上屏**：助手回复平滑逐字增量流式渲染，附带打字防抖与自动平滑滚动。

### 11. 物理受控沙箱、Git 管道秒级快照与物理 Git 暂存中枢 (Controlled FS Sandbox & Plumbing Snapshots)
* **物理文件受控沙箱 (`backend/internal/core/sandbox/fs.go`)**：
  * **原子写防撕裂机制**：写入同级临时文件 ➔ `file.Sync()` 强制落盘 ➔ `os.Rename` 原子覆盖，从物理层杜绝因断电、崩溃造成的源文件撕裂损坏；
  * **路径沙箱严格防御**：获取真实工作区绝对路径并执行 `filepath.Clean`，严禁任何越界跨盘符或目录穿越（如 `../../etc/passwd`）攻击。
* **Git Plumbing 底层管道秒级影子快照 (`backend/internal/core/sandbox/snapshot.go`)**：
  * **零分支污染**：放弃传统的 `git commit`，直接调用 Git 底层管道：`git write-tree` 生成树对象 ➔ `git commit-tree` 生成孤立提交；
  * **毫秒级安全锚点**：记录于 `.git/refs/tcode/snapshots/` 命名空间下，Agent 修改任何代码前 $\le 5\text{ms}$ 自动生成快照，支持一键无损秒级回退。
* **真实双层 Git 暂存控制面板 (`frontend/src/app/git/GitPanel.tsx` & `core/store/gitStore.ts`)**：
  * 解析 `git status --porcelain=v2`，精准呈现已暂存（Staged）与未暂存（Working）文件列表；
  * 支持一键单文件暂存（`+`）、取消暂存（`-`）、撤销放弃更改（`↺`）与带状态感知的 Commit 提交。

### 12. ReAct 双环自主执行引擎与动态工具调用卡片 (ReAct Autonomous Engine & ToolCard)
* **微内核 ReAct 自主执行状态机 (`backend/internal/core/loop/engine.go`)**：
  * **自主工具发现与声明**：自动扫描并收集注册中心内的全部 `ToolPlugin` 动态注入 OpenAI 规范的 `tools` 契约；
  * **流式切片拼接器 (`ToolReassembler`)**：增量聚合上游模型切碎的 `tool_calls` 参数分片，防止 JSON 截断畸形；
  * **多轮自愈循环 (Inner Loop)**：模型调用工具 ➔ 本地沙箱执行 ➔ 结果转换为 `role: tool` 回传上下文 ➔ 再次推理，支持最多 15 步防死循环熔断保护。
* **微内核多阶段 SSE 协议传输 (`backend/internal/transport/http/server.go`)**：
  * 扩展标准事件：`chunk` (正文与思考增量)、`tool_start` (工具启动与入参)、`tool_end` (执行结果与成功状态)、`done` (任务收敛完成)。
* **前端工具调用卡片 (`frontend/src/app/chat/ToolCard.tsx`)**：
  * 遵循 Warm Minimalist 暖色极简设计：工作台米灰（`#F4EFEA`）外框、运行中陶土暖橙（`#D96B27`）呼吸光晕、成功绿色指示；
  * 默认 32px 紧凑收起，点击平滑展开抽屉，内嵌代码暖黑（`#1E1C1A`）小代码块实时查阅入参 JSON 与返回输出；
  * 与 `ThinkingBlock`（思考卡片）和打字机气泡按严格时序编排渲染。

### 13. Monaco 现代代码工作台与万行 Diff 虚拟化审查视图 (Monaco Editor & Dual-Column Diff Reviewer)
* **真实文件资源管理器与多 Tab 标签页 (`frontend/src/app/editor/`)**：
  * **树形工作区目录 (`FileTree.tsx`)**：递归树形结构，智能过滤 `.git`, `node_modules` 等开发中间层，按后缀自适应映射语言图标；
  * **多 Tab 标签栏 (`TabBar.tsx`)**：纯白底色配顶部陶土暖橙强调线，支持多文件自由切换、一键保存与悬停关闭；
* **Monaco 现代代码编辑器与 Diff 审查模式 (`EditorWorkspace.tsx`)**：
  * 深度定制 Warm Minimalist 调色盘，适配 JetBrains Mono / Fira Code 等宽字体，代码行号、折叠与语法高亮完备；
  * **万行 Diff 虚拟化审查 (Diff Reviewer)**：一键切入 Monaco `DiffEditor` 双栏对比，左侧基准（Git HEAD 原始快照）与右侧最新改动红绿对照，右上角悬浮工具条提供一键放弃更改（`Restore`）与一键暂存（`Stage`）；
  * **行级 Hunk 状态机分块与单块 Cherry-Pick**：右侧审查区通过 Go 微内核将 Diff 结构化切分为独立变更块（Hunk），直观呈现 `块 #N` 增删行数统计；每个 Hunk 配备独立的 `[✓ 采纳块]`（`git apply --cached` 暂存入 Index）与 `[✕ 丢弃块]`（`git apply --reverse` 局部无损反向还原），并即时与左侧 Git 抽屉联动刷新，实现极致的细粒度代码控制。
* **顶栏单焦点工作台联动**：
  * 完美联动 `💬 对话`、`◫ 双栏协同`、`📝 代码模式`，实现从对话思维链到代码编辑的沉浸式无缝流转。

### 14. 系统全局设置中心与多服务商凭据热切 (Settings Modal & Multi-Provider Hot-Swapping)
* **严格居中弹窗三维铁律 (`frontend/src/app/settings/SettingsModal.tsx`)**：
  * **绝对水平垂直居中**：无论窗口尺度缩放，弹窗在视口正中精准吸附，搭配极简半透明毛玻璃遮罩；
  * **退出双重保障**：键盘全局 `Esc` 键层级化阻断退出 + 外部背景遮罩点击退出 + 右上角显式 `[X]` 关闭按钮与 Tooltip；
  * **弹窗三标签页分类**：
    * `🤖 模型与凭据 (Providers)`：可视化配置 Base URL、API Key、默认模型与 Thinking 深度思维链开关；
    * `🛡️ 沙箱与安全 (Sandbox)`：管控原子写落盘防撕裂与写前自动 Git 影子快照；
    * `📝 系统指令提示词 (System Prompts)`：自定义注入大模型的全局规则与代码生成风格；
* **一键物理连通性打点测速探针 (`POST /api/config/ping`)**：
  * 点击「测试网络连通性」，即时向上游网关发起毫秒级真实探活请求，呈现 TTFT 延迟与连通性绿标；
* **持久化安全状态机 (`core/store/settingsStore.ts`)**：
  * 自动无感持久化至 `localStorage`，支持全局快捷键 `Ctrl + ,` 或侧边栏齿轮一键唤起。

### 15. 受控集成终端与静默流式 Shell 管道 (Controlled Streaming Terminal & Silent Shell Executor)
* **底部集成式可折叠终端抽屉 (`frontend/src/App.vue` & `core/wailsBridge.ts`)**：
  * 深度定制 Warm Dark 暖炭黑界面（`#161412` 底色、`#F4F4F5` 字体、`#D96B27` 陶土暖橙高亮与提示符）；
  * 全局快捷键 **`Ctrl + \``**（或顶栏/活动栏终端按钮）瞬间唤起/隐藏抽屉，支持 `🗖` 高度平滑切换与清屏；
  * 双 Tab 架构：`$_ 终端控制台`（命令行交互与命令历史上下键回溯）+ `Agent 执行链路`（SSE 事件流实时 Trace）；
* **Windows 平台零弹窗与双通道流式管道 (`plugins/tool/terminal/terminal_tool.go` & `app.go`)**：
  * 后端启动子进程时严格注入 `CREATE_NO_WINDOW = 0x08000000` 与 `HideWindow: true`，**彻底杜绝任何 Windows CMD 黑色黑框弹出打扰用户**；
  * 基于 `StdoutPipe` 与 `StderrPipe` 双 Goroutine 并发读取，通过 Wails 事件系统（`terminal:data`）毫秒级打字机流式推送到前端，长命令无需等待全量阻塞；
  * 基于 `context.WithCancel` 支持用户一键 `[■ 终止]` 取消正在执行的进程，杜绝孤儿进程与句柄泄漏；
  * 执行目录物理锁定于工作区根目录，具备安全防穿越防护。

### 16. 高保真原型架构 100% 像素级对齐 (High-Fidelity Prototype Architecture Alignment)
* **顶层沉浸式标题栏 (`Titlebar.tsx`)**：
  * 高度严格锁定 38px，左侧呈现 `T` Logo、项目与分支徽标以及 `DeepSeek-V4 · 就绪` 绿色微核探针；
  * 中间集成单焦点工作区胶囊（`💬 智能对话` / `◫ 双栏协同` / `📝 代码工作区`）；
  * 右侧快捷集成终端抽屉开关、全局设置弹窗与原生窗口控制。
* **左侧 48px 极简活动栏与 260px 次级多功能抽屉 (`ActivityBar.tsx` & `LeftSidebar.tsx`)**：
  * 48px 活动栏挂载 7 大功能（`chat`, `files`, `git`, `usage`, `kg`, `mcp`, `terminal`），激活态伴随陶土暖橙左指示线；
  * 260px 次级抽屉实现平滑切换：会话分支抽屉（多工程折叠、`#标签` 快速筛选、分支切换与新建）、工程文件目录树、Git 源代码管理抽屉（分支徽标、AI 提炼提交信息、双层暂存列表）。
* **智能对话工作台与代码 Diff 深度联动 (`ChatCockpit.tsx` & `CodeWorkspace.tsx`)**：
  * 顶部多会话 Tab 切换与代码区展开/收起按钮；
  * 消息流完整呈现深度心智思考链卡片、多算子调用抽屉日志（`run_command`, `replace_file_content`, `invoke_subagent`, `tdd_test_runner`）；
  * **改动文件卡片组**：展示改动文件列表（`~M` / `+A`）与增删行数统计，点击 `查看 Diff` 立即在右侧 Monaco 打开行级双栏对比；
  * 底部高级输入舱挂载 `@` 引用弹窗（会话与技能）、`/` 快捷指令弹窗、`Act 极速双环` 标识与 `需人工审核` 切换开关；
  * 右侧暖炭黑（`#1E1C1A`）代码审查台配备 `✕ 放弃` 与 `✓ 一键采纳`。
### 17. 真实大模型流式推理与 ReAct 自主算子执行端到端闭环 (Autonomous ReAct Loop & Streaming E2E)
* **动态多模型网关与 WAF 穿透路由**：
  * 支持上游大模型官方端点与自定义 BaseURL（如 AgentRouter / SiliconFlow / 本地 Ollama），注入 `claude-cli` 客户端指纹穿透 WAF；
  * 严格 Fail-Closed 凭据纪律：未配置 API Key 时明确阻断提示，严禁内置后门或硬编码凭据，保障数据安全。
* **原生深度心智思考流实时推送 (`Thinking Stream`)**：
  * 自动解析并提取上游大模型原生输出的 `reasoning_content`（如 DeepSeek-V4、Claude 3.7 Thinking），通过 SSE 多阶段协议毫秒级流式推送至前端深度心智思考折叠卡片。
* **ReAct 自主物理算子调度闭环**：
  * 模型具备自主工具发现与执行能力：`run_command`（Windows 静默 Shell 命令）、`read_file`（受控安全读取）、`write_file`（原子安全写）、`git_status`（工作区状态感知）；
### 18. 高级 Git 控制中枢模态窗与 Token 效能监控大盘 (Git Modals & 24h Canvas Chart)
* **分支管理与即时检出模态窗 (`GitBranchModal.tsx`)**：
  * 支持本地与远程分支关键词即时过滤、当前活跃分支高亮指示、单键 `git checkout` 分支切换，以及一键基于当前分支检出新分支 (`git checkout -b <name>`)；
  * 严格遵循暖色极简与弹窗铁律：水平垂直居中、无多余拟物阴影、支持 Esc 退出与背景遮罩关闭。
* **微内核影子快照与 Stash 储藏中心 (`SnapshotModal.tsx`)**：
  * 双 Tab 架构：实时呈现系统在 Agent 修改物理文件前 5ms 自动生成的轻量影子快照（包含快照 ID、精确时间、受影响文件、操作说明与哈希）；
  * 提供「Diff 行级比对」与「一键秒级恢复」；集成 Git Stash 储藏栈与一键 Pop 恢复。
* **24 小时高帧率 Canvas 吞吐时序走势 (`ThroughputCanvas.tsx`)**：
  * 原生 HTML5 Canvas 自适应 Retina 高分屏（`window.devicePixelRatio`），按小时精准呈现输入/输出 Tokens 堆叠柱状图；
  * 支持鼠标在 Canvas 划过时实时计算时间切片，呈现悬浮数据探针与微秒级响应气泡。
* **客户端原生 CSV 审计报表导出**：
### 19. MCP 工具协议服务导入与 Agent 专家技能定制中心 (MCP & Skill Hubs)
* **MCP 工具协议服务导入模态窗 (`MCPImportModal.tsx`)**：
  * 支持三种录入路径：Claude Desktop / Cursor 标准 `mcpServers` JSON 一键粘贴（带语法校验与一键示例填入）、手动表单配置（支持 `stdio` 标准进程管道与 `sse` HTTP 管道）、以及社区官方精选服务（PostgreSQL 只读分析、GitHub API 自动化）一键安装；
  * 左侧 MCP 抽屉点击 `[ ➕ 添加 / 导入 MCP 协议服务 ]` 瞬间居中弹出，支持 Esc 与遮罩点击关闭。
### 20. Windows 独立桌面端安装包与自动化闭环发布 (`build-windows-installer`)
* **自动化增量编译流水线 (`build_installer.py`)**：
  * 联动前端 Vite 打包 (`npm run build`)，编译并生成高内聚桌面端微内核宿主 `Tcode.exe`（嵌入前端静态产物与 API 代理）；
  * 自动将微内核与运行时资源打包为自解压载荷，编译生成单文件安装向导 `dist/Tcode-Setup.exe` 并同步输出至 `release/Tcode-Setup-v2.0.0.exe` 与 `release/Tcode-Setup-v2.0.0-windows-x64.zip`；
### 21. 真实大模型自主 ReAct 物理编程实战验证 (Autonomous Coding Showcase)
* **模型选型与实测配置**：
  * 基于上游真实 `deepseek-v4-flash` 大模型与生产网关 `https://agentrouter.org`，执行首字延迟 (TTFT) 极速响应测试；
### 22. Vitest 单元测试矩阵与流水线构建门禁 (`test-automation-mock-governance`)
* **自动化测试套件架构**：
  * 基于 Vitest + JSDOM 构建现代测试环境，对核心状态机开展 100% 针对性测试：
    * [`workspaceStore.test.ts`](file:///d:/weihu/agent-learning/frontend/src/core/store/__tests__/workspaceStore.test.ts)：工作区模式切换、终端抽屉开关与多模态窗生命周期；
    * [`gitStore.test.ts`](file:///d:/weihu/agent-learning/frontend/src/core/store/__tests__/gitStore.test.ts)：分支列表过滤、检出切换、新建分支与影子快照；
    * [`settingsStore.test.ts`](file:///d:/weihu/agent-learning/frontend/src/core/store/__tests__/settingsStore.test.ts)：默认空 Key Fail-Closed 安全断言、运行时动态变更与面板唤起；
### 23. 系统原生文件夹选择与动态工作区装载 (Native Folder Picker & Dynamic Workspace)
* **Windows 原生对话框集成 (`backend/daemon.js`)**：
  * 基于 WinForms 原生 `FolderBrowserDialog` 与 `CREATE_NO_WINDOW` (`0x08000000`) 标志位，通过 `/api/workspace/pick-folder` 唤起操作系统级原生文件选择窗口，彻底告别浏览器端手输物理路径（严格遵照【铁律 5】）；
* **递归目录树与智能排除 (`scanDirectory`)**：
  * 自动智能排除 `node_modules`、`.git`、`dist`、`build`、`.venv`、`coverage` 等大体积目录；
  * 提供 `/api/workspace/set-root` 与 `/api/workspace/info` 接口，支持动态切换任意本地工程仓库；
### 24. 会话分支分叉与时空倒流 (Session Tree Forking & Time-Travel)
* **对话分支分叉 (Session Forking)**：
  * 支持在任意历史消息节点（无论是提问还是 AI 回复）一键点击 `[ 🌿 分叉分支 ]`；
  * 精准截取截至该节点的上下文记录，自动派生出带独立标识的平行分支（如 `架构重构 (分支 #2)`），并在左侧抽屉与顶栏无缝渲染；
  * 新旧分支彻底解耦，为高风险重构与技术方案探索提供安全试验场；
* **时光倒流回退 (Time-Travel Revert)**：
  * 支持点击 `[ ⏳ 回退至此 ]`，唤起居中弹窗确认后截断当前分支后续无效或走偏的探索，使上下文重新收敛聚焦；
### 25. 本地工程知识库 RAG 检索增强 (Local Knowledge RAG Engine)
* **四段论沉淀动态解析 (`backend/lib/knowledgeEngine.js`)**：
  * 自动深度遍历当前工程 `docs/knowledge/` 下全部实战经验（涵盖 WAF 穿透、静默 Shell、影子快照、安装包流水线等）；
  * 解析提取四段核心章节（① 问题背景 ➔ ② 核心原理 ➔ ③ 解决方案 ➔ ④ 避坑指南）；
* **多权重关键词与语义检索 (`/api/knowledge/search`)**：
  * 支持标题权重（10x）、避坑规范（5x）与实操方案（4x）的多层打分机制；
* **对话感知联动与星系研读视窗 (`KnowledgeGraphModal.tsx` & `ChatCockpit.tsx`)**：
  * 用户在对话框输入相关技术词汇时，输入框上方即时亮起 `💡 已智能匹配本地工程经验` 悬浮胶囊；
  * 点击一键展开沉淀星系图，直观查阅标准解决方案与防踩坑守则。

### 26. 源码 AST 模块依赖与架构调用拓扑 (AST Code Topology)
* **轻量级源码 AST 关系提取 (`backend/lib/astTopology.js`)**：
  * 毫秒级递归扫描项目前端与后端源码（自动忽略大型依赖与产物）；
  * 精准提取各源码模块导出的类、函数、组件标识 (`exports`) 与模块间的物理相对引用连线 (`imports`)；
* **可视化双向依赖探索网络 (`KnowledgeGraphModal.tsx`)**：
  * 实时呈现组件（Component）、状态机（Store）、微服务（Service）与核心模块（Module）；
  * 选定任意节点即可完整洞察其下游模块依赖（Imports）与上游被谁引用（Referenced By），彻底告别盲盒式重构。

### 27. Wails v2 + Go 1.22 纯原生桌面架构与单文件安装向导 (Wails Native Architecture & Standalone Go Installer)
* **Wails v2 生产级条件标签编译体系**：
  * 基于 Go 1.22 + Wails v2 + Vue 3.4 纯原生架构，采用 `-tags "desktop,production"` 彻底打通 Windows Edge WebView2 深度融合，去除空壳 Stub 回退，杜绝任何启动红叉异常；
  * 二进制裁剪采用 `-ldflags="-H windowsgui -s -w"`，剥离符号表与调试元信息，二进制体积直降 35%（~9.6MB），且彻底消除了任何控制台 CMD 黑色闪烁黑框；
* **纯 Go 嵌入式单文件自解压安装向导 (`bin/TcodeStudio_Setup_v2.0.0.exe`)**：
  * 基于 `//go:embed` 深度内嵌主桌面程序 `tcode.exe` 与独立卸载器 `uninstall.exe`，免除外部打包器依赖；
  * Win32 原生 API `MessageBoxW` 提供高亲和力安装向导交互；支持 `-silent` 极速静默安装；
  * 遵循现代桌面软件工程规范，自动部署至 `%LOCALAPPDATA%\Programs\TcodeStudio`（无需 UAC 提权干扰），全自动创建桌面与开始菜单快捷方式，并完整写入 Windows 注册表卸载中心；
* **铁律 1.5 物理闭环自动化验证体系**：
  * 物理安装验证 ➔ 真实进程生命周期探活 ➔ AgentRouter WAF 穿透流式推理 ➔ 真实工作区工具调用端到端回归，全链路保障高可靠交付。

### 28. MCP 跨进程 Stdio 工具注册与 ReAct 动态自主调度 (MCP Protocol Stdio & ReAct Dispatch Loop)
* **Anthropic MCP 标准协议支持**：
  * 基于标准输入输出（Stdio）管道与 JSON-RPC 2.0 报文，无缝支持第三方生态（如 `@modelcontextprotocol/server-filesystem`、PostgreSQL、GitHub API 等）的免侵入式挂载；
  * 实现完整的初始化握手协议（`initialize` ➔ `notifications/initialized`）、实时探活（`ping`）与工具动态探测（`tools/list`）；
* **Windows 零黑框外部进程管控 (`0x08000000`)**：
  * 在拉起任何外部 Node/Python 工具服务进程时，强制通过 `SysProcAttr.CreationFlags` 注入 `CREATE_NO_WINDOW = 0x08000000` 与 `HideWindow: true`，杜绝任何黑色 CMD 控制台窗口弹出打扰；
* **Manager 算子全局路由树与 ReAct 调度闭环**：
  * 管理器在内存中并发安全维护 `clients` 与 `toolRouting` 映射，启动时根据配置自动拉起已启用的服务；
  * 在大模型发起第一轮流式推理前，将本地沙箱工具（`exec_command`, `write_file`, `read_file`, `git_status`）与所有在线 MCP 算子合并生成工具集；
  * 当模型发起算子调用时，微内核在 $O(1)$ 时间内精准路由派发到对应子进程，执行后结果返回 ReAct 上下文驱动后续自愈推理，完成全自主端到端闭环。

### 29. LSP 编译器语法诊断自愈守卫与 MCP 服务治理看板 (LSP Diagnostics & MCP Management)
* **轻量级多语言编译器语法探针**：
  - 原生支持 Go (`go vet`)、TypeScript/JavaScript (`npx tsc --noEmit`) 与 Python (`python -m py_compile`) 毫秒级轻量静态检查；
  - 探针运行全程注入 Windows 零黑框标志位（`CREATE_NO_WINDOW = 0x08000000`），超时 4 秒严格熔断，不侵入主交互线程；
* **落盘即诊断与 ReAct 智能体自愈回路 (Self-Healing Loop)**：
  - 当大模型触发 `write_file` 动作原子落盘代码后，Go 微内核自动运行编译器诊断；若捕获未定义标识符、缺少 import 或语法红线，自动置顶追加至工具返回结果中，驱动大模型在下一轮循环中自动修复消除编译错误；
* **前端 MCP 运维可视化看板 (`SettingsModal.vue`)**：
  - 采用 Warm Minimalist 极简卡片，实时呈现服务在线状态指示灯、毫秒级握手延迟与算子数量；
  - 支持一键「⚡ 测速探活」，点击「查看算子 ▼」可平滑展开探测到的工具列表（名称与参数说明）；
  - 提供表单抽屉支持即时添加、编辑、持久化删除（`DeleteMCP`）以及一键启停服务。

### 30. 跨语言工程技术栈自适应探测与多轮自主 ReAct 自然收敛自愈状态机 (Language-Agnostic Stack Detection & Multi-Turn Autonomous Loop)
* **跨语言工程技术栈轻量探测 (`internal/core/sandbox/env_detect.go`)**：
  - 自动扫描工作区标记文件（`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`），毫秒级提取主语言、框架、构建工具与建议测试命令；
  - 动态注入 System Prompt 环境感知块，彻底消除硬编码单一语言偏见，让大模型自适应采取匹配的验证手段；
* **Zero Tool Calls 自然收敛多轮自愈状态机 (`app.go`)**：
  - 以“大模型判定目标已达成或无工具下发（Zero Tool Calls）”作为核心自然终止准则，摒弃机械的人工轮数限制；
  - 形成自动化闭环：`物理写盘 ➔ LSP 语法诊断 ➔ 注入报错 ➔ 自愈修复 ➔ 自主执行验证 ➔ 目标达成收敛交付`；
* **纯净零假数据与真实空状态架构 (Zero Demo & Clean Empty State)**：
  - 彻底清理前端、状态机与 IPC 桥接层所有硬编码的演示数据（假气泡、假思考、假工具调用、假 Diff 变更、预填 API Key、假终端命令）；
  - 全域落地纯净空状态（Clean Empty State）：初次打开、未连上游或无会话时真实暴露空提示与引导，严格 Fail-Closed 杜绝虚假繁荣；
* **LRU Map Markdown 渲染缓存与微触感交互响应**：
  - 引入 LRU 内存缓存池，彻底根除模板内联调用 `renderMarkdown` 导致的 DOM 全量重绘 CPU 抢占（Render Cascade）；
  - 弹窗与选项卡切换全面解耦阻塞性数据扫描，0ms 瞬间唤起并搭配优雅加载指示器；
  - 注入 `:active` 物理微触感反馈，全面提升交互操作响应速度与顺滑度。

### 31. 全域关键缺陷治理与桌面微内核工程加固 (Top 10 Critical Bug Eradication & Hardening)
* **凭据硬编码彻底拔除与 Fail-Closed 防御**：
  - 彻底清理后端配置中心与对话推理流中任何硬编码的测试 Token 与假模型 `deepseek-v4-flash`；
  - 遵循严格的 Fail-Closed 原则：当未配置模型渠道 API Key 时，立即向前端抛出结构化配置指引并终止推理，严禁静默回退；
* **OpenAI / DeepSeek 协议合规加固 (`Message.Content`)**：
  - 针对工具消息 (`role: "tool"`)，移除 Go 结构体 `Content` 字段的 `omitempty` 标签，确保即便工具执行标准输出为空字符串也严格序列化传输 `"content": ""`，100% 消除上游网关 400 Bad Request 校验拒绝；
* **Wails IPC 全局事件监听器泄漏根治**：
  - 在 `wailsBridge.sendMessage` 中引入自动化解绑生命周期守护，在流式连接建立前与完成时调用 `runtime.EventsOff` 注销全局总线监听器，根治多轮会话导致的 Chunk 翻倍打印与内存雪崩；
* **深层递归文件树与沉浸式无边框窗体控制**：
  - 重构 `GetFileTree` 为支持 4 层深度递归扫描并自动过滤构建依赖目录（`.git`, `node_modules`, `bin`, `dist` 等）；
  - 标题栏注入 `--wails-draggable:drag` 原生拖拽，右上角无边框控制按钮完整打通最小化、最大化/还原与安全退出；
* **安装包自定义路径隔离与卸载器全盘防误杀守卫**：
  - 单文件安装程序全面支持 `--dir=`, `-dir=`, `/D=`, `--silent-install-dir=`，自动对自定义目录校验并补齐 `TcodeStudio` 隔离子目录；
  - 卸载程序引入物理路径多重安全断言（禁止系统根目录、禁止非 `TcodeStudio` 目录整体 `rmdir`），并采用 `CREATE_NO_WINDOW` 隐蔽控制台执行自清理。

### 32. 进程树生命周期隔离、Untracked Diff 适配与全模态窗完整性治理 (Process Tree Isolation & UI Modal Completeness)
* **Windows 孤儿进程树安全治理 (`KillProcessTree`)**：
  - 针对外部 MCP Stdio 协议与流式长耗时命令，在用户中止或上下文超时时，注入 `CREATE_NO_WINDOW`（`0x08000000`）执行 `taskkill /F /T /PID <pid>` 强杀完整子进程树，彻底根除 Windows 控制台黑框弹窗与管道读写永久锁死挂死；
* **Git Porcelain 全维度差异与 Untracked 物理撤销**：
  - 打破传统 `git diff` 无法计算工作区未追踪（Untracked）新文件的盲区，结合 `git status --porcelain` 自动识别 `??` 与 `A ` 文件并生成行级全量绿字新增块（`+N 行`）；
  - `RevertFile` 在 `git checkout` 失败时智能回退物理安全清理（`os.Remove`），杜绝撤销新文件时的崩溃；
* **沙箱盘符大小写归一化与原子写抗争机制**：
  - 对 Windows 盘符进行小写归一化规约，杜绝跨大小写（如 `d:` vs `D:`）导致的路径越界误报拦截；并在目标文件被外部读取句柄锁定时提供覆写重试与容灾回退；
* **多轮自主 ReAct 算子执行全时序链路持久化**：
  - 在会话持久化实体中扩展 `Tools []ToolExecution` 切片，支持单条消息中多次算子调用的完整持久化存储与时序动态展开；
* **前端全模态窗闭环与人机工学规约补齐**：
  - 完整补齐 MCP 导入、Agent 技能创建、工程规约新增等全套居中暖色模态窗，提供显式 `[X]`、`Esc` 退出与键盘监听；
  - 补齐 AST 架构拓扑实体至主输入框的一键引用注入（`injectNodeToPrompt`）与代码变更真实物理暂存（`stageFileAction`）。

### 33. 文件树与会话防穿越守卫、编译诊断无网络阻断与前端状态洁净性 (Path Traversal Defense & Session Hygiene)
* **会话 ID 白名单清洗与越界删除安全守卫**：
  - `Store.Get` / `Save` / `Delete` 引入 `sanitizeID` 白名单校验，彻底阻断利用 `../../` 遍历、覆盖或删除会话目录外任意物理文件的路径穿越攻击；
  - 根除遗留硬编码默认标签 `核心架构`，遵循数据洁净原则设为 `默认`；
* **文件树受控沙箱绝对路径校验与 500 节点防环熔断**：
  - `GetFileTree` 与 `buildFileTree` 强制经由受控沙箱 `ValidatePath` 校验并利用 `EvalSymlinks` 阻断软链接循环递归，设定 500 节点全局上限，杜绝超大目录导致客户端 DOM 渲染卡死；
* **文件回滚物理删除沙箱校验隔离 (`RevertFile`)**：
  - 严格校验相对路径是否越出工作区，彻底消除 `git checkout` 失败回退删除未追踪文件时的越权任意文件删除漏洞；
* **会话数据原子写隔离 (`atomicWriteSession`)**：
  - 会话磁盘存储全量采用“临时文件写入 + 磁盘同步 + 原子重命名”机制，杜绝断电或高频流式交互时的 JSON 数据撕裂与空文件损坏；
* **大模型用量遥测成本精准核算**：
  - 彻底铲除遥测模块中误用 `time.Now().Format` 导致成本输出系统时间的 Bug，基于 Token 吞吐真实核算并格式化精准美元开销；
* **Windows 全链路外部进程零黑框防护规约**：
  - 全局封装 `windowsSysProcAttr()`，为微内核调用的所有 Git、Npx、Python 进程强制注入 `0x08000000` (`CREATE_NO_WINDOW`) 与 `HideWindow: true`，杜绝一切黑框弹窗闪烁；
* **JSON-RPC ID 宽容解析与非阻塞投递**：
  - MCP Stdio 客户端完整支持 `string`、`int`、`float64` 与 `json.Number` 多类型 Request ID 解析，并在 channel 投递处增加 non-blocking `select` 保护，防止 reader 协程永久挂起；
* **流式生成中删除会话防幽灵复活**：
  - 前端删除当前正在生成的会话前先主动触发 `stopGenerationAction()` 中断底层流式上下文，杜绝异步落盘导致已删除会话在磁盘上重新复活。

### 34. 动态工作区热切换、稀疏工具调用治理与脱机卸载自毁 (Workspace Hot-Swap, Sparse Tool Indexing & Detached Uninstaller)
* **动态工作区热切换与原生目录拾取器 (`OpenDirectoryDialog` & `SetWorkspace`)**：
  - 彻底铲除顶栏项目名硬编码 `agent-learning` 缺陷，标题栏与工程资源管理器同步展示当前活动目录，支持点击调起系统原生文件管理器原生拾取文件夹（`runtime.OpenDirectoryDialog`，符合铁律 5）；
  - 微内核实现 `SetWorkspace` 动态热更新机制，无缝重载受控沙箱、快照管理器、Git 状态检测、受控终端与 MCP 管理进程，并即时联动刷新前端文件树与 AST 代码拓扑；
* **多工具调用稀疏索引数学陷阱根治**：
  - 针对大模型返回的 `tool_calls` 切片可能带有稀疏或非零 index 的协议特征，摒弃危险的 `0..len-1` 连续下标假设，重构为 key 收集与 `sort.Ints` 升序遍历，确保所有高位索引工具调用 100% 完整捕获与并发调度；
* **SSE 思考流 10MB 动态缓冲与长文本容灾**：
  - 将 Go `bufio.Scanner` 默认 64KB 缓冲区扩容至 10MB 动态上限，全面防御 DeepSeek-R1、Claude 3.7 Sonnet 等超长心智思维链导致的 `bufio.ErrTooLong` 溢出截断，并显式拦截 `scanner.Err()` 抛出结构化网络错误；
* **受控文件工具 Sandbox 空指针 Panic 拦截**：
  - 在 `fstool.Execute` 顶部引入前置防御，未就绪或未初始化时优雅报错，严禁空指针解引用崩溃；
* **Swarm 算子化验证 60s 硬超时与 Windows 零黑框**：
  - `RunTDDValidation` 引入 60 秒绝对上下文超时控制与 `0x08000000` 零黑框标志位，根除测试子进程永久挂起与弹窗闪烁；
* **ShellExecuteW 异步脱机批处理与进程树自毁安全**：
  - 安装器与卸载器 `taskkill` 注入 `/T` 递归树杀，杜绝残留孤儿工具链进程；
  - 卸载器采用 Win32 API `ShellExecuteW` 异步脱机拉起延时清理批处理（`SW_HIDE`），彻底脱离父进程控制台管道生命周期，配合 `(goto) 2>nul & del "%~f0"` 实现干净彻底的无残留静默卸载自清理。

---

## 🎨 四、视觉与人机工程学规范

* **主背景色**：`#FAF8F5` (Warm Cream 柔和暖米白)
* **工作台底色**：`#F4EFEA` (Workspace Muted 米灰)
* **品牌强调色**：`#D96B27` (Terracotta Orange 陶土暖橙)
* **代码暖黑**：`#1E1C1A` (Code Dark 暖炭黑)
* **人机工学与弹窗铁律**：单主轴聚焦切换，16:9 原生工作台视野；**全系统所有模态窗严格居中，统一配备右上角显式 `[X]` 关闭按钮与悬停 Tooltip，且 100% 支持全局 `Esc` 快捷键层级化阻断退出与背景遮罩点击关闭**。

---

## 🛠️ 五、本地构建与安装包运行

### 1. 运行 Go 微内核与真实模型测试
```bash
# 运行全部内部单元测试
go test ./internal/...

# 运行真实 AgentRouter 网关流式与工具调用端到端测试
go test -v -timeout 60s ./internal/llm
```

### 2. 编译前端生产静态资源
```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. 一键编译 Wails 原生桌面程序与单文件安装向导
```bash
# 编译主程序 (带桌面生产标签与 GUI 子系统)
go build -tags "desktop,production" -ldflags="-H windowsgui -s -w" -o bin/tcode.exe .

# 编译独立卸载程序
go build -ldflags="-H windowsgui -s -w" -o bin/uninstall.exe ./cmd/uninstaller

# 封装单文件安装向导
copy bin\tcode.exe cmd\installer\assets\
copy bin\uninstall.exe cmd\installer\assets\
go build -ldflags="-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe ./cmd/installer
```

### 4. 真实端到端安装与启动验证 (铁律 1.5)
```powershell
# 方式 A: 默认路径快速静默安装 (安装至 %LOCALAPPDATA%\Programs\TcodeStudio)
Start-Process -FilePath ".\bin\TcodeStudio_Setup_v2.0.0.exe" -ArgumentList "-silent" -Wait

# 方式 B: 指定自定义路径静默安装 (支持 -dir, --dir, /D= 等业界标准参数)
Start-Process -FilePath ".\bin\TcodeStudio_Setup_v2.0.0.exe" -ArgumentList "-silent -dir ""D:\Custom\TcodeStudio""" -Wait

# 方式 C: 交互式向导安装 (双击直接运行)
# 弹窗提示默认路径与自定义选择；点击【否】自动唤起 Windows 系统原生资源管理器文件夹浏览选择，无黑框闪烁

# 启动并检查进程探活
Start-Process -FilePath "$env:LOCALAPPDATA\Programs\TcodeStudio\tcode.exe"
```
