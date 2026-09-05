package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// SessionMessage 单条消息记录
type SessionMessage struct {
	ID       string         `json:"id"`
	Role     string         `json:"role"` // "user" | "assistant"
	Content  string         `json:"content"`
	Thinking string         `json:"thinking,omitempty"`
	Tool     *ToolExecution  `json:"tool,omitempty"`
	Tools    []ToolExecution `json:"tools,omitempty"`
	Time     string          `json:"time"`
}

// ToolExecution 算子执行历史
type ToolExecution struct {
	Name   string `json:"name"`
	Args   any    `json:"args"`
	Output string `json:"output"`
}

// ChatSession 会话完整历史实体
type ChatSession struct {
	ID        string           `json:"id"`
	Title     string           `json:"title"`
	Model     string           `json:"model"`
	Tag       string           `json:"tag"`
	CreatedAt int64            `json:"created_at"`
	UpdatedAt int64            `json:"updated_at"`
	Messages  []SessionMessage `json:"messages"`
}

// SessionMeta 会话轻量摘要信息（供列表渲染）
type SessionMeta struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	Tag       string `json:"tag"`
	Time      string `json:"time"`
	Desc      string `json:"desc"`
	UpdatedAt int64  `json:"updated_at"`
}

// Store 会话本地磁盘管理器
type Store struct {
	mu      sync.RWMutex
	baseDir string
}

// NewStore 初始化会话存储，目录位于 ~/.tcode/sessions/
func NewStore() (*Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	dir := filepath.Join(home, ".tcode", "sessions")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create sessions dir failed: %w", err)
	}

	s := &Store{baseDir: dir}
	return s, nil
}

// List 列出所有已保存会话的轻量摘要
func (s *Store) List() []SessionMeta {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		return nil
	}

	metas := make([]SessionMeta, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !filepath.HasPrefix(entry.Name(), "sess_") && !filepath.HasPrefix(entry.Name(), "sess") {
			continue
		}
		if filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		filePath := filepath.Join(s.baseDir, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var sess ChatSession
		if err := json.Unmarshal(data, &sess); err == nil {
			desc := "对话已就绪"
			if len(sess.Messages) > 0 {
				last := sess.Messages[len(sess.Messages)-1]
				r := []rune(last.Content)
				if len(r) > 20 {
					desc = string(r[:20]) + "..."
				} else if len(r) > 0 {
					desc = string(r)
				}
			}

			metas = append(metas, SessionMeta{
				ID:        sess.ID,
				Title:     sess.Title,
				Model:     sess.Model,
				Tag:       sess.Tag,
				Time:      time.Unix(sess.UpdatedAt, 0).Format("15:04"),
				Desc:      desc,
				UpdatedAt: sess.UpdatedAt,
			})
		}
	}

	return metas
}

// Get 获取单条会话完整历史
func (s *Store) Get(id string) (*ChatSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.json", id))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("session [%s] not found: %w", id, err)
	}

	var sess ChatSession
	if err := json.Unmarshal(data, &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

// Save 物理持久化单条会话至本地磁盘
func (s *Store) Save(sess ChatSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess.UpdatedAt = time.Now().Unix()
	if sess.CreatedAt == 0 {
		sess.CreatedAt = sess.UpdatedAt
	}
	if sess.Tag == "" {
		sess.Tag = "核心架构"
	}

	data, err := json.MarshalIndent(sess, "", "  ")
	if err != nil {
		return err
	}

	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.json", sess.ID))
	return os.WriteFile(filePath, data, 0644)
}

// Delete 删除指定会话
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filePath := filepath.Join(s.baseDir, fmt.Sprintf("%s.json", id))
	return os.Remove(filePath)
}
