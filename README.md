# Tcode (Next-Gen AI Agentic Studio)

新一代开源 AI 编程桌面工作台，基于 **Tauri v2 + Tokio 异步 Rust Core Daemon + React 19 + TypeScript**，采用 **Inner/Outer Loop 统一双环执行内核**、**Rail 能力插件体系** 与 **Swarm Flow 算子化多智能体编排流**，严格遵循暖米白（`#FAF8F5`）、工作台米灰（`#F4EFEA`）与陶土暖橙（`#D96B27`）的极简工程人机美学规范。

---

## 🏛️ 一、核心架构设计 (Unified Dual-Loop & SwarmFlow Architecture)

Tcode 打破了单体硬编码调度逻辑，将 Agent 的执行循环、能力轨道、多智能体协同编排与表现层彻底解耦：

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Tcode Frontend (React 19 + TypeScript)                    │
│      [ 单焦点主工作区 (智能对话 / Monaco编辑器 聚合切换) | Diff 对比 | 终端抽屉 | 纯净空状态 ]       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Tauri v2 Zero-Copy IPC / Typed Event Streams
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          Tcode Rust Core Daemon (Tokio Async Engine)                   │
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
  * `🛰️ Tokio 微内核状态`：实时呈现协程池活跃 Worker、零泄漏内存监控与影子 Git 保护状态。

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
* **多源导入与一键激活**：支持直接从本地文件系统拖拽/选取 `SKILL.md` 规约文件与目录，自动解析 Frontmatter 元数据；同时内置官方专家技能市场（Rust 微内核、UI/UX 规范先行、TDD 测试治理、分布式架构守卫）；
* **指令驱动触发**：支持在对话框中以 `/` 触发词（如 `/review`, `/tdd`, `/security`, `/perf`）精准调用；
* **多行 Markdown 系统级指令**：支持舒适编辑系统提示词，规范角色契约、执行流、审查清单与输出格式；
* **业界经典预设一键套用**：内置 Thermo-Nuclear 架构审查专家、TDD 红绿重构测试生成器、全维白盒安全守卫、性能与并发调优专家模版。

### 8. 纯净零数据初始状态 (Zero Demo & Clean Empty State)
* 严格执行无假数据铁律，初次启动呈现干净的 0 项目、0 会话状态，只有用户显式打开本地项目后才载入工作区。

### 9. 生产级前后端基础工程框架与原生双轨上游驱动 (Base Framework & Dual-Track Upstream Drivers)
* **后端 Go 插件式微内核 (`backend/`)**：
  * **强类型 SPI 契约 (`pkg/plugin/v1/`)**：规范 `Plugin`、`ProviderPlugin` (带背压通道)、`ToolPlugin` (入参 Schema 校验)、`RailPlugin` (多阶段拦截与阻断)；
  * **分段锁注册中心 (`internal/host/registry.go`)**：无全局大锁，支持高并发读取与按优先级降序调度；
  * **Panic 隔离看门狗 (`internal/host/guard.go`)**：结合 `recover()` 与 `debug.Stack()` 捕获插件堆栈，保障微内核常驻守护进程 100% 高可用；
  * **OpenAI 与 Claude 双轨原生上游驱动**：中立规范层 (`pkg/protocol/canonical.go`) 抹平协议差异，原生支持 OpenAI Chat Completions 协议族（GPT-4o、DeepSeek、SiliconFlow）与 Anthropic Claude Messages API 官方协议（支持 Claude 3.7 Thinking 深度思考流与 Prompt Caching 用量审计）。
* **前端 React 19 现代工程 (`frontend/`)**：
  * 基于 **React 19 + TypeScript 5.5 (Strict) + Vite 6 + Tailwind CSS v4**；
  * 完整落地 Warm Minimalist 调色盘（`#FAF8F5` / `#F4EFEA` / `#D96B27`）与 16:9 人机工学单焦点视口布局；
  * 顶栏单焦点切换胶囊（`💬 对话` / `◫ 双栏协同` / `📝 代码区`）、48px 侧边活动栏、生产级双层 Git 源码控制面板与集成终端抽屉（`Ctrl + \`` 全局快捷唤起）。

