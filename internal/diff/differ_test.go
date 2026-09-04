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
