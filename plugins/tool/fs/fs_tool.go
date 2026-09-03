package fs

import (
	"context"
	"encoding/json"
	"fmt"
	"tcode/internal/core/sandbox"
	v1 "tcode/pkg/plugin/v1"
)

// Tool 文件系统受控操作算子插件
type Tool struct {
	id          string
	name        string
	version     string
	sandbox     *sandbox.Sandbox
	snapshotMgr *sandbox.SnapshotManager
}

// NewTool 构造实例
func NewTool(sb *sandbox.Sandbox, sm *sandbox.SnapshotManager) *Tool {
	return &Tool{
		id:          "tool.fs",
		name:        "Filesystem Controlled Sandbox Tool",
		version:     "1.0.0",
		sandbox:     sb,
		snapshotMgr: sm,
	}
}

func (t *Tool) ID() string             { return t.id }
func (t *Tool) Name() string           { return t.name }
func (t *Tool) Version() string        { return t.version }
func (t *Tool) Type() v1.PluginType    { return v1.TypeTool }
func (t *Tool) Init(ctx context.Context, cfg json.RawMessage) error { return nil }
func (t *Tool) Start(ctx context.Context) error { return nil }
func (t *Tool) Stop(ctx context.Context) error  { return nil }
func (t *Tool) Health(ctx context.Context) v1.HealthStatus {
	return v1.HealthStatus{Healthy: true, Message: "FS Sandbox ready"}
}

func (t *Tool) Definition() v1.ToolDefinition {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"action": map[string]any{
				"type": "string",
				"enum": []string{"read", "write", "list"},
				"description": "文件操作类型: read (读取), write (原子写入), list (列出目录)",
			},
			"path": map[string]any{
				"type": "string",
				"description": "相对工作区的目标文件或目录路径",
			},
			"content": map[string]any{
				"type": "string",
				"description": "写入的文件内容 (action=write 时必填)",
			},
		},
		"required": []string{"action", "path"},
	}
	schemaBytes, _ := json.Marshal(schema)

	return v1.ToolDefinition{
		Name:        "fs_control",
		Description: "在受控沙箱内安全地读写或列出工作区文件，写入前自动生成无损快照",
		Parameters:  schemaBytes,
	}
}

func (t *Tool) Execute(ctx context.Context, rawArgs json.RawMessage) (*v1.ToolResult, error) {
	var args struct {
		Action  string `json:"action"`
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := json.Unmarshal(rawArgs, &args); err != nil {
		return &v1.ToolResult{Content: fmt.Sprintf("invalid arguments: %v", err), IsError: true}, nil
	}

	switch args.Action {
	case "read":
		data, err := t.sandbox.SafeReadFile(args.Path)
		if err != nil {
			return &v1.ToolResult{Content: fmt.Sprintf("read error: %v", err), IsError: true}, nil
		}
		return &v1.ToolResult{Content: string(data), IsError: false}, nil

	case "write":
		// 写前轻量建立影子快照
		if t.snapshotMgr != nil {
			_, _ = t.snapshotMgr.CreateSnapshot(fmt.Sprintf("before write to %s", args.Path))
		}

		if err := t.sandbox.AtomicWriteFile(args.Path, []byte(args.Content)); err != nil {
			return &v1.ToolResult{Content: fmt.Sprintf("atomic write error: %v", err), IsError: true}, nil
		}
		return &v1.ToolResult{Content: fmt.Sprintf("file [%s] written successfully (atomic sync)", args.Path), IsError: false}, nil

	case "list":
		entries, err := t.sandbox.ListDir(args.Path)
		if err != nil {
			return &v1.ToolResult{Content: fmt.Sprintf("list error: %v", err), IsError: true}, nil
		}
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			tag := "[FILE]"
			if e.IsDir() {
				tag = "[DIR]"
			}
			names = append(names, fmt.Sprintf("%s %s", tag, e.Name()))
		}
		bytesOut, _ := json.Marshal(names)
		return &v1.ToolResult{Content: string(bytesOut), IsError: false}, nil

	default:
		return &v1.ToolResult{Content: fmt.Sprintf("unknown action: %s", args.Action), IsError: true}, nil
	}
}
