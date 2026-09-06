package lsp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseGoErrors(t *testing.T) {
	raw := `
internal/lsp/test_sample.go:15:3: undefined: invalidVariable
internal/lsp/test_sample.go:22:9: missing return at end of function
other.go:1:1: syntax error
`
	items := parseGoErrors(raw, "internal/lsp/test_sample.go")
	if len(items) != 2 {
		t.Fatalf("expected 2 errors for test_sample.go, got %d", len(items))
	}
	if items[0].Line != 15 || items[0].Column != 3 {
		t.Fatalf("unexpected line/column: %d:%d", items[0].Line, items[0].Column)
	}
	if !strings.Contains(items[0].Message, "undefined: invalidVariable") {
		t.Fatalf("unexpected message: %s", items[0].Message)
	}
}

func TestParseTSErrors(t *testing.T) {
	raw := `
src/app.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
src/app.ts:25:1 - error TS2554: Expected 2 arguments, but got 1.
`
	items := parseTSErrors(raw, "src/app.ts")
	if len(items) != 2 {
		t.Fatalf("expected 2 errors for src/app.ts, got %d", len(items))
	}
	if items[0].Code != "TS2322" {
		t.Fatalf("expected TS2322, got %s", items[0].Code)
	}
}

func TestFormatDiagnosticFeedback(t *testing.T) {
	report := &DiagnosticReport{
		Success:    true,
		FilePath:   "foo.go",
		HasErrors:  true,
		ErrorCount: 1,
		Errors: []DiagnosticItem{
			{
				File:     "foo.go",
				Line:     10,
				Column:   5,
				Severity: "ERROR",
				Code:     "GO_VET",
				Message:  "undeclared name: x",
			},
		},
	}

	feedback := FormatDiagnosticFeedback(report)
	if !strings.Contains(feedback, "LSP Compiler Diagnostics") {
		t.Fatalf("feedback missing header: %s", feedback)
	}
	if !strings.Contains(feedback, "undeclared name: x") {
		t.Fatalf("feedback missing error message: %s", feedback)
	}
}

func TestDiagnoseFile_CleanFile(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Skip("cannot get working dir")
	}

	target := "diagnostics.go"
	if _, err := os.Stat(filepath.Join(wd, "internal", "lsp", "diagnostics.go")); err == nil {
		target = "internal/lsp/diagnostics.go"
	}

	report, err := DiagnoseFile(wd, target)
	if err != nil {
		t.Fatalf("DiagnoseFile failed: %v", err)
	}
	if report == nil {
		t.Fatalf("expected report, got nil")
	}
	if report.HasErrors {
		t.Fatalf("expected 0 errors for clean file, got %d: %v", report.ErrorCount, report.Errors)
	}
}

func TestDiagnoseFile_PathTraversal(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Skip("cannot get working dir")
	}

	malicious := []string{
		"../../windows/system32/notepad.exe",
		"../escape.go",
		"..\\escape.go",
		"",
	}

	for _, p := range malicious {
		_, err := DiagnoseFile(wd, p)
		if err == nil {
			t.Errorf("expected traversal error for [%s], got nil", p)
		}
	}
}

func TestDiagnoseFile_WindowsDriveNormalization(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Skip("cannot get working dir")
	}

	vol := filepath.VolumeName(wd)
	if vol == "" {
		t.Skip("not windows drive")
	}

	// 构造小写盘符 workspace
	lowerWd := strings.ToLower(vol) + wd[len(vol):]
	target := "diagnostics.go"
	if _, err := os.Stat(filepath.Join(lowerWd, "internal", "lsp", "diagnostics.go")); err == nil {
		target = "internal/lsp/diagnostics.go"
	}

	report, err := DiagnoseFile(lowerWd, target)
	if err != nil {
		t.Fatalf("DiagnoseFile with lower drive letter failed: %v", err)
	}
	if report == nil {
		t.Fatalf("expected report, got nil")
	}
}

func TestDiagnoseFile_DoubleDotFileName(t *testing.T) {
	tempDir := t.TempDir()
	// Create a valid file named ..sample.go inside tempDir
	sampleFile := filepath.Join(tempDir, "..sample.go")
	if err := os.WriteFile(sampleFile, []byte("package test\n"), 0644); err != nil {
		t.Fatalf("failed to write sample file: %v", err)
	}

	report, err := DiagnoseFile(tempDir, "..sample.go")
	if err != nil {
		t.Fatalf("unexpected error for double-dot filename inside workspace: %v", err)
	}
	if report == nil {
		t.Fatalf("expected report, got nil")
	}
}
