# LSP 编译器毫秒级语法诊断自愈守卫与 MCP 前端服务治理看板

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，系统总结在 Tcode Studio 纯原生桌面智能体中，针对多语言编译器语法诊断（LSP Compiler Diagnostics）、落盘自动触发自愈回路（Self-Healing Loop）以及前端 MCP 服务运维看板（握手探活、延迟评测与算子抽屉）的完整工程实践经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在代码大模型自主编写与修改项目的过程中，普遍存在以下两大核心痛点：
1. **语法与类型红线滞后暴露（调试成本高昂）**：
   - 大模型在生成代码（`write_file`）时，常因缩写、漏引包（Unused/Undefined import）、类型错配（Type Mismatch）产生致命语法错误；
   - 传统工作流往往需要等到全量项目打包编译或单元测试执行失败时才能感知，造成了极大的 Token 浪费与多轮冗余对话；
2. **外部协议工具黑盒化（缺乏可视化运维感知）**：
   - 外部通过 Model Context Protocol (MCP) 挂载了多个子进程服务（如文件系统、数据库、Git 等），开发者在前端往往无法直观感知服务是否真实在线、握手延迟高低，以及当前模型究竟能调用哪些算子。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 轻量级编译器探针与零黑框静默诊断
- 针对常见工程语言构建轻量级静态诊断探针，避免全量构建的笨重开销：
  - **Go**：通过在文件所在目录执行 `go vet` 捕获未定义标识符、包引用错误；
  - **TypeScript/JavaScript**：通过 `npx tsc --noEmit --skipLibCheck <file>` 捕获静态类型不符；
  - **Python**：通过 `python -m py_compile <file>` 进行 AST 语法树解析检验；
- **Windows 零黑框保障**：探针进程创建时强制附加 `SysProcAttr.CreationFlags |= 0x08000000`（`CREATE_NO_WINDOW`），杜绝任何后台编译黑框闪烁。

### 2. 写盘即诊断与 ReAct 智能体自愈注入 (Self-Healing Loop)
- **拦截时机**：在 Go 微内核处理 `write_file` 原子写盘成功后，立即异步/同步触发 `lsp.DiagnoseFile`；
- **结构化错误反馈格式化**：
  若检测到语法错误，不直接中断流程，而是将错误文件、行号、列号与编译器原始报错结构化拼接，置顶追加在工具输出（`output`）中：
  ```text
  ✓ 成功原子写入文件: app.go (1024 字节)

  ⚠️ 【⚡ 编译器实时语法诊断告警 (LSP Compiler Diagnostics)】
  代码落盘后编译器检测到以下语法或类型错误：
  1. [ERROR GO_VET] app.go (第 12 行, 第 5 列): undefined: myVariable
  ⚠️ 严禁忽视上述编译器报错！请在进行下一步之前，优先修改代码消除上述编译错误。
  ```
- **自愈驱动**：大模型接收到携带编译器诊断红线的 `role: tool` 消息后，在下一轮思考时会立刻聚焦于修复该语法错误，实现闭环自愈。

### 3. 前端 MCP 治理看板与工具探测架构
- **Master-Detail 运维架构**：
  - 展示服务运行状态指示灯（🟢 在线 / 🔴 异常 / ⚪ 已停用）；
  - 动态显示握手毫秒级延迟与算子数量徽章；
  - 点击「查看算子 ▼」可平滑展开当前服务导出的所有受控工具（Tools）及其参数 Schema 概览；
  - 提供表单抽屉支持即时增加、编辑、删除与启停外部 MCP 服务。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 后端轻量诊断模块实现
在 `internal/lsp/diagnostics.go` 中：
```go
func runGoDiagnostics(ctx context.Context, workspace string, relPath string) string {
	dir := filepath.Dir(relPath)
	cmd := exec.CommandContext(ctx, "go", "vet", "./"+filepath.ToSlash(dir))
	cmd.Dir = workspace
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // 零黑框防护
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()
	return stderr.String()
}
```

### 2. 算子执行后自动触发诊断并追加反馈
在 `app.go` 中的 `SendMessage` 算子调度分支：
```go
case "write_file":
    // 1. 原子安全写
    err := a.sandbox.AtomicWriteFile(argsObj.RelPath, []byte(argsObj.Content))
    if err == nil {
        output = fmt.Sprintf("✓ 成功原子写入文件: %s (%d 字节)", argsObj.RelPath, len(argsObj.Content))
        
        // 2. 触发毫秒级轻量 LSP 编译器语法诊断守卫
        if diagReport, err := lsp.DiagnoseFile(a.workspace, argsObj.RelPath); err == nil && diagReport != nil && diagReport.HasErrors {
            output += lsp.FormatDiagnosticFeedback(diagReport)
            runtime.EventsEmit(a.ctx, "lsp:diagnostic", map[string]any{
                "session_id": req.SessionID,
                "file":       argsObj.RelPath,
                "has_errors": true,
                "errors":     diagReport.Errors,
            })
        }
    }
```

### 3. 前端实时测速与算子抽屉展现
在 `frontend/src/components/SettingsModal.vue` 中：
```vue
<button @click="executeTestMCP(mcp)" :disabled="mcpTestLoadingMap[mcp.id]">
  <span>{{ mcpTestLoadingMap[mcp.id] ? '⏳ 握手中...' : '⚡ 测速探活' }}</span>
</button>
<div v-if="expandedToolsMap[mcp.id]" class="mt-2 pt-2 border-t">
  <div v-for="tName in mcpTestResultMap[mcp.id].tools" :key="tName">
    <span>🔧</span><span>{{ tName }}</span>
  </div>
</div>
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **超时截断避免阻塞交互主协程**：
   - 编译器静态检查必须严格设置 `context.WithTimeout(ctx, 3~4s)`，当遇到巨型工程或依赖未下载时，超时立即返回并降级，严禁让 Agent 调度死锁卡住。
2. **单文件报错归属与降噪**：
   - 当执行目录级检查（如 `go vet`）时，编译器可能同时输出同目录下其他历史旧文件的报错；
   - 必须通过正则在提取时匹配 `file == targetBase`，仅向模型汇报当前被修改文件的红线错误，避免无关告警干扰模型的上下文注意力。
3. **前端状态与后端配置双向强同步**：
   - 修改/删除 MCP 服务后，必须同步通知 Go 微内核管理器（`mcpManager.StopServer`），释放正在占用的后台子进程句柄与内存。
