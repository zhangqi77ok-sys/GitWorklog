# MCP 跨进程 Stdio 协议传输、生命周期管理与 ReAct 算子动态调度机制

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，系统总结在 Tcode Studio 纯原生桌面智能体中，针对 Anthropic 模型上下文协议 (Model Context Protocol, MCP) 的标准 JSON-RPC 2.0 管道实现、Windows 零黑框进程管控、Manager 算子路由与 ReAct Agent 自主调度闭环的完整工程落地经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

随着大模型自主智能体 (Autonomous Agents) 的快速发展，硬编码内置工具已无法满足多元化业务与外部生态集成的诉求。Anthropic 提出的 **Model Context Protocol (MCP)** 正在成为大模型连接外部数据源、开发者工具（如 GitHub、Postgres、Puppeteer、Filesystem）的行业事实标准。

在为 Tcode 构建原生 MCP 客户端与算子调度系统时，面临以下核心工程挑战：
1. **跨进程 Stdio 协议管道与长连接通讯**：
   - MCP 标准通常通过标准输入输出（Stdio）派生子进程，以单行 JSON-RPC 2.0 报文进行双向无状态/有状态 RPC 交互；
   - 必须处理子进程的生命周期拉起、初始化双向握手（`initialize` / `notifications/initialized`）、探活（`ping`）以及异常崩溃与超时；
2. **Windows 外部进程弹框防护 (CREATE_NO_WINDOW)**：
   - 当桌面客户端拉起基于 Node (`npx`)、Python (`uvx`) 或独立二进制的 MCP 服务时，Windows 默认会瞬间闪烁或常驻黑色控制台窗口，严重破坏极简桌面体验；
3. **多服务算子空间与动态路由冲突治理**：
   - 用户可以配置并启用多个不同的 MCP 服务，这些服务导出的算子必须与 Tcode 本地内置沙箱算子（`exec_command`, `write_file`, `read_file`, `git_status`）统一聚合并动态转换为 OpenAI 兼容的 `tools` 参数；
   - 当大模型决定调用某个算子时，智能体内核必须在 $O(1)$ 时间内精准将调用派发至拥有该算子的特定 MCP 服务进程，并在返回后无缝闭环回到 ReAct 上下文。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. MCP JSON-RPC 2.0 握手与消息协议
- **初始化握手 (Initialize Flow)**：
  - 客户端通过 `stdin` 发送 `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tcode-desktop","version":"2.0.0"}}}`；
  - 服务端返回自身能力与服务元数据；
  - 客户端紧接着发送通知 `{"jsonrpc":"2.0","method":"notifications/initialized"}` 确认握手完成。
- **工具发现 (Tools Discovery)**：
  - 发送 `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`；
  - 服务端响应当前服务暴露的全部工具清单及 JSON Schema 入参定义（`inputSchema`）。
- **工具调用 (Tool Execution)**：
  - 发送 `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"...","arguments":{...}}}`；
  - 服务端执行后返回包含 `content: [{type: "text", text: "..."}]` 的结构化结果。

### 2. Windows 零黑框进程管控 (`0x08000000`)
- 在 Windows 下启动外部子进程必须通过 `os/exec.Cmd` 的 `SysProcAttr` 注入低阶系统标志：
  ```go
  cmd.SysProcAttr = &syscall.SysProcAttr{
      HideWindow:    true,
      CreationFlags: 0x08000000, // CREATE_NO_WINDOW
  }
  ```
- 该标志告知 Windows 内核在创建进程时不为此子进程分配新的控制台子系统屏幕缓冲区，确保无论是 `npx`、`node` 还是 `python` 执行均在后台静默运行。

### 3. Manager 算子全局路由拓扑
- 管理器通过两个核心并发安全映射维护状态：
  - `clients: map[string]Client`：维护 服务 ID ➔ 客户端实例的长连接映射；
  - `toolRouting: map[string]string`：维护 算子名 ➔ 服务 ID 的反向路由索引。
