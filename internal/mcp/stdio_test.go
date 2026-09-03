package mcp

import (
	"context"
	"testing"
	"time"
)

func TestStdioClient_TimeoutControl(t *testing.T) {
	// 启动一个 sleep 命令测试超时机制
	client := NewStdioClient("powershell", []string{"-Command", "Start-Sleep -Seconds 5"}, ".")

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	err := client.Start(ctx)
	if err == nil {
		t.Fatalf("expected timeout error, got nil")
	}
	_ = client.Stop()
}
