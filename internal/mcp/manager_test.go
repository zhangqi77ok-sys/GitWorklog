package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

type mockMCPClient struct {
	started      bool
	stopped      bool
	tools        []Tool
	callToolFunc func(ctx context.Context, name string, args map[string]any) (string, error)
}

func (m *mockMCPClient) Start(ctx context.Context) error {
	m.started = true
	return nil
}

func (m *mockMCPClient) Stop() error {
	m.stopped = true
	return nil
}

func (m *mockMCPClient) ListTools(ctx context.Context) ([]Tool, error) {
	return m.tools, nil
}

func (m *mockMCPClient) CallTool(ctx context.Context, name string, args map[string]any) (string, error) {
	if m.callToolFunc != nil {
		return m.callToolFunc(ctx, name, args)
	}
	b, _ := json.Marshal(args)
	return string(b), nil
}

func (m *mockMCPClient) Ping(ctx context.Context) (time.Duration, int, error) {
	return 10 * time.Millisecond, len(m.tools), nil
}

func TestManager_RegisterAndCallTool(t *testing.T) {
	mgr := NewManager("/fake/workspace")
	mockCli := &mockMCPClient{
		tools: []Tool{
			{
				Name:        "search_code",
				Description: "Search code in repository",
				InputSchema: []byte(`{"type":"object","properties":{"query":{"type":"string"}}}`),
			},
		},
		callToolFunc: func(ctx context.Context, name string, args map[string]any) (string, error) {
			if name != "search_code" {
				return "", errors.New("tool not found on client")
			}
			query, _ := args["query"].(string)
			return "search result for: " + query, nil
		},
	}

	mgr.RegisterClient("server-1", mockCli, mockCli.tools)

	// 1. 测试 GetAllTools
	ctx := context.Background()
	tools, err := mgr.GetAllTools(ctx)
	if err != nil {
		t.Fatalf("GetAllTools failed: %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Function.Name != "search_code" {
		t.Fatalf("expected tool name 'search_code', got %s", tools[0].Function.Name)
	}
	if !strings.Contains(tools[0].Function.Description, "[server-1]") {
		t.Fatalf("expected tool description to contain '[server-1]', got %s", tools[0].Function.Description)
	}

	// 2. 测试 CallTool 派发
	res, err := mgr.CallTool(ctx, "search_code", map[string]any{"query": "antigravity"})
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}
	expected := "search result for: antigravity"
	if res != expected {
		t.Fatalf("expected '%s', got '%s'", expected, res)
	}

	// 3. 测试未注册工具
	_, err = mgr.CallTool(ctx, "non_existent_tool", nil)
	if err == nil {
		t.Fatalf("expected error for non_existent_tool, got nil")
	}

	// 4. 测试 StopServer 与 StopAll
	_ = mgr.StopServer(ctx, "server-1")
	if !mockCli.stopped {
		t.Fatalf("expected mock client to be stopped")
	}

	// 再次调用应该报错未注册
	_, err = mgr.CallTool(ctx, "search_code", nil)
	if err == nil {
		t.Fatalf("expected error after StopServer, got nil")
	}
}