### 10. 首条端到端流式推理闭环与深度思考卡片 (End-to-End Streaming Loop & Thinking Block)
* **首个模型驱动插件落地 (`backend/plugins/provider/openai/`)**：
  * 基于 `net/http` 原生实现 OpenAI / DeepSeek SSE 流式长连接；
  * 自动识别并无损剥离 `<think>...</think>` 思考流与正文流，实时统计 Token 消耗；
  * 提供轻量 `Ping()` 探针，毫秒级探测网络 TTFT 表现。
* **本地环回 SSE 传输服务 (`backend/internal/transport/http/`)**：
  * 监听 `127.0.0.1:8765`，暴露 `/api/health` 探活与 `/api/chat/stream` SSE 流式端点；
  * **客户端断开级联取消**：当检测到前端断连时，立即中止向上游模型的拉取协程，杜绝 Token 浪费。
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
  * **万行 Diff 虚拟化审查 (Diff Reviewer)**：一键切入 Monaco `DiffEditor` 双栏对比，左侧基准（Git HEAD 原始快照）与右侧最新改动红绿对照，右上角悬浮工具条提供一键放弃更改（`Restore`）与一键暂存（`Stage`）。
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

### 15. 受控集成终端与静默无弹窗 Shell 算子 (Integrated Terminal & Silent Shell Executor)
* **Xterm.js 现代虚拟终端 (`frontend/src/app/terminal/TerminalDrawer.tsx`)**：
  * 深度定制 Warm Dark 暖炭黑界面（`#1E1C1A` 底色、`#FAF8F5` 字体、`#D96B27` 陶土暖橙呼吸光标）；
  * 支持键盘自由键入、命令历史记录、ANSI 彩色高亮流式渲染与 `@xterm/addon-fit` 视口自适应；
  * 顶部控制栏集成常用快捷胶囊（`git status`、`git log`、`npm test`）、快捷清屏与平滑高度伸缩；
* **Windows 平台零弹窗铁律 (`backend/plugins/tool/terminal/terminal_tool.go` & `daemon.js`)**：
  * 后端启动子进程时严格注入 `CREATE_NO_WINDOW = 0x08000000`（Node.js `windowsHide: true`），**彻底杜绝任何 Windows CMD 黑色黑框弹出打扰用户**；
  * 执行目录物理锁定于工作区根目录，支持超时保护与安全防穿越；
* **Agent 自主构建与验证算子 (`exec_command`)**：
  * 注册进微内核执行引擎，赋予 ReAct 智能体修改代码后自主执行单测（`npm test`）与编译构建（`go build`）的自愈闭环能力。

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
* **暖色模态窗体系 (`TimeTravelModal.tsx`)**：
  * 严格贯彻【铁律 5】，采用屏幕绝对居中、支持 `Esc` 快捷键退出与显式右上角关闭按钮，提供自定义分支命名与消息截取感知。

---

## 🎨 四、视觉与人机工程学规范

* **主背景色**：`#FAF8F5` (Warm Cream 柔和暖米白)
* **工作台底色**：`#F4EFEA` (Workspace Muted 米灰)
* **品牌强调色**：`#D96B27` (Terracotta Orange 陶土暖橙)
* **代码暖黑**：`#1E1C1A` (Code Dark 暖炭黑)
* **人机工学与弹窗铁律**：单主轴聚焦切换，16:9 原生工作台视野；**全系统所有模态窗严格居中，统一配备右上角显式 `[X]` 关闭按钮与悬停 Tooltip，且 100% 支持全局 `Esc` 快捷键层级化阻断退出与背景遮罩点击关闭**。

---

## 🛠️ 五、本地构建与安装包运行

### 1. 运行单元测试
```bash
npm test
```

### 2. 启动前端开发调试
```bash
npm run dev
```

### 3. 一键构建生产环境 Windows 安装包
```bash
npm run build:installer
```
* **构建产物**：
  * `Tcode-Setup.exe`（项目根目录）
  * `release/Tcode-Setup-v2.0.0.exe`
  * `prototype/swarm_flow_interactive.html`（可交互编排原型系统）
