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

## ⚡ 二、五大核心技术亮点

### 1. 彻底实现“大脑与肢体解耦”（Zero-UI-Contention）
* **旧架构病根**：旧版 Agent Loop 寄生在前端 React 主线程中，大文件解析、流式反序列化与高频 Diff 计算严重导致 UI 掉帧卡顿，页面刷新任务即丢失。
* **Next-Gen 突破**：Agent 推理主循环、多账号调度、LSP 索引与安全沙箱常驻于 **Tokio 异步 Rust 后端守护进程**，前端仅负责纯粹轻量的流式气泡渲染与 Monaco 视图，单文件严格控制在 300 行以内。

### 2. 全插件化能力底座 (Tool / Skill Rail)
* **一切能力皆插件**：本地文件 I/O (`plugin_fs`)、Shell 终端 (`plugin_terminal`)、文本全文搜索 (`plugin_search`)、LSP 编译诊断 (`plugin_lsp`) 以及外部 MCP 服务器 (`plugin_mcp`) 全部实现统一的 `CapabilityPlugin` 异步 Trait。
* **即插即用**：支持动态扩展第三方 Model Context Protocol (MCP) Server，无需重新编译核心引擎。

### 3. 双循环闭环与编译自愈 (Dual-Loop & Self-Healing)
* **Outer Loop (目标与任务主循环)**：高阶需求分解为 DAG 任务网，自动追踪子任务完成度与经验沉淀。
* **Inner Loop (执行与动作微循环)**：严格遵循 **Observe ➔ Reason ➔ Act ➔ Verify**。每次代码修改后自动调用编译诊断插件（`verify_diagnostics`），遇到报错自动将诊断信息作为新的 Observation 注入下一轮思考，实现自主修正代码。

### 4. 严格安全护轨 (Safety Rail) 与工作区沙箱
* 文件操作与命令执行经由内核级工作区沙箱硬隔离，任何路径逃逸（Path Traversal）与高危破坏性指令（`rm -rf`, `drop table`, `git push --force`）在 Rust 内核即被拦截，并弹出人机协同审批（HITL）。

### 5. 原生轻量极速体验 (Native Performance)
* 告别臃肿的 Python 解释器打包与缓慢解压冷启动，原生二进制安装包体积小（<25MB）、冷启动进入毫秒级。

---

## 🎨 三、视觉与人机工程学规范

* **主背景色**：`#FAF8F5` (Warm Cream 柔和暖米白)
* **工作台底色**：`#F4EFEA` (Workspace Muted 米灰)
* **品牌强调色**：`#D96B27` (Terracotta Orange 陶土暖橙)
* **代码暖黑**：`#1E1C1A` (Code Dark 暖炭黑)
* **经典布局**：三栏流体工作台（左侧项目导航 + 中央流式会话 + 右侧 Monaco 编辑器/Diff 对比），支持实时拖拽调节宽度。

---

## 🛠️ 四、本地开发与构建指南

### 1. 环境要求
* **Rust**: `rustc` / `cargo` >= 1.75
* **Node.js**: >= 20.0 (支持 npm 10+)
* **Tauri v2 CLI**

### 2. 启动前端开发服务器
```bash
npm install
npm run dev
```

### 3. 运行单元测试
```bash
# 前端 React 单元测试
npm test

# Rust Core 单元测试与检查
cargo check --manifest-path src-tauri/Cargo.toml
```

### 4. 构建发布安装包
```bash
# 构建前端生产 dist
npm run build

# 构建桌面原生可执行程序 / 安装包
cargo build --release --manifest-path src-tauri/Cargo.toml
# 或使用 Tauri CLI 构建完整安装包向导
npm run tauri:build
```
