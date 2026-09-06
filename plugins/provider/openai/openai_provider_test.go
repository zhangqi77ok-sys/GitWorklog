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

func TestOpenAIProvider_ListModels_RealModelsOnly(t *testing.T) {
	p := NewProvider()
	models, err := p.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels failed: %v", err)
	}

	fakeKeywords := []string{"v4-flash", "5.6-sol", "opus-4-8", "glm-5.3"}
	for _, m := range models {
		for _, fk := range fakeKeywords {
			if m.ID == fk || m.Name == fk {
				t.Errorf("found fake demo model in ListModels: id=%s name=%s", m.ID, m.Name)
			}
		}
	}

	foundDeepSeek := false
	for _, m := range models {
		if m.ID == "deepseek-chat" || m.ID == "deepseek-reasoner" {
			foundDeepSeek = true
			break
		}
	}
	if !foundDeepSeek {
		t.Errorf("expected real deepseek model in ListModels, got none")
	}
}

func TestOpenAIProvider_UpstreamErrorInSSE(t *testing.T) {
	// 模拟返回包含 error 报文的 SSE 流
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		// 模拟上游速率限制或网关报错
		_, _ = w.Write([]byte("data: {\"error\":{\"message\":\"Rate limit exceeded: please slow down\",\"type\":\"insufficient_quota\"}}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	p := NewProvider()
	p.baseURL = server.URL
	p.apiKey = "test-api-key"

	req := &v1.ChatRequest{
		Model:  "deepseek-chat",
		Stream: true,
	}

	ch, err := p.StreamChat(context.Background(), req)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}

	gotError := false
	for chunk := range ch {
		if chunk.Error != nil {
			gotError = true
			if chunk.Error.Error() != "upstream API error: Rate limit exceeded: please slow down" {
				t.Errorf("unexpected error message: %v", chunk.Error)
			}
		}
	}

	if !gotError {
		t.Errorf("expected error chunk from SSE error payload, but got none")
	}
}

