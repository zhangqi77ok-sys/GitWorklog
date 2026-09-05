# 27. 推理流中断、无头静默卸载、假数据彻底净化与配置原子写 (Knowledge Doc 27)

> 本文档依据 `AGENTS.md`【铁律 6】强制归档：深入剖析第四轮巡检中排查出的大模型推理上下文无法中断、Windows 无头自动化卸载受阻、初次启动注入伪 MCP 假数据、配置写入并发撕裂、GitOps 命名注入、AST 畸形源码崩溃及子进程树孤儿残留等 10 大系统级缺陷，并记录生产级标准解决方案。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在桌面端微内核与真实模型驱动的演进过程中，暴露出若干影响可用性与用户体验的深水区缺陷：
1. **初次启动硬编码假数据（违背铁律 0.5）(Bug 1)**：`internal/config/extra_stores.go` 在初次启动时，若三项配置文件不存在，会主动写入默认的假 MCP（`mcp_filesystem`、`mcp_git`）、假 Skill 和假 Rule，导致用户反馈“还是都是假数据哇”，严重违背了“干净空状态”铁律；
2. **Ping 连通性探测缺少协议自愈 (Bug 2)**：`internal/network/pinger.go` 当用户输入未带 `https://` 的裸域名（如 `api.openai.com`）时，底层直接报 `unsupported protocol scheme ""`；
3. **大模型流式推理无法由用户中断 (Bug 3)**：`app.go` 调用 `llm.StreamChat` 时使用无取消闭包的 `context.Background()`，当模型输出超长文本或出现死循环时，前端没有中断按钮，后端无法及时切断网络链接；
4. **Windows 卸载程序缺少命令行静默模式且弹黑框 (Bug 4)**：`cmd/uninstaller/main.go` 未解析 `/S` 或 `-silent` 参数，且调用外部进程时缺少 `0x08000000`（`CREATE_NO_WINDOW`），导致无头自动化测试卡在 `MessageBoxW` 弹窗上且桌面闪烁控制台黑框；
5. **Git 分支与快照命令参数隔离缺失 (Bug 5)**：`internal/gitops/gitops.go` 中 `CheckoutBranch` 与 `CreateBranch` 未对分支名做合法性校验（如非法字符或 `-` 参数），在 Windows 上调用 git 时未隐藏黑框；
6. **配置并发写入撕裂与文件锁死隐患 (Bug 6)**：`internal/config/channel_store.go` 与 `extra_stores.go` 采用原生 `os.WriteFile` 裸写，在多协程高频持久化时存在写入未完成即被读取，或 Windows 文件系统文件句柄冲突导致的撕裂风险；
7. **大模型 SSE 思考字段解析不全 (Bug 7)**：`internal/llm/client.go` 仅解析了 `reasoning_content`，对部分国产模型或网关（如 Ollama、Qwen、OpenAI o 系列代理）返回的 `reasoning` 别名字段未能捕获，导致前端思考过程丢失；
8. **AST 语法解析畸形源码引发微内核崩溃 (Bug 8)**：`internal/ast/scanner.go` 调用 `go/parser.ParseFile` 解析源码时，若遇到极端畸形或语法损坏的 Go 文件，内部可能触发 panic 导致整个 Wails 宿主进程崩溃；
9. **上游模型探测端点自愈与即时响应缺失 (Bug 9)**：`App.vue` 中的 `fetchModelsAction` 探测成功后未动态加入响应式列表供用户直接下拉选取，且端点缺少无协议前缀的自动容错；
10. **同步执行终端命令超时未杀死孤儿子进程树 (Bug 10)**：`terminal_tool.go` 的 `Execute` 函数虽然有 `context.WithTimeout`，但 Go 原生 `exec.CommandContext` 超时仅杀死最外层 `cmd.exe`，导致子进程（如 node、go test）沦为孤儿进程继续在后台占满 CPU。

---

## ② 核心原理与根因剖析 (Knowledge Content & Root Cause)

### 1. 纯净空状态与零 Demo 铁律的彻底推行
- 系统第一次运行必须是干净无痕的画布，所有配置文件的缺省状态必须是空切片 `make([]T, 0)`。
- 绝不能以“提升首屏丰富度”为由在配置加载阶段偷偷写入演示数据。

