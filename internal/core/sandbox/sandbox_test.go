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
}