- 架构图解：
```
 +-------------------------------------------------------------+
 |                   ReAct Execution Engine                    |
 +-------------------------------------------------------------+
                               |
               (1) 获取合并工具集: 内置沙箱 + MCP
                               v
 +-------------------------------------------------------------+
 |                    mcp.Manager (全局路由)                   |
 |  toolRouting: { "search_db": "srv_pg", "fetch_url": "srv_web" }
 +-------------------------------------------------------------+
          |                                       |
    [StdioClient A]                         [StdioClient B]
          | (JSON-RPC 2.0)                        | (JSON-RPC 2.0)
          v                                       v
 [npx @mcp/server-pg]                   [uvx mcp-server-web]
 (CREATE_NO_WINDOW 零黑框)               (CREATE_NO_WINDOW 零黑框)
```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. StdioClient 安全启动与握手实现
在 `internal/mcp/stdio.go` 中：
```go
func (c *StdioClient) Start(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, c.command, c.args...)
	cmd.Dir = c.workspace
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // 杜绝 CMD 黑框
	}
	// ... 建立 stdin / stdout 管道，开启 scanner 消费协程并完成 initialize 握手
}
```

### 2. Manager 路由与工具聚合转换
在 `internal/mcp/manager.go` 中：
```go
// GetAllTools 获取所有已启用服务的算子定义，并转换为 OpenAI LLM 工具格式
func (m *Manager) GetAllTools(ctx context.Context) ([]llm.ToolDef, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	defs := make([]llm.ToolDef, 0)
	for srvID, client := range m.clients {
		tools, err := client.ListTools(ctx)
		if err != nil {
			continue
		}
		for _, t := range tools {
			defs = append(defs, llm.ToolDef{
				Type: "function",
				Function: llm.ToolFunctionDef{
					Name:        t.Name,
					Description: fmt.Sprintf("[%s] %s", srvID, t.Description),
					Parameters:  params,
				},
			})
		}
	}
	return defs, nil
}
```

### 3. ReAct 智能体端到端调用闭环
在 `app.go` 中：
1. **初始化与生命周期绑定**：
   - `NewApp()` 显式挂载 `mcp.NewManager(wd)`；
   - `startup(ctx)` 异步预热拉起配置中已启用的 MCP 服务；
   - `shutdown(ctx)` 安全调用 `StopAll()` 释放所有外部子进程；
2. **工具池合并**：
   ```go
   workspaceTools := llm.DefaultWorkspaceTools()
   if a.mcpManager != nil {
       if mcpTools, err := a.mcpManager.GetAllTools(context.Background()); err == nil {
           workspaceTools = append(workspaceTools, mcpTools...)
       }
   }
   ```
3. **分发路由**：
   在执行工具的 `switch toolName` 的 `default:` 分支无感接入：
   ```go
   default:
       if a.mcpManager != nil {
           output, err = a.mcpManager.CallTool(context.Background(), toolName, mcpArgs)
       }
   ```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **子进程残留与僵尸进程防御**：
   - **风险**：若主程序崩溃或直接被杀死，衍生出来的 Node/Python 外部子进程可能孤立滞留后台，持续占用系统内存与端口；
   - **最佳实践**：所有客户端均绑定统一生命周期上下文，在 `App.shutdown` 中显式广播退出通知（`StopAll`），子进程调用 `cmd.Process.Kill()` 确保彻底回收。
2. **单行 JSON-RPC 消息解析健壮性**：
   - **风险**：某些 MCP 服务在启动初期可能向 `stdout` 输出非 JSON 的日志或版本信息；
   - **最佳实践**：采用 `bufio.Scanner` 按行扫描，逐行尝试 `json.Unmarshal`。遇到非合法 JSON-RPC 报文时跳过并记录调试日志，避免解析器整线瘫痪。
3. **工具描述增强注入**：
   - **最佳实践**：通过 `fmt.Sprintf("[%s] %s", srvID, t.Description)` 将服务归属 ID 自动附加在工具描述前缀中，不仅让大模型明晰该工具的上下文来源，还在多工具共存时显著降低模型误用幻觉。
