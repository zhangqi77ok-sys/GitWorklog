package llm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStreamChat_SparseToolIndices(t *testing.T) {
	// 启动模拟 SSE 服务器，返回 index: 1 的工具调用分片
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		// 发送 index: 1 的工具调用分片
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"id\":\"call_test_1\",\"type\":\"function\",\"function\":{\"name\":\"exec_command\",\"arguments\":\"{\\\"cmd\\\":\\\"ls\\\"}\"}}]}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	req := Request{
		Endpoint: server.URL,
		APIKey:   "dummy-key",
		Model:    "test-model",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	toolCalls, err := StreamChat(context.Background(), req, StreamHandlers{})
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}

	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call for sparse index 1, got %d", len(toolCalls))
	}

	if toolCalls[0].ID != "call_test_1" {
		t.Errorf("expected tool call ID call_test_1, got %s", toolCalls[0].ID)
	}
	if toolCalls[0].Function.Name != "exec_command" {
		t.Errorf("expected tool name exec_command, got %s", toolCalls[0].Function.Name)
	}
}

func TestStreamChat_MissingToolCallIDAndType(t *testing.T) {
	// 模拟 SSE 流：模型未返回 id 与 type
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"read_file\",\"arguments\":\"{\\\"path\\\":\\\"main.go\\\"}\"}}]}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	req := Request{
		Endpoint: server.URL,
		APIKey:   "dummy-key",
		Model:    "test-model",
		Messages: []Message{
			{Role: "user", Content: "test"},
		},
	}

	toolCalls, err := StreamChat(context.Background(), req, StreamHandlers{})
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}

	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}

	if toolCalls[0].ID == "" {
		t.Errorf("expected non-empty fallback tool call ID")
	}
	if toolCalls[0].Type != "function" {
		t.Errorf("expected fallback type 'function', got %s", toolCalls[0].Type)
	}
	if toolCalls[0].Function.Name != "read_file" {
		t.Errorf("expected tool name read_file, got %s", toolCalls[0].Function.Name)
	}
}
