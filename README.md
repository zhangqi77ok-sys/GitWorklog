# Tcode (Next-Gen AI Agentic Studio)

新一代开源 AI 编程桌面工作台，基于 **Tauri v2 + Tokio 异步 Rust Core Daemon + React 19 + TypeScript**，采用 **组合式双循环与稳定轨道架构 (Composable Rail-based Agent Architecture)**，严格遵循暖米白（`#FAF8F5`）、工作台米灰（`#F4EFEA`）与陶土暖橙（`#D96B27`）的极简工程人机美学规范。

---

## 🏛️ 一、核心架构设计 (Composable Rail-based Architecture)

Tcode 将 Agent 的认知推理循环、执行底座与表现层进行了物理级彻底解耦：

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

## ⚡ 二、六大核心全功能与强联动技术亮点

### 1. 多项目树状聚合与会话管理 (Multi-Project & Session Tree)
* **项目优先的会话体系**：支持多工程并行打开，每个项目聚合各自独立的会话记录；首次载入新项目时自动初始化【会话 1 (默认)】；
* **会话高级特性**：支持全/局部即时搜索 (`Ctrl+K`)、多彩色自定义标签 (`#架构重构`, `#Bug修复`, `#单测`)、会话置顶锁定 (`Pin to Top`)、行内双击重命名与导出；
* **全工作区联动**：点击任意会话，自动切换激活对应项目工程，文件树、Monaco 编辑器与终端工作目录（CWD）毫秒级自动对齐。

### 2. sub2api 架构纯净模型网关 (Model Gateway Cockpit)
* **多平台分段器**：全面支持 `DeepSeek`, `SiliconFlow`, `Kimi`, `智谱 GLM`, `Anthropic Claude`, `OpenAI`, `Google Gemini`, `Ollama 本地`；
* **动态认证卡片**：支持 `标准 API Key`, `OAuth 2.0 官方授权`, `Setup Token`, `云企业凭据`, `反代/中转站`；
* **极速探活测速**：一键进行真实连通性测试，毫秒级返回 HTTP 状态码、首字延迟（TTFT）与测试回复；支持一键从端点自动拉取 `/v1/models`。

### 3. 真·Monaco 代码与 Diff 审查视窗 (Monaco Editor & Diff Inspector)
* **VS Code 同款内核**：支持 Rust, TypeScript, Python, JSON, Markdown 等语法高亮、行号、MiniMap 与 `Ctrl+S` 真实落盘保存；
* **双模 Diff 审查**：支持 Side-by-Side (双栏并排) 与 Inline (行内折叠) 审查视窗；
* **浮动审查控制条**：当 Agent 提议生成补丁时，右侧自动展开 Diff，提供 `[✅ 接受并应用补丁]` 与 `[❌ 放弃变更]` 按钮。

### 4. 实时流式 Agent 对话与深度思考块 (Live SSE Stream & Thinking Block)
* **原生 SSE 流式打字机**：Rust Tokio Core 直接管理上游流式连接，零 UI 主线程阻塞；
* **深度思考链标准化**：自动提取 DeepSeek `reasoning_content`、`<think>` 标签与 Claude `thinking` 块，前端实时逐字展开并在完成后折叠为胶囊卡片；
* **代码块一键审查**：对话中的代码块提供 `[⚡ 在右侧开启 Diff 审查]` 按钮，一键将补丁投射至 Monaco 视窗。

### 5. 集成终端抽屉 (Integrated Terminal Drawer)
* 底部抽屉式折叠面板，原生连接 PowerShell / Bash 命令行终端，工作目录随当前激活项目自动同步，命令输出支持 ANSI 颜色高亮。

### 6. 极致安全护轨 (Safety Rail) 与工作区沙箱
* 文件操作与命令执行经由内核级沙箱硬隔离，任何路径逃逸与高危破坏性指令在 Rust 内核即被拦截。

---

## 🎨 三、视觉与人机工程学规范

* **主背景色**：`#FAF8F5` (Warm Cream 柔和暖米白)
* **工作台底色**：`#F4EFEA` (Workspace Muted 米灰)
* **品牌强调色**：`#D96B27` (Terracotta Orange 陶土暖橙)
* **代码暖黑**：`#1E1C1A` (Code Dark 暖炭黑)
* **经典布局**：三栏流体工作台（左侧项目与会话导航 + 中央流式会话 + 右侧 Monaco 编辑器/Diff 对比），底部抽屉式集成终端。

---

## 🛠️ 四、本地构建与安装包运行

### 1. 运行单元测试
```bash
npm test
```

### 2. 启动前端开发调试
```bash
npm run dev
```

### 3. 一键增量打包 Windows EXE 安装包
```bash
npm run build:installer
```
* **构建产物**：
  * `Tcode-Setup.exe`（项目根目录）
  * `release/Tcode-Setup-v2.0.0.exe`
  * `dist/Tcode-Setup.exe`
