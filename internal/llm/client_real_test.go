package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestRealAgentRouter_StreamChat(t *testing.T) {
	endpoint := os.Getenv("AGENTROUTER_ENDPOINT")
	if endpoint == "" {
		endpoint = "https://agentrouter.org/v1"
	}
	apiKey := os.Getenv("AGENTROUTER_API_KEY")
	if apiKey == "" {
		t.Skip("Skipping live stream test: AGENTROUTER_API_KEY not set in environment")
	}
	model := os.Getenv("AGENTROUTER_MODEL")
	if model == "" {
		model = "deepseek-chat"
	}

	req := Request{
		Endpoint: endpoint,
		APIKey:   apiKey,
		Model:    model,
		Messages: []Message{
			{Role: "user", Content: "你好，请用一句话回答：1+1等于几？无需其他废话。"},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var thinkingContent strings.Builder
	var answerContent strings.Builder

	handlers := StreamHandlers{
		OnThinking: func(text string) {
			thinkingContent.WriteString(text)
		},
		OnContent: func(delta string) {
			answerContent.WriteString(delta)
		},
		OnError: func(err error) {
			t.Logf("Stream onError: %v", err)
		},
	}

	toolCalls, err := StreamChat(ctx, req, handlers)
	if err != nil {
		t.Fatalf("StreamChat real upstream call failed: %v", err)
	}

	t.Logf("Thinking length: %d chars", thinkingContent.Len())
	t.Logf("Answer received: %q", answerContent.String())
	t.Logf("ToolCalls count: %d", len(toolCalls))

	if answerContent.Len() == 0 && thinkingContent.Len() == 0 {
		t.Errorf("Expected non-empty stream response from upstream LLM")
	}
}

func TestRealAgentRouter_ToolCalling(t *testing.T) {
	endpoint := os.Getenv("AGENTROUTER_ENDPOINT")
	if endpoint == "" {
		endpoint = "https://agentrouter.org/v1"
	}
	apiKey := os.Getenv("AGENTROUTER_API_KEY")
	if apiKey == "" {
		t.Skip("Skipping live tool test: AGENTROUTER_API_KEY not set in environment")
	}
	model := os.Getenv("AGENTROUTER_MODEL")
	if model == "" {
		model = "deepseek-chat"
	}

	req := Request{
		Endpoint: endpoint,
		APIKey:   apiKey,
		Model:    model,
		Messages: []Message{
			{Role: "system", Content: "你是一个工作区代码智能体助手，必须调用提供的工具解决问题。"},
			{Role: "user", Content: "请帮我查看当前 Git 仓库的最新提交状态和未暂存文件。"},
		},
		Tools: DefaultWorkspaceTools(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var answerContent strings.Builder
	handlers := StreamHandlers{
		OnContent: func(delta string) {
			answerContent.WriteString(delta)
		},
		OnError: func(err error) {
			t.Logf("Tool calling error: %v", err)
		},
	}

	toolCalls, err := StreamChat(ctx, req, handlers)
	if err != nil {
		t.Fatalf("StreamChat with tools failed: %v", err)
	}

	t.Logf("Received %d tool calls", len(toolCalls))
	for i, tc := range toolCalls {
		t.Logf("ToolCall[%d]: ID=%s, FuncName=%s, Args=%s", i, tc.ID, tc.Function.Name, tc.Function.Arguments)
	}

	if len(toolCalls) == 0 && answerContent.Len() == 0 {
		t.Errorf("Expected either tool_calls or answer content")
	}
}

func TestRealAgentRouter_FetchModels(t *testing.T) {
	endpoint := os.Getenv("AGENTROUTER_ENDPOINT")
	if endpoint == "" {
		endpoint = "https://agentrouter.org/v1"
	}
	apiKey := os.Getenv("AGENTROUTER_API_KEY")
	if apiKey == "" {
		t.Skip("Skipping live models test: AGENTROUTER_API_KEY not set in environment")
	}
	fetchURL := strings.TrimRight(endpoint, "/") + "/models"

	req, err := http.NewRequest("GET", fetchURL, nil)
	if err != nil {
		t.Fatalf("Create request failed: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	req.Header.Set("Originator", "codex_cli_rs")
	req.Header.Set("Version", "0.101.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Do request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	t.Logf("Total models fetched from AgentRouter: %d", len(data.Data))
	if len(data.Data) == 0 {
		t.Errorf("Expected models count > 0")
	}
	for i := 0; i < len(data.Data) && i < 5; i++ {
		t.Logf("Model[%d]: %s", i, data.Data[i].ID)
	}
}

// TestMessageSerialization_ContentNotOmitted 验证 Bug 8: Message.Content 即使为空也不能被 omitempty 过滤
func TestMessageSerialization_ContentNotOmitted(t *testing.T) {
	msg := Message{
		Role:       "tool",
		Content:    "",
		ToolCallID: "call_12345",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	jsonStr := string(data)
	if !strings.Contains(jsonStr, `"content":""`) {
		t.Errorf("Expected json to contain '\"content\":\"\"', got: %s", jsonStr)
	}

	req := Request{
		Model: "deepseek-chat",
		Messages: []Message{
			{Role: "user", Content: "hello"},
			msg,
		},
	}
	reqData, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal request failed: %v", err)
	}
	if !strings.Contains(string(reqData), `"content":""`) {
		t.Errorf("Expected request to contain '\"content\":\"\"', got: %s", string(reqData))
	}
}
