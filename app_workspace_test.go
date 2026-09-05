package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestApp_SetAndGetWorkspace(t *testing.T) {
	app := NewApp()
	initWd := app.GetWorkspace()
	if initWd == "" {
		t.Fatalf("expected non-empty initial workspace")
	}

	// 创建临时测试目录
	tmpDir, err := os.MkdirTemp("", "tcode_test_workspace_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 切换到临时目录
	err = app.SetWorkspace(tmpDir)
	if err != nil {
		t.Fatalf("SetWorkspace failed: %v", err)
	}

	gotWd := app.GetWorkspace()
	expectedWd, _ := filepath.Abs(tmpDir)
	expectedWd = filepath.ToSlash(expectedWd)
	if gotWd != expectedWd {
		t.Errorf("GetWorkspace() = %s, expected %s", gotWd, expectedWd)
	}

	// 测试设置非法路径
	err = app.SetWorkspace("")
	if err == nil {
		t.Errorf("expected error when setting empty workspace, got nil")
	}

	nonExistent := filepath.Join(tmpDir, "does_not_exist_sub_dir")
	err = app.SetWorkspace(nonExistent)
	if err == nil {
		t.Errorf("expected error when setting non-existent workspace, got nil")
	}
}
