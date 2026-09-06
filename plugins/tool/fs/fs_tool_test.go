package fs

import (
	"context"
	"encoding/json"
	"strings"
	"tcode/internal/core/sandbox"
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

func TestFSTool_ParameterAliases(t *testing.T) {
	tempDir := t.TempDir()
	sb, err := sandbox.NewSandbox(tempDir)
	if err != nil {
		t.Fatalf("failed to create sandbox: %v", err)
	}
	sm := sandbox.NewSnapshotManager(tempDir)
	tool := NewTool(sb, sm)

	// 1. 使用 rel_path 别名写入文件
	writeArgs, _ := json.Marshal(map[string]string{
		"action":   "write",
		"rel_path": "alias_test.txt",
		"content":  "hello alias",
	})
	resWrite, err := tool.Execute(context.Background(), writeArgs)
	if err != nil || resWrite.IsError {
		t.Fatalf("write with rel_path failed: %v, content: %s", err, resWrite.Content)
	}

	// 2. 使用 file_path 别名读取文件
	readArgs, _ := json.Marshal(map[string]string{
		"action":    "read",
		"file_path": "alias_test.txt",
	})
	resRead, err := tool.Execute(context.Background(), readArgs)
	if err != nil || resRead.IsError {
		t.Fatalf("read with file_path failed: %v, content: %s", err, resRead.Content)
	}
	if resRead.Content != "hello alias" {
		t.Errorf("expected 'hello alias', got: %s", resRead.Content)
	}

	// 3. 空路径防御
	emptyArgs, _ := json.Marshal(map[string]string{
		"action": "read",
		"path":   "   ",
	})
	resEmpty, err := tool.Execute(context.Background(), emptyArgs)
	if err != nil || !resEmpty.IsError {
		t.Errorf("expected IsError=true for empty path, got: %+v", resEmpty)
	}
}

func TestFSTool_CaseInsensitiveAction(t *testing.T) {
	tempDir := t.TempDir()
	sb, err := sandbox.NewSandbox(tempDir)
	if err != nil {
		t.Fatalf("failed to create sandbox: %v", err)
	}
	sm := sandbox.NewSnapshotManager(tempDir)
	tool := NewTool(sb, sm)

	// 测试大写 "WRITE"
	writeArgs, _ := json.Marshal(map[string]string{
		"action":  "WRITE",
		"path":    "case_test.txt",
		"content": "case insensitive content",
	})
	resWrite, err := tool.Execute(context.Background(), writeArgs)
	if err != nil || resWrite.IsError {
		t.Fatalf("write with uppercase action failed: %v, content: %s", err, resWrite.Content)
	}

	// 测试首字母大写 "Read"
	readArgs, _ := json.Marshal(map[string]string{
		"action": "Read",
		"path":   "case_test.txt",
	})
	resRead, err := tool.Execute(context.Background(), readArgs)
	if err != nil || resRead.IsError {
		t.Fatalf("read with titlecase action failed: %v, content: %s", err, resRead.Content)
	}
	if resRead.Content != "case insensitive content" {
		t.Errorf("expected 'case insensitive content', got: %s", resRead.Content)
	}
}

func TestFSTool_ListEmptyPath(t *testing.T) {
	tempDir := t.TempDir()
	sb, err := sandbox.NewSandbox(tempDir)
	if err != nil {
		t.Fatalf("failed to create sandbox: %v", err)
	}
	sm := sandbox.NewSnapshotManager(tempDir)
	tool := NewTool(sb, sm)

	_ = sb.AtomicWriteFile("sample.txt", []byte("hello"))

	listArgs, _ := json.Marshal(map[string]string{
		"action": "list",
	})
	resList, err := tool.Execute(context.Background(), listArgs)
	if err != nil || resList.IsError {
		t.Fatalf("list with empty path failed: %v, content: %s", err, resList.Content)
	}
	if !strings.Contains(resList.Content, "sample.txt") {
		t.Errorf("expected sample.txt in list output, got: %s", resList.Content)
	}
}

