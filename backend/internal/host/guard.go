package host

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	v1 "tcode/pkg/plugin/v1"
)

// GuardedExecutionError 带有完整堆栈信息的插件崩溃错误
type GuardedExecutionError struct {
	PluginID string
	PanicVal any
	Stack    string
}

func (e *GuardedExecutionError) Error() string {
	return fmt.Sprintf("CRITICAL: plugin [%s] panicked: %v\nStack trace:\n%s", e.PluginID, e.PanicVal, e.Stack)
}

// SafeCallTool 带崩溃隔离与超时控制的算子安全执行器
func SafeCallTool(ctx context.Context, tool v1.ToolPlugin, rawArgs json.RawMessage) (res *v1.ToolResult, err error) {
	if tool == nil {
		return nil, fmt.Errorf("cannot execute nil tool")
	}

	defer func() {
		if r := recover(); r != nil {
			stack := string(debug.Stack())
			err = &GuardedExecutionError{
				PluginID: tool.ID(),
				PanicVal: r,
				Stack:    stack,
			}
		}
	}()

	return tool.Execute(ctx, rawArgs)
}

// SafeGo 启动受 Panic 保护的独立 Goroutine
func SafeGo(fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("[Guard] Background goroutine panicked: %v\nStack:\n%s\n", r, string(debug.Stack()))
			}
		}()
		fn()
	}()
}
