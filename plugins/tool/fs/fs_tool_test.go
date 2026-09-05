package fs

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestFSTool_NilSandboxGuard(t *testing.T) {
	tool := NewTool(nil, nil)
	rawArgs, _ := json.Marshal(map[string]string{
		"action": "read",
		"path":   "any.txt",
	})
	res, err := tool.Execute(context.Background(), rawArgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsError {
		t.Errorf("expected IsError=true when sandbox is nil")
	}
	if !strings.Contains(res.Content, "not initialized") {
		t.Errorf("expected 'not initialized' in message, got: %s", res.Content)
	}
}
