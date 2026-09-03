package v1

import (
	"context"
)

// RailDecision 拦截裁决结果
type RailDecision struct {
	Allow       bool   `json:"allow"`
	Intercepted bool   `json:"intercepted"`
	Reason      string `json:"reason,omitempty"`
	Feedback    string `json:"feedback,omitempty"`
}

// RailPlugin 核心执行回路治理轨道 SPI
type RailPlugin interface {
	Plugin
	// Priority 拦截优先级 (0~100，P-100 为最高阻断权，数字越大越优先执行)
	Priority() int

	// OnBeforeObserve 观察环境前的切入钩子
	OnBeforeObserve(ctx context.Context, sessionID string) error
	// OnBeforeReason 组织 Prompt 注入前的安全/预算审查
	OnBeforeReason(ctx context.Context, sessionID string, prompt *string) error
	// OnBeforeAct 算子调用前的拦截裁决 (如危险命令阻断)
	OnBeforeAct(ctx context.Context, sessionID string, toolName string, args []byte) (*RailDecision, error)
	// OnAfterAct 算子执行完毕后的审计与清洗钩子
	OnAfterAct(ctx context.Context, sessionID string, toolName string, result *ToolResult) error
	// OnVerify 验证环节质量门禁
	OnVerify(ctx context.Context, sessionID string) (passed bool, feedback string, err error)
}
