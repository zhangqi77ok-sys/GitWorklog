# 26. 文件树与会话防穿越守卫、编译诊断无网络阻断与前端状态洁净性 (Knowledge Doc 26)

> 本文档依据 `AGENTS.md`【铁律 6】强制归档：深入剖析第三轮巡检中排查出的路径穿越越权遍历、TestMCPServer 伪配置静默降级、GitStage 边界注入、LSP 编译器 npx 离线阻断、AST 遍历节点熔断、前端会话全清残留与空会话畸形文件等系统级深水区缺陷，并记录标准防御方案。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在桌面端微内核与前端多轮交互的边界处，存在若干容易被忽略但可能导致越权或挂死的系统级盲区：
1. **文件树路径穿越与全盘越权枚举 (Bug 1)**：`GetFileTree(dir string)` 接口直接使用 `filepath.Join(a.workspace, dir)`，未调用受控沙箱的 `ValidatePath`。若前端传入 `../../` 或绝对路径，攻击者可越过工作区沙箱限制列出系统盘任意敏感目录；
2. **违背铁律 0.5 的伪服务静默降级 (Bug 2)**：`TestMCPServer` 在配置库找不到指定的 MCP 服务时，代码内部静默拼装了默认的 `npx @modelcontextprotocol/server-filesystem` 伪配置并执行探活返回假成功，掩盖了真实服务缺失，违背了 Fail-Closed 原则；
3. **Git 命令参数注入隐患 (Bug 3)**：`GitStage` 执行 `git add filePath` 时缺少 `--` 参数隔离，若文件名以 `-` 开头会被 Git 解析为命令行 Option 参数；
4. **空终端命令空指针/假退出 (Bug 4)**：`ExecTerminalStream` 传入空白命令时未做拦截，导致下层调用空进程并派发无意义的退出事件；
5. **会话 ID 路径穿越与任意文件删除 (Bug 5)**：`internal/session/store.go` 中的 `Get(id)`、`Save(sess)` 与 `Delete(id)` 直接执行 `filepath.Join(s.baseDir, fmt.Sprintf("%s.json", id))`，未对 `id` 做合法性白名单清洗。若传入 `../../foo`，不仅可任意越界读写，还可通过 `Delete` 任意删除会话目录外的物理文件；
6. **数据治理假数据标签残留 (Bug 6)**：会话保存中遗留了 `if sess.Tag == "" { sess.Tag = "核心架构" }` 的硬编码假标签；
7. **LSP 编译器诊断离线网络交互挂死 (Bug 7)**：`runTSDiagnostics` 执行 `npx tsc` 未加 `--no-install` 参数，在没有本地安装 TypeScript 的用户机器上会阻塞在终端等待交互式下载，直至 4 秒超时挂起；
8. **AST 遍历未受控导致巨型仓库卡死 (Bug 8)**：`ScanWorkspaceAST` 未过滤 `vendor`/`build`/`target` 目录，未跳过巨型源码文件，未设最大节点熔断上限，可能导致前端 Vue 瞬间挂载数千个节点卡死崩溃；
9. **前端会话删除后脏状态复活 (Bug 9)**：`deleteSession` 删除最后一个会话后，未将 `currentSessionId` 置空且未重置会话实体，导致已删除会话在界面上残留，发送新消息时用已删除的旧 ID 在磁盘上复活旧会话；
10. **空会话 ID 触发畸形 `.json` 磁盘文件 (Bug 10)**：在初次启动且无会话状态下，用户直接在输入框发送消息，传入的 `session_id` 为 `""`，导致后端在磁盘生成畸形 `.json` 文件。

---

## ② 核心原理与根因剖析 (Knowledge Content & Root Cause)

### 1. 路径穿越 (Path Traversal) 与白名单清洗
- `filepath.Join(base, userPath)` 无法防御以 `..` 开头的相对越界路径。当 `userPath` 包含 `../../` 时，`filepath.Clean` 会直接跳出 `base` 目录。
- **根治原则**：
  - 工作区路径：必须先调用沙箱 `ValidatePath` 验证绝对路径前缀匹配；
  - 命名 ID：必须执行 `filepath.Base(filepath.Clean(id))` 白名单断言，确保 `clean == id`，禁止包含任何分隔符。

### 2. Node/NPX 交互式网络阻塞防护
- 在自动化或后台静默守护进程中，执行 `npx` 时必须显式附加 `--no-install`。如果检测到本地缺少可执行二进制，立即以非零状态码退出，严禁进入联网下载等待或向终端抛出确认提示（`Ok to proceed? (y)`）。

### 3. 前端响应式状态生命周期的对称性
- 当列表从 $N \to 0$ 时，必须显式重置受该列表约束的详情状态指针。若未重置指针，界面呈现假象，后续写入操作会复活幽灵实体。

---

