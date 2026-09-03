# Tcode Studio v2.0 系统技术架构设计与 IPC 接口规范说明书
> **版本**：v2.0.0-PROD  
> **状态**：正式发布（对齐 `web_prototype.html` 6,987 行生产级设计工程）  
> **编写者**：Go 微内核架构师 + Vue 前端架构师  
> **对齐日期**：2026-09-03  

---

## 1. 架构总览与核心设计原则 (System Overview & Principles)

### 1.1 产品定位
`Tcode Studio v2.0` 是一款面向多代理协同、全自主循环编程与微内核驱动的 AI 原生桌面端智能体工作台。系统全面弃用传统跨进程胶水与 Mock 欺骗架构，采用 **Go 1.22 强类型微内核 + Wails v2 极速二进制绑定 + Vue 3 响应式设计系统**，提供无边框极简的专业工程师级交互体验。

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                  Tcode Studio v2.0 呈现工作舱 (Presentation Layer)            │
│  [38px 无边框标题栏]  [48px 极简活动栏]  [三合一侧边抽屉]  [右侧 Monaco Diff 审查] │
│      [ReAct 思考与算子流]     [Sub-Agent 多代理协作]     [参数多选交互卡片]       │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                      Wails v2 纯原生双向 IPC 通信管道
     (Promise 异步 RPC 调用 + Runtime Events 双向分轨低延迟打字机推流)
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                   Go 1.22 智能体微内核 (Agentic Microkernel)                  │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │   自主 ReAct 双环调度   │  │   Sub-Agent 协同引擎  │  │  安全沙箱与拦截器   │ │
│  │ (LLM Client + Tools)  │  │ (TDD 验证 / 代码审查) │  │  (OS/Cmd 权限收敛) │ │
│  └───────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │   Git 结构化行级 Diff  │  │  Go AST 静态语义分析  │  │  磁盘持久化中枢    │ │
│  │  (物理回滚 / 采纳暂存) │  │ (全工程代码拓扑扫描)  │  │ (~/.tcode/ 存储库) │ │
│  └───────────────────────┘  └──────────────────────┘  └────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
           标准化 HTTPS/SSE 协议 (带 Codex 指纹与 Originator 鉴权头)
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│              多模型网关调度池 (AgentRouter / OpenAI / Anthropic)              │
│       [gpt-5.6-sol]   [claude-opus-4-8]   [deepseek-v4-flash]   [glm-5.3]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心架构铁律 (Iron Architecture Rules)
1. **Zero Demo / 零假数据原则**：
   - 禁止在生产链路中使用 `setTimeout` 伪造假回复；
   - 禁止使用 `Math.random()` 伪造延迟数字；
   - 所有的测速、模型抓取、代码对比、文件撤销与指令执行，必须且仅能由 Go 微内核调用真实操作系统底层 API 或云端真实网关完成。
2. **数据本地私有化 (Local-First Privacy)**：
   - 所有运行时会话、网关凭据、MCP 服务协议、Skill 技能库和软件工程规则，均保存在用户家目录下的规范目录中：`~/.tcode/`。
3. **单可执行文件封装 (Zero External Dependency)**：
   - 生产环境编译产物必须为单一无黑框 Windows 原生 GUI 文件（`bin/tcode.exe`），内置完整的静态前端资源，运行时零额外动态链接库依赖。

---

## 2. 前端 12 大功能模块与视图规约 (Matching `web_prototype.html`)

前端界面严格 1:1 对齐 `web_prototype.html` 的 6,987 行样式体系，采用 **Linear / OpenAI 现代工程美学（陶土暖橙 `#D96B27`，暖米白背景 `#FAF8F5`，暗黑高对比代码块 `#18181B`）**。

