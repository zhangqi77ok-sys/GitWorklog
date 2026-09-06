package network

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var defaultTransport = &http.Transport{
	TLSClientConfig:     &tls.Config{InsecureSkipVerify: true},
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 20,
	IdleConnTimeout:     30 * time.Second,
	DisableCompression: true,
}

var defaultClient = &http.Client{
	Timeout:   4 * time.Second,
	Transport: defaultTransport,
}

// PingTarget 真实发起 HTTP 网络探活并测量往返毫秒延迟
func PingTarget(targetURL string) (string, error) {
	trimmed := strings.TrimSpace(targetURL)
	if trimmed == "" {
		return "", fmt.Errorf("empty url")
	}

	// 自动补齐缺失的 HTTP/HTTPS 协议前缀，防止 unsupported protocol scheme 错误
	// 本地开发测试服务（如 Ollama localhost:11434, 本地网关）智能使用 http://，外部公共渠道使用 https://
	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		lower := strings.ToLower(trimmed)
		if strings.HasPrefix(lower, "localhost") ||
			strings.HasPrefix(lower, "127.0.0.1") ||
			strings.HasPrefix(lower, "0.0.0.0") ||
			strings.HasPrefix(lower, "[::1]") {
			trimmed = "http://" + trimmed
		} else {
			trimmed = "https://" + trimmed
		}
	}

	start := time.Now()
	req, err := http.NewRequest("GET", trimmed, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	req.Header.Set("Originator", "codex_cli_rs")
	req.Header.Set("Version", "0.101.0")

	resp, err := defaultClient.Do(req)
	duration := time.Since(start)
	if err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}
	defer resp.Body.Close()

	// 浅读排空以复用长连接
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))

	latencyMs := fmt.Sprintf("%dms", duration.Milliseconds())
	return latencyMs, nil
}
