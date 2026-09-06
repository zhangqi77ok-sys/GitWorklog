# 38. 工具空输出防御、RevertFile 撤销防误删、真实快照时间戳与事件全量清理

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode 桌面端（基于 Wails v2 + Go 微内核 + Vue 3 / TS 前端）系统级巡检与调用链深入审查中，定位并根治了 10 项严重系统级缺陷与安全隐患：

1. **主智能体执行循环工具空输出引发上游网关 400 崩溃**：当大模型调用的工具没有控制台输出（例如静默执行成功的操作）时，`app.go` 直接回填空字符串 `Content: output`，导致 OpenAI / Anthropic 等模型网关返回 `400 Bad Request: 'messages[x].content' cannot be empty`；
2. **`RevertFile` 空仓库无 HEAD 时导致用户文件毁灭性删除**：旧代码直接执行 `git checkout HEAD -- filePath`，在新创建未提交 commit 的空仓库中必定失败，随后的错误处理盲目调用 `os.Remove(validPath)`，造成严重的数据丢失；
3. **沙箱路径逃逸检测误杀合法文件名**：`filepath.Rel` 检测使用 `strings.HasPrefix(rel, "..")`，导致工作区内合法命名以双点开头的文件（如 `..config.json` 或 `..env`）被误判为越界逃逸；
4. **`ListDir` 对工作区根目录（空路径与 `.`）拒绝访问**：大模型调用 `ListDir("")` 或 `ListDir(".")` 列出工作区根目录时，因 `ValidatePath("")` 抛出 `SECURITY: empty path is not allowed` 导致根目录无法枚举；
5. **GitOps 历史快照时间戳写死为当前秒数（违背铁律 0.5）**：`ListSnapshots` 将快照的 `Time` 和 `Timestamp` 均硬编码为 `time.Now()`，导致每次界面刷新所有快照时间均跳变为当前时间；
6. **未追踪新文件 Diff 针对 0 字节文件与 CRLF 损坏**：直接 `strings.Split(content, "\n")` 导致 0 字节空文件计算出 1 行伪新增，且在 Windows 下每行保留 `\r` 回车符导致 patch 污染；
7. **MCP `StdioClient.readLoop` 空指针异常隐患**：当进程启动异常或提前关闭时，`c.stdout` 为 `nil`，未做前置判断可能引发空指针解引用；
8. **终端执行算子全空格指令穿透执行**：`Execute` 与 `ExecuteStream` 仅对空字符串做拦截，传入全空格（如 `"   "`）时被穿透至 Windows CMD，引发挂起或无意义报错；
9. **SSE 流式传输中途网关报错静默吞没**：大模型流式生成过程中若遭遇网关限流、配额耗尽或敏感词拦截，上游下发包含 `error` 对象的 chunk，旧逻辑只匹配 `Choices` 导致错误被静默吞掉，呈现虚假成功；
10. **前端全局事件监听器注销遗漏导致内存与调用泄漏**：`wailsBridge.ts` 中的 `cleanAll` 在任务结束或异常退出时，遗漏了 `agent:start`、`agent:files_changed` 与 `lsp:diagnostic` 等事件注销，高频对话后引发内存与事件监听器泄漏。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 严格模型协议契约与内容保全原则
OpenAI Chat Completions 协议规范明确要求：`role: "tool"` 的消息中，`content` 必须为有效非空文本字符串（Non-empty String）。对于任何无输出的算子，微内核与协议适配层必须自动注入保全说明文本（如 `tool [%s] executed successfully with empty output`），杜绝向模型上游发送空 content。

### 2. Git 工作区未追踪与已追踪状态的精准分离
在 Git 中，未追踪文件（Untracked Files）由 `git status --porcelain` 输出的前缀 `??` 标明；已追踪文件（Tracked Files）在尚未提交任何 commit（无 HEAD 引用）时，`git checkout HEAD` 会返回 exit code 128 并报错 `fatal: invalid reference: HEAD`。直接依赖 checkout 失败作为“未追踪文件”的判断依据极为危险，必须显式结合 `git status --porcelain -- filePath` 进行状态甄别，坚决杜绝误删用户文件。

