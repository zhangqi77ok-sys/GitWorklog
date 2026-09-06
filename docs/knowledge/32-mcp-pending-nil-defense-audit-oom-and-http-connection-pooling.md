# 32. MCP 悬挂通道空指针防御、代码审计 OOM 熔断与 HTTP 连接池复用治理

## 1. 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 原生桌面微内核的高并发、多轮自主 Agent 推理及复杂工程巡检场景中，系统暴露了三类深层次的稳定性与高危运行风险：
1. **MCP 挂起请求的 SIGSEGV 空指针异常**：在动态停用或切换 MCP 服务器时，若内部存在正在等待响应的同步 RPC 请求，c.Stop() 会向请求 channel 派发 
il 唤醒。由于缺乏非空校验，调用方直接解引用 
esp.Error 或 
esp.Result，导致 Go 微内核发生未捕获的空指针解引用崩溃（Panic）。
2. **源码审计超大文件内存爆裂 (OOM)**：Sub-Agent 安全沙箱审查在扫描工作区时，若遇到开发者误放的数百兆离线模型权重、音视频文件或构建打包产物，os.ReadFile 会将整个大文件读入内存，瞬间耗尽桌面端堆内存，触发 OOM 强制杀进程。
3. **高频多轮推理连接池失效与端口耗尽**：每次发起 LLM 流式推理均临时实例化 &http.Transport{}，破坏了 HTTP/1.1 与 HTTP/2 的长连接复用机制，导致高频推理下持续进行 TCP 三次握手与 TLS 协商，并产生大量处于 TIME_WAIT 状态的套接字。

---

## 2. 核心原理与知识内容 (Knowledge Content & Root Cause)

### 2.1 Go Channel 接收 nil 与接口指针反序列化陷阱
在 Go 的并发模型中，向带缓冲或无缓冲的 chan *T 发送 
il 属于合法操作。然而在 RPC 客户端架构中，channel 既用于传递成功的响应实体，也可能在连接销毁时被广播清理。若接收方采用：
case res := <-ch: return res, nil
此时外层调用者根据惯用法 if err != nil 判定成功，紧接着解引用 
es.Error，由于 
es == nil，直接触发底层 SIGSEGV。**任何在生命周期终止时被 channel 唤醒的请求，必须明确将其转换为强类型 Error 返回，严禁返回 (nil, nil)。**

### 2.2 深度文件遍历的 WalkFunc 守卫与内存配额
ilepath.Walk 规范中，当遇到无权限访问或损坏的文件时，WalkFunc 的第一个参数 err 不为 
il，此时入参 info 可能为 
il。若未优先判断 err != nil，盲目调用 info.IsDir() 将立即 panic。此外，对于静态代码审查工具，单文件大于 5MB 的纯文本源码极少见，若不做 info.Size() 熔断，任何大文件都会被全量读入内存。

### 2.3 HTTP Transport 连接池与 Keep-Alive 机制
Go 的 http.Client 是并发安全的，其底层的连接池管理（如 MaxIdleConns、IdleConnTimeout）维护在 http.Transport 实例中。若每次请求均 
ew(http.Transport)，每个 Client 拥有独立的空连接池，请求结束后连接无法被后续请求复用，不仅成倍增加网络往返时延（RTT），还会在 Windows 上迅速耗尽临时端口（Ephemeral Ports）。

---

## 3. 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 3.1 MCP 客户端生命周期与悬挂请求通道防御
在 internal/mcp/stdio.go 中，重构 sendRequest 与 Stop 方法：
- 在 Stop 中先清空并唤醒 pending channel，再判断是否已启动；
- 在 sendRequest 中判断 if res == nil 时返回 
equest canceled or client stopped 错误，杜绝返回空响应对象；
- 在 Start、ListTools、CallTool 等所有调用点全量补齐 if resp == nil 守卫。

### 3.2 安全审查器大小熔断与 WalkFunc 空指针守卫
在 internal/agent/swarm.go 中，对文件属性和大小实施双重拦截：
- 优先处理 if err != nil || info == nil { return nil }；
- 拦截非源码目录（如 .git, 
ode_modules, dist, in, uild, .idea 等）；
- 严格限制单个文件体积不超过 5MB，阻断潜在 OOM；
- 在 TDD 验证中，若编译或执行失败，强制置 ailed >= 1，杜绝 0 失败假成功。

### 3.3 全局 HTTP Transport 与单例 Client 复用
在 internal/llm/client.go 中，声明包级全局复用 Transport：
- 配置 MaxIdleConns: 100, MaxIdleConnsPerHost: 20, IdleConnTimeout: 90s；
- 全局复用 sharedLLMClient，实现长连接复用与连接池治理。

---

## 4. 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **RPC 通信禁止返回 (nil, nil)**：当通过 channel 或回调通知异步请求取消或连接关闭时，必须确保外层返回明确的 err，杜绝调用方访问空指针。
2. **文件系统遍历必须先行判空**：在任何 ilepath.Walk 或 WalkDir 递归遍历逻辑中，第一行代码必须是 if err != nil || info == nil { return nil }。
3. **外部重 IO 请求杜绝临机分配 Client**：微内核中所有与远程 AI 上游或长耗时 HTTP 通信的组件，均应通过连接池单例复用，严禁函数内部频繁 
ew(http.Transport)。
4. **前端全局事件注销必须对称**：任何注册在桌面 IPC 桥接层（如 EventsOn）的流式任务监听，必须在任务完成、失败、超时或用户手动打断（gent:interrupted）的所有分支中执行全量注销（EventsOff），杜绝回调堆叠与幽灵打印。
