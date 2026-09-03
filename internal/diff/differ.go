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

type DiffHunk struct {
	Index    int        `json:"index"`
	Header   string     `json:"header"`
	Lines    []DiffLine `json:"lines"`
	AddCount int        `json:"add_count"`
	DelCount int        `json:"del_count"`
	RawPatch string     `json:"raw_patch"`
}

type DiffReport struct {
	FilePath string     `json:"file_path"`
	Lang     string     `json:"lang"`
	Stats    string     `json:"stats"`
	Header   string     `json:"header"`
	Lines    []DiffLine `json:"lines"`
	Hunks    []DiffHunk `json:"hunks"`
}

// ComputeFileDiff 计算指定文件相对于 Git HEAD 的真实行级差异，并分块 (Hunks) 提取
func ComputeFileDiff(workspaceRoot, relPath string) (DiffReport, error) {
	report := DiffReport{
		FilePath: relPath,
		Lang:     detectLanguage(relPath),
		Stats:    "0 行变更",
		Header:   "@@ 文件差异对比 @@",
		Lines:    make([]DiffLine, 0),
		Hunks:    make([]DiffHunk, 0),
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
		content, err := os.ReadFile(absPath)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			for i, line := range lines {
				if i > 200 {
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

	rawLines := strings.Split(diffOut, "\n")
	addCount, delCount := 0, 0

	var currentHunk *DiffHunk
	var hunkRawLines []string
	cleanRelPath := filepath.ToSlash(relPath)

	for _, l := range rawLines {
		if strings.HasPrefix(l, "diff ") || strings.HasPrefix(l, "index ") || strings.HasPrefix(l, "--- ") || strings.HasPrefix(l, "+++ ") {
			continue
		}

		if strings.HasPrefix(l, "@@") {
			if currentHunk != nil {
				currentHunk.RawPatch = buildUnifiedPatch(cleanRelPath, currentHunk.Header, hunkRawLines)
				report.Hunks = append(report.Hunks, *currentHunk)
			}
			report.Header = l
			hunkRawLines = []string{}
			currentHunk = &DiffHunk{
				Index:    len(report.Hunks),
				Header:   l,
				Lines:    make([]DiffLine, 0),
				AddCount: 0,
				DelCount: 0,
			}
			continue
		}

		hunkRawLines = append(hunkRawLines, l)

		if strings.HasPrefix(l, "+") {
			addCount++
			dl := DiffLine{Type: "add", Text: l, Label: "新增"}
			report.Lines = append(report.Lines, dl)
			if currentHunk != nil {
				currentHunk.AddCount++
				currentHunk.Lines = append(currentHunk.Lines, dl)
			}
		} else if strings.HasPrefix(l, "-") {
			delCount++
			dl := DiffLine{Type: "del", Text: l, Label: "删除"}
			report.Lines = append(report.Lines, dl)
			if currentHunk != nil {
				currentHunk.DelCount++
				currentHunk.Lines = append(currentHunk.Lines, dl)
			}
		} else {
			dl := DiffLine{Type: "ctx", Text: l}
			report.Lines = append(report.Lines, dl)
			if currentHunk != nil {
				currentHunk.Lines = append(currentHunk.Lines, dl)
			}
		}
	}

	if currentHunk != nil {
		currentHunk.RawPatch = buildUnifiedPatch(cleanRelPath, currentHunk.Header, hunkRawLines)
		report.Hunks = append(report.Hunks, *currentHunk)
	}

	report.Stats = fmt.Sprintf("%d 行新增 · %d 行删除", addCount, delCount)
	return report, nil
}

func buildUnifiedPatch(relPath, header string, hunkLines []string) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("--- a/%s\n", relPath))
	b.WriteString(fmt.Sprintf("+++ b/%s\n", relPath))
	b.WriteString(header + "\n")
	for _, l := range hunkLines {
		b.WriteString(l + "\n")
	}
	return b.String()
}

// ApplyHunkPatch 采纳并应用单个代码块补丁
func ApplyHunkPatch(workspaceRoot, relPath string, hunkIndex int, stageOnly bool) error {
	report, err := ComputeFileDiff(workspaceRoot, relPath)
	if err != nil {
		return err
	}
	if hunkIndex < 0 || hunkIndex >= len(report.Hunks) {
		return fmt.Errorf("invalid hunk index %d (total: %d)", hunkIndex, len(report.Hunks))
	}

	patch := report.Hunks[hunkIndex].RawPatch
	args := []string{"apply", "--whitespace=nowarn"}
	if stageOnly {
		args = append(args, "--cached")
	}
	args = append(args, "-")

	cmd := exec.Command("git", args...)
	cmd.Dir = workspaceRoot
	cmd.Stdin = strings.NewReader(patch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply failed: %s (patch: %s)", string(out), patch)
	}
	return nil
}

// DiscardHunkPatch 丢弃并物理还原单个代码块改动
func DiscardHunkPatch(workspaceRoot, relPath string, hunkIndex int) error {
	report, err := ComputeFileDiff(workspaceRoot, relPath)
	if err != nil {
		return err
	}
	if hunkIndex < 0 || hunkIndex >= len(report.Hunks) {
		return fmt.Errorf("invalid hunk index %d (total: %d)", hunkIndex, len(report.Hunks))
	}

	patch := report.Hunks[hunkIndex].RawPatch
	cmd := exec.Command("git", "apply", "--reverse", "--whitespace=nowarn", "-")
	cmd.Dir = workspaceRoot
	cmd.Stdin = strings.NewReader(patch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply --reverse failed: %s", string(out))
	}
	return nil
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
