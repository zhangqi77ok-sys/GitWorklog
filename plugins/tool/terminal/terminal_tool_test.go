package terminal

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

func TestTerminalTool_Execute(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("cannot get wd: %v", err)
	}

	tool := NewTool(wd)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. 测试常规简单命令
	rawArgs, _ := json.Marshal(map[string]string{"command": "echo TCODE_TERMINAL_READY"})
	res, err := tool.Execute(ctx, rawArgs)
	if err != nil {
		t.Fatalf("execute error: %v", err)
	}

	if res.IsError {
		t.Fatalf("expected success, got error: %s", res.Content)
	}

	if !strings.Contains(res.Content, "TCODE_TERMINAL_READY") {
		t.Errorf("expected output containing TCODE_TERMINAL_READY, got: %s", res.Content)
	}
}

func TestTerminalTool_EmptyCommand(t *testing.T) {
	tool := NewTool(".")
	rawArgs, _ := json.Marshal(map[string]string{"command": ""})
	res, err := tool.Execute(context.Background(), rawArgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsError {
		t.Errorf("expected isError true for empty command")
	}
}

func TestTerminalTool_ExecuteStream(t *testing.T) {
	wd, _ := os.Getwd()
	tool := NewTool(wd)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var output strings.Builder
	exitCode, err := tool.ExecuteStream(ctx, "echo HELLO_STREAM_TERMINAL", func(chunk string) {
		output.WriteString(chunk)
	})

	if err != nil {
		t.Fatalf("ExecuteStream failed: %v", err)
	}
	if exitCode != 0 {
		t.Errorf("expected exitCode 0, got %d", exitCode)
	}
	if !strings.Contains(output.String(), "HELLO_STREAM_TERMINAL") {
		t.Errorf("expected output to contain HELLO_STREAM_TERMINAL, got: %s", output.String())
	}
}
