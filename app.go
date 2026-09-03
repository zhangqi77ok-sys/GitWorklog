package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"tcode/internal/ast"
	"tcode/internal/config"
	"tcode/internal/core/loop"
	"tcode/internal/core/sandbox"
	"tcode/internal/host"
	"tcode/internal/llm"
	"tcode/internal/network"
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

// ListChannels 真实读取本地渠道配置
func (a *App) ListChannels() []config.ChannelConfig {
	if a.channelStore == nil {
		return nil
	}
	return a.channelStore.List()
}

// SaveChannel 真实保存渠道配置至 ~/.tcode/channels.json
func (a *App) SaveChannel(cfg config.ChannelConfig) error {
	if a.channelStore == nil {
		return fmt.Errorf("channel store not initialized")
	}
	return a.channelStore.Save(cfg)
}

// DeleteChannel 真实删除渠道
func (a *App) DeleteChannel(id string) error {
	if a.channelStore == nil {
		return fmt.Errorf("channel store not initialized")
	}
	return a.channelStore.Delete(id)
}

// PingChannel 真实执行网络探活并测量毫秒往返延迟
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

// ListMCPs 真实读取 MCP 配置
func (a *App) ListMCPs() []config.MCPServerConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListMCPs()
}

// SaveMCP 真实保存 MCP 配置
func (a *App) SaveMCP(cfg config.MCPServerConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveMCP(cfg)
}

// ListSkills 真实读取 Skill 列表
func (a *App) ListSkills() []config.SkillConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListSkills()
}

// SaveSkill 真实保存 Skill 配置
func (a *App) SaveSkill(cfg config.SkillConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveSkill(cfg)
}

// ListRules 真实读取工程规则
func (a *App) ListRules() []config.RuleConfig {
	if a.extraStore == nil {
		return nil
	}
	return a.extraStore.ListRules()
}

// SaveRule 真实保存规则
func (a *App) SaveRule(cfg config.RuleConfig) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.SaveRule(cfg)
}

// GetProjectASTGraph 真实执行项目 AST 语义分析
func (a *App) GetProjectASTGraph() ([]ast.GraphNode, error) {
	return ast.ScanWorkspaceAST(a.workspace)
}

// GetGitStatus 真实读取工作区 Git Plumbing 状态
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

// GetFileDiff 真实计算文件 Diff 差异
func (a *App) GetFileDiff(filePath string) (string, error) {
	if a.gitTool == nil {
		return "", fmt.Errorf("git tool not initialized")
	}
	raw, err := a.termTool.Execute(context.Background(), []byte(fmt.Sprintf(`{"command":"git diff HEAD -- %s"}`, filePath)))
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(raw.Content) == "" {
		return "无修改或文件未跟踪", nil
	}
	return raw.Content, nil
}

// GetFileTree 真实获取工作区文件树
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

// ReadFile 安全受控沙箱文件读取
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

// WriteFile 安全原子写入文件
func (a *App) WriteFile(relPath string, content string) error {
	if a.sandbox == nil {
		return fmt.Errorf("sandbox not initialized")
	}
	return a.sandbox.AtomicWriteFile(relPath, []byte(content))
}

// ExecCommand 受控终端静默执行
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

// ChatRequest 对话请求
type ChatRequest struct {
	SessionID  string `json:"session_id"`
	Prompt     string `json:"prompt"`
	Model      string `json:"model"`
	IsFullAuto bool   `json:"is_full_auto"`
}

// SendMessage 核心：发起真实流式大模型推理与 Function Calling 算子自主循环闭环
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

		// 2. 发送开始事件
		runtime.EventsEmit(a.ctx, "agent:start", map[string]any{
			"session_id": req.SessionID,
			"model":      model,
		})

		// 3. 构建提示词体系 (注入当前工作区上下文与规则)
		systemPrompt := "你是 Tcode Studio 纯原生桌面智能体。你有权调用工具来审查、读取、修改工程代码及运行测试命令。请优先利用工具解决问题，并在每次调用后解释原因。"
		rules := a.extraStore.ListRules()
		for _, r := range rules {
			if r.Enabled {
				systemPrompt += "\n[规则规约] " + r.Content
			}
		}

		conversation := []llm.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: req.Prompt},
		}

		// 4. 第一轮流式调用（携带工作区算子定义）
		llmReq := llm.Request{
			Endpoint: endpoint,
			APIKey:   apiKey,
			Model:    model,
			Messages: conversation,
			Tools:    llm.DefaultWorkspaceTools(),
		}

		toolCalls, err := llm.StreamChat(context.Background(), llmReq, llm.StreamHandlers{
			OnThinking: func(text string) {
				runtime.EventsEmit(a.ctx, "agent:thinking", map[string]any{
					"session_id": req.SessionID,
					"thinking":   text,
				})
			},
			OnContent: func(delta string) {
				runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
					"session_id": req.SessionID,
					"delta":      delta,
				})
			},
			OnError: func(err error) {
				runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
					"session_id": req.SessionID,
					"delta":      fmt.Sprintf("\n\n[系统错误: %v]", err),
				})
			},
		})

		if err != nil {
			runtime.EventsEmit(a.ctx, "agent:done", map[string]any{"session_id": req.SessionID})
			return
		}

		// 5. 若大模型决策触发算子调用，Go 微内核自动物理执行闭环！
		if len(toolCalls) > 0 {
			for _, tc := range toolCalls {
				toolName := tc.Function.Name
				toolArgs := tc.Function.Arguments

				// 向前端派发工具启动卡片
				runtime.EventsEmit(a.ctx, "agent:tool_start", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"args":       toolArgs,
				})

				var output string
				switch toolName {
				case "exec_command":
					var argsObj struct {
						Command string `json:"command"`
					}
					_ = json.Unmarshal([]byte(toolArgs), &argsObj)
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
						// 派发文件变动事件，供前端展开 Diff
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

				// 向前端派发工具完成卡片
				runtime.EventsEmit(a.ctx, "agent:tool_end", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"output":     output,
				})

				// 6. 将工具执行结果回传给大模型进行第二轮反思与总结
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

			// 第二轮流式总结
			step2Req := llm.Request{
				Endpoint: endpoint,
				APIKey:   apiKey,
				Model:    model,
				Messages: conversation,
			}
			_, _ = llm.StreamChat(context.Background(), step2Req, llm.StreamHandlers{
				OnThinking: func(text string) {
					runtime.EventsEmit(a.ctx, "agent:thinking", map[string]any{
						"session_id": req.SessionID,
						"thinking":   text,
					})
				},
				OnContent: func(delta string) {
					runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
						"session_id": req.SessionID,
						"delta":      delta,
					})
				},
			})
		}

		runtime.EventsEmit(a.ctx, "agent:done", map[string]any{"session_id": req.SessionID})
	}()

	return nil
}
