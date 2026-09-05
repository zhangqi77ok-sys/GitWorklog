# 25. Windows 进程树生命周期隔离、未追踪文件 Diff 适配与全模态窗完整性治理 (Knowledge Doc 25)

> 本文档依据 `AGENTS.md`【铁律 6】强制归档：深入剖析第二轮巡检中排查出的 Windows 孤儿进程泄漏、Untracked 文件 Diff/Revert 失效、沙箱盘符大小写归一化、多轮工具历史全量持久化以及前端模态窗/事件未闭环等关键系统缺陷，并给出标准修复方案。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在持续运行的桌面微内核与 Agent 复杂交互场景中，系统暴露了一批影响稳定性和用户体验的核心缺陷：
1. **Windows 子进程树泄漏挂死 (Bug 8 & Bug 9)**：MCP Stdio 协议或流式终端在被用户中断或超时取消时，Go 标准库 `cmd.Process.Kill()` 仅能杀死第一级命令行宿主（如 `cmd.exe`），而宿主拉起的实际工作进程（如 `npx.cmd`、`node.exe`、`python.exe`）沦为孤儿进程继续运行并持续持有 IO 管道句柄，导致 `wg.Wait()` 永久阻塞挂死。
2. **未追踪 (Untracked) 新文件 Diff 误报与撤销报错 (Bug 4 & Bug 5)**：Agent 自动创建的新文件尚未提交进 Git HEAD，执行 `git diff HEAD -- <relPath>` 无任何标准输出，被 Diff 解析器误报为“未修改 · 共 N 行 (Clean)”，无法查看绿色新增行；用户点击“放弃变更”时执行 `git checkout HEAD -- <relPath>` 抛出 `exit status 1` 报错崩溃。
3. **Windows 盘符大小写敏感导致的沙箱误拦截 (Bug 6)**：Windows 系统盘符不区分大小写，工作区为 `d:\workspace` 时，调用 `filepath.Rel` 传入 `D:\workspace\foo.txt` 会因盘符大小写不一致而计算出 `..\D:\workspace\foo.txt`，被沙箱判定为路径越界穿越（Path Traversal）非法拦截。
4. **Windows 原子写锁竞争与覆盖失败 (Bug 7)**：`AtomicWriteFile` 采用“写入临时文件后 `os.Rename` 替换目标文件”机制，在 Windows 上若目标文件正在被杀毒软件或编辑器读取持有句柄，`os.Rename` 会抛出 `Access is denied` 错误并直接丢失写入数据。
5. **多轮 ReAct 自主执行中历史算子记录覆盖丢失 (Bug 10)**：大模型在一个回复轮次中连续调用多个工具时，后端单条消息仅持久化了最后一个工具执行记录 `Tool`，导致重新加载会话时早期调用的执行卡片与输出全部丢失。
6. **前端幽灵模态窗与空函数调用 (Bug 1, 2, 3)**：MCP、Skill、Rule 的添加按钮绑定的模态窗模板在 `<template>` 中完全缺失；AST 拓扑面板的“引用节点”点击抛出未定义错误；Diff 面板“采纳变更”仅关闭弹窗未执行真实暂存。
7. **安装器静默标志缺失导致后台挂起 (Bug 11)**：安装程序在传入 `--silent-install-dir` 时未将 `isSilent` 设为 `true`，导致在无头环境下弹出 `MessageBoxW` 挂起阻塞进程。

---

## ② 核心原理与根因剖析 (Knowledge Content & Root Cause)

### 1. Windows 进程树与管道锁死机制
Windows 不像 POSIX 具有原生进程组（Process Group）和 `SIGKILL` 组广播能力。当外壳命令通过 `cmd.exe /c npx ...` 启动时，`npx` 是 `cmd.exe` 的子孙进程。如果仅对父进程调用 `Kill()`：
- 子孙进程的 stdout/stderr 管道保持打开状态；
- Go 的 `io.Copy` 或 `bufio.Scanner` 会一直阻塞在 Read 调用，导致等待管道 EOF 的协程永不退出；
- **标准根治**：在 Windows 平台通过注入 `CREATE_NO_WINDOW`（`0x08000000`）静默执行 `taskkill /F /T /PID <pid>`，强行递归遍历并终结整棵进程树。

### 2. Git Porcelain 状态与工作区新文件差异
- `git diff HEAD -- file` 仅比较暂存区或工作区相对于 HEAD 的改动；对于从未进入版本库的 Untracked 文件（`??`），Git 默认将其视为不属于比对范围，因此输出为空。
- 必须通过 `git status --porcelain -- file` 识别出 `??`（未追踪）与 `A `（已暂存新文件），将文件的全部行构建为 `DiffLine{ Type: "add" }`，并将撤回逻辑回退为 `os.Remove(absPath)` 物理安全删除。

