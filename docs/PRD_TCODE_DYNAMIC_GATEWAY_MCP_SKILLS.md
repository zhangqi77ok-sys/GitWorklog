# Tcode 智能体模型网关、MCP 服务与 Agent Skill 规范规约 (PRD)

## 1. 业务背景与业界标准对齐
在生产级智能体开发平台（如 sub2api、Claude Desktop、Cursor Rules、OpenDevin、Cline）中：
1. **模型网关 (Model Gateway)**：
   - 厂商（Provider Platform）与接入认证方式（Ingress Type）必须具备强联动约束，不同厂商原生支持不同认证矩阵；
   - 凭据输入区域随接入方式动态渲染，提供 API Key、Sub2 订阅链接与账号池熔断、Cap 凭据包长文本/JSON 粘贴、OAuth 2.0 官方授权登录、自建反代等专属表单。
2. **MCP 协议管理 (Model Context Protocol)**：
   - 支持完整 `stdio` 本地进程（自定义命令、参数表、环境变量 Key-Value 动态表）与 `sse` 远程事件流端点；
   - 支持服务连通性探活与可用工具清单探测（Probe Tools）；
   - 支持 Claude Desktop `claude_desktop_config.json` 格式一键导入。
3. **Agent Skill 技能管理**：
   - 技能是智能体系统提示词与执行工作流的专业封装；
   - 支持触发词（`/review`, `/tdd`, `/security`, `/perf` 等）、适用场景描述与多行 Markdown 核心指令编辑；
   - 提供开箱即用的业界预设模版一键套用。

---

## 2. 核心架构与数据结构

### 2.1 平台与认证动态矩阵 (Platform Matrix)
| 平台名称 (ID) | 默认端点 | 支持认证接入方式 | 推荐认证 |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude** | `https://api.anthropic.com/v1` | `api_key`, `cap`, `sub2`, `oauth`, `proxy` | `api_key` |
| **OpenAI** | `https://api.openai.com/v1` | `api_key`, `cap`, `sub2`, `oauth`, `proxy` | `api_key` |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `api_key`, `oauth`, `sub2`, `proxy` | `api_key` |
| **DeepSeek** | `https://api.deepseek.com/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **SiliconFlow** | `https://api.siliconflow.cn/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Moonshot Kimi** | `https://api.moonshot.cn/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Zhipu GLM** | `https://open.bigmodel.cn/api/paas/v4` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Ollama Local** | `http://127.0.0.1:11434/v1` | `proxy`, `api_key` | `proxy` |

### 2.2 凭据输入动态渲染规范
- **API Key**：`API Key` 密码掩码输入框（带眼睛图标显隐）+ 自定义 Header 标识；
- **Sub2 订阅**：订阅链接文本框 + 账号池刷新间隔 (TTL) + 账号池同步探测按钮；
- **Cap 凭据包**：Session Token / Claude setup-token / Cookie 下拉选择 + 多行文本域 (textarea) 粘贴；
- **OAuth 2.0**：Client ID + Client Secret + 官方授权登录按钮；
- **Proxy 代理**：中转端点 + 访问令牌（本地模型可选留空）+ 协议模拟转换。

### 2.3 MCP 服务管理规范 (McpServerModal)
- 传输类型切换：`stdio` vs `sse`；
- Stdio 模式：命令行进程 `command`（`npx`, `python`, `uvx`, `docker` 等）与 `args` 拆解输入；
- SSE 模式：远程端点 URL；
- 环境变量：动态增删 Key-Value 环境变量表；
- 探活与工具探测：支持在线测试 MCP 协议连通性并拉取可用工具清单。

