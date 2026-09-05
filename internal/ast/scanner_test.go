package ast

import (
	"os"
	"path/filepath"
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
