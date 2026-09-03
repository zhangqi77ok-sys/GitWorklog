package v1

import (
	"context"
	"encoding/json"
	"time"
)

// ChatRequest 上游模型请求载荷
type ChatRequest struct {
	Model       string          `json:"model"`
	Messages    json.RawMessage `json:"messages"`     // 协议特定的序列化消息
	Tools       []ToolDefinition `json:"tools,omitempty"`
	Temperature *float32        `json:"temperature,omitempty"`
	MaxTokens   *int            `json:"max_tokens,omitempty"`
	Stream      bool            `json:"stream"`
	Thinking    *ThinkingConfig `json:"thinking,omitempty"` // Claude 3.7 / R1 思考预算配置
}

// ThinkingConfig 深度思考预算配置
type ThinkingConfig struct {
	Enabled      bool `json:"enabled"`
	BudgetTokens int  `json:"budget_tokens"`
}

// ProviderPlugin 大模型网关驱动 SPI
type ProviderPlugin interface {
	Plugin
	// StreamChat 发起流式推理，返回带缓冲背压的只读事件通道
	StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error)
	// Ping 物理探活并返回首字延迟 (TTFT)
	Ping(ctx context.Context) (time.Duration, error)
	// ListModels 列出该服务商下支持的模型描述
	ListModels(ctx context.Context) ([]ModelDescriptor, error)
}
