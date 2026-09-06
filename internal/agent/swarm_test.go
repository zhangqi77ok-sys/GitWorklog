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

func TestRunTDDValidation_WithGoMod(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_agent_gomod_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	_ = os.WriteFile(filepath.Join(tempDir, "go.mod"), []byte("module testmod\n\ngo 1.22\n"), 0644)
	report, err := RunTDDValidation(tempDir)
	if err != nil {
		t.Fatalf("RunTDDValidation failed: %v", err)
	}
	// 无论是否有测试文件，状态应返回有效报表（PASS 或 FAIL），而不是崩溃
	if report.Status != "PASS" && report.Status != "FAIL" {
		t.Errorf("expected PASS or FAIL, got: %s", report.Status)
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

func TestRunSecurityAudit_SkipLargeFiles(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_audit_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 创建一个包含高危关键词但大于 5MB 的文件
	largePath := filepath.Join(tempDir, "big_script.py")
	f, err := os.Create(largePath)
	if err != nil {
		t.Fatalf("failed to create file: %v", err)
	}
	// 写入 6MB 数据并包含 high risk 关键字
	_ = f.Truncate(6 * 1024 * 1024)
	_, _ = f.WriteString("shutdown")
	_ = f.Close()

	report, err := RunSecurityAudit(tempDir)
	if err != nil {
		t.Fatalf("RunSecurityAudit failed: %v", err)
	}
	if len(report.Issues) > 0 {
		t.Errorf("expected 0 issues due to file size > 5MB, got %d", len(report.Issues))
	}
}
