package sandbox_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"tcode/internal/core/sandbox"
)

func TestSandbox_ValidatePathAndAtomicWrite(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "tcode_sandbox_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	sb, err := sandbox.NewSandbox(tmpDir)
	if err != nil {
		t.Fatalf("failed to create sandbox: %v", err)
	}

	// 1. 越界攻击防御测试
	escapePaths := []string{
		"../../outside.txt",
		"sub/../../outside.txt",
	}
	for _, p := range escapePaths {
		_, err := sb.ValidatePath(p)
		if err == nil {
			t.Errorf("expected security error for path [%s], but got nil", p)
		} else if !strings.Contains(err.Error(), "SECURITY") {
			t.Errorf("unexpected error message: %v", err)
		}
	}

	// 2. 正常相对路径验证
	validRel := "src/main.go"
	full, err := sb.ValidatePath(validRel)
	if err != nil {
		t.Fatalf("valid path rejected: %v", err)
	}
	expected := filepath.Clean(filepath.Join(tmpDir, validRel))
	if full != expected {
		t.Errorf("expected [%s], got [%s]", expected, full)
	}

	// 3. 原子写入测试
	content := []byte("package main\n\nfunc main() {}\n")
	if err := sb.AtomicWriteFile(validRel, content); err != nil {
		t.Fatalf("atomic write failed: %v", err)
	}

	readBack, err := sb.SafeReadFile(validRel)
	if err != nil {
		t.Fatalf("safe read failed: %v", err)
	}
	if string(readBack) != string(content) {
		t.Errorf("content mismatch: got [%s], expected [%s]", string(readBack), string(content))
	}

	// 4. 前导斜杠路径测试
	leadingSlashPath := "/src/foo.go"
	fullSlash, err := sb.ValidatePath(leadingSlashPath)
	if err != nil {
		t.Fatalf("path with leading slash rejected: %v", err)
	}
	expectedSlash := filepath.Clean(filepath.Join(tmpDir, "src/foo.go"))
	if fullSlash != expectedSlash {
		t.Errorf("expected [%s], got [%s]", expectedSlash, fullSlash)
	}

	// 5. 空字节攻击测试
	nullBytePaths := []string{
		"src/foo\x00.go",
		"\x00/etc/passwd",
	}
	for _, p := range nullBytePaths {
		_, err := sb.ValidatePath(p)
		if err == nil {
			t.Errorf("expected error for null byte in path [%s], but got nil", p)
		} else if !strings.Contains(err.Error(), "null byte") {
			t.Errorf("expected null byte error, got: %v", err)
		}
	}

	// 6. 首尾空格自动修剪测试
	trimmedPath := "   src/trimmed.go   "
	fullTrimmed, err := sb.ValidatePath(trimmedPath)
	if err != nil {
		t.Fatalf("path with surrounding spaces rejected: %v", err)
	}
	expectedTrimmed := filepath.Clean(filepath.Join(tmpDir, "src/trimmed.go"))
	if fullTrimmed != expectedTrimmed {
		t.Errorf("expected [%s], got [%s]", expectedTrimmed, fullTrimmed)
	}

	// 7. 空路径拦截测试
	if _, err := sb.ValidatePath(""); err == nil {
		t.Errorf("expected empty path to be rejected, got nil")
	}
	if _, err := sb.ValidatePath("   "); err == nil {
		t.Errorf("expected whitespace path to be rejected, got nil")
	}

	// 8. 写入根目录拦截测试
	if err := sb.AtomicWriteFile("", []byte("evil")); err == nil {
		t.Errorf("expected writing to empty path/root to be rejected, got nil")
	}

	// 9. 双点前缀合法文件名测试 (非逃逸路径)
	dotDotFile := "..legit_config.json"
	validDotDot, err := sb.ValidatePath(dotDotFile)
	if err != nil {
		t.Errorf("legitimate file [%s] starting with .. was falsely rejected: %v", dotDotFile, err)
	}
	expectedDotDot := filepath.Clean(filepath.Join(tmpDir, dotDotFile))
	if validDotDot != expectedDotDot {
		t.Errorf("expected [%s], got [%s]", expectedDotDot, validDotDot)
	}

	// 10. ListDir 支持空路径和 "." 列出根目录测试
	entriesEmpty, err := sb.ListDir("")
	if err != nil {
		t.Errorf("ListDir(\"\") failed: %v", err)
	}
	entriesDot, err := sb.ListDir(".")
	if err != nil {
		t.Errorf("ListDir(\".\") failed: %v", err)
	}
	if len(entriesEmpty) != len(entriesDot) {
		t.Errorf("entries count mismatch between empty and dot: %d vs %d", len(entriesEmpty), len(entriesDot))
	}
}

