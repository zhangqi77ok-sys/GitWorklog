package loop

import (
	"context"
	"encoding/json"
	"testing"
	"time"
	"tcode/internal/host"
	v1 "tcode/pkg/plugin/v1"
)

type mockProvider struct {
	calls int
}

func (m *mockProvider) ID() string          { return "mock.prov" }
func (m *mockProvider) Name() string        { return "Mock Provider" }
func (m *mockProvider) Version() string     { return "1.0.0" }
func (m *mockProvider) Type() v1.PluginType { return v1.TypeProvider }
func (m *mockProvider) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (m *mockProvider) Start(ctx context.Context) error { return nil }
func (m *mockProvider) Stop(ctx context.Context) error  { return nil }
func (m *mockProvider) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true}
}
func (m *mockProvider) Ping(ctx context.Context) (time.Duration, error) {
	return 10 * time.Millisecond, nil
}
func (m *mockProvider) ListModels(ctx context.Context) ([]v1.ModelDescriptor, error) {
	return nil, nil
}
func (m *mockProvider) StreamChat(ctx context.Context, req *v1.ChatRequest) (<-chan v1.StreamChunk, error) {
	ch := make(chan v1.StreamChunk, 2)
	m.calls++
	if m.calls == 1 {
		// 第 1 轮：模型返回非 0 开始的稀疏工具调用 (index=1)
		ch <- v1.StreamChunk{
			ToolCalls: []v1.ToolCallChunk{
				{
					Index:          1, // 稀疏索引测试
					ID:             "call_sparse_1",
					Name:           "non_existent_tool",
					ArgumentsDelta: `{"foo":"bar"}`,
				},
			},
		}
	} else {
		// 第 2 轮：模型返回最终结果，结束循环
		ch <- v1.StreamChunk{
			DeltaContent: "Done!",
		}
	}
	close(ch)
	return ch, nil
}

func TestExecutionEngine_SparseToolIndices(t *testing.T) {
	reg := host.NewRegistry()
	prov := &mockProvider{}
	if err := reg.Register(prov); err != nil {
		t.Fatalf("failed to register provider: %v", err)
	}

	engine := NewExecutionEngine(reg)
	eventChan := make(chan EngineEvent, 20)

	ctx := context.Background()
	req := &EngineRequest{
		Model:  "mock-model",
		Prompt: "test",
	}

	go func() {
		_ = engine.Execute(ctx, req, eventChan)
	}()

	receivedToolStart := false
	for ev := range eventChan {
		if ev.Type == EventToolStart && ev.ToolCallID == "call_sparse_1" {
			receivedToolStart = true
		}
	}

	if !receivedToolStart {
		t.Errorf("expected tool_start event for sparse index 1, but not received")
	}
}

type loopInfiniteProvider struct{}

func (m *loopInfiniteProvider) ID() string          { return "mock.loop" }
func (m *loopInfiniteProvider) Name() string        { return "Loop Provider" }
func (m *loopInfiniteProvider) Version() string     { return "1.0.0" }
func (m *loopInfiniteProvider) Type() v1.PluginType { return v1.TypeProvider }
func (m *loopInfiniteProvider) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (m *loopInfiniteProvider) Start(ctx context.Context) error { return nil }
func (m *loopInfiniteProvider) Stop(ctx context.Context) error  { return nil }
func (m *loopInfiniteProvider) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true}
}
func (m *loopInfiniteProvider) Ping(ctx context.Context) (time.Duration, error) {
	return 10 * time.Millisecond, nil
}
func (m *loopInfiniteProvider) ListModels(ctx context.Context) ([]v1.ModelDescriptor, error) {
	return nil, nil
}
func (m *loopInfiniteProvider) StreamChat(ctx context.Context, req *v1.ChatRequest) (<-chan v1.StreamChunk, error) {
	ch := make(chan v1.StreamChunk, 1)
	ch <- v1.StreamChunk{
		ToolCalls: []v1.ToolCallChunk{
			{
				Index:          0,
				ID:             "call_infinite",
				Name:           "tool.none",
				ArgumentsDelta: "{}",
			},
		},
	}
	close(ch)
	return ch, nil
}

func TestExecutionEngine_MaxStepsCutoff(t *testing.T) {
	reg := host.NewRegistry()
	prov := &loopInfiniteProvider{}
	if err := reg.Register(prov); err != nil {
		t.Fatalf("failed to register provider: %v", err)
	}

	engine := NewExecutionEngine(reg)
	eventChan := make(chan EngineEvent, 50)

	ctx := context.Background()
	req := &EngineRequest{
		Model:  "mock-model",
		Prompt: "test loop",
	}

	go func() {
		_ = engine.Execute(ctx, req, eventChan)
	}()

	receivedWarning := false
	for ev := range eventChan {
		if ev.Type == EventChunk && len(ev.DeltaContent) > 0 && ev.DeltaContent[0] == '\n' {
			receivedWarning = true
		}
	}

	if !receivedWarning {
		t.Errorf("expected max steps cutoff warning chunk event, but not received")
	}
}
