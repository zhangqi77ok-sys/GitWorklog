package openai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	v1 "tcode/pkg/plugin/v1"
)

// Provider OpenAI 官方协议驱动插件
type Provider struct {
	id         string
	name       string
	version    string
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewProvider 构造 OpenAI 驱动插件实例
func NewProvider() *Provider {
	baseURL := os.Getenv("OPENAI_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &Provider{
		id:      "provider.openai",
		name:    "OpenAI / DeepSeek Upstream Driver",
		version: "1.0.0",
		apiKey:  os.Getenv("OPENAI_API_KEY"),
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (p *Provider) ID() string      { return p.id }
func (p *Provider) Name() string    { return p.name }
func (p *Provider) Version() string { return p.version }
func (p *Provider) Type() v1.PluginType { return v1.TypeProvider }

func (p *Provider) Init(ctx context.Context, config json.RawMessage) error {
	if len(config) > 0 {
		var cfg struct {
			APIKey  string `json:"api_key"`
			BaseURL string `json:"base_url"`
		}
		if err := json.Unmarshal(config, &cfg); err == nil {
			if cfg.APIKey != "" {
				p.apiKey = cfg.APIKey
			}
			if cfg.BaseURL != "" {
				p.baseURL = strings.TrimRight(cfg.BaseURL, "/")
			}
		}
	}
	return nil
}

func (p *Provider) Start(ctx context.Context) error { return nil }
func (p *Provider) Stop(ctx context.Context) error  { return nil }

func (p *Provider) Health(ctx context.Context) v1.HealthStatus {
	latency, err := p.Ping(ctx)
	if err != nil {
		return v1.HealthStatus{
			Healthy: false,
			Message: fmt.Sprintf("Ping failed: %v", err),
		}
	}
	return v1.HealthStatus{
		Healthy:   true,
		LatencyMs: latency.Milliseconds(),
		Message:   "OpenAI upstream endpoint reachable",
	}
}

// Ping 探活
func (p *Provider) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	url := fmt.Sprintf("%s/models", p.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	if strings.Contains(p.baseURL, "agentrouter.org") {
		req.Header.Set("User-Agent", "claude-cli/1.0.108 (external, cli)")
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("anthropic-beta", "claude-code-20250219,oauth-2025-04-20")
		req.Header.Set("anthropic-dangerous-direct-browser-access", "true")
		req.Header.Set("x-app", "cli")
		req.Header.Set("x-stainless-lang", "js")
		req.Header.Set("x-stainless-package-version", "0.55.1")
		req.Header.Set("x-stainless-os", "Windows")
		req.Header.Set("x-stainless-arch", "x64")
		req.Header.Set("x-stainless-runtime", "node")
		req.Header.Set("x-stainless-runtime-version", "v22.0.0")
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusUnauthorized {
		return 0, fmt.Errorf("upstream responded with HTTP %d", resp.StatusCode)
	}

	return time.Since(start), nil
}

func (p *Provider) ListModels(ctx context.Context) ([]v1.ModelDescriptor, error) {
	return []v1.ModelDescriptor{
		{
			ID:              "deepseek-v4-flash",
			Name:            "DeepSeek-V4 Flash (Thinking)",
			Provider:        "AgentRouter / DeepSeek",
			ContextWindow:   128000,
			MaxTokens:       8192,
			SupportThinking: true,
			SupportCaching:  true,
		},
		{
			ID:              "gpt-5.6-sol",
			Name:            "GPT-5.6 Sol (Ultra-Fast)",
			Provider:        "AgentRouter / OpenAI",
			ContextWindow:   1050000,
			MaxTokens:       128000,
			SupportThinking: false,
			SupportCaching:  true,
		},
		{
			ID:              "claude-opus-4-8",
			Name:            "Claude Opus 4.8",
			Provider:        "AgentRouter / Anthropic",
			ContextWindow:   1000000,
			MaxTokens:       128000,
			SupportThinking: true,
			SupportCaching:  true,
		},
		{
			ID:              "glm-5.3",
			Name:            "GLM-5.3 (Thinking)",
			Provider:        "AgentRouter / Zhipu",
			ContextWindow:   128000,
			MaxTokens:       8192,
			SupportThinking: true,
			SupportCaching:  false,
		},
		{
			ID:              "gpt-4o",
			Name:            "GPT-4o (Omni)",
			Provider:        "OpenAI",
			ContextWindow:   128000,
			MaxTokens:       4096,
			SupportThinking: false,
			SupportCaching:  true,
		},
	}, nil
}

// StreamChat 发起流式推理
func (p *Provider) StreamChat(ctx context.Context, req *v1.ChatRequest) (<-chan v1.StreamChunk, error) {
	// 背压通道缓冲大小设为 64
	outChan := make(chan v1.StreamChunk, 64)

	// 若未配置 API Key 且不是本地 Ollama，向通道反馈明确提示
	if p.apiKey == "" && !strings.Contains(p.baseURL, "localhost") && !strings.Contains(p.baseURL, "127.0.0.1") {
		go func() {
			defer close(outChan)
			outChan <- v1.StreamChunk{
				Thinking: "微内核已拦截：未检测到有效的大模型凭据 (API Key)。请在系统设置中配置 OPENAI_API_KEY。",
				DeltaContent: "未配置 API Key。请在环境变量或配置中设置 `OPENAI_API_KEY`，或者指定本地 Ollama 端点 (`http://localhost:11434/v1`)。",
			}
		}()
		return outChan, nil
	}

	go func() {
		defer close(outChan)

		// 组装上游请求载荷
		upstreamReqBody := map[string]any{
			"model":  req.Model,
			"stream": true,
			"stream_options": map[string]any{
				"include_usage": true,
			},
		}

		// 转换消息格式
		if len(req.Messages) > 0 {
			var rawMsgs any
			if err := json.Unmarshal(req.Messages, &rawMsgs); err == nil {
				upstreamReqBody["messages"] = rawMsgs
			}
		}

		// 注入工具定义声明 (OpenAI function calling 格式)
		if len(req.Tools) > 0 {
			openAITools := make([]map[string]any, 0, len(req.Tools))
			for _, t := range req.Tools {
				var params any
				_ = json.Unmarshal(t.Parameters, &params)
				openAITools = append(openAITools, map[string]any{
					"type": "function",
					"function": map[string]any{
						"name":        t.Name,
						"description": t.Description,
						"parameters":  params,
					},
				})
			}
			upstreamReqBody["tools"] = openAITools
		}

		bodyBytes, err := json.Marshal(upstreamReqBody)
		if err != nil {
			outChan <- v1.StreamChunk{Error: fmt.Errorf("failed to encode request: %w", err)}
			return
		}

		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/chat/completions", p.baseURL), bytes.NewReader(bodyBytes))
		if err != nil {
			outChan <- v1.StreamChunk{Error: err}
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		if p.apiKey != "" {
			httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
		}

		// 若目标网关为 AgentRouter，自动注入 Claude Code CLI 指纹头部穿透 WAF
		if strings.Contains(p.baseURL, "agentrouter.org") {
			httpReq.Header.Set("User-Agent", "claude-cli/1.0.108 (external, cli)")
			httpReq.Header.Set("anthropic-version", "2023-06-01")
			httpReq.Header.Set("anthropic-beta", "claude-code-20250219,oauth-2025-04-20")
			httpReq.Header.Set("anthropic-dangerous-direct-browser-access", "true")
			httpReq.Header.Set("x-app", "cli")
			httpReq.Header.Set("x-stainless-lang", "js")
			httpReq.Header.Set("x-stainless-package-version", "0.55.1")
			httpReq.Header.Set("x-stainless-os", "Windows")
			httpReq.Header.Set("x-stainless-arch", "x64")
			httpReq.Header.Set("x-stainless-runtime", "node")
			httpReq.Header.Set("x-stainless-runtime-version", "v22.0.0")
		}

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			outChan <- v1.StreamChunk{Error: fmt.Errorf("upstream connection error: %w", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			errBytes, _ := io.ReadAll(resp.Body)
			outChan <- v1.StreamChunk{Error: fmt.Errorf("upstream returned HTTP %d: %s", resp.StatusCode, string(errBytes))}
			return
		}

		// SSE 逐行扫描解析器
		scanner := bufio.NewScanner(resp.Body)
		inThinking := false

		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
			}

			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			dataStr := strings.TrimPrefix(line, "data: ")
			if strings.TrimSpace(dataStr) == "[DONE]" {
				break
			}

			var sseChunk struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content"` // DeepSeek R1 专有字段
						ToolCalls        []struct {
							Index    int    `json:"index"`
							ID       string `json:"id"`
							Type     string `json:"type"`
							Function struct {
								Name      string `json:"name"`
								Arguments string `json:"arguments"`
							} `json:"function"`
						} `json:"tool_calls"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage *struct {
					PromptTokens     int64 `json:"prompt_tokens"`
					CompletionTokens int64 `json:"completion_tokens"`
					TotalTokens      int64 `json:"total_tokens"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(dataStr), &sseChunk); err != nil {
				continue
			}

			chunk := v1.StreamChunk{}

			if len(sseChunk.Choices) > 0 {
				choice := sseChunk.Choices[0]
				chunk.FinishReason = choice.FinishReason

				// 1. 处理 DeepSeek 原生 reasoning_content
				if choice.Delta.ReasoningContent != "" {
					chunk.Thinking = choice.Delta.ReasoningContent
				}

				// 2. 处理 <think> 标签式思考流
				rawContent := choice.Delta.Content
				if strings.Contains(rawContent, "<think>") {
					inThinking = true
					rawContent = strings.ReplaceAll(rawContent, "<think>", "")
				}
				if strings.Contains(rawContent, "</think>") {
					inThinking = false
					parts := strings.Split(rawContent, "</think>")
					chunk.Thinking += parts[0]
					if len(parts) > 1 {
						chunk.DeltaContent += parts[1]
					}
					rawContent = ""
				}

				if inThinking {
					chunk.Thinking += rawContent
				} else {
					chunk.DeltaContent += rawContent
				}

				// 3. 处理流式工具调用分片
				if len(choice.Delta.ToolCalls) > 0 {
					chunk.ToolCalls = make([]v1.ToolCallChunk, 0, len(choice.Delta.ToolCalls))
					for _, tc := range choice.Delta.ToolCalls {
						chunk.ToolCalls = append(chunk.ToolCalls, v1.ToolCallChunk{
							Index:          tc.Index,
							ID:             tc.ID,
							Name:           tc.Function.Name,
							ArgumentsDelta: tc.Function.Arguments,
						})
					}
				}
			}

			if sseChunk.Usage != nil {
				chunk.Usage = &v1.TokenUsage{
					PromptTokens:     sseChunk.Usage.PromptTokens,
					CompletionTokens: sseChunk.Usage.CompletionTokens,
					TotalTokens:      sseChunk.Usage.TotalTokens,
				}
			}

			if chunk.DeltaContent != "" || chunk.Thinking != "" || len(chunk.ToolCalls) > 0 || chunk.Usage != nil || chunk.FinishReason != "" {
				outChan <- chunk
			}
		}
	}()

	return outChan, nil
}
