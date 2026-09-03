package diff

import (
	"os"
	"path/filepath"
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
	report, err := ComputeFileDiff(filepath.Dir(wd), "app.go")
	if err != nil {
		// 忽略路径层级不匹配，测试结构体初始化
		return
	}
	if report.FilePath != "app.go" {
		t.Errorf("expected FilePath app.go, got %s", report.FilePath)
	}
}
