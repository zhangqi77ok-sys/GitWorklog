package v1

import (
	"context"
	"encoding/json"
)

// ToolPlugin 工具与受控算子 SPI
type ToolPlugin interface {
	Plugin
	// Definition 暴露给大模型的 Tool Schema 定义
	Definition() ToolDefinition
	// Execute 执行具体算子逻辑 (受 context 超时与取消严格保护)
	Execute(ctx context.Context, rawArgs json.RawMessage) (*ToolResult, error)
}
