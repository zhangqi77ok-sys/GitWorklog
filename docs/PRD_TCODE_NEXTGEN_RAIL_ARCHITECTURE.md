# Tcode Next-Gen 架构与产品需求规格说明书 (PRD)

> **版本**：v2.0.0-NextGen  
> **状态**：Architecture Reset & Specification  
> **核心定位**：基于 **Tauri v2 + Rust Core Daemon + React 19** 的组合式轨道（Composable Rail-based）智能编程桌面工作台。

---

## 1. 产品愿景与设计哲学

### 1.1 核心愿景
彻底打破传统 AI 编程工具中“前端承载复杂 Agent 运算”与“硬编码工具链”的痛点，构建一套：
1. **大脑与肢体彻底解耦**：核心 Agent 循环、多账号调度、LSP 索引与安全沙箱常驻于高性能 Rust 守护进程，前端仅负责纯粹的极简视图展示与人机交互；
2. **能力全面插件化 (Pluggable Capabilities)**：无论是本地文件读写、Shell 执行、代码拓扑搜索，还是外部 MCP 服务器、浏览器自动化，全部作为插件挂载于标准化能力轨道上；
3. **双循环与多层自适应 (Dual Loop & Multi-Level Adaptivity)**：外层目标规划循环 + 内层 ReAct 执行循环，配合安全、记忆、规划、能力、观测五大稳定轨道与编译级自愈反馈。

### 1.2 视觉与人机工程学不变量（100% 保持不变）
前端交互体验与视觉设计严格保留既有规范与布局：
* **主调色彩**：
  * 主背景色：`#FAF8F5` (Warm Cream 柔和暖米白)
  * 工作台底色：`#F4EFEA` (Workspace Muted 米灰)
  * 强调色：`#D96B27` (Terracotta Orange 陶土暖橙)
  * 代码背景：`#1E1C1A` (Code Dark 暖炭黑)
* **经典布局**：
  * **三栏流体工作台**：左侧项目导航 (12%~35%) + 中央流式会话 (Flex) + 右侧 Monaco 编辑器/Diff/终端抽屉 (20%~50%)；
  * **克制微型控件**：无大按钮、无多余卡片阴影，纯净原生文件 Tab 与流式 Markdown 气泡。

---

## 2. 系统总体架构设计

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Tcode Frontend (React 19 + TypeScript)                    │
│      [ 三栏流体工作台 | Monaco Editor | 流式思考与气泡 | Diff 对比 | 任务与插件管理面板 ]       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Tauri v2 Zero-Copy IPC / Typed Event Streams
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          Tcode Rust Core Daemon (Tokio Async Engine)                   │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                            Outer Loop (高阶任务与目标循环)                         │  │
│  │   🎯 Goal (定义目标) ➔ 📋 Plan (DAG子任务拆解) ➔ 🔄 Execute ➔ 📊 Evaluate ➔ 🔄 Update│  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 驱动子任务                                  │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                           Inner Loop (执行与动作微循环)                           │  │
│  │      👁️ Observe (上下文/诊断) ➔ 🧠 Reason (推理) ➔ 🛠️ Act (插件) ➔ ✅ Verify (验证)     │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 依托五大稳定底座                             │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                         Stable Execution Core (5 大稳定执行轨道)                  │  │
│  │ ┌─────────────┬─────────────┬──────────────┬──────────────┬────────────────────┐ │  │
│  │ │ 🛡️ Safety   │ 🧠 Memory   │ 🗺️ Planning  │ 🔌 Tool/Skill│ 📊 Observability   │ │  │
│  │ │   Rail      │    Rail     │     Rail     │     Rail     │        Rail        │ │  │
│  │ │ • 沙箱隔离  │ • KV-Cache  │ • DAG 编排   │ • 插件注册表 │ • OpenTelemetry    │ │  │
│  │ │ • 指令拦截  │ • RepoMap   │ • 步骤回溯   │ • MCP 客户端 │ • Token / TTFT 遥测│ │  │
│  │ │ • 人工审批  │ • 会话记忆  │ • Patch 规划 │ • 错误重试   │ • 结构化 Trace 归档│ │  │
│  │ └─────────────┴─────────────┴──────────────┴──────────────┴────────────────────┘ │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 标准化插件 Trait / JSON-RPC                 │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                    Pluggable Capability Ecosystem (能力插件生态)                 │  │
│  │                                                                                  │  │
│  │   [ 内置原生插件 (Rust) ]          [ 外部扩展插件 (MCP 协议) ]   [ 动态技能插件 ]   │  │
│  │   • plugin_fs (读写/Diff/Patch)    • mcp_server_stdio/sse        • .agents/skills/  │  │
│  │   • plugin_terminal (PowerShell)   • browser_automation (CDP)    • AGENTS.md 规范   │  │
│  │   • plugin_lsp (Tree-sitter/LSP)   • database_connector          • 自定义 Workflows │  │
│  │   • plugin_search (Ripgrep/FTS5)   • git_worktree_manager                           │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心功能与模块规范

### 3.1 双循环执行引擎 (Dual-Loop Execution Engine)
* **Outer Loop (Task & Goal Loop)**：
  1. 接收用户原始需求，结合项目上下文分解为结构化 DAG 任务清单；
  2. 评估当前任务执行进度（通过验收证据项判断是否达成目标）；
  3. 任务完成后沉淀经验至项目记忆库。