| 模块序号 | 模块名称 | 原型核心元素与交互规范 | Go 后端支撑机制 |
| :---: | :--- | :--- | :--- |
| **01** | **沉浸式标题栏 (Titlebar, 38px)** | Logo `T`、`agent-learning/main` 标识、模型呼吸灯状态胶囊、`Ctrl+K` 快速检索栏、知识图谱与设置入口、原生窗口三键。 | 暴露 `GetGitStatus()` 提取当前真实 Git 分支名。 |
| **02** | **主活动栏 (Activity Bar, 48px)** | 6 个专属极简线条 SVG 图标（对话工作台、工程文件树、Git版本控制、知识图谱、MCP技能库、设置）。 | 驱动前端工作舱视图秒级路由切换。 |
| **03** | **多轮会话抽屉 (Session Tree)** | 5 种场景标签筛选（`全部`、`#核心架构`、`#单测自愈`、`#网关调度`、`#安全防护`）、新建会话按钮、会话卡片。 | 读写 `~/.tcode/sessions/<id>.json`，支持多轮历史载入与自动追加。 |
| **04** | **工程文件资源管理器 (File Explorer)** | 递归折叠目录树、文件类型图标、点击自动展开右侧 Diff 或源码。 | `GetFileTree(dir)` 遍历磁盘真实物理目录，过滤 `node_modules`/`.git`。 |
| **05** | **Git 变更管理 (Source Control)** | Working Tree 修改列表、Staged 暂存列表、Commit 输入框与提交按钮。 | `GetGitStatus()` 解析 `git status --porcelain`，`GitCommit()` 真实提交。 |
| **06** | **深度心智思考卡片 (Reasoning)** | 专属思考抽屉，打字机实时推流显示心智模型 Token，支持一键折叠。 | 拦截 AgentRouter SSE 的 `reasoning_content`，通过 `agent:thinking` 事件分轨推送。 |
| **07** | **Tool Call 算子终端卡片** | `$_ <cmd>` 胶囊、绿点运行态、暗黑高亮终端面板回显 Stdout/Stderr。 | Go 微内核捕获工具调用，`exec_command` 沙箱执行后推送 `agent:tool_end`。 |
| **08** | **Sub-Agent 协同卡片组** | 多代理在线状态胶囊、TDD 单测自愈智能体与安全沙箱审查智能体卡片。 | 多协程并发调度，安全沙箱执行静态与动态拦截。 |
| **09** | **人机协同多选卡片 (Choice Picker)** | 参数单选/多选框、推荐 Badge、描述说明、用户自定义补充输入框、确认提交。 | 暂停 ReAct 循环等待前端返回用户决策参数后继续下一步。 |
| **10** | **Diff 文件卡片与 Monaco 审查区** | 改动文件增删行统计标签（`+4 / -2 行`）、行级红绿高对比差异、`✕ 放弃`（物理 Checkout）、`✓ 采纳`。 | `GetStructuredDiff(file)` 提取真实 Git Diff，`RevertFile(file)` 真实丢弃更改。 |
| **11** | **Prompt 胶囊输入舱** | 附件托盘、拖拽高亮放置区、`@` 上下文引用弹窗、`/` 快捷指令弹窗、`⚡ Act 极速双环` 与免审核全自动切换开关。 | 操作系统原生文件选择器集成，自动解析上下文注入 Prompt。 |
| **12** | **全景知识图谱与设置模态窗** | 架构语义拓扑网格、Git Time-Travel 时间轴滑块、节点引用至输入框；7 选项卡设置中枢与 4 大专属子弹窗。 | `ScanWorkspaceAST()` 静态解析源码树，读写 `~/.tcode/` 规则与 MCP 配置。 |

---

## 3. Go 微内核与前端 IPC 接口协议规约 (IPC API Contract)

所有方法由 Go 宿主层通过 Wails v2 原生反射暴露在 `window.go.main.App` 对象上，前端通过 TypeScript 强类型封装调用，底层完全基于内存二进制指针，杜绝任何外部 HTTP 监听端口的安全隐患。

### 3.1 对话与 ReAct 自主算子循环 (Chat & Agent Loop)

#### `SendMessage(req ChatRequest) error`
- **功能描述**：前端发起智能体任务的主入口。后端根据会话 ID 载入多轮历史，向上游模型发起带工具有效载荷的流式请求，并在命中模型 `tool_calls` 时自主执行本地算子，完成闭环合成。
- **请求参数**：
  ```typescript
  interface ChatRequest {
    session_id: string       // 会话唯一 ID (如 "sess1")
    prompt: string           // 用户输入的指令正文
    model: string            // 选定的模型 ("deepseek-v4-flash" | "gpt-5.6-sol" | "claude-opus-4-8" | "glm-5.3")
    is_full_auto: boolean    // 是否开启极速 Act 模式 (免人工确认直接执行高危算子)
  }
  ```
- **实时分轨流式事件**（通过 `runtime.EventsOn` 监听）：
  1. `agent:thinking` (payload: `string`)：深度思考心智推理增量 Token。
  2. `agent:chunk` (payload: `string`)：最终回答正文 Markdown 增量 Token。
  3. `agent:tool_start` (payload: `{ name: string, args: any }`)：算子调用启动。
  4. `agent:tool_end` (payload: `{ name: string, output: string }`)：算子执行完毕回显。
  5. `agent:done` (payload: `null`)：单轮推理全周期结束，会话已持久化至磁盘。

---

### 3.2 会话生命周期与物理存储 (Sessions Management)

