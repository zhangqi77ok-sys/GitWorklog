package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"tcode/internal/host"
	v1 "tcode/pkg/plugin/v1"
)

// Server 本地微内核 HTTP/SSE 传输服务
type Server struct {
	addr     string
	registry *host.Registry
	httpSrv  *http.Server
}

// NewServer 构造本地服务端
func NewServer(addr string, reg *host.Registry) *Server {
	if addr == "" {
		addr = "127.0.0.1:8765"
	}
	s := &Server{
		addr:     addr,
		registry: reg,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/chat/stream", s.handleChatStream)

	s.httpSrv = &http.Server{
		Addr:         addr,
		Handler:      s.corsMiddleware(mux),
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 0, // SSE 流式长连接禁止全局写入超时
	}

	return s
}

// Start 启动监听
func (s *Server) Start() error {
	return s.httpSrv.ListenAndServe()
}

// Stop 优雅停机
func (s *Server) Stop(ctx context.Context) error {
	return s.httpSrv.Shutdown(ctx)
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// handleHealth 探活端点
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	res := map[string]any{
		"status":    "ok",
		"version":   "2.0.0-PROD",
		"timestamp": time.Now().Unix(),
	}
	_ = json.NewEncoder(w).Encode(res)
}

// handleChatStream SSE 流式对话端点
func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Model    string          `json:"model"`
		Prompt   string          `json:"prompt"`
		Messages json.RawMessage `json:"messages"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("invalid json: %v", err), http.StatusBadRequest)
		return
	}

	if req.Model == "" {
		req.Model = "gpt-4o"
	}

	// 查找可用 Provider
	prov, ok := s.registry.GetProvider("provider.openai")
	if !ok {
		http.Error(w, "provider.openai not registered in micro-kernel", http.StatusServiceUnavailable)
		return
	}

	// 配置 SSE 头部
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // 禁用 Nginx 缓冲

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// 构造模型请求
	chatReq := &v1.ChatRequest{
		Model:    req.Model,
		Messages: req.Messages,
		Stream:   true,
	}

	// 若未传 messages 数组，自动封装用户 prompt
	if len(req.Messages) == 0 && req.Prompt != "" {
		singleUserMsg, _ := json.Marshal([]map[string]string{
			{"role": "user", "content": req.Prompt},
		})
		chatReq.Messages = singleUserMsg
	}

	ctx := r.Context()
	chunkChan, err := prov.StreamChat(ctx, chatReq)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}

	for chunk := range chunkChan {
		if chunk.Error != nil {
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", chunk.Error.Error())
			flusher.Flush()
			return
		}

		payload, err := json.Marshal(chunk)
		if err == nil {
			fmt.Fprintf(w, "event: chunk\ndata: %s\n\n", string(payload))
			flusher.Flush()
		}
	}

	// 优雅发送完成标桩
	fmt.Fprintf(w, "event: done\ndata: [DONE]\n\n")
	flusher.Flush()
}
