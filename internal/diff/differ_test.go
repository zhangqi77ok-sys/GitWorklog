package diff

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestComputeFileDiff_DetectLanguage(t *testing.T) {
	cases := map[string]string{
		"main.go":       "Go · UTF-8",
		"App.vue":       "Vue SFC · UTF-8",
		"index.ts":      "TypeScript · UTF-8",
		"package.json":  "JSON · UTF-8",
		"README.md":     "Markdown · UTF-8",
		"script.sh":     "Plain Text · UTF-8",
	}

	for f, expected := range cases {
		lang := detectLanguage(f)
		if lang != expected {
			t.Errorf("file %s expected %s, got %s", f, expected, lang)
		}
	}
}

func TestComputeFileDiff_CleanFile(t *testing.T) {
	wd, _ := os.Getwd()
	// app.go 在 git 仓库根目录下
	report, err := ComputeFileDiff(filepath.Dir(filepath.Dir(wd)), "app.go")
	if err != nil {
		return
	}
	if report.FilePath != "app.go" {
		t.Errorf("expected FilePath app.go, got %s", report.FilePath)
	}
}

func TestBuildUnifiedPatch(t *testing.T) {
	relPath := "main.go"
	header := "@@ -10,3 +10,4 @@"
	lines := []string{
		" func main() {",
		"+    println(\"hello\")",
		" }",
	}

	patch := buildUnifiedPatch(relPath, header, lines)
	if !strings.Contains(patch, "--- a/main.go") {
		t.Errorf("patch missing '--- a/main.go'")
	}
	if !strings.Contains(patch, "+++ b/main.go") {
		t.Errorf("patch missing '+++ b/main.go'")
	}
	if !strings.Contains(patch, "+    println(\"hello\")") {
		t.Errorf("patch missing added line")
	}
}

func TestComputeFileDiff_UntrackedFile(t *testing.T) {
	wd, _ := os.Getwd()
	repoRoot := filepath.Dir(filepath.Dir(wd))

	tempFileName := "temp_untracked_test_file.txt"
	absPath := filepath.Join(repoRoot, tempFileName)
	_ = os.WriteFile(absPath, []byte("line1\nline2\nline3"), 0644)
	defer os.Remove(absPath)

	report, err := ComputeFileDiff(repoRoot, tempFileName)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(report.Lines) != 3 {
		t.Errorf("expected 3 lines, got %d", len(report.Lines))
	}
	if len(report.Hunks) != 1 {
		t.Errorf("expected 1 hunk, got %d", len(report.Hunks))
	}
	for i, l := range report.Lines {
		if l.Type != "add" {
			t.Errorf("line %d expected type add, got %s", i, l.Type)
		}
	}
	if !strings.Contains(report.Stats, "新文件") {
		t.Errorf("expected stats to contain 新文件, got %s", report.Stats)
	}
}

func TestComputeFileDiff_PathTraversal(t *testing.T) {
	wd, _ := os.Getwd()
	repoRoot := filepath.Dir(filepath.Dir(wd))

	maliciousPaths := []string{
		"../outside.txt",
		"../../windows/system32/cmd.exe",
		"..\\outside.txt",
		"",
	}

	for _, p := range maliciousPaths {
		_, err := ComputeFileDiff(repoRoot, p)
		if err == nil {
			t.Errorf("expected path traversal error for [%s], but got nil", p)
		}
	}
}

func TestValidateRelPath_LeadingSlash(t *testing.T) {
	wd, _ := os.Getwd()
	repoRoot := filepath.Dir(filepath.Dir(wd))

	// 带前导斜杠的文件路径应当能正常通过校验，不报逃逸
	p, err := validateRelPath(repoRoot, "/app.go")
	if err != nil {
		t.Fatalf("expected /app.go to pass validation, got err: %v", err)
	}
	expected := filepath.Join(repoRoot, "app.go")
	if !strings.EqualFold(p, expected) {
		t.Errorf("expected %s, got %s", expected, p)
	}
}

func TestDiscardHunkPatch_UntrackedFile(t *testing.T) {
	wd, _ := os.Getwd()
	repoRoot := filepath.Dir(filepath.Dir(wd))

	tempFileName := "temp_untracked_discard_test.txt"
	absPath := filepath.Join(repoRoot, tempFileName)
	_ = os.WriteFile(absPath, []byte("discard this untracked line 1\nline 2"), 0644)
	defer os.Remove(absPath)

	err := DiscardHunkPatch(repoRoot, tempFileName, 0)
	if err != nil {
		t.Fatalf("DiscardHunkPatch failed on untracked file: %v", err)
	}

	// 验证文件已被安全物理清理
	if _, err := os.Stat(absPath); !os.IsNotExist(err) {
		t.Errorf("expected untracked file to be removed after discarding hunk, but it still exists")
	}
}

