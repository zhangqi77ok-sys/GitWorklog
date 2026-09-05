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

func TestStdioClient_RestartAndStopChan(t *testing.T) {
	client := NewStdioClient("powershell", []string{"-Command", "Start-Sleep -Seconds 1"}, ".")
	// 首次 Stop，关闭 stopChan
	_ = client.Stop()

	// 再次调用 Start，若 stopChan 未重新初始化，sendRequest 会直接被 client stopped 中断
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	err := client.Start(ctx)
	if err == nil {
		t.Fatalf("expected timeout or handshake error")
	}

	// 验证错误不是因为残留的 client stopped 导致的假失败
	if err.Error() == "client stopped" {
		t.Errorf("expected handshake/timeout error, but got stale 'client stopped' error")
	}

	_ = client.Stop()
}