* **Inner Loop (ReAct / Execution Loop)**：
  1. **Observe**：收集当前焦点代码片段、RepoMap 摘要、最近一次工具输出与 LSP 编译诊断（`diagnostics`）；
  2. **Reason**：调用模型网关进行思维链推理（输出 `<think>` 或结构化 Tool Call）；
  3. **Act**：通过 Tool/Skill Rail 路由至目标插件，在 Safety Rail 校验通过后执行；
  4. **Verify**：执行后自动触发轻量静态验证（LSP 类型推导或自动化测试），将结果作为新 Observation 回传。

### 3.2 五大稳定执行轨道 (Stable Execution Rails)
1. **Safety Rail (安全护轨)**：
   * 严格的工作区路径沙箱，拦截非工作区越界写；
   * 命令 AST 级安全分析，阻断高危破坏性指令（`rm -rf`, `drop table`, `git push --force` 等），触发前端 HITL (Human-in-the-Loop) 审批弹窗。
2. **Memory Rail (记忆护轨)**：
   * **Active Working Set** 动态追踪最近读写焦点文件；
   * **RepoMap 骨架生成**：基于 Tree-sitter 在 Rust 端并发毫秒级提取符号图谱，保证 System Prompt 字节级前缀稳定以最大化服务端 KV-Cache 命中。
3. **Planning Rail (规划护轨)**：
   * 负责子任务依赖排序、执行重试策略以及基于 Git 影子快照的步进回溯（Rollback）。
4. **Tool / Skill Rail (能力与技能护轨)**：
   * 统一所有能力插件的注册、发现、生命周期与调度；
   * 内置标准 Model Context Protocol (MCP) 客户端，支持无缝加载任意外部 MCP Server。
5. **Observability Rail (可观测性护轨)**：
   * 记录完整的 Step Trace、TTFT (首字耗时)、Token 消耗账本与操作日志，实时推送到前端 Trace 面板。

### 3.3 全插件化能力契约 (Capability Plugin Contract)
所有工具必须实现统一的 Rust Trait：
```rust
#[async_trait]
pub trait CapabilityPlugin: Send + Sync {
    fn id(&self) -> &str;
    fn metadata(&self) -> PluginMetadata;
    fn tools(&self) -> Vec<ToolSchema>;
    async fn call(&self, tool: &str, args: serde_json::Value, ctx: &PluginContext) -> Result<ToolOutput, PluginError>;
    fn evaluate_risk(&self, tool: &str, args: &serde_json::Value) -> RiskAssessment;
}
```

---

## 4. 技术栈与目录结构规范

### 4.1 核心技术选型
* **桌面底座**：Tauri v2 (Rust 2021 edition + Wry/Tao)
* **核心后端**：Rust (Tokio 异步运行时 + Reqwest + Tree-sitter + Rusqlite FTS5)
* **前端展示**：React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Monaco Editor
* **构建与分发**：Tauri CLI 原生打包 Windows 单文件 NSIS / MSI 安装包（彻底弃用 Python/PyInstaller/pywebview）

### 4.2 全新纯净目录组织规范
```text
/
├── src-tauri/                     # Rust 核心宿主与 Agent Daemon
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                # 桌面入口与 Tauri 初始化
│       ├── core/                  # 双循环核心引擎 (Outer Loop & Inner Loop)
│       ├── rails/                 # 5 大稳定轨道 (safety, memory, planning, tool, observability)
│       ├── plugins/               # 内置插件 (fs, terminal, lsp, search, mcp_client)
│       ├── gateway/               # Model Gateway v2 (多账号轮询/OAuth/Token 计费)
│       └── ipc/                   # Tauri IPC 命令与事件桥接
├── src/                           # 纯净 React 19 前端 (移出 prototype/ 目录)
│   ├── components/                # 极简原子化 UI 组件 (<300行/文件)
│   │   ├── layout/                # 三栏流体工作台骨架、Titlebar、ActivityBar
│   │   ├── chat/                  # 流式消息气泡、ThinkingBlock、OptionsCard
│   │   ├── editor/                # Monaco 编辑器、Diff 视图、文件 Tab
│   │   ├── terminal/              # 抽屉式集成终端
│   │   └── settings/              # 模型网关与插件管理面板
│   ├── hooks/                     # 响应式 Tauri IPC 状态 Hooks
│   ├── store/                     # 扁平化轻量状态管理
│   ├── types/                     # 与 Rust 严格同构的 TypeScript 类型定义
│   └── main.tsx                   # 前端启动入口
├── docs/                          # 产品与架构文档
├── tests/                         # 集成与单元测试套件
└── package.json                   # 根目录纯净前端依赖配置
```

---

## 5. 重构实施准则与质量门禁

1. **绝对禁止前端承载 Agent 推理**：所有 LLM 请求、流式分块解析、Prompt 组装、Tool 调度必须在 Rust Core 中完成，前端只订阅 Event 事件流。
2. **零大文件原则**：单文件严格控制在 300 行以内，单函数不超过 50 行，复杂组件按职责拆分子模块。
3. **原生轻量打包**：产物直接为原生可执行程序（<25MB，秒级冷启动，零解压，无杀软误报）。
