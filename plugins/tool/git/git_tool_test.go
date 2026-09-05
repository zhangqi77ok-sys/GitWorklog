package git

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGitTool_GetStatus(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get current wd: %v", err)
	}
	repoRoot := filepath.Dir(filepath.Dir(filepath.Dir(wd)))

	tool := NewTool(repoRoot)
	status, err := tool.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}

	if status.Branch == "" {
		t.Errorf("expected branch name, got empty")
	}
}
