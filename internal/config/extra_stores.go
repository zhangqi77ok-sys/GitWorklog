package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// MCPServerConfig MCP 服务器配置
type MCPServerConfig struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Type      string            `json:"type"` // "stdio" | "sse"
	Command   string            `json:"command"`
	Args      []string          `json:"args"`
	Env       map[string]string `json:"env,omitempty"`
	URL       string            `json:"url,omitempty"`
	Enabled   bool              `json:"enabled"`
	UpdatedAt int64             `json:"updated_at"`
}

// SkillConfig Agent 技能规约
type SkillConfig struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
	Enabled     bool   `json:"enabled"`
	UpdatedAt   int64  `json:"updated_at"`
}

// RuleConfig 项目工程规则
type RuleConfig struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Scope     string `json:"scope"` // "global" | "workspace"
	Enabled   bool   `json:"enabled"`
	UpdatedAt int64  `json:"updated_at"`
}

type ExtraStore struct {
	mu        sync.RWMutex
	baseDir   string
	mcpFile   string
	skillFile string
	ruleFile  string
	mcps      []MCPServerConfig
	skills    []SkillConfig
	rules     []RuleConfig
}

func NewExtraStore() (*ExtraStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	dir := filepath.Join(home, ".tcode")
	_ = os.MkdirAll(dir, 0755)

	store := &ExtraStore{
		baseDir:   dir,
		mcpFile:   filepath.Join(dir, "mcp_servers.json"),
		skillFile: filepath.Join(dir, "skills.json"),
		ruleFile:  filepath.Join(dir, "rules.json"),
		mcps:      make([]MCPServerConfig, 0),
		skills:    make([]SkillConfig, 0),
		rules:     make([]RuleConfig, 0),
	}

	_ = store.loadAll()
	return store, nil
}

func (s *ExtraStore) loadAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. MCP
	if data, err := os.ReadFile(s.mcpFile); err == nil {
		_ = json.Unmarshal(data, &s.mcps)
	} else {
		s.mcps = []MCPServerConfig{
			{
				ID:        "mcp_filesystem",
				Name:      "Filesystem Local Server",
				Type:      "stdio",
				Command:   "npx",
				Args:      []string{"-y", "@modelcontextprotocol/server-filesystem", "."},
				Enabled:   true,
				UpdatedAt: time.Now().Unix(),
			},
			{
				ID:        "mcp_git",
				Name:      "Git Local Server",
				Type:      "stdio",
				Command:   "uvx",
				Args:      []string{"mcp-server-git", "--repository", "."},
				Enabled:   true,
				UpdatedAt: time.Now().Unix(),
			},
		}
		_ = s.saveMCPs()
	}

	// 2. Skills
	if data, err := os.ReadFile(s.skillFile); err == nil {
		_ = json.Unmarshal(data, &s.skills)
	} else {
		s.skills = []SkillConfig{
			{
				ID:          "skill_tdd",
				Name:        "TDD 测试驱动自愈",
				Description: "自动编写失败测试用例，驱动代码修改并通过单测检验闭环",
				Prompt:      "在修改代码前，必须先编写针对该特性的单元测试，并验证测试红绿灯。",
				Enabled:     true,
				UpdatedAt:   time.Now().Unix(),
			},
			{
				ID:          "skill_guardrail",
				Name:        "安全沙箱与高危指令拦截",
				Description: "严禁 rm -rf、格式化磁盘与跨工作区越权写入",
				Prompt:      "禁止执行破坏性危险命令，所有文件写入必须限定在当前工作区沙箱内。",
				Enabled:     true,
				UpdatedAt:   time.Now().Unix(),
			},
		}
		_ = s.saveSkills()
	}

	// 3. Rules
	if data, err := os.ReadFile(s.ruleFile); err == nil {
		_ = json.Unmarshal(data, &s.rules)
	} else {
		s.rules = []RuleConfig{
			{
				ID:        "rule_clean_code",
				Title:     "Go 与 Vue 编码工程原则",
				Content:   "坚决遵守单一职责与插件化架构，禁止任何 Demo 伪代码和 fake alert。",
				Scope:     "global",
				Enabled:   true,
				UpdatedAt: time.Now().Unix(),
			},
		}
		_ = s.saveRules()
	}

	return nil
}

func (s *ExtraStore) saveMCPs() error {
	data, _ := json.MarshalIndent(s.mcps, "", "  ")
	return os.WriteFile(s.mcpFile, data, 0644)
}

func (s *ExtraStore) saveSkills() error {
	data, _ := json.MarshalIndent(s.skills, "", "  ")
	return os.WriteFile(s.skillFile, data, 0644)
}

func (s *ExtraStore) saveRules() error {
	data, _ := json.MarshalIndent(s.rules, "", "  ")
	return os.WriteFile(s.ruleFile, data, 0644)
}

// ListMCPs 获取 MCP 列表
func (s *ExtraStore) ListMCPs() []MCPServerConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]MCPServerConfig, len(s.mcps))
	copy(out, s.mcps)
	return out
}

// SaveMCP 保存 MCP 配置
func (s *ExtraStore) SaveMCP(cfg MCPServerConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg.UpdatedAt = time.Now().Unix()
	if cfg.ID == "" {
		cfg.ID = fmt.Sprintf("mcp_%d", time.Now().UnixNano())
	}

	found := false
	for i, item := range s.mcps {
		if item.ID == cfg.ID {
			s.mcps[i] = cfg
			found = true
			break
		}
	}
	if !found {
		s.mcps = append(s.mcps, cfg)
	}
	return s.saveMCPs()
}

// ListSkills 获取 Skills 列表
func (s *ExtraStore) ListSkills() []SkillConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]SkillConfig, len(s.skills))
	copy(out, s.skills)
	return out
}

// SaveSkill 保存 Skill 配置
func (s *ExtraStore) SaveSkill(cfg SkillConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg.UpdatedAt = time.Now().Unix()
	if cfg.ID == "" {
		cfg.ID = fmt.Sprintf("skill_%d", time.Now().UnixNano())
	}

	found := false
	for i, item := range s.skills {
		if item.ID == cfg.ID {
			s.skills[i] = cfg
			found = true
			break
		}
	}
	if !found {
		s.skills = append(s.skills, cfg)
	}
	return s.saveSkills()
}

// ListRules 获取规则列表
func (s *ExtraStore) ListRules() []RuleConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]RuleConfig, len(s.rules))
	copy(out, s.rules)
	return out
}

// SaveRule 保存规则配置
func (s *ExtraStore) SaveRule(cfg RuleConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg.UpdatedAt = time.Now().Unix()
	if cfg.ID == "" {
		cfg.ID = fmt.Sprintf("rule_%d", time.Now().UnixNano())
	}

	found := false
	for i, item := range s.rules {
		if item.ID == cfg.ID {
			s.rules[i] = cfg
			found = true
			break
		}
	}
	if !found {
		s.rules = append(s.rules, cfg)
	}
	return s.saveRules()
}
