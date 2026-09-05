package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ChannelConfig 真实的渠道配置结构体
type ChannelConfig struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Primary   bool   `json:"primary"`
	Status    string `json:"status"`    // "online", "standby", "error"
	AuthType  string `json:"auth_type"` // "codex_session", "sub2_relay", "bearer_token"
	Endpoint  string `json:"endpoint"`
	APIKey    string `json:"api_key,omitempty"`
	Model     string `json:"model"`
	Latency   string `json:"latency"` // e.g. "85ms"
	UpdatedAt int64  `json:"updated_at"`
}

// ChannelStore 真实的渠道磁盘存储管理器
type ChannelStore struct {
	mu       sync.RWMutex
	filePath string
	channels []ChannelConfig
}

// NewChannelStore 实例化存储，默认保存在用户主目录 ~/.tcode/channels.json
func NewChannelStore() (*ChannelStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	dir := filepath.Join(home, ".tcode")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("cannot create config dir [%s]: %w", dir, err)
	}

	store := &ChannelStore{
		filePath: filepath.Join(dir, "channels.json"),
		channels: make([]ChannelConfig, 0),
	}

	_ = store.load()
	return store, nil
}

func (s *ChannelStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var list []ChannelConfig
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}

	s.channels = list
	return nil
}

func (s *ChannelStore) save() error {
	data, err := json.MarshalIndent(s.channels, "", "  ")
	if err != nil {
		return err
	}
	return atomicWriteConfig(s.filePath, data)
}

// List 获取全部渠道列表
func (s *ChannelStore) List() []ChannelConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]ChannelConfig, len(s.channels))
	copy(out, s.channels)
	return out
}

// Save 保存或更新渠道
func (s *ChannelStore) Save(ch ChannelConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ch.UpdatedAt = time.Now().Unix()
	if ch.ID == "" {
		ch.ID = fmt.Sprintf("ch_%d", time.Now().UnixNano())
	}

	// 如果设为主通道，把其他通道的 primary 取消
	if ch.Primary {
		for i := range s.channels {
			s.channels[i].Primary = false
		}
	}

	found := false
	for i, item := range s.channels {
		if item.ID == ch.ID {
			s.channels[i] = ch
			found = true
			break
		}
	}

	if !found {
		s.channels = append(s.channels, ch)
	}

	return s.save()
}

// Delete 删除渠道
func (s *ChannelStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	newList := make([]ChannelConfig, 0, len(s.channels))
	for _, item := range s.channels {
		if item.ID != id {
			newList = append(newList, item)
		}
	}
	s.channels = newList
	return s.save()
}

// GetPrimary 获取当前主用渠道
func (s *ChannelStore) GetPrimary() *ChannelConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, ch := range s.channels {
		if ch.Primary {
			c := ch
			return &c
		}
	}
	if len(s.channels) > 0 {
		c := s.channels[0]
		return &c
	}
	return nil
}
