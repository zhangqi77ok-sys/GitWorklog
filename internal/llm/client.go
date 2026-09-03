package llm

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// StreamHandlers 流式回调处理器
type StreamHandlers struct {
	OnThinking func(text string)
	OnContent  func(delta string)
	OnDone     func()
	OnError    func(err error)
}

// ChatRequest 发送给大模型的请求
type Request struct {
	Endpoint string
	APIKey   string
	Model    string
	Messages []Message
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// StreamChat 发起真实 SSE 长连接流式推理
func StreamChat(ctx context.Context, req Request, handlers StreamHandlers) error {
	url := strings.TrimRight(req.Endpoint, "/") + "/chat/completions"

	bodyData := map[string]any{
		"model":    req.Model,
		"messages": req.Messages,
		"stream":   true,
	}

	payloadBytes, err := json.Marshal(bodyData)
	if err != nil {
		return fmt.Errorf("marshal request error: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("create request error: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if req.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)
	}
	// 关键：注入 AgentRouter 及各大主流平台认可的客户端特征头
	httpReq.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	httpReq.Header.Set("Originator", "codex_cli_rs")
	httpReq.Header.Set("Version", "0.101.0")

	client := &http.Client{
		Timeout: 180 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		handlers.OnError(err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("upstream API error [%d]: %s", resp.StatusCode, string(body))
		handlers.OnError(err)
		return err
	}

	reader := bufio.NewReader(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			handlers.OnError(err)
			return err
		}

		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}

		if strings.HasPrefix(line, "data:") {
			dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if dataStr == "[DONE]" {
				break
			}

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content"`
					} `json:"delta"`
					FinishReason *string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(dataStr), &chunk); err == nil && len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta
				if delta.ReasoningContent != "" && handlers.OnThinking != nil {
					handlers.OnThinking(delta.ReasoningContent)
				}
				if delta.Content != "" && handlers.OnContent != nil {
					handlers.OnContent(delta.Content)
				}
			}
		}
	}

	if handlers.OnDone != nil {
		handlers.OnDone()
	}

	return nil
}
