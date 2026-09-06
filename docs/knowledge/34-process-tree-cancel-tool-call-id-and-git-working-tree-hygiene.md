# 知识沉淀 34: 进程树主动取消机制、大模型工具调用 ID 协议守卫与 Git 变更纯净状态治理

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 桌面端（Go 1.21+ 微内核 + Wails 原生 IPC + Vue 3 暖色极简前端）的高并发长周期运行环境中，随着外部生态算子（MCP、自定义 CLI、终端执行、大模型多轮推理与 Git 版本管理）的频繁调度，暴露了如下几项系统级隐蔽缺陷：
1. **Windows 终端超时或用户主动中断时子进程孤儿存活**：Go 原生 `exec.CommandContext` 在 context 到期或取消时，默认仅向直接父进程（如 `cmd.exe`）发送终止信号。在 Windows 下，其派生出的编译器、开发服务器或测试子进程脱离父进程继续运行，造成 TCP 端口被占用、文件锁死以及后台高 CPU 消耗。
2. **OpenAI / 兼容端点大模型工具调用 ID 丢失导致 400 Bad Request**：部分开源模型或中间件反向代理在流式下发 `tool_calls` 分片时，首帧或后续分片未包含 `id` 或 `type` 字段，若引擎未做默认兜底补全，组装出的 assistant 消息中 `tool_call_id` 为空，下一轮将 tool 执行结果回传给上游时触发协议层 `400 Bad Request: Invalid tool_call_id`。
3. **前端 Git 源码管理抽屉假数据残留**：左侧源码管理抽屉曾硬编码死 `main.go`、`app.go`、`wailsBridge.ts` 三个演示文件，无论当前工作区实际干净与否均显示这 3 个假文件，严重违反项目【铁律 0.5: 严禁假数据与 Demo 占位】。
4. **前端会话切换与会话 ID 隔离失效**：点击左侧历史会话卡片时，未触发 `switchSession(id)` 导致右侧对话区域不响应；同时打开空会话或切换时未重置 `messages` 队列，导致跨会话消息污染。
5. **Diff 采纳仅关闭抽屉未物理暂存**：用户点击 Diff 审查界面中的“采纳变更”时，仅关闭了 UI 界面，未调用底层的 `GitStage` 执行物理 `git add`。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Go `exec.Cmd.Cancel` 与 Windows 进程树生命周期
Go 1.19+ 引入了 `cmd.Cancel = func() error` 字段。当 `exec.CommandContext` 关联的 context 被取消时：
- 若未显式定义 `cmd.Cancel`，Go 运行时会退化执行 `cmd.Process.Kill()`。在 Windows 操作系统中，Win32 的 `TerminateProcess` 只能强行杀死目标 PID，但无法递归杀死由其衍生的孙子进程（Child/Descendant Processes）；
- 通过显式注入 `cmd.Cancel`，在 context 触发取消瞬间拦截默认单进程 kill 逻辑，调用 Windows 内置的 `taskkill /F /T /PID <pid>`（配合 `CREATE_NO_WINDOW = 0x08000000` 隐藏控制台弹窗），从进程树叶子节点向上全面连根拔起。

### 2. OpenAI Function Calling 协议契约与 ID 单调一致性
在 OpenAI 标准及兼容的大模型协议规范中：
- `assistant` 角色的消息如果包含 `tool_calls` 列表，每一个 `tool_call` 项都必须包含唯一的 `id`（如 `call_abc123`）与 `type: "function"`；
- 后续轮次中所有携带 `role: "tool"` 的反馈消息，其 `tool_call_id` 必须严格与前一轮 `tool_calls` 中声明的 `id` 一一精确对应；
- 若解析流式 chunks 时未聚合出有效 `id`，必须在消息落入 conversation 历史之前自动生成单调唯一的 ID，绝不可留空。

### 3. Git Status Porcelain 与前端纯净空状态契约
前端组件应当直接消费后端 `app.GetGitStatus()` 暴露的真实工作区状态（`working` 与 `untracked`），当列表均为空时，渲染纯净空状态（Clean Empty State），杜绝任何硬编码占位符。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 为 `exec.Cmd` 注入 `cmd.Cancel` 根除孤儿进程
在 `plugins/tool/terminal/terminal_tool.go` 中，无论是同步执行还是实时流式执行，均注入 Windows 进程树强杀回调：

```go
if runtime.GOOS == "windows" {
    cmd = exec.CommandContext(execCtx, "cmd", "/d", "/s", "/c", args.Command)
    cmd.SysProcAttr = &syscall.SysProcAttr{
        CreationFlags: 0x08000000,
        HideWindow:    true,
    }
    cmd.Cancel = func() error {
        if cmd.Process != nil && cmd.Process.Pid > 0 {
            killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
            killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
            return killCmd.Run()
        }
        return nil
    }
}
```

### 2. 工具调用 ID 与 Type 默认值全链路防御
在 `internal/llm/client.go` 与 `app.go` 中加入防空与默认值填充：

```go
for i := range toolCalls {
    if toolCalls[i].ID == "" {
        toolCalls[i].ID = fmt.Sprintf("call_%d_%d", i, time.Now().UnixNano())
    }
    if toolCalls[i].Type == "" {
        toolCalls[i].Type = "function"
    }
}
```

### 3. 前端 Git 源码抽屉动态化与会话切换状态隔离
在 `LeftDrawer.vue` 中基于 `gitStatus` 动态计算变更列表，若无变更则呈现简洁空状态；在 `selectSession` 中调用 `await store.switchSession(id)`，并在 `chatStore.ts` 的 `switchSession` 中首先执行 `messages.value = []`，避免跨会话残留。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **切勿依赖 Go 默认的 `Process.Kill()` 销毁 Windows 外部进程**：只要涉及调用 Windows 命令解释器（`cmd.exe` 或 `powershell.exe`），必须配置 `cmd.Cancel` 执行 `taskkill /F /T` 级联终结。
2. **外部流式 SSE 解析必须对 ID 与 Type 进行完整性校验**：不同大模型厂商（DeepSeek、Qwen、Claude 适配层等）在 SSE 流中的字段完整性参差不齐，在写入会话树前必须确保 ID 非空，从源头防止后续 HTTP 400 失败。
3. **UI 原型与正式代码禁止混杂 Demo 假数据**：所有列表、卡片和状态均需从 Pinia Store 或后端 IPC 接口拉取真实数据，并在无数据时提供纯净优雅的空状态提示。
