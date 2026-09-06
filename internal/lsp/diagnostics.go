package lsp

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// DiagnosticItem 单条编译器语法/类型错误诊断
type DiagnosticItem struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Severity string `json:"severity"` // "ERROR" | "WARNING"
	Code     string `json:"code,omitempty"`
	Message  string `json:"message"`
}

// DiagnosticReport 诊断汇总报告
type DiagnosticReport struct {
	Success    bool             `json:"success"`
	FilePath   string           `json:"file_path"`
	HasErrors  bool             `json:"has_errors"`
	ErrorCount int              `json:"error_count"`
	Errors     []DiagnosticItem `json:"errors"`
	RawOutput  string           `json:"raw_output,omitempty"`
}

var (
	// Go 错误输出正则: main.go:12:5: undefined: abc 或 main.go:12: syntax error: ...
	goErrRegex = regexp.MustCompile(`(?m)^(.+?\.go):(\d+)(?::(\d+))?:\s*(.+)$`)
	// TS 错误输出正则: src/foo.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
	tsErrRegex = regexp.MustCompile(`(?m)^(.+?\.[tj]sx?):(\d+):(\d+)\s*-\s*error\s*(TS\d+)?:\s*(.+)$`)
	// Python 语法错误正则: File "foo.py", line 12
	pyErrRegex = regexp.MustCompile(`(?m)File "(.+?)", line (\d+)(?:, in .+)?\n(?:\s+.*\n)*\s*(.+Error:\s*.+)`)
)

// DiagnoseFile 对指定工作区内的文件进行毫秒级轻量编译器语法诊断
func DiagnoseFile(workspace string, relPath string) (*DiagnosticReport, error) {
	if relPath == "" {
		return nil, fmt.Errorf("empty file path")
	}
	absPath := filepath.Join(workspace, relPath)
	cleanAbs, err := filepath.Abs(absPath)
	if err != nil {
		return nil, fmt.Errorf("invalid path: %w", err)
	}
	cleanWorkspace, err := filepath.Abs(workspace)
	if err != nil {
		return nil, fmt.Errorf("invalid workspace: %w", err)
	}
	normWorkspace := normalizeWindowsPath(cleanWorkspace)
	normAbs := normalizeWindowsPath(cleanAbs)
	rel, err := filepath.Rel(normWorkspace, normAbs)
	if err != nil || strings.HasPrefix(rel, "..") {
		return nil, fmt.Errorf("path escapes workspace sandbox: %s", relPath)
	}

	if _, err := os.Stat(cleanAbs); os.IsNotExist(err) {
		return nil, fmt.Errorf("file not found: %s", relPath)
	}

	ext := strings.ToLower(filepath.Ext(relPath))
	report := &DiagnosticReport{
		Success:    true,
		FilePath:   relPath,
		Errors:     make([]DiagnosticItem, 0),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	var rawErr string
	switch ext {
	case ".go":
		rawErr = runGoDiagnostics(ctx, workspace, relPath)
		report.Errors = parseGoErrors(rawErr, relPath)
	case ".ts", ".tsx", ".js":
		rawErr = runTSDiagnostics(ctx, workspace, relPath)
		report.Errors = parseTSErrors(rawErr, relPath)
	case ".py":
		rawErr = runPythonDiagnostics(ctx, workspace, absPath)
		report.Errors = parsePythonErrors(rawErr, relPath)
	default:
		// 其他语言暂不执行静态诊断
		return report, nil
	}

	report.RawOutput = rawErr
	report.ErrorCount = len(report.Errors)
	report.HasErrors = report.ErrorCount > 0
	return report, nil
}

// FormatDiagnosticFeedback 将诊断结果格式化为注入 ReAct 智能体自愈回路的标准提示语
func FormatDiagnosticFeedback(report *DiagnosticReport) string {
	if report == nil || !report.HasErrors {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("\n\n⚠️ 【⚡ 编译器实时语法诊断告警 (LSP Compiler Diagnostics)】\n")
	sb.WriteString("代码落盘后编译器检测到以下语法或类型错误：\n")

	limit := 5
	if len(report.Errors) < limit {
		limit = len(report.Errors)
	}

	for i := 0; i < limit; i++ {
		errItem := report.Errors[i]
		codeStr := errItem.Code
		if codeStr == "" {
			codeStr = "SYNTAX"
		}
		sb.WriteString(fmt.Sprintf("%d. [%s %s] %s (第 %d 行, 第 %d 列): %s\n",
			i+1, errItem.Severity, codeStr, errItem.File, errItem.Line, errItem.Column, errItem.Message))
	}

	if len(report.Errors) > limit {
		sb.WriteString(fmt.Sprintf("... 以及其余 %d 处错误\n", len(report.Errors)-limit))
	}
	sb.WriteString("⚠️ 严禁忽视上述编译器报错！请在进行下一步之前，优先修改代码消除上述编译错误。")
	return sb.String()
}

func setWindowsProcessAttr(cmd *exec.Cmd) {
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000, // 零黑框防护
		}
		cmd.Cancel = func() error {
			if cmd.Process != nil && cmd.Process.Pid > 0 {
				killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
				killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
				return killCmd.Run()
			}
			return nil
		}
	}
}

