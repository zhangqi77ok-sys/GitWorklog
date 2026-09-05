package main

import (
	"tcode/internal/agent"
	"tcode/internal/gitops"
	"tcode/internal/lsp"
	"tcode/internal/mcp"
	"tcode/internal/telemetry"

	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"
	"syscall"
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
	sessionStore   *session.Store
	mcpManager     *mcp.Manager
	terminalCancel context.CancelFunc
	terminalMu     sync.Mutex
	agentCancel    context.CancelFunc
	agentMu        sync.Mutex
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

	mcpMgr := mcp.NewManager(wd)

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
		mcpManager:   mcpMgr,
	}
}

// startup 窗口初始化生命周期
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.LogInfo(ctx, "[Tcode] Wails Native App initialized successfully")
	// 异步预热并拉起已启用的外部 MCP 协议服务
	if a.mcpManager != nil && a.extraStore != nil {
		go func() {
			a.mcpManager.SyncFromConfig(context.Background(), a.extraStore.ListMCPs())
		}()
	}
}

// shutdown 窗口退出清理生命周期
func (a *App) shutdown(ctx context.Context) {
	if a.mcpManager != nil {
		a.mcpManager.StopAll()
	}
}

// MinimizeWindow 最小化无边框窗口
func (a *App) MinimizeWindow() {
	if a.ctx != nil {
		runtime.WindowMinimise(a.ctx)
	}
}

// ToggleMaximizeWindow 切换无边框窗口最大化/还原
func (a *App) ToggleMaximizeWindow() {
	if a.ctx != nil {
		runtime.WindowToggleMaximise(a.ctx)
	}
}

// CloseWindow 安全关闭原生桌面程序
func (a *App) CloseWindow() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
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

// OpenDirectoryDialog 弹出系统原生选择文件夹窗口 (符合铁律 5)
func (a *App) OpenDirectoryDialog() (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("app context not initialized")
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "选择项目工作区文件夹",
		DefaultDirectory: a.workspace,
	})
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(dir), nil
}

// GetWorkspace 获取当前活动工作区绝对路径
func (a *App) GetWorkspace() string {
	return filepath.ToSlash(a.workspace)
}

// SetWorkspace 动态切换项目工作区，热更新沙箱、Git 工具与插件执行链
func (a *App) SetWorkspace(dir string) error {
	if dir == "" {
		return fmt.Errorf("workspace directory cannot be empty")
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return fmt.Errorf("invalid workspace directory: %w", err)
	}
	info, err := os.Stat(absDir)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("workspace directory does not exist or is not a directory: %s", absDir)
	}

	a.workspace = absDir
	sb, _ := sandbox.NewSandbox(absDir)
	a.sandbox = sb
	a.snapshotMgr = sandbox.NewSnapshotManager(absDir)

	gt := gittool.NewTool(absDir)
	a.gitTool = gt
	if a.registry != nil {
		_ = a.registry.Register(gt)
	}

	fs := fstool.NewTool(sb, a.snapshotMgr)
	a.fsTool = fs
	if a.registry != nil {
		_ = a.registry.Register(fs)
	}

	term := terminaltool.NewTool(absDir)
	a.termTool = term
	if a.registry != nil {
		_ = a.registry.Register(term)
	}

	if a.mcpManager != nil {
		a.mcpManager.StopAll()
	}
	a.mcpManager = mcp.NewManager(absDir)
	if a.extraStore != nil {
		go func() {
			a.mcpManager.SyncFromConfig(context.Background(), a.extraStore.ListMCPs())
		}()
	}

	return nil
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

// windowsSysProcAttr 返回 Windows 平台隐藏黑框与无窗口标志
func windowsSysProcAttr() *syscall.SysProcAttr {
	if goruntime.GOOS == "windows" {
		return &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
			HideWindow:    true,
		}
	}
	return nil
}

// --- 代码行级 Diff 审查 ---

func (a *App) GetStructuredDiff(filePath string) (diff.DiffReport, error) {
	if a.sandbox != nil {
		if _, err := a.sandbox.ValidatePath(filePath); err != nil {
			return diff.DiffReport{}, fmt.Errorf("security violation: %w", err)
		}
	}
	return diff.ComputeFileDiff(a.workspace, filePath)
}

