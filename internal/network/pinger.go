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
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	req.Header.Set("Originator", "codex_cli_rs")
	req.Header.Set("Version", "0.101.0")

	resp, err := client.Do(req)
	duration := time.Since(start)
	if err != nil {
		return "", fmt.Errorf("ping failed: %w", err)
	}
	defer resp.Body.Close()

	latencyMs := fmt.Sprintf("%dms", duration.Milliseconds())
	return latencyMs, nil
}
