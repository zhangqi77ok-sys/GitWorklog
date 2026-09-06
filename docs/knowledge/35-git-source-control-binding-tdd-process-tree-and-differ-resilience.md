# 知识沉淀 35: Git 源码管理全双工双向交互、TDD 进程树孤儿规避与 Differ 物理容灾治理

## ① 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 桌面端（Go 1.21+ 微内核 + Wails 原生 IPC + Vue 3 暖色极简前端）的持续迭代演进中，针对源码管理（Git Source Control）、自动化 TDD 测试驱动执行、Diff 物理差异审查与网络探活组件，发现了一组深层次架构断层与隐蔽缺陷：
1. **Git 源码管理抽屉交互断层 (Hollow UI)**：在 `LeftDrawer.vue` 中，底部的 Git Commit 输入框与“✓ 提交变更 (Commit & Push)”按钮未绑定 `v-model` 与 `@click` 事件，处于失联的空壳状态，用户无法直接在侧栏提交代码；而在 `App.vue` 中，直接遍历 `gitStatus.working` 渲染时，未解析对象结构导致文件路径显示为 `[object Object]`，且遗漏了 `untracked` 未追踪文件的渲染。
2. **TDD 自动化验证子进程孤儿存活**：`internal/agent/swarm.go` 的 `RunTDDValidation` 在 60 秒硬超时时，默认调用 `CommandContext` 的 `Kill()`，在 Windows 系统下只能杀死父进程 `go.exe`，导致编译出的临时测试二进制文件（如 `xxx.test.exe`）继续孤儿存活在后台，锁死工作区文件。
3. **物理删除文件 Diff 审查崩溃**：`internal/diff/differ.go` 在处理已通过 `git rm` 或直接物理删除的文件时，由于前置 `os.Stat(absPath)` 返回文件不存在，直接抛出 `file does not exist` 错误，导致用户在 DiffWorkspace 中无法审查已被删除代码的负向变更差异。
4. **算子 Action 大小写敏感导致调用失败**：大模型（如 DeepSeek-R1、Claude 3.7、GPT-4o）在输出工具参数时，经常生成 `"Action": "Write"`、`"READ"` 等首字母大写格式，原代码 `switch args.Action` 严格区分大小写，直接命中 default 报错 `unknown action`。
5. **智能体直接写文件缺少快照回退保护**：智能体主循环在执行 `write_file` 算子时，未调用快照管理器（`snapshotMgr.CreateSnapshot`），违反“文件修改前自动建立轻量影子快照、支持秒级无损回退”的架构安全铁律。
6. **网络探活 5xx 假健康漏报**：`pinger.go` 在探测后端服务或网关时未校验响应状态码，当网关故障返回 500、502、503 时，仍计算往返毫秒耗时并作为成功返回，导致前端将已宕机的上游服务误判为健康在线。
7. **工作区热切换上下文竞争残留**：`SetWorkspace` 切换工作区时，未主动取消前序工作区仍在执行的智能体多轮流式推理或终端命令，导致旧任务跨项目继续往旧目录写代码或向新界面派发错乱事件。
8. **快照还原纯数字编号兼容性**：`RestoreSnapshot` 强制要求传入标准的 `stash@{...}` 格式，用户若传入纯数字编号 `"0"`、`"1"` 时直接报格式错误拦截。
9. **卸载器阻塞弹窗致延时脚本删除失败**：卸载程序先通过 `ShellExecute` 唤起延时批处理，再调阻塞式的 Win32 MessageBox；若用户超过 3 秒未点击“确定”，批处理脚本因 `uninstall.exe` 仍被占用而无法删除安装目录。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Git Porcelain 结构化报表与 Vue 响应式契约
Go 微内核的 `gitTool.GetStatus()` 输出符合 Git Porcelain v2 规范的结构化报表：
- `Working`: `[]GitFileStatus`（含 `path`、`work_code`、`staged_code`）
- `Untracked`: `[]string`
前端若直接以字符串形式渲染 `gitStatus.working`，在 JavaScript 中对象会被强制转换为 `"[object Object]"`，同时 `openFileDiff([object Object])` 会导致 IPC 参数传递畸变。必须通过响应式计算属性将 `working` 与 `untracked` 合并归一化为统一的 `{ path, type, color }` 契约实体。

