package ast

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// GraphNode 知识图谱实体节点
type GraphNode struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Type      string   `json:"type"` // "package", "struct", "interface", "file"
	File      string   `json:"file"`
	Changes   int      `json:"changes"`
	Details   string   `json:"details"`
	Children  []string `json:"children,omitempty"`
}

// ScanWorkspaceAST 真实扫描工作区 Go 源代码语法树并提取实体拓扑
func ScanWorkspaceAST(rootDir string) ([]GraphNode, error) {
	nodes := make([]GraphNode, 0)
	fset := token.NewFileSet()

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		// 忽略隐藏目录与 node_modules / dist / .git
		if info.IsDir() {
			base := info.Name()
			if strings.HasPrefix(base, ".") || base == "node_modules" || base == "dist" || base == "bin" {
				return filepath.SkipDir
			}
			return nil
		}

		// 仅分析 .go 源码
		if !strings.HasSuffix(path, ".go") {
			return nil
		}

		rel, _ := filepath.Rel(rootDir, path)
		rel = filepath.ToSlash(rel)

		node, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
		if err != nil {
			return nil
		}

		// 记录文件节点
		fileNode := GraphNode{
			ID:      rel,
			Name:    info.Name(),
			Type:    "file",
			File:    rel,
			Changes: 1,
			Details: "Package: " + node.Name.Name,
		}

		// 提取结构体与接口
		for _, decl := range node.Decls {
			genDecl, ok := decl.(*ast.GenDecl)
			if !ok {
				continue
			}
			for _, spec := range genDecl.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}

				typeName := typeSpec.Name.Name
				nodeType := "type"
				if _, ok := typeSpec.Type.(*ast.StructType); ok {
					nodeType = "struct"
				} else if _, ok := typeSpec.Type.(*ast.InterfaceType); ok {
					nodeType = "interface"
				}

				structNode := GraphNode{
					ID:      rel + "::" + typeName,
					Name:    typeName,
					Type:    nodeType,
					File:    rel,
					Changes: 1,
					Details: "定义于 " + rel,
				}
				fileNode.Children = append(fileNode.Children, structNode.ID)
				nodes = append(nodes, structNode)
			}
		}

		nodes = append(nodes, fileNode)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return nodes, nil
}
