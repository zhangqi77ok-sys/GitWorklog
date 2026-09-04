package sandbox

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDetectProjectStack_CurrentWorkspace(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Skip("cannot get working dir")
	}

	// 找到项目根目录 (包含 go.mod)
	root := wd
	for {
		if _, err := os.Stat(filepath.Join(root, "go.mod")); err == nil {
			break
		}
		parent := filepath.Dir(root)
		if parent == root {
			break
		}
		root = parent
	}

	info := DetectProjectStack(root)
	if !strings.Contains(info.PrimaryLanguage, "Go") {
		t.Fatalf("expected project language to contain Go, got: %s", info.PrimaryLanguage)
	}
	if info.BuildTool != "go" {
		t.Fatalf("expected build tool go, got: %s", info.BuildTool)
	}
	if info.TestCommand != "go test ./..." {
		t.Fatalf("expected test command 'go test ./...', got: %s", info.TestCommand)
	}

	prompt := FormatStackPrompt(info)
	if !strings.Contains(prompt, "工作区技术栈自适应环境感知") {
		t.Fatalf("expected prompt to contain header, got: %s", prompt)
	}
}

func TestDetectProjectStack_MockNode(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mock_node_proj")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	pkgJSON := `{
		"name": "my-vue-app",
		"scripts": {
			"test": "vitest",
			"build": "vite build"
		},
		"dependencies": {
			"vue": "^3.4.0"
		},
		"devDependencies": {
			"vite": "^5.0.0"
		}
	}`
	_ = os.WriteFile(filepath.Join(tempDir, "package.json"), []byte(pkgJSON), 0644)

	info := DetectProjectStack(tempDir)
	if info.PrimaryLanguage != "TypeScript/JavaScript" {
		t.Fatalf("expected TypeScript/JavaScript, got: %s", info.PrimaryLanguage)
	}
	if info.Framework != "Vue 3" {
		t.Fatalf("expected Vue 3, got: %s", info.Framework)
	}
	if info.BuildTool != "vite" {
		t.Fatalf("expected vite, got: %s", info.BuildTool)
	}
	if info.TestCommand != "npm test" {
		t.Fatalf("expected npm test, got: %s", info.TestCommand)
	}
}
