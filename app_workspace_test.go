package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

func TestApp_GetUsageMetrics_NilSessionStore(t *testing.T) {
	app := &App{
		sessionStore: nil,
	}
	// 验证 sessionStore 为 nil 时不会 panic
	metrics := app.GetUsageMetrics()
	if metrics.ActiveSessions != 0 {
		t.Errorf("expected 0 active sessions when sessionStore is nil, got %d", metrics.ActiveSessions)
	}
}

func TestApp_GitStagingAndCommit(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "tcode_git_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	runCmd := func(name string, args ...string) {
		cmd := exec.Command(name, args...)
		cmd.Dir = tmpDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("command failed: %s %v: %s", name, args, string(out))
		}
	}
	runCmd("git", "init")
	runCmd("git", "config", "user.name", "testuser")
	runCmd("git", "config", "user.email", "test@test.com")

	fileA := filepath.Join(tmpDir, "fileA.txt")
	fileB := filepath.Join(tmpDir, "fileB.txt")
	if err := os.WriteFile(fileA, []byte("hello A\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fileB, []byte("hello B\n"), 0644); err != nil {
		t.Fatal(err)
	}
	runCmd("git", "add", "-A")
	runCmd("git", "commit", "-m", "init commit")

	app := NewApp()
	if err := app.SetWorkspace(tmpDir); err != nil {
		t.Fatalf("SetWorkspace failed: %v", err)
	}

	// Modify fileA and fileB
	if err := os.WriteFile(fileA, []byte("modified A\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fileB, []byte("modified B\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// 1. Stage fileA using GitStage
	if err := app.GitStage("fileA.txt"); err != nil {
		t.Fatalf("GitStage fileA failed: %v", err)
	}

	// 2. Unstage fileA using GitUnstage, verify diff --cached is empty
	if err := app.GitUnstage("fileA.txt"); err != nil {
		t.Fatalf("GitUnstage fileA failed: %v", err)
	}
	diffCmd := exec.Command("git", "diff", "--cached", "--quiet")
	diffCmd.Dir = tmpDir
	if diffCmd.Run() != nil {
		t.Fatalf("expected staging area to be empty after GitUnstage")
	}

	// 3. Stage fileA again
	if err := app.GitStage("fileA.txt"); err != nil {
		t.Fatalf("GitStage fileA failed: %v", err)
	}

	// 4. Call GitCommit. Since fileA is staged and fileB is not, GitCommit should ONLY commit fileA!
	msg, err := app.GitCommit("feat: commit staged only")
	if err != nil {
		t.Fatalf("GitCommit failed: %v, output: %s", err, msg)
	}

	// Check git status: fileB should STILL be unstaged / modified in working tree!
	statusCmd := exec.Command("git", "status", "--porcelain")
	statusCmd.Dir = tmpDir
	statusOut, err := statusCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git status failed: %v", err)
	}
	statusStr := string(statusOut)
	if !strings.Contains(statusStr, "fileB.txt") {
		t.Errorf("expected fileB.txt to remain modified/unstaged in working tree, got status: %s", statusStr)
	}
	if strings.Contains(statusStr, "fileA.txt") {
		t.Errorf("expected fileA.txt to be committed and clean, got status: %s", statusStr)
	}
}

func TestApp_RevertFile_NoHeadRepo(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "tcode_no_head_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	runCmd := func(name string, args ...string) {
		cmd := exec.Command(name, args...)
		cmd.Dir = tmpDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("command %s %v failed: %s", name, args, string(out))
		}
	}
	runCmd("git", "init")
	runCmd("git", "config", "user.name", "testuser")
	runCmd("git", "config", "user.email", "test@test.com")

	app := NewApp()
	if err := app.SetWorkspace(tmpDir); err != nil {
		t.Fatalf("SetWorkspace failed: %v", err)
	}

	// 新建文件并暂存 (status = "A  test.txt")
	testFile := filepath.Join(tmpDir, "brand_new.txt")
	if err := os.WriteFile(testFile, []byte("brand new uncommitted\n"), 0644); err != nil {
		t.Fatal(err)
	}
	runCmd("git", "add", "brand_new.txt")

	// 撤销该暂存文件
	if err := app.RevertFile("brand_new.txt"); err != nil {
		t.Fatalf("RevertFile failed in repo without HEAD: %v", err)
	}

	// 验证文件已被清理
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Errorf("expected brand_new.txt to be removed after revert, but it still exists")
	}
}

func TestApp_GitUnstage_NoHeadRepo(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "tcode_unstage_nohead_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	runCmd := func(name string, args ...string) {
		cmd := exec.Command(name, args...)
		cmd.Dir = tmpDir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("command %s %v failed: %s", name, args, string(out))
		}
	}
	runCmd("git", "init")
	runCmd("git", "config", "user.name", "testuser")
	runCmd("git", "config", "user.email", "test@test.com")

	app := NewApp()
	if err := app.SetWorkspace(tmpDir); err != nil {
		t.Fatalf("SetWorkspace failed: %v", err)
	}

	testFile := filepath.Join(tmpDir, "unstage_test.txt")
	if err := os.WriteFile(testFile, []byte("content to unstage\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := app.GitStage("unstage_test.txt"); err != nil {
		t.Fatalf("GitStage failed: %v", err)
	}

	// 此时文件应处于已暂存状态 (A )
	statusCmd := exec.Command("git", "status", "--porcelain")
	statusCmd.Dir = tmpDir
	out, _ := statusCmd.CombinedOutput()
	if !strings.HasPrefix(string(out), "A") {
		t.Fatalf("expected file to be staged, got: %s", string(out))
	}

	// 取消暂存
	if err := app.GitUnstage("unstage_test.txt"); err != nil {
		t.Fatalf("GitUnstage failed in repo without HEAD: %v", err)
	}

	// 验证：文件应回到未追踪状态 (??)，且物理文件必须依然存在
	statusCmd2 := exec.Command("git", "status", "--porcelain")
	statusCmd2.Dir = tmpDir
	out2, _ := statusCmd2.CombinedOutput()
	if !strings.HasPrefix(string(out2), "??") {
		t.Errorf("expected file to be untracked (??) after unstage, got: %s", string(out2))
	}
	if _, err := os.Stat(testFile); err != nil {
		t.Errorf("expected physical file to still exist after unstage, got err: %v", err)
	}
}