func (a *App) RevertFile(filePath string) error {
	var validPath string
	var err error
	if a.sandbox != nil {
		validPath, err = a.sandbox.ValidatePath(filePath)
		if err != nil {
			return fmt.Errorf("security violation: %w", err)
		}
	} else {
		validPath = filepath.Join(a.workspace, filePath)
	}

	cmd := exec.Command("git", "checkout", "HEAD", "--", filePath)
	cmd.Dir = a.workspace
	if attr := windowsSysProcAttr(); attr != nil {
		cmd.SysProcAttr = attr
	}
	if err := cmd.Run(); err != nil {
		// 若 git checkout 失败 (例如该文件为未追踪 Untracked 新文件)，安全从磁盘中删除
		if fi, statErr := os.Stat(validPath); statErr == nil && !fi.IsDir() {
			return os.Remove(validPath)
		}
		return err
	}
	return nil
}

// ApplyDiffHunk 采纳指定代码块 (Hunk) 变更
func (a *App) ApplyDiffHunk(filePath string, hunkIndex int, stageOnly bool) error {
	if a.sandbox != nil {
		if _, err := a.sandbox.ValidatePath(filePath); err != nil {
			return fmt.Errorf("security violation: %w", err)
		}
	}
	return diff.ApplyHunkPatch(a.workspace, filePath, hunkIndex, stageOnly)
}

// DiscardDiffHunk 丢弃指定代码块 (Hunk) 变更
func (a *App) DiscardDiffHunk(filePath string, hunkIndex int) error {
	if a.sandbox != nil {
		if _, err := a.sandbox.ValidatePath(filePath); err != nil {
			return fmt.Errorf("security violation: %w", err)
		}
	}
	return diff.DiscardHunkPatch(a.workspace, filePath, hunkIndex)
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
	if err := a.extraStore.SaveMCP(cfg); err != nil {
		return err
	}
	// 动态联动启停 MCP 进程实例
	if a.mcpManager != nil {
		go func() {
			if cfg.Enabled {
				_ = a.mcpManager.StartServer(context.Background(), cfg)
			} else {
				_ = a.mcpManager.StopServer(context.Background(), cfg.ID)
			}
		}()
	}
	return nil
}

// DeleteMCP 从磁盘删除 MCP 配置并停止运行中的实例
func (a *App) DeleteMCP(id string) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	if err := a.extraStore.DeleteMCP(id); err != nil {
		return err
	}
	if a.mcpManager != nil {
		go func() {
			_ = a.mcpManager.StopServer(context.Background(), id)
		}()
	}
	return nil
}

// DiagnoseFile 触发指定文件的毫秒级轻量编译器语法诊断
func (a *App) DiagnoseFile(relPath string) (*lsp.DiagnosticReport, error) {
	return lsp.DiagnoseFile(a.workspace, relPath)
}

// TestMCPServer 对指定 MCP 服务执行标准 JSON-RPC 2.0 握手与工具探活
func (a *App) TestMCPServer(id string) (mcp.MCPTestResult, error) {
	if a.mcpManager == nil {
		return mcp.MCPTestResult{Status: "ERROR", Error: "mcp manager not initialized"}, fmt.Errorf("mcp manager not initialized")
	}
	if a.extraStore != nil {
		mcps := a.extraStore.ListMCPs()
		for _, srv := range mcps {
			if srv.ID == id || strings.Contains(strings.ToLower(srv.Name), strings.ToLower(id)) {
				return a.mcpManager.TestServer(context.Background(), srv)
			}
		}
	}
	return mcp.MCPTestResult{
		ID:     id,
		Status: "ERROR",
		Error:  fmt.Sprintf("未找到指定的 MCP 服务配置: [%s]", id),
	}, fmt.Errorf("mcp server [%s] not found", id)
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

func (a *App) DeleteSkill(id string) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.DeleteSkill(id)
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

func (a *App) DeleteRule(id string) error {
	if a.extraStore == nil {
		return fmt.Errorf("extra store not initialized")
	}
	return a.extraStore.DeleteRule(id)
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
		if a.sandbox != nil {
			validated, err := a.sandbox.ValidatePath(dir)
			if err != nil {
				return nil, fmt.Errorf("invalid path access: %w", err)
			}
			targetDir = validated
		} else {
			targetDir = filepath.Join(a.workspace, dir)
		}
	}
	return a.buildFileTree(targetDir, 0, 4)
}