#### `ListSessions() []SessionMeta`
- **功能描述**：从本地磁盘目录 `~/.tcode/sessions/` 枚举所有已存盘会话的元数据，按最后更新时间倒序排列。
- **返回值**：
  ```typescript
  interface SessionMeta {
    id: string               // 会话唯一标识
    title: string            // 会话标题 (自动由首句指令生成或手动编辑)
    model: string            // 当前绑定的模型名称
    tag: string              // 场景分类 ("核心架构" | "单测自愈" | "网关调度" | "安全防护")
    time: string             // 相对时间展示 (如 "刚刚", "5分钟前")
    desc: string             // 最新一条回复的摘要预览
    updated_at: number       // Unix 毫秒时间戳
  }
  ```

#### `GetSession(id string) (*ChatSession, error)`
- **功能描述**：物理读取 `~/.tcode/sessions/<id>.json`，反序列化完整的上下文消息队列供前端还原现场。
- **返回值**：
  ```typescript
  interface ChatSession {
    id: string
    title: string
    model: string
    tag: string
    created_at: number
    updated_at: number
    messages: SessionMessage[]
  }

  interface SessionMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    thinking?: string
    tool?: {
      name: string
      args: any
      output: string
    }
    time: string
  }
  ```

#### `SaveSession(sess ChatSession) error`
- **功能描述**：原子覆写保存指定会话至 `~/.tcode/sessions/<id>.json`。

#### `DeleteSession(id string) error`
- **功能描述**：物理删除 `~/.tcode/sessions/<id>.json` 文件。

---

### 3.3 物理 Git 版本控制与结构化 Diff 引擎 (Git & Diff Engine)

#### `GetStructuredDiff(filePath string) (DiffReport, error)`
- **功能描述**：针对指定文件执行 `git diff HEAD -- <filePath>`，逐行解析出统一对比行，用于驱动前端 Monaco 红绿色阶差异视图。
- **返回值**：
  ```typescript
  interface DiffReport {
    file_path: string        // 相对工程根目录路径
    lang: string             // 文件语法语言识别 (如 "Go", "Vue", "TypeScript")
    stats: string            // 增删行统计文案 (如 "+12 / -4 行")
    header: string           // Diff 块头部元信息 (如 "@@ -45,8 +45,16 @@")
    lines: DiffLine[]        // 逐行结构化数据
  }

  interface DiffLine {
    type: 'add' | 'del' | 'ctx' // 'add': 绿色新增行; 'del': 红色删除行; 'ctx': 上下文无变更行
    text: string                // 行源码内容
  }
  ```

#### `RevertFile(filePath string) error`
- **功能描述**：物理执行 `git checkout HEAD -- <filePath>`，彻底回滚工作区文件的未提交修改，并刷新 Diff 状态。

#### `GetGitStatus() (map[string]any, error)`
- **功能描述**：获取当前仓库的实时分支名称、暂存区文件列表与未暂存变更列表。
- **返回值**：
  ```typescript
  interface GitStatusResult {
    branch: string           // 当前 Git 分支 (如 "main")
    working: string[]        // 工作区未暂存修改文件列表
    staged: string[]         // 暂存区文件列表
  }
  ```

#### `GitCommit(message string) (string, error)`
- **功能描述**：执行 `git add -A && git commit -m <message>`，将工作区全部修改固化为本地提交。

---

### 3.4 模型网关调度池与全网探活 (Gateway & Models)

#### `FetchUpstreamModels(endpoint, apiKey string) ([]string, error)`
- **功能描述**：携带特定客户端风控指纹头，真实向指定上游网关的 `/v1/models` 端点发起 GET 请求，提取在线可用的模型 ID 清单。
- **核心网络头注入 (防风控穿透)**：
  ```http
  User-Agent: codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464
  Originator: codex_cli_rs
  Version: 0.101.0
  Authorization: Bearer <API_KEY>
  ```
- **返回值**：`["claude-opus-4-8", "claude-opus-5", "deepseek-v4-flash", "glm-5.3", "gpt-5.6-sol"]`

#### `PingChannel(id string) (string, error)`
- **功能描述**：通过 Go 底层网络栈对指定渠道的 Base URL 发起真实 HTTP OPTIONS/HEAD 往返探测，计算高精度耗时。
- **返回值**：`"82ms"`（网络超时回显 `"超时"`）。

#### `ListChannels() []ChannelConfig` / `SaveChannel(cfg ChannelConfig) error`
- **功能描述**：真实读写持久化文件 `~/.tcode/channels.json`。

---

### 3.5 插件化扩展：MCP 服务、Skill 技能库与工程规则 (Plugins & Specs)

