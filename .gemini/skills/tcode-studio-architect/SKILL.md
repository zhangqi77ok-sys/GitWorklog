---
name: tcode-studio-architect
description: >-
  Comprehensive architectural guidelines, desktop engineering workflow, and operational protocols
  for Tcode Studio (Go microkernel + Vue 3 desktop AI IDE). Use this skill when continuing development,
  compiling Wails desktop binaries, building Windows installer packages, editing prototypes, or
  extending backend business engines (GitOps, MCP, Monaco Diff, Swarm Agents).
---

# Tcode Studio 架构师与全栈工程规范 (Architecture & Dev Protocol)

本技能沉淀了 **Tcode Studio v2.0** 桌面端的所有架构决策、代码约束、构建踩坑点与工程流水线。
无论在任何新电脑或新环境下唤起 AI 助手，**必须严格遵循本规范执行后续开发**。

---

## 🏛️ 核心人设与开发铁律 (Golden Rules)

1. **角色定位**：
   - 资深 **Go 架构师 + Vue 前端工程师**；
   - 打造的是**插件架构的现代化桌面端**，交互与视觉必须极简、高对比度、优雅大气（遵循 Linear / OpenAI 陶土暖橙深浅基底风格）。
2. **禁止假 Demo 与 Fake 按钮**：
   - **绝对禁止占位符/Mock 按钮**！所有按钮与操作必须与真实 OS、Go 内核逻辑或业务引擎形成闭环。
3. **原型是唯一真理源 (Single Source of Truth)**：
   - 原型主文件为 `web_prototype.html`（已达 7,500+ 行，包含全部 SVG、Modal、Drawer、设置中枢与 Monaco Diff）。
   - **严禁擅自简化、重构或缩减原型**！任何视觉变动必须先在 `web_prototype.html` 中精细打磨，并同步至 `frontend/index.html`。
4. **中转路由与模型凭据 (测试基准)**：
   - **Base URL**: `https://agentrouter.org/`
   - **API Key**: `sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ`
   - **支持模型**: `gpt-5.6-sol`、`claude-opus-4-8`、`deepseek-v4-flash`、`glm-5.3`

---

## 🏗️ 系统分层架构与目录拓扑

```
agent-learning/
├── web_prototype.html          # 【核心真理源】全功能交互原型 (HTML/Tailwind/原生JS)
├── frontend/                   # Vue/Vite 桌面前端单包资产
│   ├── index.html              # 与 web_prototype.html 1:1 同步
│   └── dist/                   # npm run build 产物 (embed 进 Go 微内核)
├── app.go                      # Wails IPC 桥接层 (暴露给前端的所有核心能力)
├── main.go                     # Wails 原生桌面窗口入口 (Frameless 沉浸式)
├── cmd/
│   ├── installer/main.go       # 原生 Windows 单文件向导/静默安装包打包器
│   └── uninstaller/main.go     # 原生 Windows 干净卸载器
├── internal/                   # Go 微内核业务引擎
│   ├── gitops/                 # 真实 Git 分支、快照(Stash)、提交引擎
│   ├── mcp/                    # 标准 JSON-RPC 2.0 Stdio 跨进程 MCP 客户端与工具发现管理器
│   ├── diff/                   # Monaco 行级 Unified Diff 解析与 Hunk Cherry-Pick (git apply/reverse)
│   ├── agent/                  # 子代理集群并发执行器 (TDD 自愈与安全沙箱)
│   └── telemetry/              # 真实 Token 消耗与 TTFT 耗时度量审计
└── bin/                        # 本地交付产物目录
    ├── tcode.exe               # 编译好的 10.07MB 原生绿色运行程序
    ├── uninstall.exe           # 1.80MB 卸载器
    └── TcodeStudio_Setup_v2.0.0.exe # 13.69MB 最终 Windows 安装包
```

---

## ⚡ 关键避坑指南与构建流水线 (Critical Gotchas)

### 1. Wails 编译必须携带 Tags (血泪经验！)
- **问题**：如果使用裸 `go build`，Wails 会自动使用空白的 `stub.go`，并在双击运行时弹出红叉弹窗：
  *`"Wails applications will not build without the correct build tags. Please use wails build..."`*
- **正确编译命令**：
  ```powershell
  # 必须包含 -tags "desktop,production" 与 -ldflags="-H windowsgui -s -w"
  & E:\pro\tools\go\bin\go.exe build -tags "desktop,production" -ldflags="-H windowsgui -s -w" -o bin/tcode.exe .
  ```
  *(编译产物约为 10.07 MB，包含完整 WebView2 宿主与原生窗体)*

