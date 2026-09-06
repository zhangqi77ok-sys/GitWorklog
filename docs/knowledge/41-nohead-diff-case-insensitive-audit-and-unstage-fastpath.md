# 41. 无 HEAD 仓库增改 Diff 修正、大小写安全审计激活、取消暂存快速通道与终端进程取消

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 桌面端（Wails v2 + Go 微内核 + Vue 3 / TS 前端）系统级巡检与调用链深入静态代码审查中，定位并彻底根治了 10 项真实高危系统级缺陷与安全盲区：

1. **初建空仓库新增后修改（`AM`）文件在 Diff 视图中被误判为“工作区干净”**：在刚 `git init` 尚无 HEAD 提交的新工程中，文件暂存后再修改，`git status --porcelain` 输出 `AM <file>`；旧逻辑使用 `strings.HasPrefix(statusStr, "A ")` 严格匹配导致匹配失败，意外落入“未修改纯净文件”分支，向用户谎报“工作区干净 (Clean)”，导致真实行级差异被完全隐藏；
2. **Wails 原生 IPC `GitUnstage` 在无 HEAD 仓库中报错退出码 128**：用户在侧边栏抽屉点击取消暂存 `[-]` 时，微内核直接执行 `git restore --staged` 与 `git reset HEAD`，在空仓库中均因无法解析 HEAD 报错 `fatal: could not resolve HEAD`，导致取消暂存失败；
3. **安全沙箱审计（`RunSecurityAudit`）高危命令注入规则因大小写不匹配永久失效**：关键词列表硬编码了大写 `"exec.Command("cmd", "/c", "del"`，但比对时使用了 `strings.ToLower(str)`，导致破坏性命令审计规则成为永远无法命中的死代码；
4. **工作区根目录命名为 `build`/`bin`/`dist` 时安全审计直接跳过扫描（0 文件扫描假安全）**：`RunSecurityAudit` 中 `filepath.Walk` 发现目录基名为 `build` 时无脑返回 `filepath.SkipDir`，当用户工程根目录本身命名为 `build` 时，审计程序直接忽略整个工作区并输出 0 风险假安全报告；
5. **工程文件树展开时误杀带双点的合法子目录**：`buildFileTreeInternal` 遍历时使用 `strings.HasPrefix(relWs, "..")` 校验沙箱边界，导致形如 `..cache` 或 `..temp` 的合法内部目录被误判为越权逃逸而遭到静默丢弃；
6. **Git 快照管理器（`CreateSnapshot`）在无 HEAD 初始仓库中未拦截即调用 stash 导致报错**：空仓库无法执行 `git stash push`，缺乏前置 `HasGitHead` 拦截与自愈报错；
7. **前端代码撤回与分块采纳/丢弃在微内核断开时静默伪造假成功（铁律 0.5 违规）**：`wailsBridge.ts` 中 `revertFile`、`applyDiffHunk`、`discardDiffHunk` 缺失 Fail-Closed 守卫，在微内核未连接时静默吞下，导致 UI 弹出“已采纳/已撤回”的虚假提示；
8. **文件系统算子（`fs_control`）`list` 操作缺失根目录默认值与必填契约冲突**：大模型调用 `list` 操作遍历工作区根目录时常不传 `path` 或传空字符串，但元数据强行标记 `required: ["action", "path"]`，导致工具校验失败；且底层未将空路径缺省为当前目录 `.`；
9. **跨平台受控终端（`terminal_tool`）非 Windows 环境缺失 `cmd.Cancel` 导致超时孤儿进程挂死**：`Execute` 与 `ExecuteStream` 仅为 Windows 配置了任务树强杀，非 Windows 环境下缺少 `cmd.Cancel`，超时中断时只杀最外层 `sh`，子孙命令仍在后台空转；
10. **Windows 安装向导覆盖写入卸载程序未先清理旧文件且忽略写入错误**：`cmd/installer/main.go` 写入 `uninstall.exe` 时未调用 `os.Remove` 且未捕获错误，导致旧文件权限锁定时静默安装出损坏的卸载程序。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Git Porcelain 状态矩阵与无 HEAD 边界状态机
在 Git 中，`git status --porcelain` 输出每行前两个字符代表状态矩阵：
- 第 1 列代表 **Index (暂存区)** 状态；
- 第 2 列代表 **Working Tree (工作区)** 状态。
对于刚新建且已暂存但随后又被编辑的文件，状态码是 `AM`（A: 暂存区新增，M: 工作区修改）。
在没有 HEAD 的空仓库中，由于不存在基准树比对，整份文件相对仓库而言完全是全新内容。判定其是否属于新增范畴应遵循 `strings.HasPrefix(statusStr, "A")`，即只要 Index 状态为 `A`，均应视为全量新增差异处理。

