# Tcode 后端 Go 插件式微内核落地实施任务计划 (Go Backend WBS)

> **负责人**：Tcode 资深 Go 架构与后端工程师  
> **基准架构**：[`docs/ARCHITECTURE_GO_PLUGIN_CORE.md`](./ARCHITECTURE_GO_PLUGIN_CORE.md)  
> **工程基准**：Go 1.22+，目标交付单个静态桌面端微内核二进制 (`tcode-daemon.exe`)  
> **核心指标**：冷启动 $< 20\text{ms}$，常驻内存 $< 45\text{MB}$，单元测试覆盖率 $\ge 85\%$，生产环境零裸露 panic

---

## 🎯 一、总体实施里程碑路线图 (Milestone Roadmap)

| 阶段 | 里程碑名称 | 核心产出 | 计划周期 | 关键交付物 |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | **SPI 核心契约与插件宿主引擎** | 统一接口规范、Registry、Panic 隔离屏障 | Sprint 1 (第 1 周) | `pkg/plugin` 接口库、`internal/host` 引擎 |
| **M2** | **官方首批内置插件 (In-Process)** | DeepSeek/Claude 网关、受控文件/Git 暂存/终端管道 | Sprint 2 (第 2 周) | `plugins/provider` 与 `plugins/tool` 核心集 |
| **M3** | **外部进程隔离加载器 (MCP Host)** | stdio 子进程管道沙箱、JSON-RPC 2.0 编解码 | Sprint 3 (第 3 周) | `internal/host/loader_mcp.go`、探活探针 |
| **M4** | **双环执行引擎与异步事件总线** | Inner/Outer Loop 状态机、零锁 EventBus | Sprint 4 (第 4 周) | `internal/core/loop`、执行生命周期分发 |
| **M5** | **表现层适配与跨平台构建打包** | Tauri IPC / SSE 流式传输端点、性能压测基准 | Sprint 5 (第 5 周) | `cmd/tcode-daemon`、自动化 CI 构建脚本 |

---

## 📋 二、细分任务分解与验收标准 (WBS & Acceptance Criteria)

### 里程碑 1：SPI 核心契约与插件宿主引擎 (M1)

#### 任务 1.1：初始化标准 Go 项目结构与模块契约
- **目标路径**：`pkg/plugin/`
- **任务内容**：
  1. 定义根插件接口 `Plugin`（生命周期 `Init`, `Start`, `Stop`）；
  2. 定义四大扩展点 SPI 接口：`ProviderPlugin`, `ToolPlugin`, `RailPlugin`, `StoragePlugin`；
  3. 定义流式传输块 `StreamChunk`、模型描述符 `ModelDescriptor`、工具契约 `ToolDefinition`。
- **验收标准**：
  - 纯接口与标准数据结构定义，零第三方依赖；
  - 接口粒度符合 Go 最佳实践，提供完备的 `godoc` 说明。

#### 任务 1.2：插件注册中心与优先级调度器实现
- **目标路径**：`internal/host/registry.go`
- **任务内容**：
  1. 基于读写锁 (`sync.RWMutex`) 实现并发安全的插件注册表 `Registry`；
  2. 实现分类检索（按 ID 获取 Tool、按 ID 获取 Provider、获取已排序 Rail 列表）；
  3. 实现 `RailPlugin` 优先级堆排序（数值 0~100，P-100 拥有最高前置拦截裁决权）。
- **验收标准**：
  - 支持动态注册与注销插件，并发读写无 Data Race（通过 `go test -race` 验证）。

#### 任务 1.3：Panic 隔离防御网关与超时看门狗
- **目标路径**：`internal/host/guard.go`
- **任务内容**：
  1. 封装通用安全协程包装器 `SafeGo(ctx context.Context, fn func())`；
  2. 在插件调度链路（`ExecuteAction`, `StreamChat`）植入 `defer recover()` 拦截；
  3. 捕获插件内部 panic，转化为结构化错误对象并记录系统错误日志，阻断异常扩散。
- **验收标准**：
  - 编写故意 panic 的 mock 插件，微内核主进程不受影响并返回友好的结构化 Error。

---

### 里程碑 2：官方首批内置插件实现 (In-Process) (M2)

#### 任务 2.1：高频大模型网关驱动插件 (`plugins/provider/`)
- **实现内容**：
  1. **DeepSeek 插件 (`deepseek`)**：
     - 支持 Direct API 直连与 Sub2api 协议；
     - 实现 `StreamChat` SSE 流式切片回调；
     - 实现 `Ping` 探针（首字延迟 TTFT 毫秒级打点）；
  2. **Anthropic Claude 插件 (`anthropic`)**：
     - 支持 Claude 3.7 原生流式、Thinking 思考流解析；
     - 支持 Prompt Caching（缓存命中 Token 统计）。
- **验收标准**：
  - TTFT 探活稳定返回网络延迟；断网/超时能够正确返回带上下文的错误提示。

#### 任务 2.2：物理工作区受控文件与影子快照工具插件 (`plugins/tool/fs`)
- **实现内容**：
  1. 受控目录沙箱（禁止跨越工作区相对路径或删除关键系统根目录）；
  2. 文件读写前自动生成 `.git/refs/shadow-snapshots` 轻量快照；
  3. 提供秒级快照列表与一键回退接口。
- **验收标准**：
  - 文件修改前自动创建快照，回退操作可完整复原工作区磁盘文件。

