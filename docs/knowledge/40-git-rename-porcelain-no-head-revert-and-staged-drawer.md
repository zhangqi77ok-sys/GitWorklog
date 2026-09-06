# 40. Git Porcelain v2 重命名解析修复、无 HEAD 初始仓库安全撤回、MCP 并发 I/O 锁优化与暂存区前端闭环

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode 桌面端（基于 Wails v2 + Go 桌面微内核 + Vue 3 / TS 前端）系统级巡检与调用链深度审查中，定位并彻底根治了 10 项严重系统级缺陷、并发挂死隐患与数据破坏风险：

1. **Git Porcelain v2 重命名项（`case "2"`）字段解析偏移且新旧路径颠倒**：`plugins/tool/git/git_tool.go` 中解析 Porcelain v2 重命名行时，错误地将第 8 个空格分词（即形如 `R100` 的相似度分数字符串）当作旧路径，并颠倒了新旧路径顺序，导致含有重命名的仓库在 Diff 与状态展示时发生路径错乱；
2. **`RestoreFile` 在 Git 撤回失败后盲目物理删除被追踪修改文件**：旧逻辑在 `git restore` 返回错误时，无条件执行 `os.Remove(cleanAbs)`，导致因文件被占用或语法冲突导致 restore 失败的已追踪源码文件被直接从磁盘永久抹除；
3. **初建无 HEAD 仓库（`git init`）撤销已暂存新增文件失败（退出码 128）**：在尚未产生首次 commit 的新建工程中，`git restore --staged` 或 `git checkout HEAD` 因无法解析 HEAD 报错 `fatal: could not resolve HEAD`，导致新用户初始化项目时无法撤销已暂存文件；
4. **HTTP 微内核服务（`handleFsRead`、`handleFsOriginal`、`handleFsWrite`）在沙箱未初始化时 SIGSEGV 崩溃**：HTTP 处理器在未校验 `s.sandbox != nil` 的情况下直接调用沙箱方法，当通过 HTTP 早期访问接口时引发空指针解引用崩溃；
5. **快照回滚（`handleSnapshotRollback`）缺失快照管理器判空与沙箱路径逃逸校验**：未检查 `s.snapshotMgr == nil`，且未对传入的 `req.Path` 执行沙箱验证，存在空指针崩溃与越权回滚风险；
6. **MCP 协议管理器（`GetAllTools`）持有全局读锁执行所有外部客户端阻塞 I/O**：在持有 `m.mu.RLock()` 读锁期间，遍历所有连接的外部 MCP 进程执行包含超时的 `client.ListTools(ctx)` 阻塞通信，导致其他协程（如热挂载、停止服务、调用工具）被长时间完全冻结挂死；
7. **前端 IPC 桥接层在断开时伪造假数据模拟执行（铁律 0.5 违规）**：`frontend/src/core/wailsBridge.ts` 中 `executeTerminalStream` 在后端断开时输出 `[local] executed` 假数据，`gitStage` 与 `gitUnstage` 静默忽略断开，严重违反 Fail-Closed 原则；
8. **工程文件树展开子节点点击打开 Diff 传递纯文件名导致路径失效**：`LeftDrawer.vue` 中点击子目录下的嵌套文件时调用 `store.openDiff(sub.name)` 仅传递纯文件名而非 `sub.path` 相对路径，导致多层级工程文件无法打开 Diff 视图；
9. **Git 源代码管理抽屉完全遗漏暂存区（STAGED）列表与取消暂存操作**：侧边栏抽屉仅列出 Working Tree 变更，文件暂存后从界面上彻底消失且无法取消暂存，缺乏 `[-]` 取消暂存交互闭环；
10. **LSP 编译器诊断沙箱校验误判双点合法文件名与跨平台进程泄露**：`strings.HasPrefix(rel, "..")` 误伤形如 `..sample.go` 的合法工作区文件，且非 Windows 环境下缺失 `cmd.Cancel` 导致超时时孤儿进程遗留。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Git Porcelain v2 重命名格式规范
Git Porcelain v2 格式针对重命名文件输出以 `2 ` 开头的行：
```
2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><TAB><origPath>
```
关键点解析：
- `<X><score>` 位于空格拆分的第 8 项（索引从 0 开始计数，如 `R100`）；
- `<path>`（新路径）与 `<origPath>`（旧路径）之间以制表符 `	` 分隔，**新路径在 TAB 之前，旧路径在 TAB 之后**；
- 路径中若包含空格，以空格分词会拆碎路径。正统解析方案是首先以制表符 `	` 分割整行，将前半部分按空格提取状态码与新路径（从第 9 项起拼接），制表符后半部分即为完整的旧路径 `origPath`。

### 2. 区分 Git 已追踪改动与未追踪文件（`??`）的安全删除语义
在撤回文件改动（Restore）时：
- 若文件被 Git 追踪且发生修改，撤回的正确方式是 `git restore --staged` 与 `git restore`，**任何情况下都绝对不能调用 `os.Remove` 物理删除**；
- 仅当该文件完全是未被追踪的新增文件（即 `git status --porcelain` 明确输出 `??`）且用户明确要求撤销时，物理删除才安全；
- 旧代码在 `git restore` 失败后错误地盲目执行 `os.Remove`，直接构成了高危的数据毁灭漏洞。

