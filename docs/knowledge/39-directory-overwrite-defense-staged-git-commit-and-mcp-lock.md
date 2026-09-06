# 39. 目录防覆盖防御、Git 暂存区感知提交、MCP 锁粒度优化与全链路无黑框防护

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode 桌面端（基于 Wails v2 + Go 微内核 + Vue 3 / TS 前端）系统级巡检与调用链深入审查中，定位并彻底根治了 10 项严重系统级缺陷与安全隐患：

1. **沙箱原子文件写入（`AtomicWriteFile`）覆盖目录时的致命反向删除风险**：旧代码仅判断了 `validated == s.rootDir`，当调用方试图向已存在的子目录路径写入文件时，Windows 下 `os.Rename(tmpFile, validated)` 失败并触发回退分支 `_ = os.Remove(validated)`，导致已存在的空目录被意外物理删除；
2. **`GitCommit` 无条件执行 `git add -A` 强行覆盖用户暂存区选择**：在代码提交抽屉中，用户可能精心挑选暂存了部分文件，但后台 `GitCommit` 每次盲目执行 `git add -A`，将用户未暂存（Unstaged）的临时变动一股脑全部提交；
3. **Wails 原生 IPC 桥接层缺失 `GitUnstage` 取消暂存接口**：前端虽有暂存逻辑，但缺乏对应的取消暂存（Unstage）能力，用户一旦误暂存文件便无法在 UI 上还原，造成暂存状态不可逆；
4. **Git 快照管理器（`SnapshotManager.execGit`）缺失无黑框属性**：在执行快照创建、回滚与列表查询时，未配置 Windows `0x08000000` / `HideWindow: true`，导致用户操作时频繁在后台闪现 Windows CMD 黑框；
5. **HTTP 静态差异服务（`handleFsOriginal`）路径穿越与黑框隐患**：读取 HEAD 原始内容时未调用 `sandbox.ValidatePath`，存在路径越界与任意命令参数注入风险，且同样缺失无黑框属性；
6. **MCP 协议管理器（`mcp.Manager`）停止服务全局锁死锁阻塞**：`StopServer` 与 `StopAll` 在持有 `m.mu.Lock()` 互斥锁期间同步调用包含最长 1 秒超时等待的 `client.Stop()`，导致高并发下所有并发的 `CallTool` 与 `ListTools` 请求被长时间完全挂死；
7. **AST 拓扑扫描器根目录清洗不一致导致相对路径解析失败**：`ScanWorkspaceAST` 入口虽对 `rootDir` 进行了 `filepath.Clean`，但内部闭包回调 `filepath.Walk` 时传入的仍是未清洗的原始路径，导致 Windows 下正反斜杠混用时 `filepath.Rel` 频繁报错并退化为纯文件名；
8. **会话元数据零时间戳显示东八区怪异时间 `"08:00"`**：`session/store.go` 中若新创建会话的 `UpdatedAt <= 0`，旧逻辑直接对其进行 `time.Unix(sess.UpdatedAt, 0).Format("15:04")`，在 UTC+8 环境下被计算并展示为怪异的 `"08:00"`；
9. **前端 IPC 桥接层 `gitCommit` 在微内核断开时伪造假成功（铁律 0.5 违规）**：在微内核未连接或 `app.GitCommit` 尚未注入时，旧代码直接 `return 'Committed successfully'` 返回假成功字符串，严重掩盖了真实故障；
10. **蜂群多智能体 TDD 验证在非 Windows 环境下进程孤儿与泄漏**：`RunTDDValidation` 仅为 Windows 配置了 `cmd.Cancel = taskkill`，非 Windows 环境未配置 `cmd.Cancel` 导致超时或被取消时产生僵尸测试进程。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Windows 文件系统原子 Rename 语义与 IsDir 防护
在 Windows 平台中，`os.Rename(oldpath, newpath)` 无法直接用文件覆盖目录。若目标路径 `validated` 是一个已存在的目录，`os.Rename` 将返回 `Access is denied` 或 `File exists` 错误。如果开发人员直接在错误处理分支中编写 `_ = os.Remove(validated)` 试图清理目标文件再重试，便会直接将空目录物理删除。因此，在执行写盘和 rename 前，必须首先执行 `os.Stat(validated)`，若目标是目录，坚决拒绝写入并返回明确的 `security violation: target path is a directory` 错误。

### 2. Git 暂存区感知（`git diff --cached --quiet`）与精准提交
Git 提交机制应遵循开发者的自由意志。在 Git 中，`git diff --cached --quiet` 命令专门用于检测暂存区状态：
- 若暂存区有变动，该命令退出码为 `1`；
- 若暂存区为空，该命令退出码为 `0`。
微内核应先执行探针检测：若检测到已有暂存内容（退出码非 0），则直接调用 `git commit -m`，只提交已暂存改动；仅在暂存区完全为空时，才作为便捷兜底执行 `git add -A`。

### 3. Go 互斥锁粒度控制与慢 I/O 外置原则
互斥锁（`sync.Mutex` 或 `sync.RWMutex`）的设计宗旨是保护共享内存状态（如 Map 映射、切片增删），必须确保锁内操作在微秒级完成。外部进程关闭、网络 I/O、管道排空等耗时操作（`client.Stop()` 等待退出长达 1 秒）**严禁置于互斥锁临界区内**。正确模式是：在锁内原子移除并暂存指针对象，释放锁后再执行该对象的慢清理与停止操作，从而彻底杜绝并发阻塞死锁。

