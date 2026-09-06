package host

import (
	"context"
	"encoding/json"
	"testing"
	v1 "tcode/pkg/plugin/v1"
)

type mockRail struct {
	id       string
	priority int
}

func (m *mockRail) ID() string                              { return m.id }
func (m *mockRail) Name() string                            { return m.id }
func (m *mockRail) Version() string                         { return "1.0.0" }
func (m *mockRail) Type() v1.PluginType                     { return v1.TypeRail }
func (m *mockRail) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (m *mockRail) Start(ctx context.Context) error         { return nil }
func (m *mockRail) Stop(ctx context.Context) error          { return nil }
func (m *mockRail) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true}
}
func (m *mockRail) Priority() int { return m.priority }
func (m *mockRail) OnBeforeObserve(ctx context.Context, sessionID string) error { return nil }
func (m *mockRail) OnBeforeReason(ctx context.Context, sessionID string, prompt *string) error { return nil }
func (m *mockRail) OnBeforeAct(ctx context.Context, sessionID string, toolName string, args []byte) (*v1.RailDecision, error) {
	return &v1.RailDecision{Allow: true}, nil
}
func (m *mockRail) OnAfterAct(ctx context.Context, sessionID string, toolName string, result *v1.ToolResult) error { return nil }
func (m *mockRail) OnVerify(ctx context.Context, sessionID string) (bool, string, error) {
	return true, "", nil
}

func TestRegistry_RailDuplicateAndUnregister(t *testing.T) {
	reg := NewRegistry()
	rail1 := &mockRail{id: "rail.safety", priority: 100}

	if err := reg.Register(rail1); err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	// 重复注册应当报错
	if err := reg.Register(rail1); err == nil {
		t.Errorf("expected error on duplicate rail registration, got nil")
	}

	rails := reg.ListRails()
	if len(rails) != 1 {
		t.Errorf("expected 1 rail, got %d", len(rails))
	}

	// 注销
	if !reg.Unregister("rail.safety") {
		t.Errorf("expected Unregister to return true")
	}

	railsAfter := reg.ListRails()
	if len(railsAfter) != 0 {
		t.Errorf("expected 0 rails after unregister, got %d", len(railsAfter))
	}
}

type mockTool struct {
	id   string
	desc string
}

func (m *mockTool) ID() string                              { return m.id }
func (m *mockTool) Name() string                            { return m.id }
func (m *mockTool) Version() string                         { return "1.0.0" }
func (m *mockTool) Type() v1.PluginType                     { return v1.TypeTool }
func (m *mockTool) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (m *mockTool) Start(ctx context.Context) error         { return nil }
func (m *mockTool) Stop(ctx context.Context) error          { return nil }
func (m *mockTool) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true}
}
func (m *mockTool) Definition() v1.ToolDefinition {
	return v1.ToolDefinition{Name: m.id, Description: m.desc}
}
func (m *mockTool) Execute(ctx context.Context, args json.RawMessage) (*v1.ToolResult, error) {
	return &v1.ToolResult{Content: m.desc}, nil
}

func TestRegistry_RegisterOrReplace(t *testing.T) {
	reg := NewRegistry()
	tool1 := &mockTool{id: "tool.git", desc: "Workspace 1 Git"}
	if err := reg.Register(tool1); err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	// 再次调用 RegisterOrReplace，应当成功覆盖原有工具
	tool2 := &mockTool{id: "tool.git", desc: "Workspace 2 Git"}
	if err := reg.RegisterOrReplace(tool2); err != nil {
		t.Fatalf("RegisterOrReplace failed: %v", err)
	}

	retrieved, ok := reg.GetTool("tool.git")
	if !ok {
		t.Fatalf("tool.git not found after replace")
	}
	if retrieved.Definition().Description != "Workspace 2 Git" {
		t.Errorf("expected replaced tool desc 'Workspace 2 Git', got '%s'", retrieved.Definition().Description)
	}
}
