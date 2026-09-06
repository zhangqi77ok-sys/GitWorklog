package ast

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanWorkspaceAST_Safe(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ast_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Write a valid Go file
	validCode := `package sample

type Service interface {
	Do() error
}

type MyService struct {
	Name string
}
`
	_ = os.WriteFile(filepath.Join(tempDir, "sample.go"), []byte(validCode), 0644)

	// Write a malformed Go file
	malformed := `package !!! syntax error !!!`
	_ = os.WriteFile(filepath.Join(tempDir, "bad.go"), []byte(malformed), 0644)

	nodes, err := ScanWorkspaceAST(tempDir)
	if err != nil {
		t.Fatalf("ScanWorkspaceAST returned unexpected error: %v", err)
	}

	foundSample := false
	for _, n := range nodes {
		if n.Name == "sample.go" {
			foundSample = true
			break
		}
	}
	if !foundSample {
		t.Errorf("expected sample.go node to be found in AST")
	}
}

func TestScanWorkspaceAST_WindowsDriveNormalization(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "ast_drive_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	validCode := `package hello
type Greeter struct {}`
	_ = os.WriteFile(filepath.Join(tempDir, "hello.go"), []byte(validCode), 0644)

	vol := filepath.VolumeName(tempDir)
	var testDir = tempDir
	if vol != "" {
		// 切换盘符大小写
		lowerVol := strings.ToLower(vol)
		testDir = lowerVol + tempDir[len(vol):]
	}

	nodes, err := ScanWorkspaceAST(testDir)
	if err != nil {
		t.Fatalf("ScanWorkspaceAST with drive case variation failed: %v", err)
	}
	if len(nodes) == 0 {
		t.Fatalf("expected at least 1 node, got 0")
	}
}
