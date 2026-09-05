package telemetry

import (
	"fmt"
	"sync"
	"time"
)

// ModelUsage 单个模型的累计用量统计
type ModelUsage struct {
	Model        string `json:"model"`
	Calls        int    `json:"calls"`
	TotalTokens  int    `json:"total_tokens"`
	PromptTokens int    `json:"prompt_tokens"`
	CompTokens   int    `json:"comp_tokens"`
	AvgLatencyMs int64  `json:"avg_latency_ms"`
}

// UsageMetrics 全局 Token 消耗与网关遥测大盘
type UsageMetrics struct {
	TotalTokens     int                   `json:"total_tokens"`
	TotalCalls      int                   `json:"total_calls"`
	EstimatedCost   string                `json:"estimated_cost"` // 美元预估 (如 "$0.042")
	ActiveSessions  int                   `json:"active_sessions"`
	PerModel        map[string]ModelUsage `json:"per_model"`
	LastUpdatedTime string                `json:"last_updated_time"`
}

type Tracker struct {
	mu       sync.RWMutex
	perModel map[string]*ModelUsage
}

var globalTracker = NewTracker()

func NewTracker() *Tracker {
	return &Tracker{
		perModel: make(map[string]*ModelUsage),
	}
}

func GetTracker() *Tracker {
	return globalTracker
}

func (t *Tracker) Record(model string, promptTokens, compTokens int, durationMs int64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	mu, exists := t.perModel[model]
	if !exists {
		mu = &ModelUsage{
			Model: model,
		}
		t.perModel[model] = mu
	}

	mu.Calls++
	mu.PromptTokens += promptTokens
	mu.CompTokens += compTokens
	mu.TotalTokens += (promptTokens + compTokens)
	if mu.Calls > 0 {
		mu.AvgLatencyMs = (mu.AvgLatencyMs*int64(mu.Calls-1) + durationMs) / int64(mu.Calls)
	}
}

func (t *Tracker) GetMetrics(activeSessions int) UsageMetrics {
	t.mu.RLock()
	defer t.mu.RUnlock()

	totalTokens := 0
	totalCalls := 0
	resMap := make(map[string]ModelUsage)

	for m, u := range t.perModel {
		totalTokens += u.TotalTokens
		totalCalls += u.Calls
		resMap[m] = *u
	}

	// 预估成本估算 (平均 $0.002 / 1k tokens)
	cost := float64(totalTokens) * 0.000002
	costStr := fmt.Sprintf("$%.4f", cost)

	return UsageMetrics{
		TotalTokens:     totalTokens,
		TotalCalls:      totalCalls,
		EstimatedCost:   costStr,
		ActiveSessions:  activeSessions,
		PerModel:        resMap,
		LastUpdatedTime: time.Now().Format("15:04:05"),
	}
}
