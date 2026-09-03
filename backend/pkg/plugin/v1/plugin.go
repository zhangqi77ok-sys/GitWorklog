package v1

import (
	"context"
	"encoding/json"
)

// Plugin 根插件基础生命周期契约
type Plugin interface {
	// ID 插件唯一标识符 (例: "provider.openai", "tool.git")
	ID() string
	// Name 插件人类可读名称
	Name() string
	// Version 语义化版本号
	Version() string
	// Type 插件分类
	Type() PluginType
	// Init 读取配置并初始化内部资源
	Init(ctx context.Context, config json.RawMessage) error
	// Start 启动后台协程或保持网络长连接
	Start(ctx context.Context) error
	// Stop 优雅释放资源、关闭连接与关闭子进程
	Stop(ctx context.Context) error
	// Health 返回当前实时健康检查结果
	Health(ctx context.Context) HealthStatus
}