#### `ListMCPs() []MCPServerConfig` / `SaveMCP(cfg MCPServerConfig) error`
- **存储路径**：`~/.tcode/mcp_servers.json`
- **数据结构**：
  ```typescript
  interface MCPServerConfig {
    id: string
    name: string
    type: 'stdio' | 'sse'
    command: string          // 如 "npx" 或 "python"
    args: string[]           // 如 ["-y", "@modelcontextprotocol/server-filesystem", "E:/pro"]
    enabled: boolean
    updated_at: number
  }
  ```

#### `ListSkills() []SkillConfig` / `SaveSkill(cfg SkillConfig) error`
- **存储路径**：`~/.tcode/skills.json`
- **数据结构**：
  ```typescript
  interface SkillConfig {
    id: string
    name: string
    description: string
    prompt: string           // 专属领域强化系统提示词
    enabled: boolean
    updated_at: number
  }
  ```

#### `ListRules() []RuleConfig` / `SaveRule(cfg RuleConfig) error`
- **存储路径**：`~/.tcode/rules.json`
- **作用机制**：所有处于 `enabled: true` 状态的规则，将在智能体发起会话时，静默拼装注入到 System Context 的 `[Project Architecture Rules]` 约束段中。

---

### 3.6 项目代码语义拓扑扫描引擎 (AST Scanner)

#### `GetProjectASTGraph() ([]GraphNode, error)`
- **功能描述**：使用 Go 标准库 `go/parser` 与 `go/ast`，对工程源码目录进行静态语法树递归遍历，提取所有 Go 包（Package）、结构体（Struct）、接口（Interface）与核心源文件的依赖拓扑。
- **返回值**：
  ```typescript
  interface GraphNode {
    id: string               // 节点唯一标识
    name: string             // 实体名称 (如 "App", "ScanWorkspaceAST")
    type: 'package' | 'struct' | 'interface' | 'file'
    file: string             // 声明所在源码相对路径
    details: string          // 静态分析提取的摘要与字段统计
  }
  ```

---

## 4. 安全沙箱防线与执行阻断规范 (Security & Sandbox Spec)

系统提供两级保护机制，杜绝自主智能体执行破坏性或越权命令：

1. **高危指令硬编码熔断表 (Hard Deny List)**：
   - 包含：`rm -rf /`、`mkfs`、`format`、`drop database`、`dd if=`、`shutdown`、`reboot`、`del /f /s /q c:\` 等；
   - 无论是否开启 Act 免审核模式，Go 微内核一律在执行前直接拦截报错，向前端推送阻断告警。
2. **人工审查双环机制 (Human-in-the-loop Stage-Gate)**：
   - 当底部切换为 `[ 需人工审核 ]` 时：凡涉及写文件（`write_file`）、终端系统命令（`exec_command`）均会向前端触发确认事件，等待用户审批；
   - 当底部切换为 `[ ⚡ 全自动执行 ]` 时：除高危指令外，自动在 Go 沙箱目录内完成测试编译与文件修补。

---

## 5. 项目工程目录全景拓扑 (Repository Layout)

```
e:/pro/agent-learning/
├── app.go                       # Wails v2 宿主主入口与全部 IPC 契约实现
├── main.go                      # Windows 原生无边框桌面窗体启动与资源嵌入
├── wails.json                   # Wails 桌面打包与编译器配置
├── web_prototype.html           # 【核心】6,987 行纯净原生设计原型真理源
├── internal/
│   ├── ast/
│   │   └── scanner.go           # Go AST 语法树静态分析与拓扑提取器
│   ├── diff/
│   │   └── differ.go            # Git 行级结构化 Diff 报告生成器
│   ├── llm/
│   │   └── client.go            # AgentRouter 多模型 SSE 流式客户端与 Tool 协议封包
│   ├── sandbox/
│   │   └── runner.go            # 本地受控终端算子执行器与高危指令拦截防线
│   └── session/
│       └── store.go             # ~/.tcode/sessions/ 磁盘持久化引擎
├── frontend/
│   ├── index.html               # 1:1 挂载 web_prototype.html (Vite 生产入口)
│   ├── package.json             # 前端构建依赖配置
│   ├── vite.config.ts           # Vite 6 构建流水线配置
│   └── src/
│       ├── core/
│       │   ├── wailsBridge.ts   # TypeScript 强类型 IPC 桥接封装
│       │   └── markdown.ts      # Marked GFM 渲染器与暗黑代码块配置
│       └── style.css            # Tailwind CSS 本地样式层
└── bin/
    └── tcode.exe                # 3.95MB Windows 原生独立可执行 GUI 二进制程序
```

---

## 6. 总结与后续迭代指南
本说明书与工程源码及 `web_prototype.html` 保持 **100% 绝对对齐**。后续用户继续扩充原型设计、出具 PRD 或新增算子协议时，可遵循本规范第三章的 IPC API 契约进行横向扩展，确保桌面端桌面体验始终坚如磐石、优雅纯粹。
