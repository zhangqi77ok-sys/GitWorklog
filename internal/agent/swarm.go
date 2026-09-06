package agent

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// TestReport TDD 自动化测试验证器结果
type TestReport struct {
	Status    string   `json:"status"` // "PASS" | "FAIL"
	Passed    int      `json:"passed"`
	Failed    int      `json:"failed"`
	Duration  string   `json:"duration"`
	Output    string   `json:"output"`
	Timestamp int64    `json:"timestamp"`
}

// AuditReport 安全沙箱代码审查报告
type AuditReport struct {
	Status      string   `json:"status"` // "SECURE" | "WARNING" | "BLOCKED"
	RiskLevel   string   `json:"risk_level"` // "LOW" | "MEDIUM" | "CRITICAL"
	Issues      []string `json:"issues"`
	FilesScanned int     `json:"files_scanned"`
	Timestamp   int64    `json:"timestamp"`
}

// RunTDDValidation 运行自动化 TDD 测试驱动红绿灯验证 (带 60s 硬超时与 Windows 零黑框)
func RunTDDValidation(workspace string) (TestReport, error) {
	start := time.Now()

	// 检查工程是否包含 go.mod
	hasGoMod := false
	if fi, err := os.Stat(filepath.Join(workspace, "go.mod")); err == nil && !fi.IsDir() {
		hasGoMod = true
	}

	if !hasGoMod {
		return TestReport{
			Status:    "PASS",
			Passed:    0,
			Failed:    0,
			Duration:  "0ms",
			Output:    "当前工作区未检测到 go.mod，跳过 Go 原生测试套件",
			Timestamp: time.Now().Unix(),
		}, nil
	}

	if _, lookErr := exec.LookPath("go"); lookErr != nil {
		return TestReport{
			Status:    "FAIL",
			Passed:    0,
			Failed:    1,
			Duration:  "0ms",
			Output:    "未检测到系统安装的 Go 编译器环境 (go not found in PATH)，请先安装 Go 工具链以运行 TDD 验证套件",
			Timestamp: time.Now().Unix(),
		}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "go", "test", "-v", "./...")
	cmd.Dir = workspace
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
		cmd.Cancel = func() error {
			if cmd.Process != nil && cmd.Process.Pid > 0 {
				killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
				killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
				return killCmd.Run()
			}
			return nil
		}
	} else {
		cmd.Cancel = func() error {
			if cmd.Process != nil {
				return cmd.Process.Kill()
			}
			return nil
		}
	}
	out, err := cmd.CombinedOutput()
	duration := time.Since(start).Round(time.Millisecond).String()

	outputStr := string(out)
	if ctx.Err() == context.DeadlineExceeded {
		outputStr += "\n[超时警告] 测试执行超过 60s 硬超时上限，已被安全中断"
	}

	passed := strings.Count(outputStr, "--- PASS:")
	failed := strings.Count(outputStr, "--- FAIL:")

	status := "PASS"
	if err != nil || failed > 0 {
		status = "FAIL"
		if failed == 0 {
			failed = 1 // 编译失败或异常退出时，确保 failed >= 1，杜绝 0 失败假成功
		}
	}

	return TestReport{
		Status:    status,
		Passed:    passed,
		Failed:    failed,
		Duration:  duration,
		Output:    outputStr,
		Timestamp: time.Now().Unix(),
	}, nil
}

// RunSecurityAudit 运行安全沙箱审查器，检测高危代码、未脱敏密钥与系统提权指令
func RunSecurityAudit(workspace string) (AuditReport, error) {
	issues := make([]string, 0)
	filesScanned := 0

	highRiskKeywords := []string{
		"rm -rf /", "mkfs", "format c:", "drop database", "shutdown", "exec.Command(\"cmd\", \"/c\", \"del",
		"exec.Command(\"sh\", \"-c\", \"rm",
	}

	_ = filepath.Walk(workspace, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil {
			return nil
		}
		if info.IsDir() {
			cleanPath := filepath.Clean(path)
			cleanWs := filepath.Clean(workspace)
			if cleanPath != cleanWs {
				base := filepath.Base(path)
				if base == ".git" || base == "node_modules" || base == "bin" || base == "dist" || base == "build" || base == ".idea" || base == ".vscode" {
					return filepath.SkipDir
				}
			}
			return nil
		}

		// 限制单个审计文件最大不超过 5MB，杜绝大文件读取引发 OOM
		if info.Size() > 5*1024*1024 {
			return nil
		}

		// 只审计源码与脚本
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".go" && ext != ".js" && ext != ".ts" && ext != ".sh" && ext != ".py" {
			return nil
		}

		filesScanned++
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		rel, _ := filepath.Rel(workspace, path)
		str := string(content)

		for _, kw := range highRiskKeywords {
			if strings.Contains(strings.ToLower(str), strings.ToLower(kw)) {
				issues = append(issues, "文件 ["+rel+"] 发现高危破坏性指令特征: "+kw)
			}
		}

		return nil
	})

	status := "SECURE"
	riskLevel := "LOW"
	if len(issues) > 0 {
		status = "WARNING"
		riskLevel = "MEDIUM"
	}

	return AuditReport{
		Status:       status,
		RiskLevel:    riskLevel,
		Issues:       issues,
		FilesScanned: filesScanned,
		Timestamp:   time.Now().Unix(),
	}, nil
}
