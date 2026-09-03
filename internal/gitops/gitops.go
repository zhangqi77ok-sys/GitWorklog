package gitops

import (
	"os/exec"
	"strings"
	"time"
)

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
	cmd := exec.Command("git", "branch", "--list")
	cmd.Dir = workspace
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

// CheckoutBranch 真实检出指定分支
func CheckoutBranch(workspace, name string) error {
	cmd := exec.Command("git", "checkout", name)
	cmd.Dir = workspace
	return cmd.Run()
}

// CreateBranch 基于当前 HEAD 创建并切换到新分支
func CreateBranch(workspace, name string) error {
	cmd := exec.Command("git", "checkout", "-b", name)
	cmd.Dir = workspace
	return cmd.Run()
}

// ListSnapshots 枚举历史检查点快照 (git stash)
func ListSnapshots(workspace string) ([]Snapshot, error) {
	cmd := exec.Command("git", "stash", "list")
	cmd.Dir = workspace
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
			Time:      time.Now().Format("15:04:05"),
			Timestamp: time.Now().Unix(),
		})
	}

	return res, nil
}

// CreateSnapshot 创建当前状态快照并暂存
func CreateSnapshot(workspace, msg string) error {
	if msg == "" {
		msg = "tcode_auto_checkpoint_" + time.Now().Format("20060102_150405")
	}
	cmd := exec.Command("git", "stash", "push", "-m", msg, "--include-untracked")
	cmd.Dir = workspace
	return cmd.Run()
}

// RestoreSnapshot 应用并还原指定快照
func RestoreSnapshot(workspace, stashID string) error {
	if stashID == "" {
		stashID = "stash@{0}"
	}
	cmd := exec.Command("git", "stash", "apply", stashID)
	cmd.Dir = workspace
	return cmd.Run()
}