### 3. 沙箱路径相对化（Rel Path）的双点判定法则
`filepath.Rel(root, target)` 返回相对路径：
- 当 target 位于 root 外部的上一级时，返回 `..` 或以 `..\` / `../` 开头；
- 当 target 是 root 下合法命名的文件（如 `..test.txt`）时，相对路径恰为 `..test.txt`，其带有 `..` 前缀但并非父目录跃迁！
因此合法的逃逸判断必须是：
`rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || strings.HasPrefix(rel, "../")`。

### 4. Git Stash 历史时间戳的精准溯源
`git stash` 的本质是保存在 `refs/stash` 引用中的 commit 对象日志。直接调用 `git log -g --pretty=format:"%gd|%ct|%gs" refs/stash` 可以原子获取到每一个快照的：
- `%gd`: 快照 ID（例如 `stash@{0}`）
- `%ct`: 真实 Unix 提交时间戳（提交者的纪元秒数）
- `%gs`: 快照提交日志信息（例如 `On main: stash message`）
从而彻底消除硬编码伪造时间戳的弊端。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 工具空输出防御与协议适配
在 `app.go` 与 `pkg/protocol/openai_adapter.go` 中实施双重兜底：

```go
toolOutput := strings.TrimSpace(output)
if toolOutput == "" {
    toolOutput = fmt.Sprintf("tool [%s] executed successfully with empty output", toolName)
}
conversation = append(conversation, llm.Message{
    Role:       "tool",
    ToolCallID: tc.ID,
    Name:       toolName,
    Content:    toolOutput,
})
```

### 2. `RevertFile` 撤销防误删安全改造
在 `app.go` 中通过 `git status --porcelain` 精确确认文件状态：

```go
// 1. 先检查该文件在 git 中的真实状态，严禁无条件物理删除
statusCmd := exec.Command("git", "status", "--porcelain", "--", filePath)
statusCmd.Dir = a.workspace
if attr := windowsSysProcAttr(); attr != nil {
    statusCmd.SysProcAttr = attr
}
statusOut, _ := statusCmd.Output()
statusStr := strings.TrimSpace(string(statusOut))

// 若确认为未追踪文件 (??)，撤销即安全清理该未追踪新文件
if strings.HasPrefix(statusStr, "??") {
    if fi, statErr := os.Stat(validPath); statErr == nil && !fi.IsDir() {
        return os.Remove(validPath)
    }
    return nil
}

// 2. 对于已追踪文件，优先使用 git restore 撤销暂存区和工作区修改
restoreCmd := exec.Command("git", "restore", "--staged", "--worktree", "--", filePath)
restoreCmd.Dir = a.workspace
if attr := windowsSysProcAttr(); attr != nil {
    restoreCmd.SysProcAttr = attr
}
if err := restoreCmd.Run(); err == nil {
    return nil
}

// 3. 降级尝试 git checkout HEAD -- filePath
checkoutCmd := exec.Command("git", "checkout", "HEAD", "--", filePath)
checkoutCmd.Dir = a.workspace
if attr := windowsSysProcAttr(); attr != nil {
    checkoutCmd.SysProcAttr = attr
}
return checkoutCmd.Run()
```

### 3. 沙箱路径逃逸精准检测与 ListDir 根目录支持
在 `internal/core/sandbox/fs.go` 与 `internal/diff/differ.go` 中修复：

```go
rel, err := filepath.Rel(normRoot, normFull)
if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || strings.HasPrefix(rel, "../") {
    return "", fmt.Errorf("SECURITY: path [%s] escapes sandbox root [%s]", targetPath, s.rootDir)
}

// ListDir 列出指定目录内容（支持空路径或 "." 代表沙箱根目录）
func (s *Sandbox) ListDir(relPath string) ([]os.DirEntry, error) {
    trimmed := strings.TrimSpace(relPath)
    if trimmed == "" || trimmed == "." {
        return os.ReadDir(s.rootDir)
    }
    validated, err := s.ValidatePath(relPath)
    if err != nil {
        return nil, err
    }
    return os.ReadDir(validated)
}
```

### 4. Git 快照真实时间戳提取
在 `internal/gitops/gitops.go` 中：

```go
cmdLog := gitCmd(workspace, "log", "-g", "--pretty=format:%gd|%ct|%gs", "refs/stash")
if out, err := cmdLog.Output(); err == nil && len(bytes.TrimSpace(out)) > 0 {
    // 准确切分每一行并解析真实时间戳，格式化为时分秒
    // 杜绝任何使用 time.Now() 的伪造数据
}
```

### 5. 前端事件监听器统一声明式注销
在 `frontend/src/core/wailsBridge.ts` 中维护全量事件数组：

```ts
const agentEvents = [
  'agent:start',
  'agent:thinking',
  'agent:chunk',
  'agent:tool_start',
  'agent:tool_end',
  'agent:files_changed',
  'agent:done',
  'agent:complete',
  'agent:interrupted',
  'lsp:diagnostic'
]

const cleanAll = () => {
  try {
    if (runtime.EventsOff) {
      for (const ev of agentEvents) {
        runtime.EventsOff(ev)
      }
    }
  } catch (_) {}
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对杜绝使用 `time.Now()` 伪造历史时间（铁律 0.5）**：凡是涉及历史日志、提交记录、快照备份或文件元数据，必须从真实文件系统或 Git 底层读取时间戳；若无法获取，应置空或返回零值，禁止展示伪造的实时时间；
2. **物理文件删除操作必须设置严格门禁**：在任何涉及 `os.Remove` 或 `os.RemoveAll` 的路径上，严禁在捕获通用错误后盲目删除文件，必须结合元数据判断是否属于可删除的临时产物；
3. **大模型流式 SSE 异常探测必须优先于普通分片处理**：解析 SSE 报文时，若服务商返回带 `error` 对象的 JSON，必须立即捕获并中断流，将错误反馈给前端，避免大模型中途断流后界面卡在思考中；
4. **全套自动化测试守护**：在实施任何路径校验、Diff 计算或 GitOps 变更时，必须编写覆盖空仓库、无 HEAD、空文件与越界文件的单元测试，确保红绿灯循环闭环。