## ③ 标准解决方案与关键代码 (Actionable Solutions & Key Code)

### 1. 会话 ID 路径穿越清洗与防删除守卫 (`internal/session/store.go`)
```go
// sanitizeID 防御会话 ID 路径穿越 (Path Traversal)，只允许合法基名
func sanitizeID(id string) (string, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return "", fmt.Errorf("session id cannot be empty")
	}
	clean := filepath.Base(filepath.Clean(trimmed))
	if clean == "." || clean == "/" || clean == "\\" || clean != trimmed {
		return "", fmt.Errorf("invalid session id format: %s", id)
	}
	return clean, nil
}
```

### 2. 文件树沙箱合法性强制校验 (`app.go`)
```go
func (a *App) GetFileTree(dir string) ([]FileNode, error) {
	targetDir := a.workspace
	if dir != "" {
		if a.sandbox != nil {
			validated, err := a.sandbox.ValidatePath(dir)
			if err != nil {
				return nil, fmt.Errorf("invalid path access: %w", err)
			}
			targetDir = validated
		} else {
			targetDir = filepath.Join(a.workspace, dir)
		}
	}
	return a.buildFileTree(targetDir, 0, 4)
}
```

### 3. Fail-Closed 严禁静默假成功降级 (`app.go`)
```go
func (a *App) TestMCPServer(id string) (mcp.MCPTestResult, error) {
	if a.mcpManager == nil {
		return mcp.MCPTestResult{Status: "ERROR", Error: "mcp manager not initialized"}, fmt.Errorf("mcp manager not initialized")
	}
	if a.extraStore != nil {
		mcps := a.extraStore.ListMCPs()
		for _, srv := range mcps {
			if srv.ID == id || strings.Contains(strings.ToLower(srv.Name), strings.ToLower(id)) {
				return a.mcpManager.TestServer(context.Background(), srv)
			}
		}
	}
	// 坚决杜绝静默假配置降级，未找到直接暴露真实错误
	return mcp.MCPTestResult{
		ID:     id,
		Status: "ERROR",
		Error:  fmt.Sprintf("未找到指定的 MCP 服务配置: [%s]", id),
	}, fmt.Errorf("mcp server [%s] not found", id)
}
```

### 4. LSP 编译器零交互无阻塞执行 (`internal/lsp/diagnostics.go`)
```go
func runTSDiagnostics(ctx context.Context, workspace string, relPath string) string {
	// 注入 --no-install 标志，若本地未安装 tsc 立即退出，严禁进入网络交互挂起
	cmd := exec.CommandContext(ctx, "npx", "--no-install", "tsc", "--noEmit", "--skipLibCheck", relPath)
	cmd.Dir = workspace
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	_ = cmd.Run()
	return out.String()
}
```

### 5. AST 深度解析资源阈值与熔断保护 (`internal/ast/scanner.go`)
```go
// 忽略隐藏目录与大型依赖产物目录
if info.IsDir() {
	base := strings.ToLower(info.Name())
	if strings.HasPrefix(base, ".") || base == "node_modules" || base == "dist" || base == "bin" || base == "build" || base == "vendor" || base == "target" || base == "release" {
		return filepath.SkipDir
	}
	return nil
}

// 熔断保护: 达到 300 个拓扑节点即刻自然收敛，防止 DOM 渲染雪崩
if len(nodes) >= 300 {
	return filepath.SkipAll
}

// 仅分析 .go 源码，且跳过单文件超过 512KB 的巨型文件
if !strings.HasSuffix(path, ".go") || info.Size() > 512*1024 {
	return nil
}
```

### 6. 前端会话自愈与干净空状态维护 (`App.vue`)
```ts
async function deleteSession(id: string) {
  await wailsBridge.deleteSession(id)
  await loadSessionsList()
  if (currentSessionId.value === id) {
    if (sessions.value.length > 0) {
      await selectSession(sessions.value[0].id)
    } else {
      currentSessionId.value = ''
      currentSession.value = {
        id: '',
        title: '新工程对话',
        model: selectedModel.value || 'deepseek-chat',
        tag: '',
        created_at: Date.now(),
        updated_at: Date.now(),
        messages: []
      }
    }
  }
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **不可信输入绝对禁止拼接文件后缀直接删除**：必须在入参进入 IO 之前进行 `filepath.Base` 归一化与非法字符阻断；
2. **外部工具命令必须配置防挂起标志**：凡是调用 `npx`、`pip`、`go run` 等可能自动下载包的命令，在自动化守护进程中必须配置 `--no-install` / `--no-input` 参数；
3. **大数据量可视化必须设置数量硬顶熔断**：任何将外部系统扫描结果渲染至前端的视窗（如 AST 拓扑图、文件树），必须在后端微内核层设定数量硬顶与体积上限，杜绝单点数据膨胀拖垮客户端渲染线程。
