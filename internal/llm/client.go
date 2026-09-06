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
	"sort"
	"strings"
	"time"
)

var (
	sharedTransport = &http.Transport{
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: true},
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}
	sharedLLMClient = &http.Client{
		Timeout:   180 * time.Second,
		Transport: sharedTransport,
	}
)

// StreamHandlers 流式回调处理器
type StreamHandlers struct {
	OnThinking  func(text string)
	OnContent   func(delta string)
	OnToolStart func(id string, name string)
	OnToolArg   func(id string, argDelta string)
	OnDone      func()
	OnError     func(err error)
}

// ToolCallDef 算子调用
type ToolCall struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Function  struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// Request 请求结构
type Request struct {
	Endpoint string        `json:"endpoint"`
	APIKey   string        `json:"api_key"`
	Model    string        `json:"model"`
	Messages []Message     `json:"messages"`
	Tools    []ToolDef     `json:"tools,omitempty"`
}

type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type ToolDef struct {
	Type     string         `json:"type"`
	Function ToolFunctionDef `json:"function"`
}

type ToolFunctionDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// DefaultWorkspaceTools 获取标准沙箱工程算子定义
func DefaultWorkspaceTools() []ToolDef {
	return []ToolDef{
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "exec_command",
				Description: "在工作区受控沙箱终端中静默执行 Shell/CMD/PowerShell 命令并返回输出。",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"command": map[string]any{
							"type":        "string",
							"description": "要执行的命令行指令，例如 'go test ./...' 或 'git status'",
						},
					},
					"required": []string{"command"},
				},
			},
		},
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "write_file",
				Description: "向工作区沙箱安全原子写入或更新文件内容，并在发生异常时支持回滚快照。",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"rel_path": map[string]any{
							"type":        "string",
							"description": "相对于工作区根目录的文件路径",
						},
						"content": map[string]any{
							"type":        "string",
							"description": "文件的完整更新源码内容",
						},
					},
					"required": []string{"rel_path", "content"},
				},
			},
		},
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "read_file",
				Description: "安全读取工作区沙箱内的文件源码内容。",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"rel_path": map[string]any{
							"type":        "string",
							"description": "相对于工作区根目录的文件路径",
						},
					},
					"required": []string{"rel_path"},
				},
			},
		},
		{
			Type: "function",
			Function: ToolFunctionDef{
				Name:        "git_status",
				Description: "获取当前 Git 仓库的分支、暂存区与未暂存工作区详细差异报表。",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		},
	}
}

// StreamChat 发起真实 SSE 长连接流式推理并聚合 ToolCalls
func StreamChat(ctx context.Context, req Request, handlers StreamHandlers) ([]ToolCall, error) {
	url := strings.TrimRight(req.Endpoint, "/") + "/chat/completions"

	bodyData := map[string]any{
		"model":    req.Model,
		"messages": req.Messages,
		"stream":   true,
	}
	if len(req.Tools) > 0 {
		bodyData["tools"] = req.Tools
	}

	payloadBytes, err := json.Marshal(bodyData)
	if err != nil {
		return nil, fmt.Errorf("marshal request error: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create request error: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if req.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)
	}
	httpReq.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	httpReq.Header.Set("Originator", "codex_cli_rs")
	httpReq.Header.Set("Version", "0.101.0")

	resp, err := sharedLLMClient.Do(httpReq)
	if err != nil {
		if handlers.OnError != nil {
			handlers.OnError(err)
		}
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("upstream API error [%d]: %s", resp.StatusCode, string(body))
		if handlers.OnError != nil {
			handlers.OnError(err)
		}
		return nil, err
	}

	reader := bufio.NewReader(resp.Body)
	toolCallsMap := make(map[int]*ToolCall)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			if handlers.OnError != nil {
				handlers.OnError(err)
			}
			return nil, err
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
						Reasoning        string `json:"reasoning"`
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
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(dataStr), &chunk); err == nil && len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta
				thinking := delta.ReasoningContent
				if thinking == "" {
					thinking = delta.Reasoning
				}
				if thinking != "" && handlers.OnThinking != nil {
					handlers.OnThinking(thinking)
				}
				if delta.Content != "" && handlers.OnContent != nil {
					handlers.OnContent(delta.Content)
				}
				// 聚合 Tool Calls
				for _, tc := range delta.ToolCalls {
					call, exists := toolCallsMap[tc.Index]
					if !exists {
						call = &ToolCall{
							ID:   tc.ID,
							Type: tc.Type,
						}
						if call.Type == "" {
							call.Type = "function"
						}
						call.Function.Name = tc.Function.Name
						toolCallsMap[tc.Index] = call
						if handlers.OnToolStart != nil {
							handlers.OnToolStart(tc.ID, tc.Function.Name)
						}
					} else {
						if tc.ID != "" && call.ID == "" {
							call.ID = tc.ID
						}
						if tc.Type != "" && call.Type == "" {
							call.Type = tc.Type
						}
						if tc.Function.Name != "" && call.Function.Name == "" {
							call.Function.Name = tc.Function.Name
						}
					}
					if tc.Function.Arguments != "" {
						call.Function.Arguments += tc.Function.Arguments
						if handlers.OnToolArg != nil {
							handlers.OnToolArg(call.ID, tc.Function.Arguments)
						}
					}
				}
			}
		}
	}

	if handlers.OnDone != nil {
		handlers.OnDone()
	}

	keys := make([]int, 0, len(toolCallsMap))
	for k := range toolCallsMap {
		keys = append(keys, k)
	}
	sort.Ints(keys)

	resultToolCalls := make([]ToolCall, 0, len(keys))
	for _, k := range keys {
		if tc, ok := toolCallsMap[k]; ok {
			if tc.ID == "" {
				tc.ID = fmt.Sprintf("call_%d_%d", k, time.Now().UnixNano())
			}
			if tc.Type == "" {
				tc.Type = "function"
			}
			resultToolCalls = append(resultToolCalls, *tc)
		}
	}

	return resultToolCalls, nil
}
