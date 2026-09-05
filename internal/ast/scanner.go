package ast

import (
	"fmt"
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
		// 忽略隐藏目录与大型依赖产物目录
		if info.IsDir() {
			base := strings.ToLower(info.Name())
			if strings.HasPrefix(base, ".") || base == "node_modules" || base == "dist" || base == "bin" || base == "build" || base == "vendor" || base == "target" || base == "release" {
				return filepath.SkipDir
			}
			return nil
		}

		// 熔断保护: 达到 300 个拓扑节点即刻自然收敛，防止 DOM 渲染雪崩
		if len(nodes) >= 300 {
			return filepath.SkipAll
		}

		// 仅分析 .go 源码，且跳过单文件超过 512KB 的巨型文件
		if !strings.HasSuffix(path, ".go") || info.Size() > 512*1024 {
			return nil
		}

		rel, _ := filepath.Rel(rootDir, path)
		rel = filepath.ToSlash(rel)

		safeParse := func() (n *ast.File, err error) {
			defer func() {
				if r := recover(); r != nil {
					err = fmt.Errorf("ast parse panic: %v", r)
				}
			}()
			return parser.ParseFile(fset, path, nil, parser.ParseComments)
		}
		node, err := safeParse()
		if err != nil || node == nil {
			return nil
		}

		pkgName := "unknown"
		if node.Name != nil {
			pkgName = node.Name.Name
		}

		// 记录文件节点
		fileNode := GraphNode{
			ID:      rel,
			Name:    info.Name(),
			Type:    "file",
			File:    rel,
			Changes: 1,
			Details: "Package: " + pkgName,
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