### 2. Windows 孤儿子进程树 (Orphan Process Tree)
- 在 Windows 平台上，`cmd.exe /c <command>` 会启动一个 `cmd.exe` 进程，由它再启动具体目标进程。
- 当 Go 的 `context` 超时或被 cancel 时，Go 标准库内部调用的 `TerminateProcess` 仅仅对准了 `cmd.exe` 的句柄，而 `cmd.exe` 创建的下级子进程树会被 Windows 孤儿化，脱离管理并在后台长期挂起。
- **根治手段**：在 `execCtx.Done()` 协程中，使用 Windows 系统原生命令 `taskkill /F /T /PID <cmd_pid>`，带上 `/T` 参数递归遍历并强行终结整个子进程树。

### 3. Windows 卸载程序的异步自删除机制
- 正在运行的可执行文件（如 `uninstall.exe`）在 Windows 下拥有排他执行锁，无法通过常规进程自身删除自身。
- 必须通过在 `%TEMP%` 目录下生成独立的临时批处理脚本，由批处理脚本利用 `ping 127.0.0.1 -n 3 >nul` 进行延时等待 `uninstall.exe` 彻底退出并释放文件锁，然后执行 `rmdir /s /q` 清理安装目录，最后通过 `del /f /q "%~f0"` 完成自毁。

---

## ③ 标准解决方案与关键代码 (Actionable Solutions & Key Code)

### 1. 彻底清空默认 Demo 假数据 (`internal/config/extra_stores.go`)
```go
func (s *ExtraStore) loadAll() {
	// 关键铁律: 默认纯净空状态，严禁预埋任何假 MCP、假 Rule 或假 Skill
	s.mcps = make([]MCPServerConfig, 0)
	s.skills = make([]SkillConfig, 0)
	s.rules = make([]RuleConfig, 0)
    // 仅当磁盘文件实际存在且内容有效时才进行反序列化
    ...
}
```

### 2. 配置原子写 (`atomicWriteConfig`)
```go
func atomicWriteConfig(filePath string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(filePath)
	_ = os.MkdirAll(dir, 0755)

	tmpFile := filepath.Join(dir, fmt.Sprintf(".tmp_%d_%s", time.Now().UnixNano(), filepath.Base(filePath)))
	if err := os.WriteFile(tmpFile, data, perm); err != nil {
		return err
	}

	if err := os.Rename(tmpFile, filePath); err != nil {
		_ = os.Remove(tmpFile)
		return os.WriteFile(filePath, data, perm)
	}
	return nil
}
```

### 3. 全链路流式中断支持 (`app.go`)
```go
func (a *App) CancelAgentStream() {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentCancel != nil {
		a.agentCancel()
		a.agentCancel = nil
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "agent:interrupted", map[string]any{
				"message": "用户手动中断了本次推理",
			})
		}
	}
}
```

### 4. 终端命令子进程树递归强杀 (`plugins/tool/terminal/terminal_tool.go`)
```go
	// 注入 context 超时/取消守护：彻底杀死整棵孤儿子进程树，防止后台挂死
	done := make(chan struct{})
	go func() {
		select {
		case <-done:
		case <-execCtx.Done():
			if cmd.Process != nil {
				if runtime.GOOS == "windows" {
					killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
					killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
					_ = killCmd.Run()
				} else {
					_ = cmd.Process.Kill()
				}
			}
		}
	}()

	err := cmd.Wait()
	close(done)
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **避免在非交互式 Shell 中使用 `timeout` 命令**：
   - Windows 原生 `timeout /t 1 /nobreak` 在输入被重定向或非控制台环境下会立即报错 `ERROR: Input redirection is not supported` 并返回错误码 1。
   - 在后台无头脚本中执行延时，推荐使用通用无副作用的 `ping 127.0.0.1 -n <秒数+1> >nul`。
2. **大模型 SSE 多变字段兼容性**：
   - 网关层字段命名往往存在差异（如 `reasoning_content`、`reasoning`、`thought`），客户端解析器必须具备多字段兼容策略，优先提取非空字段。
3. **外部命令创建参数必须隔离**：
   - 任何由用户或外部传入的参数，在拼装 Git 命令或系统指令前必须进行白名单校验，禁止包含 `-` 开头的 Option 参数或 shell 特殊字符（`; & |`）。
