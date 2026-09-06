package http

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServer_NilGitToolHandlers(t *testing.T) {
	srv := NewServer("127.0.0.1:0", nil, nil, nil, nil)

	// 1. handleGitStage
	body := bytes.NewBufferString(`{"path":"foo.txt"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/git/stage", body)
	w := httptest.NewRecorder()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("handleGitStage panicked on nil gitTool: %v", r)
		}
	}()
	srv.handleGitStage(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil gitTool stage, got %d", w.Code)
	}

	// 2. handleGitUnstage
	body = bytes.NewBufferString(`{"path":"foo.txt"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/git/unstage", body)
	w = httptest.NewRecorder()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("handleGitUnstage panicked on nil gitTool: %v", r)
		}
	}()
	srv.handleGitUnstage(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil gitTool unstage, got %d", w.Code)
	}

	// 3. handleGitRestore
	body = bytes.NewBufferString(`{"path":"foo.txt"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/git/restore", body)
	w = httptest.NewRecorder()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("handleGitRestore panicked on nil gitTool: %v", r)
		}
	}()
	srv.handleGitRestore(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil gitTool restore, got %d", w.Code)
	}
}

func TestServer_NilEngineChatStream(t *testing.T) {
	srv := NewServer("127.0.0.1:0", nil, nil, nil, nil)
	srv.engine = nil

	body := bytes.NewBufferString(`{"prompt":"hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/chat/stream", body)
	w := httptest.NewRecorder()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("handleChatStream panicked on nil engine: %v", r)
		}
	}()
	srv.handleChatStream(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil engine, got %d", w.Code)
	}
}
