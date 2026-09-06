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

	// 传入缺少 scheme 的主机名/端口 (如 127.0.0.1:xxxx)
	hostPort := strings.TrimPrefix(ts.URL, "http://")
	// 针对 127.0.0.1 / localhost，应智能补齐 http://，且能成功连通返回有效延迟
	localLatency, pingErr := PingTarget(hostPort)
	if pingErr != nil {
		t.Fatalf("local hostPort without scheme should be completed with http:// and succeed, got error: %v", pingErr)
	}
	if !strings.HasSuffix(localLatency, "ms") {
		t.Errorf("expected local latency to end with ms, got: %s", localLatency)
	}
}

func TestPingTarget_ServerError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("502 Bad Gateway"))
	}))
	defer ts.Close()

	_, err := PingTarget(ts.URL)
	if err == nil {
		t.Fatalf("expected error for 502 Bad Gateway, got nil")
	}
	if !strings.Contains(err.Error(), "502") {
		t.Errorf("expected error message to contain 502, got %v", err)
	}
}
