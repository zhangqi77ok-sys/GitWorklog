# 30. MCP 外部握手并发锁粒度优化、终端守护协程防泄漏、Git 状态路径空格防御与时间戳量级校验

> 本文档针对 Tcode Studio 系统级核心缺陷研判（第 7/8 轮），详细剖析外部子进程握手阻塞持有全局写锁导致的雪崩、Context 监听协程未通知退出造成的隐式内存泄漏、Git Porcelain v2 空格文件名截断与 JS 13 位毫秒级时间戳溢出等典型工业级高危陷阱。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在持续高频自动化巡检与极端边界测试中，排查出以下系统级架构与稳定性缺陷：
1. **MCP Manager 启动长 I/O 独占写锁 (Bug 3)**：`StartServer` 将外部子进程启动与最长 10 秒的 JSON-RPC 初始化握手放在全局写锁 `m.mu.Lock()` 内部，导致并发读取服务器列表、状态探活全部被阻塞长达数秒甚至超时崩溃；
2. **StdioClient 协程悬挂与重启通道失效 (Bug 4 & 5)**：
   - `Stop()` 未显式关闭 `c.stdout`，导致后台 `readLoop` 在 Windows 管道句柄未及时释放时挂死泄漏；
   - `Stop()` 未唤醒 `c.pending` 中的等待通道，导致外部调用者无法感知连接已关闭并永久挂起；
   - `Start()` 未重置已关闭的 `c.stopChan`，导致客户端无法安全复用与重启；
3. **终端执行流 Context 监听协程永久泄漏 (Bug 6)**：`ExecuteStream` 中启动 `go func() { <-ctx.Done(); kill() }()` 协程以响应取消，但命令正常执行完毕时缺少完成退出通知，导致每个被执行的命令都会在父 Context 生命周期内永久悬挂一个无用协程；
4. **Git 状态解析空格截断缺陷 (Bug 7)**：`git status --porcelain=v2` 解析中，对普通文件与未追踪文件直接使用 `strings.Fields` 拆分，导致文件名中包含空格的文件（如 `my doc.md`、`hello world.go`）被拆成多段，无法正确暂存或提交；
5. **时间戳 13 位毫秒溢出 (Bug 8)**：前端 `Date.now()` 传入 13 位毫秒级时间戳，Go 后端未做量级判断直接调用 `time.Unix(ts, 0)`，导致会话修改时间溢出展示为公元 58000+ 年；
6. **删除会话非幂等报错 (Bug 9)**：`Delete` 在文件已被删除或不存在时返回 `os.ErrNotExist`，引发前端非预期弹窗；
7. **快捷方式单引号注入 (Bug 2)**：PowerShell 创建快捷方式脚本未对路径中的单引号转义，包含单引号的目录名导致安装报错；
8. **卸载器控制台绑定与自删除中断 (Bug 1)**：子进程批处理受父进程管道生命周期影响，卸载程序提前退出导致自删除批处理连带被销毁。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 长 I/O 阻塞独占写锁的雪崩效应
`sync.RWMutex` 在写锁锁定期间拒绝所有读请求与后续写请求。外部进程启动涉及操作系统进程创建、标准输入输出重定向管道初始化，以及基于 JSON-RPC 的工具列表发现。该握手过程可能耗时数百毫秒至 10 秒（超时阈值）。若在此期间持有全局写锁，所有界面的轻量读操作（如刷新 MCP 服务器卡片列表、查询状态）将陷入全面卡死。正确的模式是：**锁内仅校验配置并创建未连接实例，长 I/O 移出锁外执行，待连接完成后再次获取小粒度锁更新就绪状态**。

### 2. Context 守护协程的生命周期对称性
在长周期上下文（如会话级或全局应用 Context）中派生执行短期子任务（如执行一条终端 Shell 命令）时，若通过 `go func() { <-ctx.Done(); kill() }()` 实现优雅取消，必须时刻警惕：**子任务先于 Context 正常完成是绝大多数情况**。当命令返回时，如果没有显式通知机制（`done := make(chan struct{})`），该守护协程将继续阻塞在 `<-ctx.Done()`，无法被 Go 运行时垃圾回收，形成长生命周期协程泄漏。