### 4. Windows `CREATE_NO_WINDOW`（`0x08000000`）全局注入
在 Windows 平台下，任何通过 `exec.Command` 拉起控制台程序（如 `git`、`node`、`python`）若未配置 `SysProcAttr`，操作系统均可能为其分配独立控制台窗口，导致用户屏幕出现频繁黑框闪烁。统一注入以下配置是桌面端核心底线：
```go
&syscall.SysProcAttr{
    HideWindow:    true,
    CreationFlags: 0x08000000, // CREATE_NO_WINDOW
}
```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 原子写盘前置目录校验防御 (`internal/core/sandbox/fs.go`)
```go
// 提前检查目标路径是否已存在且为目录，坚决防止 rename 失败后误删目录
if stat, err := os.Stat(validated); err == nil && stat.IsDir() {
    return fmt.Errorf("security violation: target path is a directory: %s", validated)
}
```

### 2. 暂存区感知与精准 Git 提交 (`app.go`)
```go
// 1. 先检查暂存区是否已有内容 (git diff --cached --quiet 退出码 1 代表有暂存变更)
diffCachedCmd := exec.Command("git", "diff", "--cached", "--quiet")
diffCachedCmd.Dir = a.workspace
if attr := windowsSysProcAttr(); attr != nil {
    diffCachedCmd.SysProcAttr = attr
}
hasStaged := diffCachedCmd.Run() != nil // 退出码非 0 说明已有暂存改动

// 2. 若暂存区完全为空，自动将工作区变动暂存
if !hasStaged {
    cmdAdd := exec.Command("git", "add", "-A")
    cmdAdd.Dir = a.workspace
    if attr := windowsSysProcAttr(); attr != nil {
        cmdAdd.SysProcAttr = attr
    }
    if err := cmdAdd.Run(); err != nil {
        return "", err
    }
}
```

### 3. Wails IPC 桥接层实现 `GitUnstage` 取消暂存 (`app.go` & `wailsBridge.ts`)
```go
// GitUnstage 真实取消暂存单个文件
func (a *App) GitUnstage(filePath string) error {
    if a.sandbox != nil {
        if _, err := a.sandbox.ValidatePath(filePath); err != nil {
            return fmt.Errorf("security violation: %w", err)
        }
    }
    cmd := exec.Command("git", "restore", "--staged", "--", filePath)
    cmd.Dir = a.workspace
    if attr := windowsSysProcAttr(); attr != nil {
        cmd.SysProcAttr = attr
    }
    if err := cmd.Run(); err == nil {
        return nil
    }
    // 降级使用 git reset HEAD -- filePath
    resetCmd := exec.Command("git", "reset", "HEAD", "--", filePath)
    resetCmd.Dir = a.workspace
    if attr := windowsSysProcAttr(); attr != nil {
        resetCmd.SysProcAttr = attr
    }
    return resetCmd.Run()
}
```

### 4. MCP 管理器停止服务互斥锁粒度优化 (`internal/mcp/manager.go`)
```go
func (m *Manager) StopServer(name string) error {
    m.mu.Lock()
    client, ok := m.clients[name]
    if !ok {
        m.mu.Unlock()
        return fmt.Errorf("server %s not running", name)
    }
    delete(m.clients, name)
    m.mu.Unlock()

    // 将耗时慢 I/O (包含最长 1 秒超时等待) 移出互斥锁临界区，避免阻塞 CallTool/ListTools
    return client.Stop()
}
```

### 5. 前端 IPC 桥接层严格 Fail-Closed 拒绝假成功 (`wailsBridge.ts`)
```typescript
async gitCommit(msg: string): Promise<string> {
    const app = getApp()
    if (app?.GitCommit) {
        return await app.GitCommit(msg)
    }
    // 严格遵循铁律 0.5，杜绝假成功，暴露微内核未就绪真实错误
    throw new Error('microkernel not connected: GitCommit unavailable')
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **写文件严禁假设目标不是目录**：在受控文件沙箱或跨平台应用中，永远不可用写文件接口覆盖现有目录。必须前置执行 `os.Stat(path).IsDir()`，一旦命中目录立即拦截并显式报错；
2. **用户选择不可盲目覆盖**：Git 工作流中，用户操作暂存区与未暂存区是细粒度的代码版本管理行为。后端提交逻辑必须优先探测已有暂存区（`git diff --cached --quiet`），杜绝粗暴无脑 `git add -A`；
3. **互斥锁临界区严禁包含外部进程生命周期等待**：任何涉及网络连接断开、子进程退出等待、文件同步落盘等操作，必须先在锁内完成状态解绑（`delete(map, key)`），在释放互斥锁之后再执行慢清理；
4. **路径解析前后端基准必须严格同构**：跨平台（特别是 Windows）文件路径处理时，入口一律执行 `filepath.Clean` 与 `filepath.ToSlash`，在传递给递归枚举器时保持统一的规范化基准，杜绝由于一个斜杠差异导致 `filepath.Rel` 失败；
5. **铁律 0.5 零假成功原则**：桌面端 IPC 通信与桥接层严禁在内核离线时静默返回假成功字符（如 `'Committed successfully'`），必须 Fail-Closed 抛出真实异常并驱动前端友好错误弹窗。\n