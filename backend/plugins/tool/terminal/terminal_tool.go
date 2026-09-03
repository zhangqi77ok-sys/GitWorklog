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

	"tcode-core/kernel/plugin"
)

// Tool 受控终端执行算子插件
type Tool struct {
	workspaceRoot string
}

// NewTool 构造受控终端算子
func NewTool(root string) *Tool {
	return &Tool{workspaceRoot: root}
}

func (t *Tool) ID() string               { return "terminal_control" }
func (t *Tool) Name() string             { return "Controlled Terminal Tool" }
func (t *Tool) Version() string          { return "1.0.0" }
func (t *Tool) Type() plugin.PluginType   { return plugin.TypeTool }
func (t *Tool) Init(ctx context.Context) error { return nil }
func (t *Tool) Shutdown(ctx context.Context) error { return nil }

// ToolDefinition 声明给大模型的算子元数据契约
func (t *Tool) ToolDefinition() plugin.ToolDescriptor {
	return plugin.ToolDescriptor{
		Name:        "exec_command",
		Description: "在沙箱工作区根目录下受控静默执行一条命令行脚本，并返回 stdout 和 stderr。严禁阻塞运行长服务。",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"command": map[string]any{
					"type":        "string",
					"description": "要执行的 Shell/CMD 命令，例如 'git status'、'npm test' 或 'dir'",
				},
			},
			"required": []string{"command"},
		},
	}
}

// Execute 物理执行命令 (严格注入 CREATE_NO_WINDOW 杜绝弹窗)
func (t *Tool) Execute(ctx context.Context, argsJSON string) (any, error) {
	var args struct {
		Command string `json:"command"`
	}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return nil, fmt.Errorf("invalid args: %w", err)
	}

	if args.Command == "" {
		return nil, fmt.Errorf("command is required")
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
		return map[string]any{
			"output":   output,
			"error":    err.Error(),
			"exitCode": cmd.ProcessState.ExitCode(),
		}, nil
	}

	return map[string]any{
		"output":   output,
		"exitCode": 0,
	}, nil
}