### 2.4 Agent Skill 技能管理与多源导入规范 (SkillModal)
- **多源导入与创建向导架构**：
  - **📥 外部文件/目录导入 (File & Directory Import)**：支持拖拽或选取本地 `SKILL.md` 规范文件与目录，自动解析 YAML Frontmatter 元数据（name, description, triggers）与 Markdown 工作流正文；
  - **✍️ 可视化自定义创建 (Visual Custom Builder)**：录入技能唯一标识 (Skill ID)、所属领域分类、触发条件与详细规约，支持一键载入经典 TDD 自愈规范模板；
  - **🌐 官方推荐专家市场 (Skill Hub / Marketplace)**：内置 Rust 微内核专家 (`rust-core-engineer`)、UI/UX 规范专家 (`ui-ux-pro-max`)、测试驱动专家 (`test-automation-mock-governance`) 与分布式架构专家 (`cloud-distributed-guard`) 等工业级技能，支持一键载入并即时激活。
- **状态联动与动态呈现**：
  - 导入或创建成功后，即时动态追加至 Skill 卡片网格流，实时更新“X 个已加载”徽标，并向用户提示暖色微交互反馈。

---

### 2.5 全局弹窗与人机交互规范 (Modal Interaction & Escape Rules)
根据项目铁律与工业级人机工程学标准，系统内所有弹窗必须严格遵守三维规范：
1. **显式关闭控件**：
   - 所有的模态窗右上角必须拥有清晰可见的 `[X]` 关闭按钮，并配置悬停说明 `title="关闭 (Esc)"`；
2. **Esc 快捷键层级化阻断退出**：
   - 全局挂载 `Escape` 键盘监听器，按优先级退出：优先关闭输入辅助浮层（`@` 与 `/`），其次关闭二级子弹窗（渠道配置、Skill 导入、MCP 导入、规则配置、知识实体、Git 分支弹窗、影子快照弹窗），最后关闭一级全景工作舱（知识图谱全景看板、系统设置中枢、模型使用大盘）；
3. **点击遮罩退出**：
   - 点击暗色半透明遮罩背景（`bg-black/45`）区域触发安全关闭；
4. **禁止原生弹窗**：
   - 全链路严禁使用浏览器原生 `alert()` / `confirm()` / `prompt()`。

---

## 3. 单焦点主工作区与集成式可折叠终端抽屉规约

### 3.1 单焦点工作区聚合切换 (Single-Focus Workspace Switcher)
1. **业务痛点**：传统 AI IDE 将会话历史、对话交互流、代码编辑器三列并排平铺，导致在 16:9 或笔记本屏幕下对话流极度挤压，开发者无法聚焦。
2. **交互三态切换**：
   - **`[💬 智能对话 (Chat)]`**：全宽沉浸式对话与任务编排，右侧代码区折叠收拢，主视口宽阔呼吸感强；
   - **`[◫ 双栏协同 (Split)]`**：左侧对话流 + 右侧代码/Diff 对照审查，兼顾即时沟通与文件改动审查；
   - **`[📝 代码工作区 (Editor)]`**：全宽展开 Monaco 代码编辑器与 Diff 比对视窗，对话区收拢，提供沉浸式编程排障环境；
3. **智能平滑流转机制**：
   - 在全宽对话模式下，用户若点击对话流中产生的文件改动卡片或 Diff 审查触发器，系统自动平滑切入「双栏协同」；代码工作区右上角提供全屏/分屏/收起快速操作组。

### 3.2 底部集成式可折叠终端抽屉 (Terminal Drawer)
1. **设计定位**：为本地微内核 Tokio 协程、Go 算子命令执行与系统守护进程提供即时可见的桌面端交互控制台。
2. **物理布局与快捷唤起**：
   - 固定悬挂于主工作台正下方，默认高 `230px`，支持最大化拉伸至 `48vh` 与一键收起；
   - 继承代码暗炭黑背景（`#161412`），具备独立的 `32px` 顶栏标签与操作区；
   - 全局支持快捷键 **`Ctrl + \``**（反引号）瞬间唤起或收起终端抽屉。
3. **三大核心 Tab 视窗**：
   - **`$_ pwsh 命令行终端 (Shell)`**：真实响应用户手动输入的常用工程指令（`go test`, `git status`, `cargo check`, `go build`, `clear` 等），并与对话流中 Agent 执行的 `run_command` 实时联动；
   - **`⚡ Agent 执行链路 (SSE Trace)`**：流式推送微内核 Inner Loop、算子分发事件、TTFT 延迟与 Token 开销；
   - **`🛰️ Tokio 微内核状态 (Daemon)`**：展示 Tokio 异步协程池、活动 Worker 数量、零泄漏内存占用与影子 Git 快照回退保护状态。