### 2. Windows 编译型测试子进程的生命周期隔离
Go 执行 `go test ./...` 时，Go 编译器会先在临时目录编译出测试二进制文件（如 `b239.test.exe`），然后创建子进程运行测试。若外部仅向 `go.exe` 派发终止信号，Windows 不会自动级联终止该测试子进程。必须在 `exec.Cmd.Cancel` 回调中显式调用 `taskkill /F /T /PID` 才能保障整树消亡。

### 3. Git Diff 负向变更（Negative Diff）与文件存在性解耦
Diff 引擎的核心职责是呈现工作区与暂存区/HEAD 之间的真实补丁（Patch）。当文件在物理磁盘上已被删除时，`git diff HEAD -- <file>` 会产生合法的删除补丁（`deleted file mode 100644\n--- a/file\n+++ /dev/null`）。因此，Diff 计算绝不能单纯以 `os.Stat` 物理存在作为前提，必须在文件缺失时检查 Git 历史是否存在删除差异记录。

### 4. Windows 原生卸载器脱机批处理与进程句柄占用
Windows 操作系统的 PE 文件在被任何进程执行时，其文件句柄被内核锁定（`FILE_SHARE_READ`），任何进程（包括管理员和批处理）均无法直接执行 `del uninstall.exe` 或 `rmdir /s /q`。必须保证在唤起批处理脚本后，卸载器主体进程在毫秒级内完成 `main()` 退出并释放进程句柄，因此阻塞式的用户确认弹窗必须严格放置在批处理拉起之前。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 前端 Working Tree 归一化与 Commit 双向绑定
在 `frontend/src/App.vue` 与 `LeftDrawer.vue` 中统一构造 `workingTreeFiles` 计算属性，并绑定提交逻辑：

```ts
const workingTreeFiles = computed(() => {
  const list: { path: string; type: string; color: string }[] = []
  if (gitStatus.value?.working && Array.isArray(gitStatus.value.working)) {
    for (const f of gitStatus.value.working) {
      if (typeof f === 'string') {
        list.push({ path: f, type: 'M', color: 'text-amber-600' })
      } else if (f && typeof f === 'object') {
        list.push({
          path: f.path || '',
          type: f.work_code || 'M',
          color: f.work_code === 'D' ? 'text-red-500' : 'text-amber-600'
        })
      }
    }
  }
  if (gitStatus.value?.untracked && Array.isArray(gitStatus.value.untracked)) {
    for (const p of gitStatus.value.untracked) {
      list.push({
        path: typeof p === 'string' ? p : (p as any)?.path || '',
        type: 'U',
        color: 'text-emerald-600'
      })
    }
  }
  return list
})
```

### 2. Differ 支持已删除文件的差异渲染
在 `internal/diff/differ.go` 中，当本地文件不存在时，检查 Git 差异输出：

```go
if _, err := os.Stat(absPath); os.IsNotExist(err) {
    cmdCheck := gitCmd(workspaceRoot, "diff", "HEAD", "--", relPath)
    var checkOut bytes.Buffer
    cmdCheck.Stdout = &checkOut
    if errCheck := cmdCheck.Run(); errCheck != nil || checkOut.Len() == 0 {
        return report, fmt.Errorf("file [%s] does not exist", relPath)
    }
}
```

### 3. 网络探活 5xx 严格 Fail-Closed
在 `internal/network/pinger.go` 中加入状态码防线：

```go
if resp.StatusCode >= 500 {
    return "", fmt.Errorf("ping failed: server returned status %d", resp.StatusCode)
}
```

### 4. 卸载流程时序重排杜绝文件锁死
在 `cmd/uninstaller/main.go` 中，先弹窗确认卸载完成，最后调用 `ShellExecuteW` 唤起延时自删除批处理，使程序立即自然退出。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **复杂数据契约禁止直接在模板中假定为基础类型**：后端 IPC 返回复杂对象切片（如 `GitFileStatus`、`FileNode`）时，前端必须通过 TypeScript Interface 进行强类型约束并提取相应字段，杜绝直接渲染对象产生 `[object Object]`。
2. **外部大模型输入参数必须无条件进行不区分大小写归一化**：模型生成的枚举值（如 `action`、`type`、`role`）必须统一经过 `strings.ToLower(strings.TrimSpace(val))` 处理。
3. **工作区动态切换前强制取消前序任务**：在微内核变更工作区（`SetWorkspace`）时，必须以原子方式取消当前正在运行的智能体上下文（`agentCancel`）与终端上下文（`terminalCancel`），确保新旧工作区之间绝对隔离。