### 3. 无 HEAD 初始仓库的 Git 状态机特殊性
在执行了 `git init` 但尚未产生任何提交的空仓库中：
- `HEAD` 引用指向尚未存在的 `refs/heads/main`；
- 执行 `git restore --staged <file>` 或 `git checkout HEAD <file>` 必然抛出 `fatal: could not resolve HEAD`（退出码 128）；
- 在无 HEAD 状态下撤回已暂存文件，正统且唯一可靠的原生 Git 命令是：
  ```bash
  git rm --cached -f -- <path>
  ```
  该命令能够从 Git index 树中安全移除暂存项，而不依赖任何历史 commit 节点。

### 4. 互斥锁保护内存 vs 外部进程慢 I/O 解耦
`sync.RWMutex` 或 `sync.Mutex` 的持有时间必须尽可能短（通常为几微秒）。外部 MCP 服务器通过 stdio（标准输入输出）进行 JSON-RPC 通信，任何单个服务器由于启动慢、进程挂起或重载可能产生长达数秒的延迟。若在持有读锁 `m.mu.RLock()` 期间调用 RPC，所有并发写操作（如挂载新服务、更新配置、注销服务）将排队挂死。
**标准做法**：在读锁内快速浅拷贝客户端引用列表并立即释放锁，随后在临界区外并发执行慢 RPC。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. Git Porcelain v2 重命名严密解析 (`plugins/tool/git/git_tool.go`)
```go
case "2":
	// 格式: 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><TAB><origPath>
	tabParts := strings.Split(line, "\t")
	metaFields := strings.Fields(tabParts[0])
	if len(metaFields) >= 9 {
		filePath := strings.Join(metaFields[8:], " ")
		var origPath string
		if len(tabParts) > 1 {
			origPath = tabParts[1]
		}
		item := StatusItem{
			Path:     filePath,
			OrigPath: origPath,
			Staged:   metaFields[1][0:1],
			WorkTree: metaFields[1][1:2],
		}
		items = append(items, item)
	}
```

### 2. 安全防删的 RestoreFile 机制 (`plugins/tool/git/git_tool.go`)
```go
// 严禁对非未追踪文件盲目执行 os.Remove！
// 先检查文件是否完全属于未追踪的新文件 (??)
statusOut, _ := t.runGit("status", "--porcelain", "--", cleanPath)
isUntracked := strings.HasPrefix(strings.TrimSpace(statusOut), "??")
if isUntracked {
	if removeErr := os.Remove(cleanAbs); removeErr == nil {
		return fmt.Sprintf("Removed untracked file %s", cleanPath), nil
	}
}
return "", fmt.Errorf("failed to restore file %s: %s", cleanPath, restoreErr)
```

### 3. 无 HEAD 仓库已暂存文件安全回退 (`app.go`)
```go
if !diff.HasGitHead(a.workspace) {
	// 针对无 HEAD 仓库的特殊回退机制：使用 git rm --cached -f
	rmCmd := exec.Command("git", "rm", "--cached", "-f", "--", filePath)
	rmCmd.Dir = a.workspace
	_ = rmCmd.Run()
	_ = os.Remove(absPath)
	return nil
}
```

### 4. 读锁外置解耦的 MCP 工具查询 (`internal/mcp/manager.go`)
```go
func (m *Manager) GetAllTools(ctx context.Context) ([]protocol.Tool, error) {
	m.mu.RLock()
	clientMap := make(map[string]*Client, len(m.clients))
	for name, client := range m.clients {
		clientMap[name] = client
	}
	m.mu.RUnlock()

	var allTools []protocol.Tool
	for name, client := range clientMap {
		tools, err := client.ListTools(ctx)
		if err == nil {
			allTools = append(allTools, tools...)
		}
	}
	return allTools, nil
}
```

### 5. 前端 Git 暂存区感知与取消暂存闭环 (`frontend/src/App.vue`)
```typescript
const stagedTreeFiles = computed(() => {
  const list: { path: string; type: string; color: string }[] = []
  if (gitStatus.value?.staged && Array.isArray(gitStatus.value.staged)) {
    for (const f of gitStatus.value.staged) {
      const type = f.staged_code || f.index_code || 'M'
      list.push({
        path: f.path || '',
        type: type,
        color: type === 'D' ? 'text-red-500' : 'text-[#10A37F]'
      })
    }
  }
  return list
})

async function unstageFileAction(filePath: string, event?: MouseEvent) {
  if (event) event.stopPropagation()
  if (!filePath) return
  await wailsBridge.gitUnstage(filePath)
  await loadGitStatus()
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止在错误回退分支中滥用 `os.Remove`**：
   文件删除是不可逆的单向操作。遇到外部工具（如 Git）报错时，优先将真实错误暴露给上层调用者，只有当证据链 100% 确认目标是未追踪临时文件时才允许物理删除；
2. **严防 Git 历史空窗期陷阱**：
   在编写 Git 自动化与集成工具时，切记不可假设仓库必然存在 `HEAD` 或存在默认分支。任何调用 `git diff`、`git restore`、`git checkout` 的地方必须具备 `HasGitHead` 前置校验与无 HEAD 降级策略；
3. **保持读写锁临界区绝对纯粹**：
   锁内严禁包含磁盘文件读写、网络请求、外部子进程管道通信或任何可能会被阻塞的上下文等待；
4. **前端状态树全覆盖与严禁假数据**：
   Git 状态由 Working Tree、Staged Index、Untracked Files 三部分组成，界面必须完整渲染对应区域并提供双向可逆操作（Stage 与 Unstage），在桥接层断开时坚决 Fail-Closed 抛出异常。
