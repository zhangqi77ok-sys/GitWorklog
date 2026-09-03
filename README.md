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
