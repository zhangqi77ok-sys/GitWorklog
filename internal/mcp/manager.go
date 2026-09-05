package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"tcode/internal/config"
	"tcode/internal/llm"
	"time"
)

// Manager MCP 插件全局管理器
type Manager struct {
	workspace   string
	clients     map[string]Client // key: server ID
	toolRouting map[string]string // key: tool name -> server ID
	mu          sync.RWMutex
}

func NewManager(workspace string) *Manager {
	return &Manager{
		workspace:   workspace,
		clients:     make(map[string]Client),
		toolRouting: make(map[string]string),
	}
}

// TestServer 对指定服务执行物理拉起与工具探活 (JSON-RPC)
func (m *Manager) TestServer(ctx context.Context, cfg config.MCPServerConfig) (MCPTestResult, error) {
	var client Client
	if cfg.Type == "stdio" || cfg.Type == "" {
		client = NewStdioClient(cfg.Command, cfg.Args, m.workspace)
	} else {
		return MCPTestResult{
			ID:      cfg.ID,
			Name:    cfg.Name,
			Status:  "ERROR",
			Error:   "Unsupported MCP transport: " + cfg.Type,
			Latency: "0ms",
		}, nil
	}

	// 设置 5 秒握手超时
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := client.Start(timeoutCtx); err != nil {
		return MCPTestResult{
			ID:      cfg.ID,
			Name:    cfg.Name,
			Status:  "ERROR",
			Error:   err.Error(),
			Latency: "超时",
		}, nil
	}
	defer client.Stop()

	duration, count, err := client.Ping(timeoutCtx)
	if err != nil {
		return MCPTestResult{
			ID:      cfg.ID,
			Name:    cfg.Name,
			Status:  "ERROR",
			Error:   err.Error(),
			Latency: "超时",
		}, nil
	}

	tools, _ := client.ListTools(timeoutCtx)
	toolNames := make([]string, 0, len(tools))
	for _, t := range tools {
		toolNames = append(toolNames, t.Name)
	}

	return MCPTestResult{
		ID:        cfg.ID,
		Name:      cfg.Name,
		Status:    "ONLINE",
		Latency:   fmt.Sprintf("%dms", duration.Milliseconds()),
		ToolCount: count,
		Tools:     toolNames,
	}, nil
}

// StartServer 启动单个 MCP 服务，完成握手并注册算子路由 (优化锁粒度)
func (m *Manager) StartServer(ctx context.Context, cfg config.MCPServerConfig) error {
	var client Client
	if cfg.Type == "stdio" || cfg.Type == "" {
		client = NewStdioClient(cfg.Command, cfg.Args, m.workspace)
	} else {
		return fmt.Errorf("unsupported transport: %s", cfg.Type)
	}

	startCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// 锁外执行耗时的外部子进程启动与工具探测，避免阻塞全局并发查询
	if err := client.Start(startCtx); err != nil {
		return fmt.Errorf("failed to start mcp server [%s]: %w", cfg.Name, err)
	}

	tools, err := client.ListTools(startCtx)
	if err != nil {
		_ = client.Stop()
		return fmt.Errorf("failed to list tools for [%s]: %w", cfg.Name, err)
	}

	m.mu.Lock()
	var oldClient Client
	if old, ok := m.clients[cfg.ID]; ok {
		oldClient = old
		delete(m.clients, cfg.ID)
		for tName, sID := range m.toolRouting {
			if sID == cfg.ID {
				delete(m.toolRouting, tName)
			}
		}
	}

	for _, t := range tools {
		m.toolRouting[t.Name] = cfg.ID
	}
	m.clients[cfg.ID] = client
	m.mu.Unlock()

	if oldClient != nil {
		_ = oldClient.Stop()
	}
	return nil
}

// StopServer 安全停止指定 MCP 服务并清理路由
func (m *Manager) StopServer(ctx context.Context, srvID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	client, ok := m.clients[srvID]
	if !ok {
		return nil
	}

	_ = client.Stop()
	delete(m.clients, srvID)
	for tName, sID := range m.toolRouting {
		if sID == srvID {
			delete(m.toolRouting, tName)
		}
	}
	return nil
}

// StopAll 停止所有运行中的 MCP 服务
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for srvID, client := range m.clients {
		_ = client.Stop()
		delete(m.clients, srvID)
	}
	m.toolRouting = make(map[string]string)
}

// RegisterClient 注册指定客户端 (用于测试治具或自定义插件)
func (m *Manager) RegisterClient(srvID string, client Client, tools []Tool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.clients[srvID] = client
	for _, t := range tools {
		m.toolRouting[t.Name] = srvID
	}
}

// SyncFromConfig 根据配置同步启动/关闭 MCP 服务
func (m *Manager) SyncFromConfig(ctx context.Context, cfgs []config.MCPServerConfig) {
	for _, cfg := range cfgs {
		if cfg.Enabled {
			m.mu.RLock()
			_, running := m.clients[cfg.ID]
			m.mu.RUnlock()
			if !running {
				_ = m.StartServer(ctx, cfg)
			}
		} else {
			_ = m.StopServer(ctx, cfg.ID)
		}
	}
}

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
			var params map[string]any
			if len(t.InputSchema) > 0 {
				_ = json.Unmarshal(t.InputSchema, &params)
			}
			if params == nil {
				params = map[string]any{
					"type": "object",
				}
			}

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

// CallTool 派发算子调用到对应的 MCP Client 进程
func (m *Manager) CallTool(ctx context.Context, name string, args map[string]any) (string, error) {
	m.mu.RLock()
	srvID, exists := m.toolRouting[name]
	if !exists {
		m.mu.RUnlock()
		return "", fmt.Errorf("tool %s not registered in any active MCP server", name)
	}

	client, hasClient := m.clients[srvID]
	m.mu.RUnlock()

	if !hasClient {
		return "", fmt.Errorf("mcp server %s not running", srvID)
	}

	return client.CallTool(ctx, name, args)
}