func (a *App) buildFileTree(currentDir string, currentDepth, maxDepth int) ([]FileNode, error) {
	nodeCount := 0
	visited := make(map[string]bool)
	return a.buildFileTreeInternal(currentDir, currentDepth, maxDepth, &nodeCount, visited)
}

func (a *App) buildFileTreeInternal(currentDir string, currentDepth, maxDepth int, nodeCount *int, visited map[string]bool) ([]FileNode, error) {
	if *nodeCount >= 500 {
		return nil, nil
	}

	realDir, err := filepath.EvalSymlinks(currentDir)
	if err != nil {
		realDir = currentDir
	}
	if visited[realDir] {
		return nil, nil // 避免软链接循环递归
	}
	visited[realDir] = true

	// 确保没有越出工作区
	cleanReal, err := filepath.Abs(realDir)
	if err == nil {
		cleanWs, err := filepath.Abs(a.workspace)
		if err == nil {
			relWs, err := filepath.Rel(cleanWs, cleanReal)
			if err != nil || strings.HasPrefix(relWs, "..") {
				return nil, nil // 软链接指向工作区外部，阻断
			}
		}
	}

	entries, err := os.ReadDir(currentDir)
	if err != nil {
		return nil, err
	}

	nodes := make([]FileNode, 0, len(entries))
	for _, entry := range entries {
		if *nodeCount >= 500 {
			break
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "bin" || name == "dist" || name == "build" {
			continue
		}
		rel, _ := filepath.Rel(a.workspace, filepath.Join(currentDir, name))
		rel = filepath.ToSlash(rel)

		*nodeCount++
		node := FileNode{
			Name:  name,
			Path:  rel,
			IsDir: entry.IsDir(),
		}
		if entry.IsDir() && currentDepth < maxDepth {
			subNodes, _ := a.buildFileTreeInternal(filepath.Join(currentDir, name), currentDepth+1, maxDepth, nodeCount, visited)
			node.Children = subNodes
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

// ExecTerminalStream 异步执行终端命令，通过 Wails 事件实时推送流式输出与退出码
func (a *App) ExecTerminalStream(command string) error {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return fmt.Errorf("command cannot be empty")
	}
	if a.ctx == nil {
		return fmt.Errorf("context not initialized")
	}
	if a.termTool == nil {
		return fmt.Errorf("terminal tool not initialized")
	}

	a.terminalMu.Lock()
	if a.terminalCancel != nil {
		a.terminalCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.terminalCancel = cancel
	a.terminalMu.Unlock()

	go func() {
		startTime := time.Now()
		runtime.EventsEmit(a.ctx, "terminal:start", map[string]any{
			"command":    command,
			"start_time": startTime.UnixMilli(),
		})

		exitCode, err := a.termTool.ExecuteStream(ctx, command, func(chunk string) {
			runtime.EventsEmit(a.ctx, "terminal:data", chunk)
		})

		elapsed := time.Since(startTime).Milliseconds()
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		}

		runtime.EventsEmit(a.ctx, "terminal:exit", map[string]any{
			"command":     command,
			"exit_code":   exitCode,
			"duration_ms": elapsed,
			"error":       errMsg,
		})

		a.terminalMu.Lock()
		a.terminalCancel = nil
		a.terminalMu.Unlock()
	}()

	return nil
}

// CancelTerminalCommand 中断当前正在执行的终端命令
func (a *App) CancelTerminalCommand() {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()
	if a.terminalCancel != nil {
		a.terminalCancel()
		a.terminalCancel = nil
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "terminal:data", "\n[Process interrupted by user]\n")
		}
	}
}

// CancelAgentStream 中断当前正在进行的大模型流式推理与自主工具循环
func (a *App) CancelAgentStream() {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentCancel != nil {
		a.agentCancel()
		a.agentCancel = nil
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "agent:interrupted", map[string]any{
				"message": "用户手动中断了本次推理",
			})
		}
	}
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
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = "https://agentrouter.org/v1"
	} else {
		if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
			if strings.Contains(endpoint, "localhost") || strings.Contains(endpoint, "127.0.0.1") {
				endpoint = "http://" + endpoint
			} else {
				endpoint = "https://" + endpoint
			}
		}
	}
	if apiKey == "" {
		if primary := a.channelStore.GetPrimary(); primary != nil && primary.APIKey != "" {
			apiKey = primary.APIKey
			if endpoint == "https://agentrouter.org/v1" && primary.Endpoint != "" {
				endpoint = primary.Endpoint
			}
		}
	}
	if apiKey == "" {
		return nil, fmt.Errorf("未配置有效 API Key，请先在渠道配置中填写模型 API Key")
	}
	cleanEndpoint := strings.TrimRight(endpoint, "/")
	if strings.HasSuffix(cleanEndpoint, "/models") {
		cleanEndpoint = strings.TrimSuffix(cleanEndpoint, "/models")
	}
	url := cleanEndpoint + "/models"

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
	if attr := windowsSysProcAttr(); attr != nil {
		cmdAdd.SysProcAttr = attr
	}
	if err := cmdAdd.Run(); err != nil {
		return "", err
	}

	cmdCommit := exec.Command("git", "commit", "-m", msg)
	cmdCommit.Dir = a.workspace
	if attr := windowsSysProcAttr(); attr != nil {
		cmdCommit.SysProcAttr = attr
	}
	out, err := cmdCommit.CombinedOutput()
	outStr := string(out)
	if err != nil {
		// 当工作区没有发生任何变更时，git commit 会返回 exit status 1 伴随 nothing to commit
		if strings.Contains(outStr, "nothing to commit") || strings.Contains(outStr, "无文件要提交") {
			return outStr, nil
		}
		return outStr, err
	}
	return outStr, nil
}

