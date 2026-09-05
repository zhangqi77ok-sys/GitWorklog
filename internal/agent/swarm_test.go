package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunTDDValidation_NoGoMod(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_agent_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	report, err := RunTDDValidation(tempDir)
	if err != nil {
		t.Fatalf("RunTDDValidation failed: %v", err)
	}
	if report.Status != "PASS" {
		t.Errorf("expected PASS for no-go-mod directory, got %s", report.Status)
	}
	if !strings.Contains(report.Output, "跳过") {
		t.Errorf("expected skip message in output, got: %s", report.Output)
	}
}

func TestRunSecurityAudit_Clean(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get wd: %v", err)
	}
	repoRoot := filepath.Dir(filepath.Dir(wd))

	report, err := RunSecurityAudit(repoRoot)
	if err != nil {
		t.Fatalf("RunSecurityAudit failed: %v", err)
	}
	if report.FilesScanned == 0 {
		t.Errorf("expected files scanned > 0, got %d", report.FilesScanned)
	}
}
