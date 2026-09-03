package protocol

import (
	"fmt"
)

// OpenAIChatMessage OpenAI 请求消息
type OpenAIChatMessage struct {
	Role       string              `json:"role"`
	Content    string              `json:"content,omitempty"`
	Name       string              `json:"name,omitempty"`
	ToolCalls  []OpenAIToolCall    `json:"tool_calls,omitempty"`
	ToolCallID string              `json:"tool_call_id,omitempty"`
}

// OpenAIToolCall OpenAI 工具调用
type OpenAIToolCall struct {
	Index    int                `json:"index,omitempty"`
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function OpenAIFunctionCall `json:"function"`
}

type OpenAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// ConvertCanonicalToOpenAI 将中立消息列表转换为 OpenAI 标准请求数组
func ConvertCanonicalToOpenAI(messages []CanonicalMessage) ([]OpenAIChatMessage, error) {
	out := make([]OpenAIChatMessage, 0, len(messages))

	for _, msg := range messages {
		switch msg.Role {
		case RoleSystem:
			content := ""
			for _, p := range msg.Parts {
				if p.Type == ContentText {
					content += p.Text
				}
			}
			out = append(out, OpenAIChatMessage{Role: "system", Content: content})

		case RoleUser:
			content := ""
			for _, p := range msg.Parts {
				if p.Type == ContentText {
					content += p.Text
				}
			}
			out = append(out, OpenAIChatMessage{Role: "user", Content: content})

		case RoleAssistant:
			chatMsg := OpenAIChatMessage{Role: "assistant"}
			text := ""
			toolCalls := make([]OpenAIToolCall, 0)
			for idx, p := range msg.Parts {
				if p.Type == ContentText {
					text += p.Text
				} else if p.Type == ContentToolUse && p.ToolCall != nil {
					toolCalls = append(toolCalls, OpenAIToolCall{
						Index: idx,
						ID:    p.ToolCall.ID,
						Type:  "function",
						Function: OpenAIFunctionCall{
							Name:      p.ToolCall.Name,
							Arguments: p.ToolCall.Arguments,
						},
					})
				}
			}
			chatMsg.Content = text
			if len(toolCalls) > 0 {
				chatMsg.ToolCalls = toolCalls
			}
			out = append(out, chatMsg)

		case RoleTool:
			for _, p := range msg.Parts {
				if p.Type == ContentToolResult && p.ToolResult != nil {
					out = append(out, OpenAIChatMessage{
						Role:       "tool",
						ToolCallID: p.ToolResult.ToolCallID,
						Content:    p.ToolResult.Content,
					})
				}
			}
		default:
			return nil, fmt.Errorf("unsupported canonical role: %s", msg.Role)
		}
	}

	return out, nil
}