---

## 4. 高频生产级 Git 控制中枢与影子快照规约

### 4.1 双层暂存管理架构 (Dual-Layer Staging Workflow)
1. **已暂存的更改 (Staged Changes)**：展示通过 `git add` 暂存的文件列表，支持单文件/全部取消暂存 (`git restore --staged`) 与行级 Diff 比对；
2. **工作区更改 (Working Tree Changes)**：展示本地正在编辑但未暂存的文件（M/U/D 状态与增删行数统计），支持一键全量暂存 (`git add .`)、单文件/全部放弃更改 (`git restore .`)。

### 4.2 AI 辅助 Conventional Commits 提交面板
1. **多行提交信息输入框**：支持 `Ctrl+Enter` 快速提交；
2. **「🪄 AI 提炼」引擎**：深度分析当前暂存区代码 Diff 与架构影响，一键自动生成标准规范（如 Conventional Commits: `feat/fix/refactor(...)`）的语义化说明；
3. **提交与推送双模式**：提供 `✓ 提交更改` 与 `Commit & Push` 操作出口。

### 4.3 即时分支管理与检出弹窗 (`gitBranchModal`)
1. 顶栏常驻当前分支胶囊徽标（如 `🌿 main`），点击弹出符合规范的居中模态窗；
2. 支持本地/远程分支列表即时检索过滤；
3. 支持一键基于当前分支检出新分支 (`git checkout -b <name>`) 与即时分支切换。

### 4.4 微内核影子快照与 Stash 储藏栈 (`gitStashSnapshotModal`)
1. **影子快照防护 (Shadow Snapshot)**：Agent 在自主写代码或打补丁前，Tokio 微内核自动在本地生成快照锚点，界面清晰列出生成时间、关联文件与触发说明，支持一键秒级无损回退；
2. **Git Stash 储藏栈**：支持一键将当前未完工的工作区储藏 (`git stash`)，并在储藏列表中随时一键 `Pop` 恢复或审查。

---

## 5. 多模型使用量与 Token 消耗监控大盘规约 (Model Usage & Analytics Cockpit)

### 5.1 活动栏专属导航与侧边抽屉速览
1. 最左侧 48px 活动栏常驻数据图表导航位（`act-btn-usage`），带有悬停 Tooltip；
2. 点击后次级抽屉展开 `drawer-usage`，展示今日总消耗概览、模型配额占比进度条与导出报表入口。

### 5.2 中央全景效能监控大盘工作舱 (`usageCockpitView`)
1. **四维核心 KPI 矩阵**：
   - **今日 Token 总吞吐**：区分输入/输出明细与环比趋势（如 342,850 Tokens，环比 +18.4%）；
   - **预估累计费用**：展示当日花费金额（人民币与美元双币折算）及日预算水位警戒线；
   - **平均首字延迟 (TTFT)**：实时加权各活跃模型的物理网络延迟表现（如 DeepSeek 420ms，Claude 1,150ms）；
   - **Prompt Cache 节省率**：展示提示词前缀缓存所节约的 Tokens（如节约 182k Tokens）与节约资金；
2. **多模型明细对比与 24 小时吞吐波形走势**：
   - 按消耗量排序展示各模型（DeepSeek-V4-Flash, Claude-3.7-Sonnet, GPT-4o, 本地 Ollama）的调用占比、平均耗时与费用；
   - 24 小时柱状时序走势图，支持鼠标悬停浮动查看每个时间段的调用峰值；
3. **实时微内核调度审计流 (Live Dispatch Stream)**：
   - 流式呈现最近调用的底层算子、输入/输出 Token 明细、精确耗时与 HTTP 200 状态；
4. **时间切片与导出功能**：
   - 支持「今日 (24h)」、「近 7 天」、「本月」三档动态切片；
   - 提供 CSV 审计流水导出；
   - 支持按 `Escape` 快捷键瞬间切回智能对话工作台。