### 3. 命令行输出的分隔符边界 (Spaces in File Paths)
`git status --porcelain=v2` 的设计规范为：
- 普通变动行（`1` 或 `2`）：前 8 个字段为元数据标志（`XY sub mH mI mW hH hI path`）；
- 未追踪行（`?`）：第 1 个字段为标记符，剩余内容全为文件路径。
`strings.Fields` 会根据任意连续空白字符切割。如果路径中包含空格，路径会被切割成数组的多个元素。必须保留前缀元数据之后的所有字段，并通过 `strings.Join(parts[8:], " ")` 还原真实路径。

### 4. JavaScript 毫秒与 Unix 秒的时间戳数量级鸿沟
- JavaScript `Date.now()`：返回 Unix Epoch 毫秒数（当前约 `1.7e12`，13 位数字）；
- Unix 标准秒数：当前约 `1.7e9`（10 位数字）。
Go 语言标准库 `time.Unix(sec, nsec)` 第一个参数要求为秒。若直接传入 13 位毫秒数字，时间将乘以 1000 倍，即当前时间距离 1970 年的 1000 倍（约 55000 年后）。必须引入动态数量级校验：`if ts > 1e11` 则转换为 `time.UnixMilli(ts)` 或 `ts / 1000`。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. MCP 启动长 I/O 锁粒度优化
```go
func (m *Manager) StartServer(name string) error {
    m.mu.Lock()
    cfg, exists := m.configs[name]
    if !exists {
        m.mu.Unlock()
        return fmt.Errorf("server %s not found", name)
    }
    client := NewStdioClient(cfg)
    m.clients[name] = client
    m.mu.Unlock() // 释放锁，外部进程握手在锁外进行

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := client.Start(ctx); err != nil {
        m.mu.Lock()
        delete(m.clients, name) // 启动失败时清理
        m.mu.Unlock()
        return err
    }
    return nil
}
```

### 2. 终端执行守护协程防泄漏
```go
done := make(chan struct{})
defer close(done)

go func() {
    select {
    case <-done:
        // 命令正常完成，守护协程立即安全退出
        return
    case <-ctx.Done():
        // 上下文提前取消，主动杀死进程树
        if cmd.Process != nil {
            _ = killProcessTree(cmd.Process.Pid)
        }
    }
}()
```

### 3. Git 状态解析完整空格路径拼接
```go
switch parts[0] {
case "1", "2":
    if len(parts) >= 9 {
        path := strings.Join(parts[8:], " ")
        // 正确处理含空格路径...
    }
case "?":
    if len(parts) >= 2 {
        path := strings.Join(parts[1:], " ")
        // 正确处理未追踪含空格文件...
    }
}
```

### 4. 毫秒级时间戳自适应防御
```go
func formatTimestamp(ts int64) string {
    if ts <= 0 {
        return ""
    }
    // 超过 1000 亿 (1e11) 即判定为前端毫秒级时间戳 (如 1741160000000)
    if ts > 100_000_000_000 {
        return time.UnixMilli(ts).Format("2006-01-02 15:04:05")
    }
    return time.Unix(ts, 0).Format("2006-01-02 15:04:05")
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止在互斥锁保护区内执行任何外部进程或网络握手**：将长耗时 I/O 移出锁外是保持桌面端流畅与并发高可用的基本准则。
2. **任何 `go func()` 必须具备确定的退出路径**：严禁仅监听 `<-ctx.Done()` 而没有任务完成信令通道，必须借助 `done` 通道与 `defer close(done)` 实现对称退出。
3. **文本协议解析警惕空格破坏 Token 切分**：只要输出中包含用户文件路径，必须采用元数据索引定界或原样字符截取，不得随意使用全局空格拆分。
4. **全链路时间戳格式化强制做量级归一化**：在跨前后端（TS / Go）传递时间戳时，后端统一防御 13 位毫秒数。