### 2. 安全审计特征匹配的大小写归一化（Case Folding）
文本安全匹配必须确保比对双方位于同一字符集空间（Canonical Case Domain）：
- 若待检文本转换为小写（`strings.ToLower(source)`），比对的规则库（Pattern）也**必须全部经过小写转换**；
- 硬编码混合大小写的规则去比对全小写文本，在形式逻辑上永远为假（Dead Condition）。

### 3. 文件树遍历中的根节点（Root Invariant）保护
在递归遍历（如 `filepath.Walk`）中，第一个被访问的节点就是根目录自身（`path == rootDir`）。
若基于文件夹名称白名单/黑名单进行剪枝（`filepath.SkipDir`），必须始终遵守**根节点不变量（Root Invariant）**：
```go
if cleanPath != cleanRootDir && isIgnored(base) {
    return filepath.SkipDir
}
```
否则当用户刚好在名为 `build` 的目录中打开项目时，根目录就会在第 0 步被误杀剪枝。

### 4. 跨平台进程树生命周期与 `cmd.Cancel`
Go 1.20 引入了 `cmd.Cancel` 函数，用于精确接管 Context 超时或中断时的进程杀灭行为：
- Windows 下拉起的是控制台进程树，需要通过 `taskkill /F /T /PID` 顺藤摸瓜杀掉所有子进程；
- POSIX（Linux / macOS）下拉起的是管道进程，如果直接依赖默认的 `cmd.Process.Kill()`，往往只能终止 `sh` 进程，由 `sh` 派生的编译器、测试套件依然常驻后台成为孤儿僵尸进程。通过显式配置 `cmd.Cancel`，统一全平台进程生命周期管理。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 无 HEAD 仓库 `AM` 状态识别与 Diff 补全 (`internal/diff/differ.go`)
```go
// 如果是未追踪新文件 (??) 或新增暂存文件 (A / AM)
if strings.HasPrefix(statusStr, "??") || strings.HasPrefix(statusStr, "A") {
    // 提取完整物理内容按新增行 (+line) 渲染 Diff
}
```

### 2. 无 HEAD 仓库快速取消暂存通道 (`app.go`)
```go
// 针对无 HEAD 仓库（刚 git init 尚未提交），git restore --staged 会失败 (could not resolve HEAD)
// 此时优先使用 git rm --cached -f
if !diff.HasGitHead(a.workspace) {
    rmCmd := exec.Command("git", "rm", "--cached", "-f", "--", filePath)
    rmCmd.Dir = a.workspace
    if attr := windowsSysProcAttr(); attr != nil {
        rmCmd.SysProcAttr = attr
    }
    if err := rmCmd.Run(); err == nil {
        return nil
    }
}
```

### 3. 安全审查大小写归一化与根节点剪枝保护 (`internal/agent/swarm.go`)
```go
if info.IsDir() {
    cleanPath := filepath.Clean(path)
    cleanWs := filepath.Clean(workspace)
    if cleanPath != cleanWs {
        base := filepath.Base(path)
        if base == ".git" || base == "node_modules" || base == "bin" || base == "dist" || base == "build" || base == ".idea" || base == ".vscode" {
            return filepath.SkipDir
        }
    }
    return nil
}

for _, kw := range highRiskKeywords {
    if strings.Contains(strings.ToLower(str), strings.ToLower(kw)) {
        issues = append(issues, "文件 ["+rel+"] 发现高危破坏性指令特征: "+kw)
    }
}
```

### 4. 前端 IPC 严格遵循 Fail-Closed (`frontend/src/core/wailsBridge.ts`)
```typescript
async revertFile(filePath: string): Promise<void> {
  const app = getApp()
  if (app?.RevertFile) {
    await app.RevertFile(filePath)
    return
  }
  throw new Error('microkernel not connected: RevertFile unavailable')
}
```

### 5. 跨平台终端取消安全清理 (`plugins/tool/terminal/terminal_tool.go`)
```go
} else {
    cmd = exec.CommandContext(ctx, "sh", "-c", command)
    cmd.Cancel = func() error {
        if cmd.Process != nil && cmd.Process.Pid > 0 {
            return cmd.Process.Kill()
        }
        return nil
    }
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止在特征匹配中依赖原始规则字面量**：
   比对前双方统一调用 `strings.ToLower()` 是文本检索与静态安全审计的铁律；
2. **严防目录扫描剪枝“自杀”**：
   在任何忽略目录名单（如 `node_modules`、`build`）的遍历逻辑中，必须始终判断当前目录是否为遍历起点，严禁在第 0 步自杀性剪枝；
3. **UI 弹窗与后端成功必须真实挂钩**：
   前端在调用 IPC 桥接方法后，只有当底层确确实实返回成功才允许展示绿色 Toast，微内核断开时必须严格 Fail-Closed 抛出红色异常；
4. **Git 空仓库双向流转必须完备**：
   不仅是 `add` 和 `commit`，包括 `revert`、`unstage`、`diff` 在面对没有 HEAD 的初始状态时，必须全部配备非空分支与降级适配。
