package protocol

import (
	"fmt"
)

// ClaudeMessage Anthropic 请求消息
type ClaudeMessage struct {
	Role    string        `json:"role"` // 仅允许 "user" 或 "assistant"
	Content []ClaudeBlock `json:"content"`
}

// ClaudeBlock 内容块
type ClaudeBlock struct {
	Type         string         `json:"type"` // "text", "thinking", "tool_use", "tool_result"
	Text         string         `json:"text,omitempty"`
	Thinking     string         `json:"thinking,omitempty"`
	ID           string         `json:"id,omitempty"` // tool_use ID
	Name         string         `json:"name,omitempty"`
	Input        any            `json:"input,omitempty"`
	ToolUseID    string         `json:"tool_use_id,omitempty"` // tool_result 关联 ID
	Content      string         `json:"content,omitempty"`     // tool_result 结果内容
	IsError      bool           `json:"is_error,omitempty"`
	CacheControl *ClaudeCacheCtrl `json:"cache_control,omitempty"` // Prompt Caching
}

type ClaudeCacheCtrl struct {
	Type string `json:"type"` // "ephemeral"
}

// ConvertCanonicalToClaude 将中立消息列表转换为 Claude 标准请求体
// 返回：提取出的顶级 systemPrompt, 严格 user/assistant 消息数组, 错误
func ConvertCanonicalToClaude(messages []CanonicalMessage) (systemPrompt string, out []ClaudeMessage, err error) {
	out = make([]ClaudeMessage, 0, len(messages))

	for _, msg := range messages {
		switch msg.Role {
		case RoleSystem:
			// 提取所有 system 角色内容合并至顶层
			for _, p := range msg.Parts {
				if p.Type == ContentText {
					if systemPrompt != "" {
						systemPrompt += "\n\n"
					}
					systemPrompt += p.Text
				}
			}

		case RoleUser:
			blocks := make([]ClaudeBlock, 0, len(msg.Parts))
			for _, p := range msg.Parts {
				if p.Type == ContentText {
					block := ClaudeBlock{Type: "text", Text: p.Text}
					if p.CacheMarker {
						block.CacheControl = &ClaudeCacheCtrl{Type: "ephemeral"}
					}
					blocks = append(blocks, block)
				}
			}
			if len(blocks) > 0 {
				out = append(out, ClaudeMessage{Role: "user", Content: blocks})
			}

		case RoleAssistant:
			blocks := make([]ClaudeBlock, 0, len(msg.Parts))
			for _, p := range msg.Parts {
				switch p.Type {
				case ContentText:
					blocks = append(blocks, ClaudeBlock{Type: "text", Text: p.Text})
				case ContentThinking:
					blocks = append(blocks, ClaudeBlock{Type: "thinking", Thinking: p.Thinking})
				case ContentToolUse:
					if p.ToolCall != nil {
						blocks = append(blocks, ClaudeBlock{
							Type:  "tool_use",
							ID:    p.ToolCall.ID,
							Name:  p.ToolCall.Name,
							Input: p.ToolCall.Arguments,
						})
					}
				}
			}
			if len(blocks) > 0 {
				out = append(out, ClaudeMessage{Role: "assistant", Content: blocks})
			}

		case RoleTool:
			// Claude 规范：tool_result 必须作为 user 消息中的块传入
			blocks := make([]ClaudeBlock, 0, len(msg.Parts))
			for _, p := range msg.Parts {
				if p.Type == ContentToolResult && p.ToolResult != nil {
					blocks = append(blocks, ClaudeBlock{
						Type:      "tool_result",
						ToolUseID: p.ToolResult.ToolCallID,
						Content:   p.ToolResult.Content,
						IsError:   p.ToolResult.IsError,
					})
				}
			}
			if len(blocks) > 0 {
				out = append(out, ClaudeMessage{Role: "user", Content: blocks})
			}

		default:
			return "", nil, fmt.Errorf("unsupported canonical role for Claude: %s", msg.Role)
		}
	}

	return systemPrompt, out, nil
}
