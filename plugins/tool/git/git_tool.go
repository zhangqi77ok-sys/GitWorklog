package git

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	v1 "tcode/pkg/plugin/v1"
)

// GitFileStatus 单文件状态
type GitFileStatus struct {
	Path       string `json:"path"`
	OrigPath   string `json:"orig_path,omitempty"`
	StagedCode string `json:"staged_code"`  // "M", "A", "D" 或 ""
	WorkCode   string `json:"work_code"`    // "M", "D", "?" 或 ""
}

// GitStatusReport 完整状态报表
type GitStatusReport struct {
	Branch       string          `json:"branch"`
	Staged       []GitFileStatus `json:"staged"`
	Working      []GitFileStatus `json:"working"`
	Untracked    []string        `json:"untracked"`
}

// Tool Git 物理受控算子插件
type Tool struct {
	id      string
	name    string
	version string
	rootDir string
}

// NewTool 构造实例
func NewTool(rootDir string) *Tool {
	return &Tool{
		id:      "tool.git",
		name:    "Git Source Control Tool",
		version: "1.0.0",
		rootDir: rootDir,
	}
}

func (t *Tool) ID() string             { return t.id }
func (t *Tool) Name() string           { return t.name }
func (t *Tool) Version() string        { return t.version }
func (t *Tool) Type() v1.PluginType    { return v1.TypeTool }
func (t *Tool) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (t *Tool) Start(ctx context.Context) error { return nil }
func (t *Tool) Stop(ctx context.Context) error  { return nil }
func (t *Tool) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true, Message: "Git tool ready"}
}

func (t *Tool) Definition() v1.ToolDefinition {
	return v1.ToolDefinition{
		Name:        "git_control",
		Description: "查询并管理工作区的物理 Git 暂存与分支状态",
	}
}

func (t *Tool) execGit(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = t.rootDir
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s error: %v (stderr: %s)", strings.Join(args, " "), err, stderr.String())
	}

	return strings.TrimSpace(stdout.String()), nil
}

// GetStatus 获取精准的双层暂存状态
func (t *Tool) GetStatus() (*GitStatusReport, error) {
	branch, _ := t.execGit("branch", "--show-current")
	if branch == "" {
		branch = "main"
	}

	rawStatus, err := t.execGit("status", "--porcelain=v2")
	if err != nil {
		return nil, err
	}

	return parsePorcelainV2(rawStatus, branch), nil
}

// parsePorcelainV2 解析 git status --porcelain=v2 格式输出并防御带空格的文件路径
func parsePorcelainV2(rawStatus, branch string) *GitStatusReport {
	report := &GitStatusReport{
		Branch:    branch,
		Staged:    make([]GitFileStatus, 0),
		Working:   make([]GitFileStatus, 0),
		Untracked: make([]string, 0),
	}

	lines := strings.Split(rawStatus, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) == 0 {
			continue
		}

		switch parts[0] {
		case "1": // 普通更改: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path...>
			if len(parts) >= 9 {
				stagedCode := string(parts[1][0])
				workCode := string(parts[1][1])
				// 防御文件名含空格: 将索引 8 之后全部字段拼接恢复真实路径
				filePath := strings.Join(parts[8:], " ")

				if stagedCode != "." {
					report.Staged = append(report.Staged, GitFileStatus{
						Path:       filePath,
						StagedCode: stagedCode,
					})
				}
				if workCode != "." {
					report.Working = append(report.Working, GitFileStatus{
						Path:     filePath,
						WorkCode: workCode,
					})
				}
			}
		case "2": // 重命名文件: 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><TAB><origPath>
			if len(parts) >= 10 {
				stagedCode := string(parts[1][0])
				workCode := string(parts[1][1])
				pathPart := strings.Join(parts[8:], " ")
				subParts := strings.Split(pathPart, "\t")
				origPath := parts[8]
				filePath := parts[9]
				if len(subParts) >= 2 {
					origPath = subParts[0]
					filePath = subParts[1]
				}

				if stagedCode != "." {
					report.Staged = append(report.Staged, GitFileStatus{
						Path:       filePath,
						OrigPath:   origPath,
						StagedCode: stagedCode,
					})
				}
				if workCode != "." {
					report.Working = append(report.Working, GitFileStatus{
						Path:     filePath,
						WorkCode: workCode,
					})
				}
			}
		case "?": // 未跟踪文件: ? <path...>
			if len(parts) >= 2 {
				filePath := strings.Join(parts[1:], " ")
				report.Untracked = append(report.Untracked, filePath)
				report.Working = append(report.Working, GitFileStatus{
					Path:     filePath,
					WorkCode: "U",
				})
			}
		}
	}

	return report
}

// StageFile 暂存单个文件
func (t *Tool) StageFile(filePath string) error {
	_, err := t.execGit("add", "--", filePath)
	return err
}

// UnstageFile 取消暂存单个文件
func (t *Tool) UnstageFile(filePath string) error {
	_, err := t.execGit("restore", "--staged", "--", filePath)
	return err
}

// RestoreFile 放弃工作区更改
func (t *Tool) RestoreFile(filePath string) error {
	trimmed := strings.TrimSpace(filePath)
	if trimmed == "" {
		return fmt.Errorf("empty file path")
	}
	_, err := t.execGit("restore", "--", trimmed)
	if err != nil {
		// 如果是未追踪新文件，git restore 会报错：error: pathspec '...' did not match any file(s) known to git
		// 安全回退：如果在仓库沙箱内且属于未追踪文件，物理移除该文件
		absPath := filepath.Join(t.rootDir, trimmed)
		cleanAbs, absErr := filepath.Abs(absPath)
		cleanRepo, repoErr := filepath.Abs(t.rootDir)
		if absErr == nil && repoErr == nil {
			volRepo := filepath.VolumeName(cleanRepo)
			normRepo := strings.ToUpper(volRepo) + cleanRepo[len(volRepo):]
			volAbs := filepath.VolumeName(cleanAbs)
			normAbs := strings.ToUpper(volAbs) + cleanAbs[len(volAbs):]
			rel, relErr := filepath.Rel(normRepo, normAbs)
			if relErr == nil && !strings.HasPrefix(rel, "..") {
				if fi, statErr := os.Stat(cleanAbs); statErr == nil && !fi.IsDir() {
					if rmErr := os.Remove(cleanAbs); rmErr == nil || os.IsNotExist(rmErr) {
						return nil
					}
				}
			}
		}
	}
	return err
}

func (t *Tool) Execute(ctx context.Context, rawArgs json.RawMessage) (*v1.ToolResult, error) {
	status, err := t.GetStatus()
	if err != nil {
		return &v1.ToolResult{Content: fmt.Sprintf("git status error: %v", err), IsError: true}, nil
	}
	bytesOut, _ := json.Marshal(status)
	return &v1.ToolResult{Content: string(bytesOut), IsError: false}, nil
}
