package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// StdioClient 基于标准输入输出进程通信的 MCP 客户端
type StdioClient struct {
	command   string
	args      []string
	workspace string

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser

	pending  sync.Map // map[int64]chan *JSONRPCMessage
	nextID   atomic.Int64
	stopChan chan struct{}
	mu       sync.Mutex
	started  bool
}

// NewStdioClient 创建 Stdio 客户端实例
func NewStdioClient(command string, args []string, workspace string) *StdioClient {
	return &StdioClient{
		command:   command,
		args:      args,
		workspace: workspace,
		stopChan:  make(chan struct{}),
	}
}

// Start 拉起外部进程并完成 MCP Initialize 协议握手
func (c *StdioClient) Start(ctx context.Context) error {
	c.mu.Lock()
	if c.started {
		c.mu.Unlock()
		return nil
	}

	cmd := exec.Command(c.command, c.args...)
	cmd.Dir = c.workspace

	stdin, err := cmd.StdinPipe()
	if err != nil {
		c.mu.Unlock()
		return fmt.Errorf("stdin pipe error: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		c.mu.Unlock()
		return fmt.Errorf("stdout pipe error: %w", err)
	}

	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	}

	if err := cmd.Start(); err != nil {
		c.mu.Unlock()
		return fmt.Errorf("process start error (%s): %w", c.command, err)
	}

	c.cmd = cmd
	c.stdin = stdin
	c.stdout = stdout
	c.started = true
	c.mu.Unlock()

	// 启动后台扫描协程监听服务端按行输出
	go c.readLoop()

	// 1. 发起 initialize 握手
	initParams := InitializeParams{
		ProtocolVersion: "2024-11-05",
		Capabilities: map[string]any{
			"tools": map[string]any{},
		},
		ClientInfo: ClientInfo{
			Name:    "tcode-studio",
			Version: "2.0.0",
		},
	}

	initBytes, _ := json.Marshal(initParams)
	resp, err := c.sendRequest(ctx, "initialize", initBytes)
	if err != nil {
		_ = c.Stop()
		return fmt.Errorf("mcp initialize failed: %w", err)
	}

	if resp.Error != nil {
		_ = c.Stop()
		return fmt.Errorf("mcp initialize error from server: %s", resp.Error.Message)
	}

	// 2. 发送 notifications/initialized
	_ = c.sendNotification("notifications/initialized", nil)

	return nil
}

// Stop 优雅停止子进程
func (c *StdioClient) Stop() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.started {
		return nil
	}

	close(c.stopChan)
	if c.stdin != nil {
		_ = c.stdin.Close()
	}

	done := make(chan error, 1)
	go func() {
		done <- c.cmd.Wait()
	}()

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		_ = c.cmd.Process.Kill()
	}

	c.started = false
	return nil
}

// ListTools 请求服务端暴露的全部工具清单
func (c *StdioClient) ListTools(ctx context.Context) ([]Tool, error) {
	resp, err := c.sendRequest(ctx, "tools/list", nil)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("server error: %s", resp.Error.Message)
	}

	var res ToolsListResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return nil, fmt.Errorf("parse tools/list result error: %w", err)
	}

	return res.Tools, nil
}

// CallTool 运行具体算子
func (c *StdioClient) CallTool(ctx context.Context, name string, args map[string]any) (string, error) {
	params := ToolCallParams{
		Name:      name,
		Arguments: args,
	}
	pBytes, _ := json.Marshal(params)

	resp, err := c.sendRequest(ctx, "tools/call", pBytes)
	if err != nil {
		return "", err
	}
	if resp.Error != nil {
		return "", fmt.Errorf("tool call error: %s", resp.Error.Message)
	}

	var res ToolCallResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return "", fmt.Errorf("parse tool/call result error: %w", err)
	}

	output := ""
	for _, item := range res.Content {
		if item.Text != "" {
			if output != "" {
				output += "\n"
			}
			output += item.Text
		}
	}

	return output, nil
}

// Ping 测试连通性与测量延迟
func (c *StdioClient) Ping(ctx context.Context) (time.Duration, int, error) {
	start := time.Now()
	tools, err := c.ListTools(ctx)
	duration := time.Since(start)
	if err != nil {
		return 0, 0, err
	}
	return duration, len(tools), nil
}

// sendRequest 发送带 ID 的同步请求并等待响应
func (c *StdioClient) sendRequest(ctx context.Context, method string, params json.RawMessage) (*JSONRPCMessage, error) {
	id := c.nextID.Add(1)

	msg := JSONRPCMessage{
		JSONRPC: "2.0",
		ID:      id,
		Method:  method,
		Params:  params,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return nil, err
	}

	ch := make(chan *JSONRPCMessage, 1)
	c.pending.Store(id, ch)
	defer c.pending.Delete(id)

	c.mu.Lock()
	if c.stdin == nil {
		c.mu.Unlock()
		return nil, fmt.Errorf("stdin is nil")
	}
	_, err = c.stdin.Write(append(data, '\n'))
	c.mu.Unlock()

	if err != nil {
		return nil, fmt.Errorf("write error: %w", err)
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-c.stopChan:
		return nil, fmt.Errorf("client stopped")
	case res := <-ch:
		return res, nil
	}
}

// sendNotification 发送单向通知
func (c *StdioClient) sendNotification(method string, params json.RawMessage) error {
	msg := JSONRPCMessage{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
	}
	data, _ := json.Marshal(msg)

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.stdin != nil {
		_, _ = c.stdin.Write(append(data, '\n'))
	}
	return nil
}

// readLoop 持续按行读取外部进程输出并派发给对应 Request ID
func (c *StdioClient) readLoop() {
	scanner := bufio.NewScanner(c.stdout)
	// 允许单行大报文 (最高 4MB)
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 4*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var msg JSONRPCMessage
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		// 检查是否有匹配的 Request ID
		if msg.ID != nil {
			var reqID int64
			switch v := msg.ID.(type) {
			case float64:
				reqID = int64(v)
			case int64:
				reqID = v
			}

			if chVal, ok := c.pending.Load(reqID); ok {
				if ch, ok := chVal.(chan *JSONRPCMessage); ok {
					ch <- &msg
				}
			}
		}
	}
}