// GitStage 真实暂存单个文件
func (a *App) GitStage(filePath string) error {
	if a.sandbox != nil {
		if _, err := a.sandbox.ValidatePath(filePath); err != nil {
			return fmt.Errorf("security violation: %w", err)
		}
	}
	cmd := exec.Command("git", "add", "--", filePath)
	cmd.Dir = a.workspace
	if attr := windowsSysProcAttr(); attr != nil {
		cmd.SysProcAttr = attr
	}
	return cmd.Run()
}

func (a *App) SendMessage(req ChatRequest) error {
	if a.ctx == nil {
		return fmt.Errorf("context not initialized")
	}

	a.agentMu.Lock()
	if a.agentCancel != nil {
		a.agentCancel()
	}
	agentCtx, cancel := context.WithCancel(context.Background())
	a.agentCancel = cancel
	a.agentMu.Unlock()

	go func() {
		defer func() {
			a.agentMu.Lock()
			a.agentCancel = nil
			a.agentMu.Unlock()
		}()

		// 1. 获取主用渠道凭据
		primary := a.channelStore.GetPrimary()
		var endpoint string
		var apiKey string
		model := req.Model

		if primary != nil {
			endpoint = primary.Endpoint
			apiKey = primary.APIKey
			if model == "" {
				model = primary.Model
			}
		}
		if endpoint == "" {
			endpoint = "https://api.openai.com/v1"
		}
		if model == "" {
			model = "deepseek-chat"
		}

		if apiKey == "" {
			errMsg := "\n\n[配置错误] 未检测到有效的模型渠道凭据 (API Key)。请在右侧「渠道配置」面板添加并激活您的真实模型服务渠道。"
			runtime.EventsEmit(a.ctx, "agent:start", map[string]any{
				"session_id": req.SessionID,
				"model":      model,
			})
			runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
				"session_id": req.SessionID,
				"delta":      errMsg,
				"turn":       1,
			})
			runtime.EventsEmit(a.ctx, "agent:complete", map[string]any{
				"session_id": req.SessionID,
				"error":      "missing_api_key",
			})
			return
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
				Tag:       "默认",
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

		// 4. 构建提示词体系 (注入规则 + 工作区技术栈感知 + 最近多轮历史)
		systemPrompt := "你是 Tcode Studio 纯原生桌面智能体。你有权调用工具来审查、读取、修改工程代码及运行测试命令。请优先利用工具解决问题，并在每次调用后解释原因。"
		rules := a.extraStore.ListRules()
		for _, r := range rules {
			if r.Enabled {
				systemPrompt += "\n[规则规约] " + r.Content
			}
		}
		// 动态侦测工作区项目技术栈并注入环境上下文
		stackInfo := sandbox.DetectProjectStack(a.workspace)
		if stackPrompt := sandbox.FormatStackPrompt(stackInfo); stackPrompt != "" {
			systemPrompt += "\n" + stackPrompt
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
		allToolExecs := make([]session.ToolExecution, 0)

		// 5. 准备工作区内置沙箱算子与外部已激活 MCP 协议算子
		workspaceTools := llm.DefaultWorkspaceTools()
		if a.mcpManager != nil {
			if mcpTools, err := a.mcpManager.GetAllTools(agentCtx); err == nil && len(mcpTools) > 0 {
				workspaceTools = append(workspaceTools, mcpTools...)
			}
		}

		// 6. 通用多轮自主自愈状态机 (以大模型不再调用工具或目标达成作为核心自然收敛依据)
		const maxWatchdogTurns = 12
		for turn := 1; turn <= maxWatchdogTurns; turn++ {
			if agentCtx.Err() != nil {
				break
			}

			llmReq := llm.Request{
				Endpoint: endpoint,
				APIKey:   apiKey,
				Model:    model,
				Messages: conversation,
				Tools:    workspaceTools,
			}

			var roundContent strings.Builder
			toolCalls, err := llm.StreamChat(agentCtx, llmReq, llm.StreamHandlers{
				OnThinking: func(text string) {
					assistantThinking.WriteString(text)
					runtime.EventsEmit(a.ctx, "agent:thinking", map[string]any{
						"session_id": req.SessionID,
						"thinking":   text,
						"turn":       turn,
					})
				},
				OnContent: func(delta string) {
					assistantContent.WriteString(delta)
					roundContent.WriteString(delta)
					runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
						"session_id": req.SessionID,
						"delta":      delta,
						"turn":       turn,
					})
				},
				OnError: func(err error) {
					errMsg := fmt.Sprintf("\n\n[系统错误: %v]", err)
					assistantContent.WriteString(errMsg)
					runtime.EventsEmit(a.ctx, "agent:chunk", map[string]any{
						"session_id": req.SessionID,
						"delta":      errMsg,
						"turn":       turn,
					})
				},
			})

			// 核心自然收敛判定：若模型没有发起工具调用 (Zero Tool Calls) 或发生错误，说明目标已达成或已汇报完毕，立即退出循环！
			if err != nil || len(toolCalls) == 0 {
				break
			}

			// 将模型本轮决策与工具调用注入上下文
			conversation = append(conversation, llm.Message{
				Role:      "assistant",
				Content:   roundContent.String(),
				ToolCalls: toolCalls,
			})

			// 物理执行当前轮下发的各个算子并收集反馈
			for _, tc := range toolCalls {
				toolName := tc.Function.Name
				toolArgs := tc.Function.Arguments

				runtime.EventsEmit(a.ctx, "agent:tool_start", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"args":       toolArgs,
					"turn":       turn,
				})

				var output string
				switch toolName {
				case "exec_command":
					res, err := a.termTool.Execute(agentCtx, []byte(toolArgs))
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

						// 触发毫秒级轻量 LSP 编译器语法诊断自愈守卫
						if diagReport, err := lsp.DiagnoseFile(a.workspace, argsObj.RelPath); err == nil && diagReport != nil && diagReport.HasErrors {
							feedback := lsp.FormatDiagnosticFeedback(diagReport)
							output += feedback
							runtime.EventsEmit(a.ctx, "lsp:diagnostic", map[string]any{
								"session_id": req.SessionID,
								"file":       argsObj.RelPath,
								"has_errors": true,
								"errors":     diagReport.Errors,
							})
						}
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
					if a.mcpManager != nil {
						var mcpArgs map[string]any
						if len(toolArgs) > 0 {
							_ = json.Unmarshal([]byte(toolArgs), &mcpArgs)
						}
						if mcpArgs == nil {
							mcpArgs = make(map[string]any)
						}
						mcpRes, err := a.mcpManager.CallTool(agentCtx, toolName, mcpArgs)
						if err != nil {
							output = fmt.Sprintf("MCP 算子 [%s] 执行失败: %v", toolName, err)
						} else {
							output = mcpRes
						}
					} else {
						output = fmt.Sprintf("未知算子: %s", toolName)
					}
				}

				tExec := session.ToolExecution{
					Name:   toolName,
					Args:   toolArgs,
					Output: output,
				}
				allToolExecs = append(allToolExecs, tExec)
				lastToolExec = &tExec

				runtime.EventsEmit(a.ctx, "agent:tool_end", map[string]any{
					"session_id": req.SessionID,
					"id":         tc.ID,
					"tool":       toolName,
					"output":     output,
					"turn":       turn,
				})

				conversation = append(conversation, llm.Message{
					Role:       "tool",
					ToolCallID: tc.ID,
					Name:       toolName,
					Content:    output,
				})
			}
		}

		// 7. 持久化 Assistant 回复至磁盘
		asstMsg := session.SessionMessage{
			ID:       fmt.Sprintf("msg_%d", time.Now().UnixNano()),
			Role:     "assistant",
			Content:  assistantContent.String(),
			Thinking: assistantThinking.String(),
			Tool:     lastToolExec,
			Tools:    allToolExecs,
			Time:     time.Now().Format("15:04"),
		}
		currentSession.Messages = append(currentSession.Messages, asstMsg)
		currentSession.UpdatedAt = time.Now().Unix()
		_ = a.sessionStore.Save(currentSession)

		runtime.EventsEmit(a.ctx, "agent:done", map[string]any{"session_id": req.SessionID})
	}()

	return nil
}


