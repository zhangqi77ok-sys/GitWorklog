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

func TestGitTool_ParsePorcelainWithSpaces(t *testing.T) {
	rawOutput := `1 .M N... 100644 100644 100644 a1b2c3d e4f5a6b my space file.txt
? untracked with space.md
1 M. N... 100644 100644 100644 a1b2c3d e4f5a6b normal.go`

	report := parsePorcelainV2(rawOutput, "feat-test")
	if report.Branch != "feat-test" {
		t.Errorf("expected branch feat-test, got %s", report.Branch)
	}

	if len(report.Working) < 2 {
		t.Fatalf("expected at least 2 working files, got %d", len(report.Working))
	}

	// 验证空格文件没有被截断成 my
	if report.Working[0].Path != "my space file.txt" {
		t.Errorf("expected Path 'my space file.txt', got %q", report.Working[0].Path)
	}

	// 验证未追踪空格文件没有被截断成 untracked
	if len(report.Untracked) != 1 || report.Untracked[0] != "untracked with space.md" {
		t.Errorf("expected Untracked 'untracked with space.md', got %v", report.Untracked)
	}
}

