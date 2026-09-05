# 28. 任意文件删除防御、会话原子落盘、大模型用量成本核算与文件树循环防御 (Knowledge Doc 28)

> 本文档依据 `AGENTS.md`【铁律 6】强制归档：深入剖析第五轮巡检中排查出的文件回滚任意删除越权、会话持久化高频写入撕裂风险、遥测用量成本格式化重大 Bug、文件树软链接死循环与大目录卡顿、Diff/Git/Diagnostics 外部进程黑框闪烁与参数隔离缺失、JSON-RPC ID 多类型兼容性及流式删除幽灵会话复活等 10 大系统级缺陷，并记录生产级标准解决方案。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在桌面端微内核与真实模型驱动的持续巡检中，排查出以下 10 项核心系统缺陷：
1. **`RevertFile` 任意文件物理删除越权漏洞 (Path Traversal) (Bug 1)**：`app.go` 在处理未追踪文件的撤回时，若 `git checkout` 返回非零，直接拼接未校验的入参路径并调用 `os.Remove(absPath)`，恶意路径（如 `../../important.txt`）可绕过沙箱将宿主机上的任意非工作区文件彻底物理删除；
2. **会话持久化高频写入撕裂隐患 (Bug 2)**：`internal/session/store.go` 的 `Save(sess)` 仍在使用裸写 `os.WriteFile`，在流式高频持久化或异常断电场景下存在数据截断、损坏（JSON 数据撕裂）的风险；
3. **预估成本遥测格式化重大 Bug (Bug 3)**：`internal/telemetry/tracker.go` 中预估美元成本计算出 `cost` 后，却错误地使用了 `time.Now().Format("0.000")` 格式化美元字符串，导致输出的并不是真实消耗的 Token 换算成本，而是当前系统时间格式化出的伪造数值；
4. **`buildFileTree` 缺少全局节点上限与软链接死循环识别 (Bug 4)**：`app.go` 文件树遍历缺少软链接真实物理路径防环识别与 500 节点硬性截断，在大工程或具有循环符号链接的工作区下可能导致死循环递归或 DOM 渲染卡死；
5. **Diff 模块缺少路径越界校验与 Windows 零黑框防护 (Bug 5)**：`internal/diff/differ.go` 计算文件差异与应用补丁时未校验 `relPath` 沙箱边界，且多处 `exec.Command("git", ...)` 缺失 Windows `0x08000000` / `HideWindow: true`；
6. **Git 插件算子调用未配置 Windows 隐藏黑框 (Bug 6)**：`plugins/tool/git/git_tool.go` 的 `execGit` 每次拉取 Git 状态时都会在 Windows 桌面闪烁控制台黑框；
7. **LSP 语法诊断缺少沙箱校验与参数隔离 (Bug 7)**：`internal/lsp/diagnostics.go` 的 `DiagnoseFile` 未校验工作区相对路径，且 `runTSDiagnostics` 传递 `relPath` 前未加 `"--"` 参数隔离；
8. **工作区提交无黑框与无变更容错缺失 (Bug 8)**：`app.go` 中的 `GitCommit` 和 `GitStage` 未配置 `windowsSysProcAttr()`，且当工作区无变动时 `git commit` 会抛出 exit status 1 错误未优雅容错；
9. **MCP Stdio JSON-RPC ID 多类型解析与非阻塞投递缺失 (Bug 9)**：`internal/mcp/stdio.go` 仅解析 `float64` 和 `int64`，服务端返回字符串 ID 或 `json.Number` 时请求超时挂死，向 pending channel 投递未做非阻塞保护；
10. **流式生成中删除会话导致幽灵会话复活 (Bug 10)**：`frontend/src/App.vue` 中的 `deleteSession` 在删除当前活跃会话时未先中断正在运行的推理流，导致推理结束后的自动落盘将已删除的会话在磁盘上重新写回。

---

## ② 核心原理与根因剖析 (Knowledge Content & Root Cause)

