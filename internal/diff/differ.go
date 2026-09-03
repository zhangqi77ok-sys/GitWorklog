package diff

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DiffLine struct {
	Type  string `json:"type"` // "add" | "del" | "ctx"
	Text  string `json:"text"`
	Label string `json:"label,omitempty"`
}

type DiffReport struct {
	FilePath string     `json:"file_path"`
	Lang     string     `json:"lang"`
	Stats    string     `json:"stats"`
	Header   string     `json:"header"`
	Lines    []DiffLine `json:"lines"`
}

// ComputeFileDiff 计算指定文件相对于 Git HEAD 的真实行级差异
func ComputeFileDiff(workspaceRoot, relPath string) (DiffReport, error) {
	report := DiffReport{
		FilePath: relPath,
		Lang:     detectLanguage(relPath),
		Stats:    "0 行变更",
		Header:   "@@ 文件差异对比 @@",
		Lines:    make([]DiffLine, 0),
	}

	absPath := filepath.Join(workspaceRoot, relPath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return report, fmt.Errorf("file [%s] does not exist", relPath)
	}

	cmd := exec.Command("git", "diff", "HEAD", "--", relPath)
	cmd.Dir = workspaceRoot
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	_ = cmd.Run()

	diffOut := strings.TrimSpace(stdout.String())
	if diffOut == "" {
		// 没有未提交差异，读取真实物理文件作为只读上下文展示
		content, err := os.ReadFile(absPath)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			for i, line := range lines {
				if i > 200 { // 限制初次加载行数防卡顿
					break
				}
				report.Lines = append(report.Lines, DiffLine{
					Type: "ctx",
					Text: fmt.Sprintf("%-4d  %s", i+1, line),
				})
			}
			report.Stats = fmt.Sprintf("未修改 · 共 %d 行", len(lines))
			report.Header = "@@ 工作区干净 (Clean) @@"
		}
		return report, nil
	}

	// 解析真实 git diff 输出
	rawLines := strings.Split(diffOut, "\n")
	addCount, delCount := 0, 0
	for _, l := range rawLines {
		if strings.HasPrefix(l, "diff ") || strings.HasPrefix(l, "index ") || strings.HasPrefix(l, "--- ") || strings.HasPrefix(l, "+++ ") {
			continue
		}
		if strings.HasPrefix(l, "@@") {
			report.Header = l
			continue
		}

		if strings.HasPrefix(l, "+") {
			addCount++
			report.Lines = append(report.Lines, DiffLine{
				Type:  "add",
				Text:  l,
				Label: "新增",
			})
		} else if strings.HasPrefix(l, "-") {
			delCount++
			report.Lines = append(report.Lines, DiffLine{
				Type:  "del",
				Text:  l,
				Label: "删除",
			})
		} else {
			report.Lines = append(report.Lines, DiffLine{
				Type: "ctx",
				Text: l,
			})
		}
	}

	report.Stats = fmt.Sprintf("%d 行新增 · %d 行删除", addCount, delCount)
	return report, nil
}

func detectLanguage(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".go":
		return "Go · UTF-8"
	case ".vue":
		return "Vue SFC · UTF-8"
	case ".ts":
		return "TypeScript · UTF-8"
	case ".js":
		return "JavaScript · UTF-8"
	case ".json":
		return "JSON · UTF-8"
	case ".md":
		return "Markdown · UTF-8"
	default:
		return "Plain Text · UTF-8"
	}
}
