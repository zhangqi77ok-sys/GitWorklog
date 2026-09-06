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

func TestStdioClient_SendRequestNilResDefense(t *testing.T) {
	client := NewStdioClient("powershell", []string{"-Command", "Start-Sleep -Seconds 1"}, ".")
	// 模拟挂起请求并在 Stop 时清理
	ch := make(chan *JSONRPCMessage, 1)
	client.pending.Store(int64(999), ch)

	// 关闭客户端，触发 pending channel 发送 nil
	_ = client.Stop()

	// 从 channel 接收
	val := <-ch
	if val != nil {
		t.Errorf("expected nil from closed pending channel, got %v", val)
	}

	// 再次验证 sendRequest 不会导致 panic，且返回错误
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := client.sendRequest(ctx, "test", nil)
	if err == nil {
		t.Errorf("expected error from stopped client, got nil")
	}
}

func TestStdioClient_ReadLoopExitWakesPending(t *testing.T) {
	// 启动一个立即退出的进程
	client := NewStdioClient("powershell", []string{"-Command", "exit 0"}, ".")
	ch := make(chan *JSONRPCMessage, 1)
	client.pending.Store(int64(1001), ch)

	// 模拟直接运行 readLoop
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_ = client.Start(ctx)

	// 等待 readLoop 退出并唤醒 ch
	select {
	case val := <-ch:
		if val != nil {
			t.Errorf("expected nil from pending channel on process exit, got: %v", val)
		}
	case <-time.After(1 * time.Second):
		t.Errorf("readLoop failed to wake pending channel within timeout")
	}
	_ = client.Stop()
}


