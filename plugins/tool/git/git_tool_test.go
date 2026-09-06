package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"testing"
)

func gitCmdDir(dir string, args ...string) *exec.Cmd {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	}
	return cmd
}

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

func TestGitTool_RestoreUntrackedFile(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get current wd: %v", err)
	}
	repoRoot := filepath.Dir(filepath.Dir(filepath.Dir(wd)))

	tool := NewTool(repoRoot)
	tempFile := "temp_git_restore_untracked.txt"
	absPath := filepath.Join(repoRoot, tempFile)
	_ = os.WriteFile(absPath, []byte("untracked file to restore"), 0644)
	defer os.Remove(absPath)

	err = tool.RestoreFile(tempFile)
	if err != nil {
		t.Fatalf("RestoreFile on untracked file failed: %v", err)
	}

	if _, err := os.Stat(absPath); !os.IsNotExist(err) {
		t.Errorf("expected untracked file to be removed after RestoreFile, but it still exists")
	}

	// 空路径防御
	if err := tool.RestoreFile("   "); err == nil {
		t.Errorf("expected error for empty file path, got nil")
	}
}

func TestGitTool_ParsePorcelainRenameWithSpaces(t *testing.T) {
	// 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><TAB><origPath>
	rawOutput := "2 R. N... 100644 100644 100644 a1b2c3d e4f5a6b R100 new folder/target file.go\told folder/source file.go"
	report := parsePorcelainV2(rawOutput, "main")

	if len(report.Staged) != 1 {
		t.Fatalf("expected 1 staged file, got %d", len(report.Staged))
	}
	staged := report.Staged[0]
	if staged.Path != "new folder/target file.go" {
		t.Errorf("expected staged.Path 'new folder/target file.go', got %q", staged.Path)
	}
	if staged.OrigPath != "old folder/source file.go" {
		t.Errorf("expected staged.OrigPath 'old folder/source file.go', got %q", staged.OrigPath)
	}
	if staged.StagedCode != "R" {
		t.Errorf("expected staged.StagedCode 'R', got %q", staged.StagedCode)
	}
}

func TestGitTool_RestoreFile_NoHeadRepo(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_git_tool_nohead_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 初始化一个没有 HEAD 提交的空仓库
	cmd := gitCmdDir(tempDir, "init")
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init failed: %v", err)
	}

	testFile := "nohead_staged.txt"
	absTestFile := filepath.Join(tempDir, testFile)
	if err := os.WriteFile(absTestFile, []byte("staged content in no-head repo"), 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// 暂存该文件
	addCmd := gitCmdDir(tempDir, "add", testFile)
	if err := addCmd.Run(); err != nil {
		t.Fatalf("git add failed: %v", err)
	}

	tool := NewTool(tempDir)
	// 期望在无 HEAD 仓库中恢复/撤销该已暂存文件不报错并成功清理
	if err := tool.RestoreFile(testFile); err != nil {
		t.Fatalf("RestoreFile failed on no-HEAD repo: %v", err)
	}

	if _, err := os.Stat(absTestFile); !os.IsNotExist(err) {
		t.Errorf("expected file to be removed after RestoreFile in no-head repo, but still exists")
	}
}


