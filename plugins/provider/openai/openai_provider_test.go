package openai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	v1 "tcode/pkg/plugin/v1"
)

func TestOpenAIProvider_ReasoningAliasAndBuffer(t *testing.T) {
	// 模拟返回携带 reasoning 别名字段的 SSE 流
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		// 包含 reasoning 别名字段
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"reasoning\":\"思考过程A\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"正文内容B\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	p := NewProvider()
	p.baseURL = server.URL
	p.apiKey = "test-api-key"

	req := &v1.ChatRequest{
		Model:  "deepseek-reasoner",
		Stream: true,
	}

	ch, err := p.StreamChat(context.Background(), req)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}

	gotThinking := false
	gotContent := false

	for chunk := range ch {
		if chunk.Thinking == "思考过程A" {
			gotThinking = true
		}
		if chunk.DeltaContent == "正文内容B" {
			gotContent = true
		}
	}

	if !gotThinking {
		t.Errorf("expected thinking '思考过程A', but not captured from reasoning field")
	}
	if !gotContent {
		t.Errorf("expected content '正文内容B', but not received")
	}
}
