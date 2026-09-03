package sandbox

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Sandbox 文件物理受控沙箱
type Sandbox struct {
	rootDir string
}

// NewSandbox 构造沙箱实例
func NewSandbox(rootDir string) (*Sandbox, error) {
	abs, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve workspace root: %w", err)
	}
	clean := filepath.Clean(abs)
	return &Sandbox{rootDir: clean}, nil
}

// Root 获取工作区根目录
func (s *Sandbox) Root() string {
	return s.rootDir
}

// ValidatePath 严格校验目标路径是否越界
func (s *Sandbox) ValidatePath(targetPath string) (string, error) {
	var fullPath string
	if filepath.IsAbs(targetPath) {
		fullPath = filepath.Clean(targetPath)
	} else {
		fullPath = filepath.Clean(filepath.Join(s.rootDir, targetPath))
	}

	// 统一转为大写比较 Windows 盘符
	rel, err := filepath.Rel(s.rootDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || rel == ".." {
		return "", fmt.Errorf("SECURITY: path [%s] escapes sandbox root [%s]", targetPath, s.rootDir)
	}

	return fullPath, nil
}

// SafeReadFile 安全读取沙箱内文件
func (s *Sandbox) SafeReadFile(path string) ([]byte, error) {
	validated, err := s.ValidatePath(path)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(validated)
}

// AtomicWriteFile 原子写文件防撕裂
// 流程：写同级临时文件 ➔ file.Sync() 强制落盘 ➔ 关闭句柄 ➔ os.Rename 原子覆盖
func (s *Sandbox) AtomicWriteFile(path string, content []byte) error {
	validated, err := s.ValidatePath(path)
	if err != nil {
		return err
	}

	dir := filepath.Dir(validated)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory [%s]: %w", dir, err)
	}

	base := filepath.Base(validated)
	tmpFile, err := os.CreateTemp(dir, fmt.Sprintf(".%s.tcode_tmp_*", base))
	if err != nil {
		return fmt.Errorf("failed to create atomic temp file: %w", err)
	}
	tmpName := tmpFile.Name()

	// 确保发生错误时清理临时文件
	defer func() {
		if tmpFile != nil {
			_ = tmpFile.Close()
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmpFile.Write(content); err != nil {
		return fmt.Errorf("failed to write content to temp file: %w", err)
	}

	// 强制落盘刷新 OS 缓存区
	if err := tmpFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync temp file to disk: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp file: %w", err)
	}
	tmpFile = nil // 释放以便 Windows os.Rename 能获取文件独占权

	// 原子重命名替换原文件
	if err := os.Rename(tmpName, validated); err != nil {
		return fmt.Errorf("atomic rename failed: %w", err)
	}

	return nil
}

// ListDir 列出指定目录内容
func (s *Sandbox) ListDir(relPath string) ([]os.DirEntry, error) {
	validated, err := s.ValidatePath(relPath)
	if err != nil {
		return nil, err
	}
	return os.ReadDir(validated)
}
