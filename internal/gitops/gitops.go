package gitops

import (
	"bytes"
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// gitCmd 创建配置好工作目录与隐蔽窗口参数的 git 命令
func gitCmd(workspace string, args ...string) *exec.Cmd {
	cmd := exec.Command("git", args...)
	cmd.Dir = workspace
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	}
	return cmd
}

// isValidBranchName 严格校验分支名合法性，防止注入参数、修订范围或非法控制字符
func isValidBranchName(name string) bool {
	if name == "" || name == "@" || strings.HasPrefix(name, "-") || strings.HasPrefix(name, "/") || strings.HasSuffix(name, "/") ||
		strings.HasSuffix(name, ".lock") || strings.Contains(name, "..") || strings.Contains(name, "//") ||
		strings.Contains(name, "\x00") || strings.ContainsAny(name, " \t\r\n~^:?*[\\]") {
		return false
	}
	return true
}

// Snapshot Git 临时快照实体 (基于 git stash)
type Snapshot struct {
	ID        string `json:"id"`
	Branch    string `json:"branch"`
	Message   string `json:"message"`
	Time      string `json:"time"`
	Timestamp int64  `json:"timestamp"`
}

// ListBranches 枚举全部本地 Git 分支，并返回当前活跃分支
func ListBranches(workspace string) ([]string, string, error) {
	cmd := gitCmd(workspace, "branch", "--list")
	out, err := cmd.Output()
	if err != nil {
		return []string{"main"}, "main", nil
	}

	lines := strings.Split(string(out), "\n")
	branches := make([]string, 0, len(lines))
	current := "main"

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "*") {
			name := strings.TrimSpace(strings.TrimPrefix(trimmed, "*"))
			current = name
			branches = append(branches, name)
		} else {
			branches = append(branches, trimmed)
		}
	}

	if len(branches) == 0 {
		branches = append(branches, "main")
	}

	return branches, current, nil
}

// isValidStashID 严格校验 stash ID 格式，形如 stash@{0}、stash@{12}
func isValidStashID(id string) bool {
	if !strings.HasPrefix(id, "stash@{") || !strings.HasSuffix(id, "}") {
		return false
	}
	numStr := strings.TrimSuffix(strings.TrimPrefix(id, "stash@{"), "}")
	if len(numStr) == 0 {
		return false
	}
	for _, c := range numStr {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// CheckoutBranch 真实检出指定分支 (严格参数隔离与合法性校验)
func CheckoutBranch(workspace, name string) error {
	name = strings.TrimSpace(name)
	if !isValidBranchName(name) {
		return fmt.Errorf("invalid branch name: %q", name)
	}
	cmd := gitCmd(workspace, "checkout", name)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout failed: %s (%w)", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// CreateBranch 基于当前 HEAD 创建并切换到新分支
func CreateBranch(workspace, name string) error {
	name = strings.TrimSpace(name)
	if !isValidBranchName(name) {
		return fmt.Errorf("invalid branch name: %q", name)
	}
	cmd := gitCmd(workspace, "checkout", "-b", name)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git create branch failed: %s (%w)", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// ListSnapshots 枚举历史检查点快照 (git stash)，读取真实历史时间戳
func ListSnapshots(workspace string) ([]Snapshot, error) {
	// 优先使用 git log 查询 refs/stash 获取真实创建时间戳 (%ct)
	cmdLog := gitCmd(workspace, "log", "-g", "--pretty=format:%gd|%ct|%gs", "refs/stash")
	if out, err := cmdLog.Output(); err == nil && len(bytes.TrimSpace(out)) > 0 {
		lines := strings.Split(string(out), "\n")
		res := make([]Snapshot, 0, len(lines))
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" {
				continue
			}
			parts := strings.SplitN(trimmed, "|", 3)
			if len(parts) < 3 {
				continue
			}
			stashID := strings.TrimSpace(parts[0])
			ts, _ := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
			desc := strings.TrimSpace(parts[2])

			branch := "main"
			msg := desc
			if strings.Contains(desc, ":") {
				subparts := strings.SplitN(desc, ":", 2)
				b := strings.TrimSpace(subparts[0])
				if strings.HasPrefix(b, "On ") {
					branch = strings.TrimSpace(strings.TrimPrefix(b, "On "))
				} else if strings.HasPrefix(b, "WIP on ") {
					branch = strings.TrimSpace(strings.TrimPrefix(b, "WIP on "))
				}
				msg = strings.TrimSpace(subparts[1])
			}

			tTime := time.Unix(ts, 0)
			res = append(res, Snapshot{
				ID:        stashID,
				Branch:    branch,
				Message:   msg,
				Time:      tTime.Format("15:04:05"),
				Timestamp: ts,
			})
		}
		return res, nil
	}

	// 降级使用 git stash list
	cmd := gitCmd(workspace, "stash", "list")
	out, err := cmd.Output()
	if err != nil {
		return []Snapshot{}, nil
	}

	lines := strings.Split(string(out), "\n")
	res := make([]Snapshot, 0, len(lines))

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		parts := strings.SplitN(trimmed, ":", 3)
		stashID := strings.TrimSpace(parts[0])
		branch := "main"
		msg := trimmed

		if len(parts) >= 2 {
			branch = strings.TrimSpace(strings.TrimPrefix(parts[1], " On "))
		}
		if len(parts) >= 3 {
			msg = strings.TrimSpace(parts[2])
		}

		res = append(res, Snapshot{
			ID:        stashID,
			Branch:    branch,
			Message:   msg,
			Time:      "",
			Timestamp: 0,
		})
	}

	return res, nil
}

// HasGitHead 检查当前工作区是否拥有有效的 HEAD 提交
func HasGitHead(workspace string) bool {
	cmd := gitCmd(workspace, "rev-parse", "--verify", "HEAD")
	return cmd.Run() == nil
}

// CreateSnapshot 创建当前状态快照并暂存
func CreateSnapshot(workspace, msg string) error {
	if !HasGitHead(workspace) {
		return fmt.Errorf("cannot create snapshot on repository without initial commit")
	}
	if msg == "" {
		msg = "tcode_auto_checkpoint_" + time.Now().Format("20060102_150405")
	}
	msg = strings.ReplaceAll(msg, "\n", " ")
	cmd := gitCmd(workspace, "stash", "push", "-m", msg, "--include-untracked")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash push failed: %s (%w)", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// RestoreSnapshot 应用并还原指定快照
func RestoreSnapshot(workspace, stashID string) error {
	stashID = strings.TrimSpace(stashID)
	isAllDigits := func(s string) bool {
		if len(s) == 0 {
			return false
		}
		for _, c := range s {
			if c < '0' || c > '9' {
				return false
			}
		}
		return true
	}
	if stashID == "" {
		stashID = "stash@{0}"
	} else if isAllDigits(stashID) {
		stashID = fmt.Sprintf("stash@{%s}", stashID)
	}
	if !isValidStashID(stashID) {
		return fmt.Errorf("invalid stash id: %q", stashID)
	}
	cmd := gitCmd(workspace, "stash", "apply", stashID)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash apply failed: %s (%w)", strings.TrimSpace(string(out)), err)
	}
	return nil
}
