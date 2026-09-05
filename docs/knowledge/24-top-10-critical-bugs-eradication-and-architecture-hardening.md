# 24. 核心系统前十大关键缺陷全域歼灭与桌面微内核工程加固指南

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 从原型演进至生产级 Wails 原生桌面端过程中，随着微内核、IPC 桥接层与前端 UI 深度联动，排查并定位出全栈链路中存在的 10 个最严重的系统级缺陷：
1. **渠道配置层初始数据投毒** (`internal/config/channel_store.go`)：配置初始化硬编码测试 Token 与假模型 `deepseek-v4-flash`，污染本地状态；
2. **后端凭据穿透与缺失 Fail-Closed** (`app.go`)：调用网关拉取模型与发送对话时回退至内置测试 Token，未在缺少 API Key 时明确报错中断；
3. **无边框窗口控制与拖拽失效** (`frontend/src/App.vue`)：Frameless 标题栏未绑定 Wails 窗口最小化/最大化/关闭函数，未配置 `--wails-draggable:drag`；
4. **工作区深层文件树遍历截断** (`app.go`)：`GetFileTree` 仅扫描 1 层子目录，深层项目结构无法浏览；
5. **IPC 事件监听器泄漏与 Token 多倍打印** (`frontend/src/core/wailsBridge.ts`)：每次 `sendMessage` 均新注册 `runtime.EventsOn` 却从未 `EventsOff`，导致多轮对话后 Chunk 回调成倍重复触发且内存持续泄漏；
6. **附件文件 Payload 遗漏与状态未重置** (`frontend/src/App.vue`)：选中的关联文件未拼接进请求提示词，发送后附件列表未清空；
7. **算子参数裸解析组件崩溃风险** (`frontend/src/App.vue`)：`onToolStart` 裸执行 `JSON.parse(args)` 缺少 try-catch 保护；
8. **工具消息空 Content 字段被过滤致协议校验失败** (`internal/llm/client.go`)：`Message.Content` 的 `omitempty` 导致工具消息当内容为空时缺失 `content` 键，触发上游网关 `400 Bad Request: 'content' is a required property for role 'tool'`；
9. **安装包目录隔离缺陷与卸载器防误杀缺失** (`cmd/installer` & `cmd/uninstaller`)：CLI 安装未补齐专属 `TcodeStudio` 子目录；卸载器无差别删除自身父级目录；
10. **工作台顶栏模型选择器静态硬编码** (`frontend/src/App.vue`)：`<select>` 写死固定假模型，未动态联动用户真实配置的模型渠道。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 协议合规与 JSON 序列化规范
OpenAI 与 DeepSeek 标准 API 规范对 `role: "tool"` 消息有严格 Schema 校验，即使工具执行后标准输出为空，也必须传输 `"content": ""`。若在 Go 结构体中使用 `omitempty` 标签，Go 的 `json.Marshal` 会自动剪裁空字符串键，造成 HTTP 请求报文中缺少必须字段，触发网关拦截拒绝。

### 2. Wails 原生事件总线生命周期
Wails 2 提供了 `runtime.EventsOn` 与 `runtime.EventsOff` 全局事件广播总线。由于事件总线生命周期挂载在全局 `window.runtime` 对象上，每次业务方法调用时如果未清理旧监听器，就会累加注册。导致第 $N$ 轮对话时单次后端事件触发 $N$ 次前端回调，引发严重的性能卡顿、日志暴击与重复渲染。

