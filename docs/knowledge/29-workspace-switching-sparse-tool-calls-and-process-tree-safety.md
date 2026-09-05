# 29. 动态工作区热切换、稀疏工具调用索引治理、SSE思考流长文本扩容与进程树脱机自毁安全

> 本文档针对 Tcode Studio 系统级核心缺陷研判（第 6 轮），详细剖析工作区硬编码与原生对话框热切换、大模型 `tool_calls` 稀疏索引丢弃、`bufio.Scanner` 64KB 思考流截断、`ShellExecuteW` 异步脱机批处理自删除等典型工业级技术陷阱。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在持续自动化巡检与高负载桌面端测试中，发现了以下 10 个高危工程与架构缺陷：
1. **顶栏工作区硬编码与无法切换**：顶栏项目名称硬编码 `agent-learning`，底层缺少动态工作区设值与系统原生目录拾取器（违反铁律 5）；
2. **多工具调用稀疏索引丢失 (Bug 3 & 4)**：大模型返回多个 `tool_calls` 时，其 `index` 字段可能非零（例如仅调用第 2 个工具或稀疏分布），底层循环按 `for i := 0; i < len(tcMap); i++` 取值，导致大量高位索引工具调用被静默丢弃；
3. **SSE 思考流 64KB 截断与静默吞错 (Bug 5 & 6)**：Go `bufio.Scanner` 默认最大缓冲区为 64KB，在深度推理模型（DeepSeek-R1、Claude 3.7 Sonnet）输出超长 reasoning content 时触发 `bufio.ErrTooLong`，且循环结束时未调用 `scanner.Err()` 抛出异常；
4. **受控文件工具 Sandbox 空指针 Panic (Bug 7)**：`plugins/tool/fs/fs_tool.go` 在未就绪或未完成沙箱初始化时被调用 `Execute`，直接触发解引用空指针崩溃；
5. **Swarm 测试黑框与超时悬挂 (Bug 8)**：`RunTDDValidation` 在 Windows 下未注入 `0x08000000` 产生闪烁黑框，且缺少 60s 硬超时控制，导致卡顿悬挂；
6. **安装与卸载残留孤儿进程 (Bug 9)**：`taskkill` 未注入 `/T` 递归树杀，导致桌面程序衍生出的外部工具链子进程成为僵尸进程残留；
7. **插件注销与重复注册覆盖 (Bug 10)**：Rail 插件重复追加导致注册表无限膨胀，缺乏注销能力；
8. **卸载器延迟自删除失效**：卸载程序通过 `exec.Command` 唤起清理批处理，父进程退出导致子进程管道断裂或被 Windows 控制台同时终结，静默卸载无法清理残留安装目录。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 稀疏索引与键遍历的数学陷阱
OpenAI 兼容协议中，流式工具调用切片返回的 `index` 表示模型当前生成的工具调用下标。当代理网关、过滤层或并行调用跳过某些工具时，返回的 index map 可能为 `{1: CallA, 3: CallB}`（`len=2`）。如果采用 `for i := 0; i < len(map); i++` 访问，则尝试查找 `map[0]`（nil）和 `map[1]`，不仅丢失了 `map[3]`，更因 `map[0]` 为空而中断。正确的做法是提取所有 map key，进行 `sort.Ints(keys)` 排序遍历。

### 2. `bufio.Scanner` 默认缓冲区溢出机制
Go 标准库 `bufio.NewScanner` 内部分配的初始缓冲为 4KB，最大限制为 `MaxScanTokenSize = 64 * 1024`。当单行 SSE 数据（如 `data: {"choices":[{"delta":{"reasoning_content":"..."}}]}`）超过 64KB 时，Scanner 内部设置错误标志位并退出循环。若调用方未显式判断 `scanner.Err()`，外部将误以为流式传输正常结束（伪成功），造成用户界面显示文本截断。必须显式分配 10MB 动态缓冲并做错误兜底。

### 3. Windows 控制台生命周期与 `ShellExecuteW`
在 Windows 平台上，由控制台或父进程创建的子进程，若未完全脱离 Job 对象与控制台 Session（即便指定了 `CREATE_NEW_PROCESS_GROUP`），当父进程退去时，关联的标准 I/O 句柄关闭可能直接导致子进程异常终结。通过 `shell32.dll` 的 `ShellExecuteW` 原生 API，请求操作系统 Shell 在完全独立的上下文中唤起 `cmd.exe`，并配合 `(goto) 2>nul & del "%~f0"` 标准自销毁语法，实现真正脱机运行的延迟自清理。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 排序遍历治理稀疏 `tool_calls`
```go
// 提取全部实际存在的索引并排序
tcIndices := make([]int, 0, len(streamToolCalls))
for idx := range streamToolCalls {
    tcIndices = append(tcIndices, idx)
}
sort.Ints(tcIndices)

// 保证所有稀疏与非零索引工具调用无一遗漏
for _, idx := range tcIndices {
    tc := streamToolCalls[idx]
    // 派发执行...
}
```

### 2. 扩容 Scanner 缓冲区与错误派发
```go
scanner := bufio.NewScanner(resp.Body)
buf := make([]byte, 64*1024)
scanner.Buffer(buf, 10*1024*1024) // 扩展至 10MB 支持长思考流

for scanner.Scan() {
    line := scanner.Text()
    // 解析处理...
}

if err := scanner.Err(); err != nil {
    ch <- StreamEvent{Type: "error", Error: fmt.Sprintf("SSE stream reading failed: %v", err)}
}
```

### 3. ShellExecuteW 异步脱机批处理自删除
```go
op, _ := syscall.UTF16PtrFromString("open")
file, _ := syscall.UTF16PtrFromString("cmd.exe")
params, _ := syscall.UTF16PtrFromString(fmt.Sprintf("/c \"%s\"", batPath))
dir, _ := syscall.UTF16PtrFromString(tempDir)

// SW_HIDE = 0, 独立于当前进程生命周期
procShellExecute.Call(0, uintptr(unsafe.Pointer(op)), uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(params)), uintptr(unsafe.Pointer(dir)), 0)
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **协议索引勿做连续性假设**：处理外部或大模型返回的切片/Map 时，严禁使用基于 `len` 的连续正整数索引访问，一律采用 Key 切片抽取 + 显式排序。
2. **长文本流必须指定 Buffer 上限**：任何用于读取 SSE 或 WebSocket 文本流的 Scanner，必须显式调用 `Buffer()` 设定合理的上限（建议 5MB~10MB），并在循环后强制检查 `scanner.Err()`。
3. **安装卸载严守脱机原则**：自更新与自卸载程序由于需要删除正在运行的可执行文件本身，必须借助操作系统底层机制或脱机进程，避免主进程提前退出拖垮子清理程序。
