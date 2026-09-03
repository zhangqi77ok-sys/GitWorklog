package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"tcode/internal/ast"
	"tcode/internal/config"
	"tcode/internal/core/loop"
	"tcode/internal/core/sandbox"
	"tcode/internal/diff"
	"tcode/internal/host"
	"tcode/internal/llm"
	"tcode/internal/network"
	"tcode/internal/session"
	"tcode/plugins/provider/openai"
	fstool "tcode/plugins/tool/fs"
	gittool "tcode/plugins/tool/git"
	terminaltool "tcode/plugins/tool/terminal"
)

// FileNode 文件树节点
type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"is_dir"`
	Children []FileNode `json:"children,omitempty"`
}

// App Wails Go 原生桌面宿主结构体
type App struct {
	ctx          context.Context
	workspace    string
	sandbox      *sandbox.Sandbox
	snapshotMgr  *sandbox.SnapshotManager
	registry     *host.Registry
	gitTool      *gittool.Tool
	fsTool       *fstool.Tool
	termTool     *terminaltool.Tool
	engine       *loop.ExecutionEngine
	channelStore *config.ChannelStore
	extraStore   *config.ExtraStore
	sessionStore *session.Store
}

// NewApp 构造生产级 Wails 宿主
func NewApp() *App {
	wd, _ := os.Getwd()
	sb, _ := sandbox.NewSandbox(wd)
	sm := sandbox.NewSnapshotManager(wd)
	reg := host.NewRegistry()

	prov := openai.NewProvider()
	_ = reg.Register(prov)

	gt := gittool.NewTool(wd)
	_ = reg.Register(gt)

	fs := fstool.NewTool(sb, sm)
	_ = reg.Register(fs)

	term := terminaltool.NewTool(wd)
	_ = reg.Register(term)

	chStore, _ := config.NewChannelStore()
	exStore, _ := config.NewExtraStore()
	sessStore, _ := session.NewStore()

	return &App{
		workspace:    wd,
		sandbox:      sb,
		snapshotMgr:  sm,
		registry:     reg,
		gitTool:      gt,
		fsTool:       fs,
		termTool:     term,
		engine:       loop.NewExecutionEngine(reg),
		channelStore: chStore,
		extraStore:   exStore,
		sessionStore: sessStore,
	}
}

// startup 窗口初始化生命周期
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.LogInfo(ctx, "[Tcode] Wails Native App initialized successfully")
}

// shutdown 窗口退出清理生命周期
func (a *App) shutdown(ctx context.Context) {
}

// OpenFileDialog 弹出真实 Windows 原生多文件选择窗口
func (a *App) OpenFileDialog() ([]string, error) {
	if a.ctx == nil {
		return nil, fmt.Errorf("app context not initialized")
	}
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "选择要上传给 Agent 的代码或文档",
		DefaultDirectory: a.workspace,
	})
	if err != nil {
		return nil, err
	}
	relFiles := make([]string, 0, len(files))
	for _, f := range files {
		rel, err := filepath.Rel(a.workspace, f)
		if err == nil && !filepath.IsAbs(rel) {
			relFiles = append(relFiles, filepath.ToSlash(rel))
		} else {
			relFiles = append(relFiles, filepath.ToSlash(f))
		}
	}
	return relFiles, nil
}

// --- 会话历史持久化 (Sessions) ---

func (a *App) ListSessions() []session.SessionMeta {
	if a.sessionStore == nil {
		return nil
	}
	return a.sessionStore.List()
}

func (a *App) GetSession(id string) (*session.ChatSession, error) {
	if a.sessionStore == nil {
		return nil, fmt.Errorf("session store not initialized")
	}
	return a.sessionStore.Get(id)
}

func (a *App) SaveSession(sess session.ChatSession) error {
	if a.sessionStore == nil {
		return fmt.Errorf("session store not initialized")
	}
	return a.sessionStore.Save(sess)
}

func (a *App) DeleteSession(id string) error {
	if a.sessionStore == nil {
		return fmt.Errorf("session store not initialized")
	}
	return a.sessionStore.Delete(id)
}

// --- 代码行级 Diff 审查 ---

func (a *App) GetStructuredDiff(filePath string) (diff.DiffReport, error) {
	return diff.ComputeFileDiff(a.workspace, filePath)
}

func (a *App) RevertFile(filePath string) error {
	cmd := exec.Command("git", "checkout", "HEAD", "--", filePath)
	cmd.Dir = a.workspace
	return cmd.Run()
}

// --- 渠道与插件设置 ---

func (a *App) ListChannels() []config.ChannelConfig {
	if a.channelStore == nil {
		return nil
	}
	return a.channelStore.List()
}

func (a *App) SaveChannel(cfg config.ChannelConfig) error {
	if a.channelStore == nil {
		return fmt.Errorf("channel store not initialized")
	}
	return a.channelStore.Save(cfg)
}

func (a *App) DeleteChannel(id string) error {
	if a.channelStore == nil {
		return fmt.Errorf("channel store not initialized")
	}
	return a.channelStore.Delete(id)
}

func (a *App) PingChannel(id string) (string, error) {
	if a.channelStore == nil {
		return "", fmt.Errorf("channel store not initialized")
	}
	channels := a.channelStore.List()
	for _, ch := range channels {
		if ch.ID == id {
			latency, err := network.PingTarget(ch.Endpoint)
			if err != nil {
				return "", err
			}
			ch.Latency = latency
			_ = a.channelStore.Save(ch)
			return latency, nil
		}
	}
	return "", fmt.Errorf("channel [%s] not found", id)
}

func (a *App) ListMCPs() []config.MCPServerConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListMCPs()
}

func (a *App) SaveMCP(cfg config.MCPServerConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveMCP(cfg)
}

func (a *App) ListSkills() []config.SkillConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListSkills()
}

func (a *App) SaveSkill(cfg config.SkillConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveSkill(cfg)
}

func (a *App) ListRules() []config.RuleConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListRules()
}

func (a *App) SaveRule(cfg config.RuleConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveRule(cfg)
}

func (a *App) GetProjectASTGraph() ([]ast.GraphNode, error) {
	return ast.ScanWorkspaceAST(a.workspace)
}

func (a *App) GetGitStatus() (map[string]any, error) {
	if a.gitTool == nil {
		return map[string]any{"error": "git tool not initialized"}, nil
	}
	report, err := a.gitTool.GetStatus()
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"branch":    report.Branch,
		"staged":    report.Staged,
		"working":   report.Working,
		"untracked": report.Untracked,
	}, nil
}

func (a *App) GetFileTree(dir string) ([]FileNode, error) {
	targetDir := a.workspace
	if dir != "" {
		targetDir = filepath.Join(a.workspace, dir)
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil, err
	}

	nodes := make([]FileNode, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "bin" {
			continue
		}
		rel, _ := filepath.Rel(a.workspace, filepath.Join(targetDir, name))
		rel = filepath.ToSlash(rel)

		node := FileNode{
			Name:  name,
			Path:  rel,
			IsDir: entry.IsDir(),
		}
		if entry.IsDir() {
			subEntries, _ := os.ReadDir(filepath.Join(targetDir, name))
			for _, sub := range subEntries {
				subName := sub.Name()
				if !strings.HasPrefix(subName, ".") && subName != "node_modules" {
					subRel, _ := filepath.Rel(a.workspace, filepath.Join(targetDir, name, subName))
					node.Children = append(node.Children, FileNode{
						Name:  subName,
						Path:  filepath.ToSlash(subRel),
						IsDir: sub.IsDir(),
					})
				}
			}
		}
		nodes = append(nodes, node)
	}
	return nodes, nil
}

func (a *App) ReadFile(relPath string) (string, error) {
	if a.sandbox == nil {
		return "", fmt.Errorf("sandbox not initialized")
	}
	data, err := a.sandbox.SafeReadFile(relPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) WriteFile(relPath string, content string) error {
	if a.sandbox == nil {
		return fmt.Errorf("sandbox not initialized")
	}
	return a.sandbox.AtomicWriteFile(relPath, []byte(content))
}

func (a *App) ExecCommand(command string) (string, error) {
	if a.termTool == nil {
		return "", fmt.Errorf("terminal tool not initialized")
	}
	rawArgs, _ := json.Marshal(map[string]string{"command": command})
	res, err := a.termTool.Execute(a.ctx, rawArgs)
	if err != nil {
		return "", err
	}
	return res.Content, nil
}

type ChatRequest struct {
	SessionID  string `json:"session_id"`
	Prompt     string `json:"prompt"`
	Model      string `json:"model"`
	IsFullAuto bool   `json:"is_full_auto"`
}

// SendMessage 核心：多轮记忆 + 真实流式推理 + ReAct 算子自主循环 + 自动持久化

// FetchUpstreamModels 从真实上游网关拉取真实可用模型列表 (Zero Demo)
func (a *App) FetchUpstreamModels(endpoint, apiKey string) ([]string, error) {
	if endpoint == "" {
		endpoint = "https://agentrouter.org/v1"
	}
	if apiKey == "" {
		apiKey = "sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ"
	}
	url := strings.TrimRight(endpoint, "/") + "/models"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	req.Header.Set("Originator", "codex_cli_rs")
	req.Header.Set("Version", "0.101.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	res := make([]string, 0, len(data.Data))
	for _, m := range data.Data {
		res = append(res, m.ID)
	}
	return res, nil
}

// GitCommit 真实执行本地工作区提交
func (a *App) GitCommit(msg string) (string, error) {
	if msg == "" {
		msg = "feat: update by tcode agent"
	}
	cmdAdd := exec.Command("git", "add", "-A")
	cmdAdd.Dir = a.workspace
	if err := cmdAdd.Run(); err != nil {
		return "", err
	}

	cmdCommit := exec.Command("git", "commit", "-m", msg)
	cmdCommit.Dir = a.workspace
	out, err := cmdCommit.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GitStage 真实暂存单个文件
func (a *App) GitStage(filePath string) error {
	cmd := exec.Command("git", "add", filePath)
	cmd.Dir = a.workspace
	return cmd.Run()
}

func (a *App) SendMessage(req ChatRequest) error {
	if a.ctx == nil {
		return fmt.Errorf("context not initialized")
	}

	go func() {
		// 1. 获取主用渠道凭据
		primary := a.channelStore.GetPrimary()
		endpoint := "https://agentrouter.org/v1"
		apiKey := "sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ"
		model := req.Model
		if model == "" {
			model = "deepseek-v4-flash"
		}
		if primary != nil {
			if primary.Endpoint != "" {
				endpoint = primary.Endpoint
			}
			if primary.APIKey != "" {
				apiKey = primary.APIKey
			}
			if req.Model == "" && primary.Model != "" {
				model = primary.Model
			}
		}

		// 2. 加载已有会话历史，若不存在则新建
		var currentSession session.ChatSession
		existing, err := a.sessionStore.Get(req.SessionID)
		if err == nil && existing != nil {
			currentSession = *existing
		} else {
			currentSession = session.ChatSession{
				ID:        req.SessionID,
				Title:     req.Prompt,
				Model:     model,
				Tag:       "核心架构",
				CreatedAt: time.Now().Unix(),
				UpdatedAt: time.Now().Unix(),
				Messages:  make([]session.SessionMessage, 0),
			}
			r := []rune(req.Prompt)
			if len(r) > 16 {
				currentSession.Title = string(r[:16]) + "..."
			}
		}

		// 追加用户消息
		userMsg := session.SessionMessage{
			ID:      fmt.Sprintf("msg_%d", time.Now().UnixNano()),
			Role:    "user",
			Content: req.Prompt,
			Time:    time.Now().Format("15:04"),
		}
		currentSession.Messages = append(currentSession.Messages, userMsg)
		_ = a.sessionStore.Save(currentSession)

		// 3. 发送开始事件
		runtime.EventsEmit(a.ctx, "agent:start", map[string]any{
			"session_id": req.SessionID,
			"model":      model,
		})

		// 4. 构建提示词体系 (注入规则 + 最近多轮历史)
		systemPrompt := "你是 Tcode Studio 纯原生桌面智能体。你有权调用工具来审查、读取、修改工程代码及运行测试命令。请优先利用工具解决问题，并在每次调用后解释原因。"
		rules := a.extraStore.ListRules()
		for _, r := range rules {
			if r.Enabled {
				systemPrompt += "\n[规则规约] " + r.Content
			}
		}

		conversation := []llm.Message{
			{Role: "system", Content: systemPrompt},
		}

		// 选取最近 6 条历史消息防止超出上下文
		startIdx := 0
		if len(currentSession.Messages) > 6 {
			startIdx = len(currentSession.Messages) - 6
		}
		for i := startIdx; i < len(currentSession.Messages); i++ {
			m := currentSession.Messages[i]
			conversation = append(conversation, llm.Message{
				Role:    m.Role,
				Content: m.Content,
			})
		}

		var assistantThinking strings.Builder
		var assistantContent strings.Builder
		var lastToolExec *session.ToolExecution

		// 5. 第一轮流式调用（携带工作区算子定义）
		llmReq := llm.Request{
			Endpoint: endpoint,
			APIKey:   apiKey,
			Model:    model,
			Messages: conversation,
			Tools:    llm.DefaultWorkspaceTools(),
		}

		toolCalls, err := llm.StreamChat(context.Background(), llmReq, llm.StreamHandlers{
			OnThinking: func(text string) {
				assistantThinking.WriteString(text)
				runtime.EventsEmit(a.ctx, "agent:thinking", map[string]any{
					"session_id": req.SessionID,
					"thinking":   text,
				})
			},
			OnContent: func(delta string) {
				assistantContent.WriteString(delta)
				runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
					"session_id": req.SessionID,
					"delta":      delta,
				})
			},
			OnError: func(err error) {
				errMsg := fmt.Sprintf("\n\n[系统错误: %v]", err)
				assistantContent.WriteString(errMsg)
				runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
					"session_id": req.SessionID,
					"delta":      errMsg,
				})
			},
		})

		// 6. 若大模型决策触发算子调用，Go 微内核自动物理执行闭环！
		if err == nil && len(toolCalls) > 0 {
			for _, tc := range toolCalls {
				toolName := tc.Function.Name
				toolArgs := tc.Function.Arguments

				runtime.EventsEmit(a.ctx, "agent:tool_start", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"args":       toolArgs,
				})

				var output string
				switch toolName {
				case "exec_command":
					res, err := a.termTool.Execute(context.Background(), []byte(toolArgs))
					if err != nil {
						output = fmt.Sprintf("执行失败: %v", err)
					} else {
						output = res.Content
					}

				case "write_file":
					var argsObj struct {
						RelPath string `json:"rel_path"`
						Content string `json:"content"`
					}
					_ = json.Unmarshal([]byte(toolArgs), &argsObj)
					err := a.sandbox.AtomicWriteFile(argsObj.RelPath, []byte(argsObj.Content))
					if err != nil {
						output = fmt.Sprintf("写入文件失败: %v", err)
					} else {
						output = fmt.Sprintf("✓ 成功原子写入文件: %s (%d 字节)", argsObj.RelPath, len(argsObj.Content))
						runtime.EventsEmit(a.ctx, "agent:files_changed", map[string]any{
							"session_id": req.SessionID,
							"file":       argsObj.RelPath,
						})
					}

				case "read_file":
					var argsObj struct {
						RelPath string `json:"rel_path"`
					}
					_ = json.Unmarshal([]byte(toolArgs), &argsObj)
					data, err := a.sandbox.SafeReadFile(argsObj.RelPath)
					if err != nil {
						output = fmt.Sprintf("读取文件失败: %v", err)
					} else {
						output = string(data)
					}

				case "git_status":
					status, err := a.gitTool.GetStatus()
					if err != nil {
						output = fmt.Sprintf("查询 Git 失败: %v", err)
					} else {
						b, _ := json.MarshalIndent(status, "", "  ")
						output = string(b)
					}
				default:
					output = fmt.Sprintf("未知算子: %s", toolName)
				}

				lastToolExec = &session.ToolExecution{
					Name:   toolName,
					Args:   toolArgs,
					Output: output,
				}

				runtime.EventsEmit(a.ctx, "agent:tool_end", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"output":     output,
				})

				conversation = append(conversation, llm.Message{
					Role:      "assistant",
					ToolCalls: []llm.ToolCall{tc},
				})
				conversation = append(conversation, llm.Message{
					Role:       "tool",
					ToolCallID: tc.ID,
					Name:       toolName,
					Content:    output,
				})
			}

			// 第二轮流式总结反思
			step2Req := llm.Request{
				Endpoint: endpoint,
				APIKey:   apiKey,
				Model:    model,
				Messages: conversation,
			}
			_, _ = llm.StreamChat(context.Background(), step2Req, llm.StreamHandlers{
				OnThinking: func(text string) {
					assistantThinking.WriteString(text)
					runtime.EventsEmit(a.ctx, "agent:thinking", map[string]any{
						"session_id": req.SessionID,
						"thinking":   text,
					})
				},
				OnContent: func(delta string) {
					assistantContent.WriteString(delta)
					runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
						"session_id": req.SessionID,
						"delta":      delta,
					})
				},
			})
		}

		// 7. 持久化 Assistant 回复至磁盘
		asstMsg := session.SessionMessage{
			ID:       fmt.Sprintf("msg_%d", time.Now().UnixNano()),
			Role:     "assistant",
			Content:  assistantContent.String(),
			Thinking: assistantThinking.String(),
			Tool:     lastToolExec,
			Time:     time.Now().Format("15:04"),
		}
		currentSession.Messages = append(currentSession.Messages, asstMsg)
		currentSession.UpdatedAt = time.Now().Unix()
		_ = a.sessionStore.Save(currentSession)

		runtime.EventsEmit(a.ctx, "agent:done", map[string]any{"session_id": req.SessionID})
	}()

	return nil
}
