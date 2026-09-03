package terminal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
	"syscall"
	"time"

	v1 "tcode/pkg/plugin/v1"
)

// Tool 受控终端执行算子插件
type Tool struct {
	id            string
	name          string
	version       string
	workspaceRoot string
}

// NewTool 构造受控终端算子
func NewTool(root string) *Tool {
	return &Tool{
		id:            "tool.terminal",
		name:          "Controlled Terminal Tool",
		version:       "1.0.0",
		workspaceRoot: root,
	}
}

func (t *Tool) ID() string             { return t.id }
func (t *Tool) Name() string           { return t.name }
func (t *Tool) Version() string        { return t.version }
func (t *Tool) Type() v1.PluginType    { return v1.TypeTool }
func (t *Tool) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (t *Tool) Start(ctx context.Context) error { return nil }
func (t *Tool) Stop(ctx context.Context) error  { return nil }
func (t *Tool) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true, Message: "Terminal tool ready"}
}

// Definition 声明给大模型的算子元数据契约
func (t *Tool) Definition() v1.ToolDefinition {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"command": map[string]any{
				"type":        "string",
				"description": "要执行的 Shell/CMD 命令，例如 'git status'、'npm test' 或 'dir'",
			},
		},
		"required": []string{"command"},
	}
	schemaBytes, _ := json.Marshal(schema)

	return v1.ToolDefinition{
		Name:        "exec_command",
		Description: "在沙箱工作区根目录下受控静默执行一条命令行脚本，并返回 stdout 和 stderr。严禁阻塞运行长服务。",
		Parameters:  schemaBytes,
	}
}

// Execute 物理执行命令 (严格注入 CREATE_NO_WINDOW 杜绝弹窗)
func (t *Tool) Execute(ctx context.Context, rawArgs json.RawMessage) (*v1.ToolResult, error) {
	var args struct {
		Command string `json:"command"`
	}
	if err := json.Unmarshal(rawArgs, &args); err != nil {
		return &v1.ToolResult{Content: fmt.Sprintf("invalid args: %v", err), IsError: true}, nil
	}

	if args.Command == "" {
		return &v1.ToolResult{Content: "command is required", IsError: true}, nil
	}

	execCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(execCtx, "cmd", "/d", "/s", "/c", args.Command)
		// 关键铁律: 注入 CREATE_NO_WINDOW = 0x08000000 杜绝 Windows 黑色控制台弹窗
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	} else {
		cmd = exec.CommandContext(execCtx, "sh", "-c", args.Command)
	}

	cmd.Dir = t.workspaceRoot

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n[stderr]:\n" + stderr.String()
		} else {
			output = stderr.String()
		}
	}

	if err != nil {
		exitCode := -1
		if cmd.ProcessState != nil {
			exitCode = cmd.ProcessState.ExitCode()
		}
		return &v1.ToolResult{
			Content: fmt.Sprintf("Exit Code: %d\nOutput:\n%s\nError: %v", exitCode, output, err),
			IsError: true,
		}, nil
	}

	return &v1.ToolResult{
		Content: output,
		IsError: false,
	}, nil
}