func runGoDiagnostics(ctx context.Context, workspace string, relPath string) string {
	dir := filepath.Dir(relPath)
	// 优先在同目录下执行 go vet
	cmd := exec.CommandContext(ctx, "go", "vet", "./"+filepath.ToSlash(dir))
	cmd.Dir = workspace
	setWindowsProcessAttr(cmd)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()
	return stderr.String()
}

func runTSDiagnostics(ctx context.Context, workspace string, relPath string) string {
	// 关键防护: 注入 --no-install 标志，若本地未安装 tsc 立即退出，严禁进入网络交互挂起；注入 -- 隔离参数
	cmd := exec.CommandContext(ctx, "npx", "--no-install", "tsc", "--noEmit", "--skipLibCheck", "--", relPath)
	cmd.Dir = workspace
	setWindowsProcessAttr(cmd)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	_ = cmd.Run()
	return out.String()
}

func runPythonDiagnostics(ctx context.Context, workspace string, absPath string) string {
	cmd := exec.CommandContext(ctx, "python", "-m", "py_compile", absPath)
	cmd.Dir = workspace
	setWindowsProcessAttr(cmd)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()
	return stderr.String()
}

func parseGoErrors(raw string, targetFile string) []DiagnosticItem {
	items := make([]DiagnosticItem, 0)
	matches := goErrRegex.FindAllStringSubmatch(raw, -1)
	for _, m := range matches {
		if len(m) < 5 {
			continue
		}
		file := filepath.Base(m[1])
		targetBase := filepath.Base(targetFile)
		// 优先匹配当前修改的文件
		if file != targetBase && !strings.Contains(m[1], targetBase) {
			continue
		}
		line, _ := strconv.Atoi(m[2])
		col := 0
		if m[3] != "" {
			col, _ = strconv.Atoi(m[3])
		}
		msg := strings.TrimSpace(m[4])
		items = append(items, DiagnosticItem{
			File:     targetFile,
			Line:     line,
			Column:   col,
			Severity: "ERROR",
			Code:     "GO_VET",
			Message:  msg,
		})
	}
	return items
}

func parseTSErrors(raw string, targetFile string) []DiagnosticItem {
	items := make([]DiagnosticItem, 0)
	matches := tsErrRegex.FindAllStringSubmatch(raw, -1)
	for _, m := range matches {
		if len(m) < 6 {
			continue
		}
		line, _ := strconv.Atoi(m[2])
		col, _ := strconv.Atoi(m[3])
		code := m[4]
		msg := strings.TrimSpace(m[5])
		items = append(items, DiagnosticItem{
			File:     targetFile,
			Line:     line,
			Column:   col,
			Severity: "ERROR",
			Code:     code,
			Message:  msg,
		})
	}
	return items
}

func parsePythonErrors(raw string, targetFile string) []DiagnosticItem {
	items := make([]DiagnosticItem, 0)
	matches := pyErrRegex.FindAllStringSubmatch(raw, -1)
	for _, m := range matches {
		if len(m) < 4 {
			continue
		}
		line, _ := strconv.Atoi(m[2])
		msg := strings.TrimSpace(m[3])
		items = append(items, DiagnosticItem{
			File:     targetFile,
			Line:     line,
			Column:   1,
			Severity: "ERROR",
			Code:     "PY_COMPILE",
			Message:  msg,
		})
	}
	return items
}

func normalizeWindowsPath(p string) string {
	vol := filepath.VolumeName(p)
	if len(vol) > 0 {
		return strings.ToUpper(vol) + p[len(vol):]
	}
	return p
}
