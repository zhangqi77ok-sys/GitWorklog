package network

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPingTarget_Empty(t *testing.T) {
	_, err := PingTarget("")
	if err == nil {
		t.Fatalf("expected error for empty target, got nil")
	}
}

func TestPingTarget_AutoScheme(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer ts.Close()

	// 传入带 http:// 的测试地址
	latency, err := PingTarget(ts.URL)
	if err != nil {
		t.Fatalf("ping failed: %v", err)
	}
	if !strings.HasSuffix(latency, "ms") {
		t.Errorf("expected latency to end with ms, got: %s", latency)
	}

	// 传入缺少 scheme 的主机名/端口
	hostPort := strings.TrimPrefix(ts.URL, "http://")
	// 因为测试服务器是 HTTP，不带 scheme 默认被补成 https:// 会被底层拦截，但不能报 unsupported protocol scheme
	_, pingErr := PingTarget(hostPort)
	if pingErr != nil && strings.Contains(pingErr.Error(), "unsupported protocol scheme") {
		t.Errorf("protocol scheme should be auto completed, but got error: %v", pingErr)
	}
}