### 2. 沉浸式无边框窗口 (Frameless Mode)
- `main.go` 中必须配置 `Frameless: true`，消除 Windows 自带的白色外壳标题栏；
- 前端自定义顶栏（38px）配置 `style="--wails-draggable: drag;"`；
- 顶栏内部所有按钮配置 `style="--wails-draggable: no-drag;"`；
- 窗口最小化/最大化/关闭按钮调用 `app.go` 暴露的方法：
  - `App.MinimizeWindow()`
  - `App.ToggleMaximizeWindow()`
  - `App.CloseWindow()`

### 3. 原生 Windows 独立 EXE 安装包机制
- 安装包源码位于 `cmd/installer/main.go`；
- 原理：使用 `//go:embed assets/tcode.exe` 与 `assets/uninstall.exe` 封装单文件向导；
- 安装位置：`%LOCALAPPDATA%\Programs\TcodeStudio`（免 UAC 提权）；
- 自动生成桌面快捷方式 `Tcode Studio.lnk` 与开始菜单项；
- 注册表登记卸载项：`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio`；
- 编译命令：
  ```powershell
  # 1. 复制最新编译好的二进制到 assets
  Copy-Item -Path bin/tcode.exe -Destination cmd/installer/assets/tcode.exe -Force
  Copy-Item -Path bin/uninstall.exe -Destination cmd/installer/assets/uninstall.exe -Force
  # 2. 编译打包生成安装包
  & E:\pro\tools\go\bin\go.exe build -ldflags="-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe ./cmd/installer
  ```

---

## 🛠️ 新电脑初始化与环境搭建步骤

明天在另一台电脑拉取代码后，按以下步骤恢复开发环境：

### 步骤 1：安装前置工具链
- **Go**: 1.22+（并将 `go.exe` 加入系统 PATH）
- **Node.js**: 18+ 或 20+（含 npm）
- **Git**: 官方 Windows 版
- **WebView2 运行时**: Windows 10/11 默认自带（若没有则下载 Evergreen Bootstrapper）

### 步骤 2：克隆仓库与安装前端依赖
```powershell
git clone git@github.com:zhangqi77ok-sys/agent-learning.git
cd agent-learning/frontend
npm install
```

### 步骤 3：本地启动与热重载
- **浏览器极速预览**：
  ```powershell
  cd frontend
  npm run dev
  # 访问 http://localhost:5173 即可极速热重载
  ```
- **完整编译生产桌面端与安装包**：
  ```powershell
  # 1. 构建前端单包
  cd frontend && npm run build && cd ..

  # 2. 编译 Wails 原生桌面端
  go build -tags "desktop,production" -ldflags="-H windowsgui -s -w" -o bin/tcode.exe .

  # 3. 更新并打包安装包
  Copy-Item -Path bin/tcode.exe -Destination cmd/installer/assets/tcode.exe -Force
  go build -ldflags="-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe ./cmd/installer
  ```

---

## 📋 已完成功能盘点与下一步任务清单

### ✅ 今日已闭环功能
1. **全局快捷键与命令调色板**：`Ctrl+K` Raycast/Linear 风格 Omnibar；
2. **MCP 工具协议客户端**：真实 Stdio 跨进程客户端 + JSON-RPC 2.0 异步消息路由；
3. **Monaco 行级 Unified Diff**：真实块级 Cherry-Pick（`git apply --cached` 采纳 / `git apply --reverse` 放弃）；
4. **GitOps 引擎**：真实分支列出/切换/创建、快照恢复（Stash）、Commit 闭环；
5. **多会话页签交互**：支持鼠标拖拽横向排序、单个 Tab 悬停关闭 `✕`、右键菜单（关闭当前/关闭其他/关闭全部）；
6. **安装包与桌面沉浸化**：无边框窗口模式（消除双层标题栏）、原生单文件 Windows 安装向导。

### 🚀 明天优先推进任务
1. **流式 LLM 对话接通**：将 Agent Router 的 `DeepSeek-V4-Flash` / `Claude-3.7-Sonnet` 真实 SSE 流式输出接入对话视窗；
2. **真实 Monaco 编辑器挂载**：在 `代码工作区` 视图中，将右侧静态代码面板替换为通过 CDN 或 NPM 引入的真正可编辑的 Monaco Editor 实例；
3. **MCP 跨进程实测工具调用**：配置一个标准的 `@modelcontextprotocol/server-filesystem` 实例并在会话中实现文件读取与写入。