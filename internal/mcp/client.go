package mcp

import (
	"context"
	"time"
)

// Client 统一 MCP 客户端接口
type Client interface {
	// Start 启动底层外部进程或连接
	Start(ctx context.Context) error

	// Stop 停止并释放资源
	Stop() error

	// ListTools 获取服务暴露的全部受控工具
	ListTools(ctx context.Context) ([]Tool, error)

	// CallTool 调用具体工具并返回结果
	CallTool(ctx context.Context, name string, args map[string]any) (string, error)

	// Ping 测试连通性与握手时延
	Ping(ctx context.Context) (time.Duration, int, error)
}
