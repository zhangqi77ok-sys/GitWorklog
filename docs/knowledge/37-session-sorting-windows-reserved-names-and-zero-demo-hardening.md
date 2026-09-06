# 37. 会话更新时序保序、Windows 设备保留名防御与零假凭据架构防线

## ① 知识点与问题背景 (Context & Problem Statement)

在桌面端生产级 Agentic IDE（基于 Wails v2 + Go 微内核 + Web 前端）运行演进中，排查发现了以下几类具有高破坏力与破坏体验的系统级缺陷与安全漏洞：
1. **历史会话顺序乱序跳动**：后端微内核会话列表方法 `Store.List()` 直接按文件系统目录读取条目返回，在 Windows 与跨平台文件系统下目录项顺序不确定，导致前端会话列表频繁跳变，失去时间连续性感官；
2. **Windows 设备保留字（Reserved Device Names）致命文件系统错误**：Windows 操作系统底层保留了如 `CON`, `PRN`, `AUX`, `NUL`, `COM1..9`, `LPT1..9` 等特殊设备名称。即便带有扩展名（如 `CON.json`），尝试打开或写入这些路径也会触发致命的文件系统拒绝或进程阻塞；
3. **原子写入文件父级目录丢失崩溃**：当系统清理临时文件或用户移动目录后，原子文件写入方法 `atomicWriteSession` 与 `atomicWriteConfig` 缺少父目录存在性检查，直接写入临时文件导致崩溃；
4. **原型与前端硬编码凭据与假 Token 残留风险**：在快速迭代阶段，前端字典容易残留测试用的 API Key、Setup Token 或 Demo 数据，违反了项目【铁律 0.5: 零假数据与 Demo 占位铁律】；
5. **模型工具返回空内容触发上游网关 400 Bad Request**：双环执行引擎在执行部分无输出命令（如 `git add` 或创建空文件）后，拼接的 `messages` 中 tool 角色消息 `content` 为空，被上游 OpenAI/Anthropic 校验拦截并报错；
6. **AST 扫描工作区不存在时静默吞错误**：工作区根目录不存在时未做预检，`filepath.Walk` 静默吞掉错误并返回空切片，掩盖了严重的工作区未就绪状态。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Windows 文件名设备保留字机制 (MS-DOS Legacy Device Names)
在 Windows 下，以下名称属于保留设备，无论大小写或是否附带扩展名，均指向特殊字符设备：
- `CON` (键盘与显示器控制台)
- `PRN` / `AUX` (打印机与辅助设备)
- `NUL` (空设备，类似于 `/dev/null`)
- `COM1` 至 `COM9` (串行通信端口)
- `LPT1` 至 `LPT9` (并行打印端口)

在 Go 中直接执行 `os.WriteFile(".../CON.json", ...)` 会导致 Windows 返回 `Access is denied` 或底层管道挂死。会话 ID 与文件名的净化函数 `sanitizeID` 必须在应用层显式过滤这些保留字。

### 2. 会话列表更新时间戳单调降序保证
桌面端左侧会话历史抽屉必须按“最近交互”顺序呈现。由于底层 `os.ReadDir` 仅返回目录下的文件名列表（Windows 下按字母排序），必须在读取元数据后显式调用 `sort.Slice` 按 `UpdatedAt` 降序排序。

### 3. 上游 LLM 网关对于 Tool Role 消息的契约约束
各大云端模型 API（如 OpenAI Chat Completions、Anthropic Claude、DeepSeek）对 `role: "tool"` 的消息结构有着严格约束：
`content` 字段不能为空字符串。若工具输出为空，模型网关会直接返回 `HTTP 400: 'messages[x].content' cannot be empty`。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 会话列表排序与设备保留名拦截
在 `internal/session/store.go` 中实施排序与保留字拦截：

```go
// sanitizeID 防御会话 ID 路径穿越与 Windows 保留设备名称
func sanitizeID(id string) (string, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return "", fmt.Errorf("session id cannot be empty")
	}
	clean := filepath.Base(filepath.Clean(trimmed))
	if clean == "." || clean == "/" || clean == "\\" || clean != trimmed {
		return "", fmt.Errorf("invalid session id format: %s", id)
	}

	// 拦截 Windows 设备保留字 (无论大小写与是否带后缀)
	upper := strings.ToUpper(clean)
	baseUpper := strings.TrimSuffix(upper, filepath.Ext(upper))
	switch baseUpper {
	case "CON", "PRN", "AUX", "NUL",
		"COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
		"LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9":
		return "", fmt.Errorf("reserved device name cannot be used as session id: %s", id)
	}

	// 拦截非法文件名字符
	if strings.ContainsAny(clean, `<>:"/\|?*`+"\x00") {
		return "", fmt.Errorf("session id contains illegal characters: %s", id)
	}
	return clean, nil
}
```

在 `Store.List()` 中增加降序排列：
```go
sort.Slice(metas, func(i, j int) bool {
    return metas[i].UpdatedAt > metas[j].UpdatedAt
})
```

### 2. 工具结果回填非空兜底保护
在 `internal/core/loop/engine.go` 中，确保回填上下文的 `content` 满足网关非空校验：
```go
contentForContext := toolOutput
if strings.TrimSpace(contentForContext) == "" {
    contentForContext = fmt.Sprintf("tool [%s] executed successfully with empty output", atc.Name)
}
messages = append(messages, map[string]any{
    "role":         "tool",
    "tool_call_id": atc.ID,
    "content":      contentForContext,
})
```

### 3. 全局清理 Demo 假数据与泄露密钥
全面排查前端和原型工程中 `PROVIDER_CONFIGS` 字典，所有密码、Token、API Key 的 `val` 预填字段全部重置为纯净空字符串 `""`，展示卡片使用 `已安全加密存储 (AES-GCM)` 脱敏占位。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **会话 ID 校验不可轻信后缀名**：Windows 设备保留字即使附带 `.json` 或 `.txt` 后缀依然是保留字，检查时必须使用 `strings.TrimSuffix(upper, filepath.Ext(upper))` 剥离后缀比对；
2. **原子写入必做父目录存在性防御**：所有临时文件与持久化写入前，统一执行 `os.MkdirAll(filepath.Dir(filePath), 0755)`，防止跨模块调用时目录未初始化报错；
3. **严格遵循 Fail-Closed 原则**：遇到无效参数、不存在的路径或上游 SSE 错误报文（如 `{"error":{"message":"..."}}`），必须第一时间暴露真实错误，严禁通过返回空数组、静默吞异常等方式掩盖根本问题。
