# Windows CREATE_NO_WINDOW 受控流式终端管道、命令中断与前后端双向事件流设计

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录在 Tcode Studio v2.0 中，基于 Go 微内核打造 Windows 平台受控静默流式终端管道、长耗时命令上下文可中断取消（Cancel）、以及基于 Wails 双向事件系统实现打字机式实时终端流输出的完整工程实战经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

桌面端 IDE 工作台集成命令行终端是核心能力之一，但在 Windows GUI 桌面环境下存在以下经典工程陷阱：
1. **Windows 控制台黑色黑框弹出打扰用户**：
   若使用标准 `exec.Command` 执行命令（如 `cmd /c ...`），Windows 默认会为子进程弹出独立的黑色控制台窗口，严重破坏现代化桌面应用的沉浸感；
2. **长耗时命令阻塞与白屏假死**：
   若采用常规同步 `cmd.CombinedOutput()` 阻塞读取输出，执行如 `npm run dev`、`go test -v ./...` 等长耗时任务时，前端将无法获取中间日志，用户无法感知实时执行进度；
3. **外部进程可控取消与资源泄漏**：
   当用户执行误输入的死循环命令或想要中途放弃时，若无取消信号机制，后台进程将成为孤儿进程并持续占用 CPU/内存与文件句柄。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. `CREATE_NO_WINDOW` (0x08000000) 操作系统级静默约束
- Windows Win32 API 进程创建标志位 `CREATE_NO_WINDOW = 0x08000000`：
  - 明确指示系统内核在创建新进程时，不要为其分配新的控制台窗口（Console Csrss）；
  - 搭配 `HideWindow: true`，确保无论执行什么 CLI 命令，屏幕均 100% 纯净，零黑框弹窗：
  ```go
  cmd.SysProcAttr = &syscall.SysProcAttr{
      CreationFlags: 0x08000000,
      HideWindow:    true,
  }
  ```

### 2. 双通道管道并发读取 (`StdoutPipe` & `StderrPipe`)
- 进程启动前分别获取 `cmd.StdoutPipe()` 与 `cmd.StderrPipe()`；
- 使用 `sync.WaitGroup` 启动两个并发 Goroutine 分别进行流式缓冲区滑动读取（`buf := make([]byte, 1024)`）；
- 每次读取到增量数据后，立即触发回调闭包推送至前端 Wails 事件管道（`terminal:data`）。

### 3. 可取消上下文与生命周期管理 (`context.WithCancel`)
- 每次启动终端命令时派生独立的 `context.WithCancel`，并将 `cancel` 函数受互斥锁（`sync.Mutex`）保护保存在宿主状态中；
- 当触发新的命令或用户点击 `[■ 终止]` 按钮时，主动调用 `cancel()` 级联通知系统内核向子进程投递终止信号。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 后端流式算子 (`plugins/tool/terminal/terminal_tool.go`)
```go
func (t *Tool) ExecuteStream(ctx context.Context, command string, onChunk StreamChunkHandler) (int, error) {
    cmd := exec.CommandContext(ctx, "cmd", "/d", "/s", "/c", command)
    cmd.SysProcAttr = &syscall.SysProcAttr{
        CreationFlags: 0x08000000,
        HideWindow:    true,
    }
    cmd.Dir = t.workspaceRoot

    stdoutPipe, _ := cmd.StdoutPipe()
    stderrPipe, _ := cmd.StderrPipe()
    _ = cmd.Start()

    var wg sync.WaitGroup
    wg.Add(2)
    readerFunc := func(r io.Reader) {
        defer wg.Done()
        buf := make([]byte, 1024)
        for {
            n, err := r.Read(buf)
            if n > 0 && onChunk != nil {
                onChunk(string(buf[:n]))
            }
            if err != nil { break }
        }
    }
    go readerFunc(stdoutPipe)
    go readerFunc(stderrPipe)
    wg.Wait()
    return cmd.ProcessState.ExitCode(), cmd.Wait()
}
```

### 2. Wails 宿主桥接与事件发射 (`app.go`)
- 启动时发射 `terminal:start`；
- 输出时实时发射 `terminal:data`（增量字符串）；
- 结束时发射 `terminal:exit`（带 exit code 与耗时 duration_ms）。

### 3. 前端快捷键与历史回溯 (`frontend/src/App.vue`)
- 全局监听 `Ctrl + \``（`e.ctrlKey && e.key === '\`'`）瞬时唤起/隐藏终端抽屉；
- 命令行输入框支持上下方向键（`ArrowUp` / `ArrowDown`）回溯命令历史；
- 支持内置 `clear` / `cls` 极速清屏。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **管道死锁规避**：
   - 必须等待 `StdoutPipe` 与 `StderrPipe` 读取完成后（`wg.Wait()`），才能调用 `cmd.Wait()`，否则缓冲区填满可能导致子进程阻塞挂死；
2. **事件监听清理防内存泄漏**：
   - 前端在 `terminal:exit` 触发后，应及时注销或重置单次执行监听，防止多轮命令累计重叠订阅；
3. **工作区目录物理锁定**：
   - 终端命令的工作目录必须严格绑定在 `a.workspace`，禁止因相对路径穿越导致意料之外的系统级改动。