### 3. Windows 应用程序目录安全隔离与自清理防误杀
Windows 环境下的单文件安装程序支持通过 CLI 参数指定目标路径（如 `/D=`, `--dir=`, `--silent-install-dir=`）。若不对输入路径进行规范化校验并强制追加软件专用子目录，用户若误传入盘符根目录（如 `D:\`）或现有代码仓库目录，卸载程序将自身所在目录直接判定为主目录并执行 `rmdir /s /q`，造成不可逆的灾难性数据丢失。必须在安装与卸载全链路设立双向安全守卫。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 根除假数据与严格 Fail-Closed (Bug 1 & Bug 2)
在 `internal/config/channel_store.go` 中彻底移除 `initDefaults()` 及其所有硬编码凭据与模拟延迟，确保无配置文件时初始化为空切片：
```go
// NewChannelStore 纯净初始化 (Zero Demo / Fail-Closed)
func NewChannelStore(configDir string) *ChannelStore {
	store := &ChannelStore{
		configDir: configDir,
		filePath:  filepath.Join(configDir, "channels.json"),
		channels:  make([]ChannelConfig, 0),
	}
	_ = store.Load()
	return store
}
```
在 `app.go` 中，去除所有降级硬编码 Token；若渠道未配置有效 API Key，立即向前端推送配置指引并终止：
```go
if apiKey == "" {
	errMsg := "\n\n[配置错误] 未检测到有效的模型渠道凭据 (API Key)。请在右侧「渠道配置」面板添加并激活您的真实模型服务渠道。"
	runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
		"session_id": req.SessionID,
		"delta":      errMsg,
		"turn":       1,
	})
	runtime.EventsEmit(a.ctx, "agent:complete", map[string]any{
		"session_id": req.SessionID,
		"error":      "missing_api_key",
	})
	return
}
```

### 2. 协议严谨性修复 (Bug 8)
在 `internal/llm/client.go` 中移除 `Content` 的 `omitempty` 标签，确保空字符串也能原样序列化为 `"content": ""`：
```go
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}
```

### 3. 深层递归文件树构建 (Bug 4)
在 `app.go` 中重构 `GetFileTree`，引入深度受控（上限 4 层）并过滤忽略目录（`.git`, `node_modules`, `bin`, `dist`, `build`）的递归扫描算法：
```go
func (a *App) buildFileTree(currentDir string, currentDepth, maxDepth int) ([]FileNode, error) {
	entries, err := os.ReadDir(currentDir)
	if err != nil { return nil, err }
	nodes := make([]FileNode, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "bin" || name == "dist" || name == "build" {
			continue
		}
		rel, _ := filepath.Rel(a.workspace, filepath.Join(currentDir, name))
		node := FileNode{
			Name: name, Path: filepath.ToSlash(rel), IsDir: entry.IsDir(),
		}
		if entry.IsDir() && currentDepth < maxDepth {
			subNodes, _ := a.buildFileTree(filepath.Join(currentDir, name), currentDepth+1, maxDepth)
			node.Children = subNodes
		}
		nodes = append(nodes, node)
	}
	return nodes, nil
}
```

### 4. 前端事件防泄漏与窗口控制集成 (Bug 3, Bug 5, Bug 6, Bug 7, Bug 10)
- **事件清理**：在 `wailsBridge.sendMessage` 中注入 `cleanAll()`，在建立新对话流前及对话完成时调用 `runtime.EventsOff` 注销全局监听器；
- **窗口控制**：为标题栏注入 `style="--wails-draggable:drag"`，窗口控制按钮绑定 `wailsBridge.windowMinimise()`、`windowToggleMaximise()`、`windowClose()`；
- **模型联动**：增加计算属性 `availableModels`，动态收集 `channels` 列表中配置的所有模型，并默认选中主用渠道模型；
- **异常保护**：`onToolStart` 增加 JSON 解析 try-catch 保护，避免非标准工具参数导致 Vue 组件崩溃。

### 5. 安装与卸载安全隔离防护 (Bug 9)
- **安装器路径强制追加子目录**：命令行或界面选择的路径若尾部非 `TcodeStudio`，自动创建 `filepath.Join(cleaned, "TcodeStudio")`；
- **卸载器目录防误杀**：校验目录长度 $>5$、禁止系统盘根目录或用户主目录，必须确认为 `TcodeStudio` 目录方允许递归自删除，否则仅针对性清理程序二进制，杜绝误杀全盘。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **测试用例杜绝生产凭据投毒**：编写单元测试时，禁止直接写死商业 API Key，统一通过 `os.Getenv(...)` 获取并在缺少时调用 `t.Skip()`；
2. **事件总线必须具备配对注销机制**：凡是在单例或长效组件中注册的全局总线事件，必须在调用结束或生命周期销毁（`onUnmounted`）时主动解绑；
3. **敏感操作多重物理断言**：在编写自删除或系统级操作脚本时，绝不能仅依赖环境推测变量，必须设置多道白名单规则（基名匹配、路径前缀校验、长度校验等）进行硬性守卫。
