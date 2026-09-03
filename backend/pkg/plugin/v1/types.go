package v1

import "encoding/json"

// PluginType 插件类型枚举
type PluginType string

const (
	TypeProvider PluginType = "provider" // 大模型网关驱动
	TypeTool     PluginType = "tool"     // 算子工具
	TypeRail     PluginType = "rail"     // 生命周期治理轨道
	TypeStorage  PluginType = "storage"  // 快照与状态持久化
)

// HealthStatus 插件健康状态
type HealthStatus struct {
	Healthy   bool              `json:"healthy"`
	LatencyMs int64             `json:"latency_ms,omitempty"`
	Message   string            `json:"message,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// TokenUsage Token 计量与成本结构体
type TokenUsage struct {
	PromptTokens        int64 `json:"prompt_tokens"`
	CompletionTokens    int64 `json:"completion_tokens"`
	TotalTokens         int64 `json:"total_tokens"`
	CacheReadTokens     int64 `json:"cache_read_tokens,omitempty"`     // 命中的前缀缓存 Tokens (Claude/DeepSeek)
	CacheCreationTokens int64 `json:"cache_creation_tokens,omitempty"` // 新写入的前缀缓存 Tokens
}

// ToolCallChunk 流式工具调用切片
type ToolCallChunk struct {
	Index        int    `json:"index"`
	ID           string `json:"id,omitempty"`
	Name         string `json:"name,omitempty"`
	ArgumentsDelta string `json:"arguments_delta,omitempty"`
}

// StreamChunk 流式输出数据块
type StreamChunk struct {
	DeltaContent string          `json:"delta_content,omitempty"`
	Thinking     string          `json:"thinking,omitempty"` // Claude 3.7 / R1 思考流
	ToolCalls    []ToolCallChunk `json:"tool_calls,omitempty"`
	Usage        *TokenUsage     `json:"usage,omitempty"`
	FinishReason string          `json:"finish_reason,omitempty"`
	Error        error           `json:"-"`
}

// ModelDescriptor 模型描述元数据
type ModelDescriptor struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Provider      string `json:"provider"`
	ContextWindow int    `json:"context_window"`
	MaxTokens     int    `json:"max_tokens"`
	SupportThinking bool `json:"support_thinking"`
	SupportCaching  bool `json:"support_caching"`
}

// ToolDefinition 暴露给模型的工具声明
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"` // JSON Schema
}

// ToolResult 算子执行结果
type ToolResult struct {
	ToolCallID string `json:"tool_call_id,omitempty"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}