### 1. 任意文件删除越权 (Arbitrary File Deletion)
- 当用户执行“放弃变更 (Revert)”操作时，若该文件是一个新增的未追踪文件（Untracked），`git checkout HEAD -- <file>` 会报错退出。
- 原实现代码在 `err != nil` 分支中简单调用了 `os.Remove(filepath.Join(a.workspace, filePath))`。如果 `filePath` 传入 `../../foo.txt`，`filepath.Join` 无法阻止向父级目录穿越。
- **根治手段**：所有涉及到物理磁盘删除或读取的操作，必须统一接入 `a.sandbox.ValidatePath(filePath)` 强校验，严密拦截任何企图逃逸工作区沙箱的非法路径。

### 2. 原子落盘防御数据撕裂 (Atomic Write via Temp File & Rename)
- 直接使用 `os.WriteFile` 覆写正在读取或频繁写入的文件时，操作系统会首先 truncate 目标文件。若此时程序被终止、崩溃或发生并发读写，文件会变成空文件或残缺 JSON。
- **根治手段**：在同目录创建带有纳秒时间戳的 `.tmp` 临时文件，写入完成后调用 `Sync()` 刷盘并关闭句柄，最后利用操作系统原语原子性重命名为目标文件名。

### 3. 时间格式化与浮点数字符串混淆
- Go 语言中的 `time.Format` 格式化串是基于固定参考时间 `Mon Jan 2 15:04:05 MST 2006`（即 1 2 3 4 5 6）。
- 将浮点数格式化为美元金额必须使用 `fmt.Sprintf("$%.4f", cost)`，误用 `time.Now().Format("0.000")` 会导致时间数字被拼接成虚假的计费金额。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 文件回滚沙箱保护 (`app.go`)
```go
func (a *App) RevertFile(filePath string) error {
	var validPath string
	var err error
	if a.sandbox != nil {
		validPath, err = a.sandbox.ValidatePath(filePath)
		if err != nil {
			return fmt.Errorf("security violation: %w", err)
		}
	} else {
		validPath = filepath.Join(a.workspace, filePath)
	}

	cmd := exec.Command("git", "checkout", "HEAD", "--", filePath)
	cmd.Dir = a.workspace
	if attr := windowsSysProcAttr(); attr != nil {
		cmd.SysProcAttr = attr
	}
	if err := cmd.Run(); err != nil {
		if fi, statErr := os.Stat(validPath); statErr == nil && !fi.IsDir() {
			return os.Remove(validPath)
		}
		return err
	}
	return nil
}
```

### 2. 会话原子落盘实现 (`internal/session/store.go`)
```go
func atomicWriteSession(filePath string, data []byte) error {
	tmpPath := fmt.Sprintf("%s.tmp.%d", filePath, time.Now().UnixNano())
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, filePath); err != nil {
		_ = os.Remove(filePath)
		if renameErr := os.Rename(tmpPath, filePath); renameErr != nil {
			_ = os.Remove(tmpPath)
			return os.WriteFile(filePath, data, 0644)
		}
	}
	return nil
}
```

### 3. 遥测成本精确格式化 (`internal/telemetry/tracker.go`)
```go
// 预估成本估算 (平均 $0.002 / 1k tokens)
cost := float64(totalTokens) * 0.000002
costStr := fmt.Sprintf("$%.4f", cost)
```

### 4. 文件树防环与规模截断 (`app.go`)
```go
func (a *App) buildFileTreeInternal(currentDir string, currentDepth, maxDepth int, nodeCount *int, visited map[string]bool) ([]FileNode, error) {
	if *nodeCount >= 500 {
		return nil, nil
	}

	realDir, err := filepath.EvalSymlinks(currentDir)
	if err != nil {
		realDir = currentDir
	}
	if visited[realDir] {
		return nil, nil // 避免软链接死循环
	}
	visited[realDir] = true
    ...
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止无验证直接拼接路径并执行删除**：凡是调用 `os.Remove` 或 `os.RemoveAll` 的地方，必须经过沙箱合法性验证（`ValidatePath`），严防通过未受保护的入参删除系统关键目录或文件。
2. **所有 Windows 外部进程必须注入零黑框标记**：所有由微内核启动的 `git`、`npx`、`python` 等命令，必须在 Windows 下配置 `CreationFlags: 0x08000000` 与 `HideWindow: true`，杜绝桌面端控制台弹窗闪烁。
3. **前端异步删除前确保状态干净**：删除数据实体（如会话、文档）时，必须联动清理正在进行的流式监听与后台推理任务，防止过时的异步回调执行“复活写入”。
