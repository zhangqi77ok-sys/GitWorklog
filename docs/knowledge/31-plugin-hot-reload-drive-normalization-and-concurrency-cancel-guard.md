# 31. 插件分段锁热替换、Windows 驱动器盘符归一化、任务并发取消保护与状态码防御

> 本文档针对 Tcode Studio 系统级核心缺陷研判（第 9 轮），深度剖析工作区热重载时插件注册中心拒绝同名 ID 导致旧工作区越权、Windows 下 `EvalSymlinks` 与工作区盘符大小写不一致导致文件树空白、并发流式任务退出时取消句柄冲掉新任务、上游模型网关未校验 HTTP 状态码致假成功空列表等典型高危架构陷阱。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在持续自动化每小时巡检与极端异常场景测试中，排查出以下系统级架构缺陷：
1. **工作区切换后智能体工具残留旧工作区 (Bug 1)**：`SetWorkspace` 切换工作区时重新构造 `gitTool`、`fsTool`、`termTool` 并调用 `a.registry.Register`，但由于注册中心发现同 ID 工具已存在时直接报错并被静默吞掉，导致智能体 ReAct 引擎中依然持有启动时的旧工作区插件，造成严重的跨项目数据读写与 Git 越权篡改；
2. **Windows 盘符大小写不一致致文件树空白 (Bug 2)**：`buildFileTreeInternal` 遍历目录并调用 `filepath.EvalSymlinks` 校验沙箱边界时，Windows 经常将软链接或路径盘符转为大写（如 `D:`），而工作区变量可能为小写（如 `d:`），导致 `filepath.Rel` 跨盘符判定失败直接拦截，文件树偶发返回空白；
3. **上游模型拉取未校验 HTTP 状态码致伪成功 (Bug 3)**：`FetchUpstreamModels` 未校验 `resp.StatusCode == 200`，当密钥无效（401）或上游报错（403/500）时，JSON Decode 静默忽略返回空列表，向前端报告 0 个模型且无报错，违反 Fail-Closed 铁律；
4. **并发任务退出冲掉新任务取消句柄 (Bug 4)**：`ExecTerminalStream` 与 `SendMessage` 在异步协程退出时，无条件执行 `cancel = nil`。若用户快速打断并启动了新任务，旧协程退出时会无条件抹除新任务的取消函数，导致后续点击中断按钮失效；
5. **智能体达到 maxSteps 步数截断时静默伪完成 (Bug 5)**：ReAct 循环达到 15 步上限时直接派发 `EventDone`，前端未收到任何步数超限告警，且最后一步下发的工具未获得最终解答；
6. **全域弹窗缺少全局 Esc 快捷键支持 (Bug 6)**：`handleGlobalKeydown` 未监听 `Escape` 键，违反铁律 5；
7. **大模型读写工具参数命名不兼容 (Bug 7)**：大模型下发 `write_file` / `read_file` 时常传入 `path` 或 `file_path`，而后端仅解析 `rel_path` 导致路径为空报错；
8. **Diff 计算路径逃逸校验盘符大小写崩溃 (Bug 8)**：`validateRelPath` 未归一化盘符大小写导致误报沙箱逃逸；
9. **原子写入在 Rename 失败时临时文件残留 (Bug 9)**：`AtomicWriteFile` 句柄提前关闭导致异常分支跳过临时文件删除。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 插件注册表的分段锁安全性与覆盖机制 (Register vs RegisterOrReplace)
在支持热插拔与动态工作区的微内核架构中，`Register` 接口默认具备幂等与防重复注册保护（防插件恶意覆盖注入）。但在“工作区热重载（Workspace Hot-Swap）”场景下，工作区特定的工具实现必须根据新路径重新初始化并**原子替换（In-place Replacement）**老插件。若仅依赖 `Register` 并忽略错误，系统将处于“工作区已切换、但底层工具链仍锚定旧路径”的严重错位状态。因此注册中心必须显式提供 `RegisterOrReplace` 语义，且在替换后重新构造 `ExecutionEngine`。

### 2. Windows 驱动器盘符大小写与 `filepath.Rel` 的数学机制
Go 标准库 `filepath.Rel(basepath, targpath)` 在 Windows 平台的实现中：
首先调用 `filepath.VolumeName` 提取两者的盘符卷标（如 `d:` 与 `D:`）。如果两者 `vol1 != vol2`（直接通过字符串 `!=` 比较，未做 `strings.ToUpper`），Go 直接判定为“跨驱动器”，抛出错误：`can't make D:\foo relative to d:\bar`。
由于 Windows 系统文件 API（如 `filepath.EvalSymlinks`、`GetFinalPathNameByHandle`）返回的盘符经常是大写的，而用户输入或 `os.Getwd()` 可能是小写的，未做盘符卷标大写归一化会导致所有依赖 `filepath.Rel` 的沙箱路径校验严重误报。

### 3. 上下文取消函数（CancelFunc）的并发生命周期
在支持用户主动取消的长耗时异步任务中，通常在宿主结构体中持有 `cancel context.CancelFunc`。当任务并发启动（例如取消当前任务并立即发起下一个任务）时，旧任务协程的退出清理代码（`defer cancel = nil`）与新任务的初始化存在时序竞争。必须引入单调递增的任务序列号（`taskID`），在退出时仅当当前存储的任务序号与本协程一致时才执行清空操作，防止将新任务的句柄冲空。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 注册中心提供原子替换接口
```go
func (r *Registry) RegisterOrReplace(p v1.Plugin) error {
    if p == nil {
        return fmt.Errorf("cannot register nil plugin")
    }
    switch p.Type() {
    case v1.TypeTool:
        t, ok := p.(v1.ToolPlugin)
        if !ok {
            return fmt.Errorf("plugin %s does not implement ToolPlugin", p.ID())
        }
        r.toolMu.Lock()
        r.tools[p.ID()] = t // 原子覆盖旧工作区工具
        r.toolMu.Unlock()
    // ...
    }
    return nil
}
```

### 2. Windows 盘符大小写规范化函数
```go
func normalizeWindowsPath(p string) string {
    vol := filepath.VolumeName(p)
    if len(vol) > 0 {
        return strings.ToUpper(vol) + p[len(vol):]
    }
    return p
}
```

### 3. 异步任务序号保护 CancelFunc 防冲掉
```go
a.agentMu.Lock()
if a.agentCancel != nil {
    a.agentCancel()
}
agentCtx, cancel := context.WithCancel(context.Background())
a.agentTaskID++
currentTaskID := a.agentTaskID
a.agentCancel = cancel
a.agentMu.Unlock()

go func() {
    defer func() {
        a.agentMu.Lock()
        // 仅当当前任务序号仍为本协程序号时才清空句柄
        if a.agentTaskID == currentTaskID {
            a.agentCancel = nil
        }
        a.agentMu.Unlock()
    }()
    // 执行业务...
}()
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **工作区热切换必须全链路更新状态机**：切换工作区不仅是更改目录变量，必须联动更新快照管理、沙箱实例、工具注册表和 ReAct 引擎。
2. **Windows 路径计算前必做盘符归一化**：在跨平台调用 `filepath.Rel` 之前，必须对两端路径统一执行 `normalizeWindowsPath`。
3. **HTTP 客户端绝不能因解析成功掩盖状态码错误**：在 `json.NewDecoder().Decode()` 之前，强制拦截 `resp.StatusCode != 200` 并读取真实错误体。