### 3. Windows 路径规范化规约
Go 的 `filepath.Clean` 和 `filepath.Abs` 不会自动统一 Windows 盘符大小写。因此在执行路径包含性断言（`strings.HasPrefix`）之前，必须将盘符转换为小写统一格式（`normalizeWindowsPath`）。

---

## ③ 标准解决方案与关键代码 (Actionable Solutions & Key Code)

### 1. Windows 进程树安全强杀 (`internal/mcp/stdio.go` & `plugins/tool/terminal/terminal_tool.go`)
```go
// 安全关闭子进程及其整个子孙进程树 (Windows taskkill /F /T)
func KillProcessTree(pid int) {
	if runtime.GOOS == "windows" {
		killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", pid))
		killCmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000, // CREATE_NO_WINDOW 杜绝黑框弹窗
		}
		_ = killCmd.Run()
	}
}
```

### 2. 未追踪新文件行级 Diff 解析 (`internal/diff/differ.go`)
```go
if diffOut == "" {
	// 检查是否为未追踪新文件或暂存区新文件 (Untracked / Added)
	statusCmd := exec.Command("git", "status", "--porcelain", "--", relPath)
	statusCmd.Dir = workspaceRoot
	var statusOut bytes.Buffer
	statusCmd.Stdout = &statusOut
	_ = statusCmd.Run()
	statusStr := strings.TrimSpace(statusOut.String())

	if strings.HasPrefix(statusStr, "??") || strings.HasPrefix(statusStr, "A ") {
		content, err := os.ReadFile(absPath)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				report.Lines = append(report.Lines, DiffLine{Type: "add", Text: line})
			}
			report.Stats = fmt.Sprintf("+%d 行 (新文件)", len(lines))
			report.Header = fmt.Sprintf("@@ 新增文件 +1,%d @@", len(lines))
			return report, nil
		}
	}
}
```

### 3. 未追踪文件安全物理撤回 (`app.go`)
```go
func (a *App) RevertFile(filePath string) error {
	cmd := exec.Command("git", "checkout", "HEAD", "--", filePath)
	cmd.Dir = a.workspace
	if err := cmd.Run(); err != nil {
		// 若 git checkout 失败 (例如该文件为未追踪 Untracked 新文件)，安全从磁盘中物理删除
		absPath := filepath.Join(a.workspace, filePath)
		if fi, statErr := os.Stat(absPath); statErr == nil && !fi.IsDir() {
			return os.Remove(absPath)
		}
		return err
	}
	return nil
}
```

### 4. 多轮算子时序全量切片持久化 (`internal/session/store.go` & `app.go`)
```go
type SessionMessage struct {
	ID       string          `json:"id"`
	Role     string          `json:"role"`
	Content  string          `json:"content"`
	Thinking string          `json:"thinking,omitempty"`
	Tool     *ToolExecution  `json:"tool,omitempty"`
	Tools    []ToolExecution `json:"tools,omitempty"` // 完整多算子执行历史链路
	Time     string          `json:"time"`
}
```

### 5. 前端模态窗补齐与居中人机工程学规范 (`App.vue`)
- 补齐 `isMcpModalOpen`、`isSkillModalOpen`、`isRuleModalOpen` 居中弹窗结构；
- 绑定 `@keydown.esc` 与显式 `[X]` 关闭按钮，严禁浏览器原生弹窗；
- 实现 `stageFileAction` 物理调用 `wailsBridge.gitStage`；
- 实现 `injectNodeToPrompt` 将选中 AST 节点结构化注入主输入框。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **外部进程生命周期必须与 Context 双向解绑**：启动长耗时外部子进程时，必须通过协程监听 `ctx.Done()`，一旦收到取消信号，立即调用进程树杀手强行释放底层管道；
2. **Git 工作区不仅有 Modified 还有 Untracked**：所有涉及文件版本控制的接口（Diff、Stage、Revert），必须同时对未追踪文件做兼容分支处理；
3. **Windows 路径比较强制大小写与前缀归一**：切忌直接用原生字符串比较 Windows 路径，必须经过 `filepath.Clean` 与统一盘符后方可做前缀判定；
4. **命令行安装参数必须保证静默与交互互斥**：安装器解析 `--silent-install-dir` 时，必须同步将 `isSilent` 锁死为 `true`，杜绝后台无头执行时被 UI 弹窗阻塞挂死。
