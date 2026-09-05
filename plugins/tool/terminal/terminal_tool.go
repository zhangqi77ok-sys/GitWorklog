package terminal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"runtime"
	"sync"
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

// StreamChunkHandler 流式输出回调
type StreamChunkHandler func(chunk string)

// ExecuteStream 实时流式执行终端指令，边读边回调 onChunk，并在命令结束时返回 exitCode
func (t *Tool) ExecuteStream(ctx context.Context, command string, onChunk StreamChunkHandler) (int, error) {
	if command == "" {
		return -1, fmt.Errorf("command is required")
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/d", "/s", "/c", command)
		// 关键铁律: 注入 CREATE_NO_WINDOW = 0x08000000 杜绝 Windows 黑色控制台弹窗
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", command)
	}

	cmd.Dir = t.workspaceRoot

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return -1, fmt.Errorf("stdout pipe error: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return -1, fmt.Errorf("stderr pipe error: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return -1, fmt.Errorf("cmd start error: %w", err)
	}

	// 注入 context 取消守护：防止进程树孤儿与管道锁死
	go func() {
		<-ctx.Done()
		if cmd.Process != nil {
			if runtime.GOOS == "windows" {
				killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
				killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
				_ = killCmd.Run()
			} else {
				_ = cmd.Process.Kill()
			}
		}
	}()

	var wg sync.WaitGroup
	wg.Add(2)

	readerFunc := func(r io.Reader) {
		defer wg.Done()
		buf := make([]byte, 1024)
		for {
			n, err := r.Read(buf)
			if n > 0 && onChunk != nil {
				onChunk(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}

	go readerFunc(stdoutPipe)
	go readerFunc(stderrPipe)

	wg.Wait()
	err = cmd.Wait()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}
	return exitCode, err
}
