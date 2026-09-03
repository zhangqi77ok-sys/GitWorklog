package protocol

// Role 统一规范化角色枚举
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// ContentType 内容块细分类型
type ContentType string

const (
	ContentText       ContentType = "text"
	ContentThinking   ContentType = "thinking"   // 独立思考过程 (Claude 3.7 / R1)
	ContentToolUse    ContentType = "tool_use"   // 触发工具调用
	ContentToolResult ContentType = "tool_result" // 工具产出结果
)

// ContentPart 中立内容块数据单元
type ContentPart struct {
	Type        ContentType        `json:"type"`
	Text        string             `json:"text,omitempty"`
	Thinking    string             `json:"thinking,omitempty"`
	ToolCall    *CanonicalToolCall `json:"tool_call,omitempty"`
	ToolResult  *CanonicalToolResult `json:"tool_result,omitempty"`
	CacheMarker bool               `json:"cache_marker,omitempty"` // 触发 Prompt Caching
}

// CanonicalToolCall 统一规范化工具调用契约
type CanonicalToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON 字符串
}

// CanonicalToolResult 统一规范化工具结果
type CanonicalToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}

// CanonicalMessage 中立规范消息
type CanonicalMessage struct {
	Role  Role          `json:"role"`
	Parts []ContentPart `json:"parts"`
}