#### 任务 2.3：高级 Git 控制中心算子插件 (`plugins/tool/git`)
- **实现内容**：
  1. 获取工作区状态：精确划分 `Staged Changes` 与 `Working Changes`；
  2. 暂存/取消暂存/放弃更改底层命令行封装；
  3. 分支列表读取、分支切换与创建新分支 (`checkout -b`)。
- **验收标准**：
  - 返回与 Git CLI 完全一致的增删行数统计与文件状态码（M/U/D）。

#### 任务 2.4：终端管道算子插件 (`plugins/tool/term`)
- **实现内容**：
  1. Windows 平台通过 `CREATE_NO_WINDOW` (`0x08000000`) 标志静默启动 `pwsh.exe`；
  2. 双向捕获标准输入输出（`StdinPipe`, `StdoutPipe`, `StderrPipe`）；
  3. 实现与前端集成终端抽屉的实时双向传输。
- **验收标准**：
  - 执行 `go test`、`git status` 时后台运行无控制台黑框弹出，输出流式实时送达。

---

### 里程碑 3：外部进程隔离加载器 (MCP Host) (M3)

#### 任务 3.1：stdio 模式外部进程生命周期管理器
- **实现内容**：
  1. 读取本地 Claude Desktop JSON 格式配置；
  2. 跨平台子进程拉起与守护（支持 `npx`, `python`, `uvx`, `docker`）；
  3. 环境变量注入与管道健康心跳探针。
- **验收标准**：
  - 外部进程异常退出时自动捕获退出码，支持可配置的自动重启（Restart Policy）。

#### 任务 3.2：JSON-RPC 2.0 协议适配器与工具探测
- **实现内容**：
  1. 实现 MCP `initialize` 握手协议；
  2. 调用 `tools/list` 自动获取可用工具 Schema 并动态注册为 `ToolPlugin`；
  3. 实现 `tools/call` 的参数验证与双向转发。
- **验收标准**：
  - 挂载标准 MCP Server（如 SQLite、Filesystem），微内核能秒级探测到全部工具清单。

---

### 里程碑 4：双环执行引擎与异步事件总线 (M4)

#### 任务 4.1：基于通道的高性能零拷贝事件驱动总线 (`internal/core/eventbus`)
- **实现内容**：
  1. `EventBus` 支持主题发布订阅（`agent.started`, `tool.executing`, `token.usage`, `error`）；
  2. 采用只读非阻塞通道分发，内置环形缓冲区防慢消费者阻塞。
- **验收标准**：
  - 高并发压测（每秒 10,000 事件），内存分配平稳，无内存泄漏。

#### 任务 4.2：Inner Loop 四步执行闭环 (`internal/core/loop/inner.go`)
- **实现内容**：
  1. 单轮标准流：`Observe` ➔ `Reason` ➔ `Act` ➔ `Verify`；
  2. 贯穿调用 `RailPlugin` 前置后置钩子进行安全拦截与 TDD 自愈检查。
- **验收标准**：
  - 当高危命令触发时，`SafetyRail` 能够有效阻断并不进入 `Act` 执行阶段。

#### 任务 4.3：Outer Loop 多轮收敛状态机 (`internal/core/loop/outer.go`)
- **实现内容**：
  1. 任务目标完成度判定；
  2. 最大迭代步数（Max Steps）防死循环保护；
  3. Token 预算实时核销与超额熔断。
- **验收标准**：
  - 达到单轮最大步数或超出预算时，状态机能主动优雅收敛并交付部分产出。

---

### 里程碑 5：表现层适配与跨平台构建打包 (M5)

#### 任务 5.1：HTTP / SSE 与 WebSocket 统一传输层
- **实现内容**：
  1. 基于标准库 `net/http` 搭建微内核本地通信服务端（固定监听 `127.0.0.1` 环回接口）；
  2. 端点实现：`/api/chat/stream` (SSE), `/api/tools/execute`, `/api/terminal/ws`, `/api/usage/metrics`。
- **验收标准**：
  - SSE 连接断开时能及时通过 Context Cancel 通知后台协程中止推理，避免 Token 浪费。

#### 任务 5.2：单二进制静态编译与 CI 构建矩阵
- **实现内容**：
  1. 编写跨平台编译脚本（支持 Windows x64、macOS ARM64/x64、Linux x64）；
  2. 使用 `-ldflags="-s -w"` 剔除调试符号，压缩二进制体积至 $< 30\text{MB}$。
- **验收标准**：
  - 编译产物为无外部动态链接依赖的纯静态单一可执行文件。

---

## 🧪 三、测试与质量门禁 (TDD & Quality Gates)

1. **单元测试与 Mock 治理**：
   - 采用标准库 `testing` 与 `testify/assert`；
   - 仅对外部不可控大模型 HTTP 端点与远端网络执行 Mock，本地文件与 Git 算子全部执行物理真实临时目录测试；
2. **代码规约扫描**：
   - `golangci-lint` 全项通过（开启 `govet`, `errcheck`, `staticcheck`, `unused`, `gosec`）；
3. **性能基准测试 (Benchmarks)**：
   - `BenchmarkRegistry_SafeExecuteAction`：单次算子派发开销 $< 2\mu\text{s}$；
   - `BenchmarkEventBus_Publish`：单事件吞吐量 $> 500,000\text{ ops/sec}$。
