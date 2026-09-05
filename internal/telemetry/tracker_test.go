package telemetry

import (
	"strings"
	"testing"
)

func TestTracker_EstimatedCostAccuracy(t *testing.T) {
	tracker := NewTracker()

	// 初始状态
	m := tracker.GetMetrics(1)
	if m.TotalTokens != 0 {
		t.Errorf("expected 0 tokens, got %d", m.TotalTokens)
	}
	if m.EstimatedCost != "$0.0000" {
		t.Errorf("expected $0.0000, got %s", m.EstimatedCost)
	}

	// 记录调用 (1000 prompt + 500 comp = 1500 tokens)
	tracker.Record("deepseek-chat", 1000, 500, 120)
	m2 := tracker.GetMetrics(1)
	if m2.TotalTokens != 1500 {
		t.Errorf("expected 1500 tokens, got %d", m2.TotalTokens)
	}
	// 1500 * 0.000002 = 0.0030
	if m2.EstimatedCost != "$0.0030" {
		t.Errorf("expected $0.0030, got %s", m2.EstimatedCost)
	}
	if strings.Contains(m2.EstimatedCost, ":") {
		t.Errorf("EstimatedCost should not contain time colon: %s", m2.EstimatedCost)
	}
}
