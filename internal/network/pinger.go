package network

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"
)

// PingTarget 真实发起 HTTP 网络探活并测量往返毫秒延迟
func PingTarget(targetURL string) (string, error) {
	if targetURL == "" {
		return "", fmt.Errorf("empty url")
	}

	client := &http.Client{
		Timeout: 4 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	start := time.Now()
	resp, err := client.Head(targetURL)
	if err != nil {
		// 尝试 GET
		resp, err = client.Get(targetURL)
	}

	duration := time.Since(start)
	if err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}
	defer resp.Body.Close()

	latencyMs := fmt.Sprintf("%dms", duration.Milliseconds())
	return latencyMs, nil
}