// GitListBranches 列出本地全部分支与当前分支
func (a *App) GitListBranches() ([]string, string, error) {
	return gitops.ListBranches(a.workspace)
}

// GitCheckoutBranch 切换检出分支
func (a *App) GitCheckoutBranch(name string) error {
	return gitops.CheckoutBranch(a.workspace, name)
}

// GitCreateBranch 创建并检出新分支
func (a *App) GitCreateBranch(name string) error {
	return gitops.CreateBranch(a.workspace, name)
}

// GitListSnapshots 枚举快照与暂存回溯点
func (a *App) GitListSnapshots() ([]gitops.Snapshot, error) {
	return gitops.ListSnapshots(a.workspace)
}

// GitCreateSnapshot 创建当前工作区检查点快照
func (a *App) GitCreateSnapshot(msg string) error {
	return gitops.CreateSnapshot(a.workspace, msg)
}

// GitRestoreSnapshot 还原指定快照
func (a *App) GitRestoreSnapshot(stashID string) error {
	return gitops.RestoreSnapshot(a.workspace, stashID)
}

// RunTDDValidation 触发 Sub-Agent TDD 自动化单测红绿灯自愈检查
func (a *App) RunTDDValidation() (agent.TestReport, error) {
	return agent.RunTDDValidation(a.workspace)
}

// RunSecurityAudit 触发 Sub-Agent 安全沙箱代码与命令审查
func (a *App) RunSecurityAudit() (agent.AuditReport, error) {
	return agent.RunSecurityAudit(a.workspace)
}

// GetUsageMetrics 获取 Token 消耗与网关使用量统计大盘
func (a *App) GetUsageMetrics() telemetry.UsageMetrics {
	sessions := a.sessionStore.List()
	return telemetry.GetTracker().GetMetrics(len(sessions))
}
