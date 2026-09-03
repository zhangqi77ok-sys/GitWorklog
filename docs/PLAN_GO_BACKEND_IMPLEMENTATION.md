# Tcode 工业级 Go 插件式微内核工程落地任务计划 (Production-Grade WBS)

> **版本**：v2.0.0-PROD  
> **负责人**：Tcode 首席 Go 基础架构师  
> **设计基准**：[`docs/ARCHITECTURE_GO_PLUGIN_CORE.md`](./ARCHITECTURE_GO_PLUGIN_CORE.md)  
> **技术基准**：Go 1.22+、无 CGO 纯静态交叉编译、内存控制 $\le 45\text{MB}$、进程崩溃隔离、原子文件写与 Git Plumbing 管道快照

---

## 🎯 一、技术选型与工程依赖规范 (Stack & Dependencies)

拒绝使用未经工业验证的小众玩具库，核心通信与并发调度统一收敛：
- **核心运行时**：Go 1.22 原生，禁止开启 CGO（`CGO_ENABLED=0` 保证极致单文件跨平台静态交付）；
- **高性能协程池**：`github.com/panjf2000/ants/v2`（池化复用 10,000+ 异步事件消费，杜绝 goroutine 暴涨击穿调度器）；
- **高性能结构化日志**：Go 1.21+ 原生 `log/slog`，定制脱敏 `SlogHandler`（明文 API Key、Token 强制掩码为 `sk-***`）；
- **高并发零拷贝序列化**：`github.com/bytedance/sonic`（AMD64 汇编加速）与标准库 `encoding/json`（ARM64 降级）；
- **外部进程终端管道**：`github.com/creack/pty` (POSIX) 与 Windows ConPTY / Win32 `CREATE_NO_WINDOW` 原生管道对接；
- **嵌入式轻量元数据**：`go.etcd.io/bbolt`（纯 Go 嵌入式单文件 KV 库，ACID 事务，零外部守护进程依赖）。

---

## 📋 二、核心分层工程落地 WBS (5 大生产级模块)

```text
agent-learning/
├── cmd/
│   └── tcode-daemon/              # 守护进程主入口 (CLI 参数解析、优雅停机信号处理)
├── internal/
│   ├── core/                      # 微内核核心引擎
│   │   ├── engine/                # 双环状态机 (Dual-Loop FSM Engine)
│   │   ├── eventbus/              # 环形缓冲区零锁异步事件总线 (Ring-Buffer EventBus)
│   │   ├── sandbox/               # 物理工作区安全沙箱与 Git Plumbing 原子快照
│   │   └── session/               # 会话状态机、滑动窗口 Token 计量与成本看板
│   ├── host/                      # 插件宿主引擎
│   │   ├── registry.go            # 分类读写锁注册中心
│   │   ├── guard.go               # Panic 调用栈熔断与看门狗
│   │   ├── loader_inproc.go       # 原生 In-Process 编译期插件装载
│   │   └── loader_mcp.go          # 进程外 MCP stdio/JSON-RPC 2.0 管道沙箱
│   └── transport/                 # 本地环回通信服务
│       ├── http/                  # SSE 流式端点与 REST 算子路由 (127.0.0.1 鉴权)
│       └── ws/                    # 终端双向流控 WebSocket 处理器
├── pkg/
│   ├── plugin/v1/                 # 严格向后兼容的公共 SPI 接口契约
│   │   ├── plugin.go              # 根插件生命周期
│   │   ├── provider.go            # 模型网关驱动契约 (带背压 Channel)
│   │   ├── tool.go                # 算子契约 (OpenAPI Schema 校验)
│   │   ├── rail.go                # 生命周期执行拦截器
│   │   └── types.go               # 统一 DTO 与状态枚举
│   ├── protocol/                  # 上游大模型双向协议适配与序列化
│   │   ├── canonical.go           # 微内核统一中立消息/工具契约 (Canonical IR)
│   │   ├── openai_adapter.go      # OpenAI Chat Completions 双向映射转换器
│   │   └── claude_adapter.go      # Anthropic Messages API 双向映射转换器
│   └── errors/                    # 结构化错误体系与错误码
└── plugins/                       # 官方核心插件集
    ├── provider/                  # 模型适配器
    │   ├── openai/                # OpenAI 官方协议驱动 (原生支持 GPT-4o / DeepSeek / SiliconFlow / vLLM / Ollama)
    │   └── claude/                # Anthropic Claude 官方协议驱动 (原生支持 Claude 3.7 / Extended Thinking / Prompt Caching)
    ├── tool/                      # 核心算子 (受控文件、Git暂存、终端交互)
    └── rail/                      # 治理拦截 (高危阻断、TDD自愈、成本审计)
```

---

### 阶段 1：核心 SPI 强类型契约与基础宿主引擎 (Sprint 1)

#### 1.1 核心 SPI 接口与背压数据流契约 (`pkg/plugin/v1/`)
- **文件与函数契约**：
  - `pkg/plugin/v1/plugin.go`：
    ```go
    type Plugin interface {
        ID() string
        Name() string
        Version() string
        Type() PluginType
        Init(ctx context.Context, config json.RawMessage) error
        Start(ctx context.Context) error
        Stop(ctx context.Context) error
        Health(ctx context.Context) HealthStatus
    }
    ```
  - `pkg/plugin/v1/provider.go`：
    - `StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error)`：
      强制通道缓冲区大小为 `64`，消费端超时 `5s` 未取走自动触发背压等待，避免下游网络堵塞造成内存堆积。
    - `Ping(ctx context.Context) (time.Duration, error)`：毫秒级 TTFT 探针。
  - `pkg/plugin/v1/tool.go`：
    - `Execute(ctx context.Context, rawArgs json.RawMessage) (*ToolResult, error)`：
      统一入参强制校验，执行受 `ctx` 超时硬控制（默认单步执行上限 60s）。
  - `pkg/plugin/v1/rail.go`：
    - 拦截器接口：`OnBeforeObserve`、`OnBeforeReason`、`OnBeforeAct`、`OnAfterAct`、`OnVerify`。
- **质量验收标准**：
  - 100% 静态代码无全局变量暴露；
  - 编写 `spi_test.go` 验证接口契约完整性与并发数据竞争（`go test -race`）。

#### 1.2 分段锁注册中心与优先级调度器 (`internal/host/registry.go`)
- **核心实现细节**：
  - 采用分段读写锁（`ProviderMap sync.RWMutex`, `ToolMap sync.RWMutex`, `RailList sync.RWMutex`），杜绝单一全局大锁造成的并发竞争；
  - `sortRails()`：利用 Go 原生 `slices.SortFunc` 按照 `Priority` 降序排列，数值最高（P-100 `SafetyRail`）保证首位拦截；
  - 动态热插拔生命周期管理（支持运行时增删 MCP 插件，自动调用旧插件 `Stop` 与新插件 `Start`）。
- **质量验收标准**：
  - 并发读取吞吐量达到 $> 2,000,000\text{ ops/sec}$；
  - 动态注册冲突测试（重复 ID 拒绝并返回 `ErrDuplicatePluginID`）。

#### 1.3 Panic 隔离网关与调用栈追踪守护 (`internal/host/guard.go`)
- **核心实现细节**：
  - 封装 `SafeCallTool(ctx context.Context, tool ToolPlugin, args json.RawMessage) (res *ToolResult, err error)`；
  - `defer` 中使用 `recover()` 拦截未知崩溃，使用 `debug.Stack()` 捕获完整调用栈，格式化为标准 JSON 日志；
  - 将 Panic 包装为业务级错误 `ErrPluginPanicked`，向执行链路返回优雅错误信息，保障微内核常驻进程 100% 存活。
- **质量验收标准**：
  - 模拟故意除以零、非法指针访问的破坏性插件，微内核运行稳定，日志记录错误堆栈，单测通过。

---

### 阶段 2：生产级物理文件沙箱与 Git Plumbing 管道快照 (Sprint 2)

#### 2.1 原子写文件与目录穿越沙箱防御 (`internal/core/sandbox/fs.go`)
- **核心实现细节**：
  - **路径规范化防护 (Canonicalize)**：执行 `filepath.EvalSymlinks` 与 `filepath.Clean`，严格限制操作路径处于用户打开的工作区根目录内，越界访问立即返回 `ErrPathEscapingSandbox`；
  - **原子写防撕裂机制**：
    1. 在同级目录创建临时文件（如 `.app.go.tcode_tmp_9381`）；
    2. 将修改内容写入临时文件并显式调用 `file.Sync()` 强制落盘；
    3. 关闭临时文件句柄；
    4. 执行 `os.Rename(tmp, target)` 原子替换；若中途掉电或崩溃，原文件完好无损。
- **质量验收标准**：
  - 构造 `../../../../Windows/System32` 路径穿越攻击，拦截率 100%；
  - 模拟并发写入中断，校验源文件无坏块与半截写入。

#### 2.2 基于 Git Plumbing 底层管道的高性能影子快照 (`internal/core/sandbox/snapshot.go`)
- **核心实现细节**：
  - 放弃低效笨重的高级命令（`git commit` 会污染用户分支日志与暂存区）；
  - 采用 **Git Plumbing 底层管道命令**：
    1. `git write-tree`：秒级生成当前工作区树对象（Tree SHA）；
    2. `git commit-tree <tree-sha> -m "tcode: shadow snapshot before modifying [file]"`：生成孤立游离 Commit 对象；
    3. 将 Commit SHA 记录在专用命名空间：`.git/refs/tcode/snapshots/<snapshot-id>`；
  - **秒级恢复 (`RollbackSnapshot`)**：
    调用 `git checkout <commit-sha> -- <file_path>` 瞬间无损复原目标文件。
- **性能与质量指标**：
  - 单次快照耗时 $\le 5\text{ms}$（即便 50,000 文件仓库也仅记录变化索引树，零额外物理磁盘冗余）；
  - 绝不产生跨分支冲突，绝不产生用户可见的未提交游离提交。

#### 2.3 高级双层暂存器控制算子 (`plugins/tool/git/git_tool.go`)
- **核心实现细节**：
  - 基于 `git status --porcelain=v2` 解析机器可读状态流，精确分离 `Staged Changes` 与 `Working Changes`；
  - 实现 `git add -- <file>`、`git restore --staged -- <file>`、`git restore -- <file>` 封装；
  - 提供本地与远程分支扫描 (`git branch -a --format="%(refname:short)|%(objectname:short)|%(subject)"`)。
- **质量验收标准**：
  - 支持文件名含空格、特殊字符、中文路径的转义与安全执行。

#### 2.4 OpenAI 官方 Chat Completions 协议原生驱动 (`plugins/provider/openai/`)
- **上游规范标准**：标准对齐 `POST /v1/chat/completions` (OpenAI 官方、DeepSeek、SiliconFlow、Ollama、vLLM、One-API 协议族)；
- **核心实现细节**：
  1. **请求体编码**：规范化映射 `model`, `messages`（`system`, `user`, `assistant`, `tool` 角色结构），`tools` 数组（`type: "function"` 嵌套函数契约），以及 `stream_options: { include_usage: true }`；
  2. **SSE 帧解码器与终止符**：监听 `data: {"choices":[{"delta":...}]}\n\n` 并以 `data: [DONE]\n\n` 为可靠退出标桩；
  3. **流式 Tool Calling 分片拼装器 (Chunk Reassembler)**：
     大模型在流式输出工具调用时，`arguments` 会被拆分为数十个极细字符片（`{"index": 0, "function": {"arguments": "{\"file"}}`），驱动内部维护索引哈希表（`map[int]*ToolCallAccumulator`），按 `index` 流式累加字符串，直至该 Block 闭合再交由 JSON 反序列化，彻底杜绝半截 JSON 导致的语法解析 Panic；
  4. **429 速率熔断与智能退避**：读取响应头 `Retry-After` 与 `x-ratelimit-reset-requests`，自动执行带有 Jitter 的指数退避重试（最多重试 3 次）。
- **质量验收标准**：
  - 构造包含 3 个并发 Function Call 的分片流，能够 100% 准确拼装为完整的入参 JSON；
  - 接入官方 OpenAI API 与 DeepSeek-V4 实测通过。

#### 2.5 Anthropic Claude 官方 Messages API 协议原生驱动 (`plugins/provider/claude/`)
- **上游规范标准**：标准对齐 `POST /v1/messages` (Claude 3.5 Sonnet, Claude 3.7 Sonnet Extended Thinking 官方原生协议)；
- **核心实现细节**：
  1. **严格协议头注入**：
     - `x-api-key: <token>`
     - `anthropic-version: 2023-06-01`
     - `anthropic-beta: prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15`
  2. **结构体无损重构适配**：
     - **顶级 `system` 提取**：Anthropic 协议禁止在 `messages` 数组中出现 `system` 角色，适配器自动将所有系统指令聚合并提升为顶层 `system` 字段；
     - **消息交替与工具块转换**：Anthropic 严格要求 `user` 与 `assistant` 角色交替。前序工具调用在 `assistant` 消息中呈现为 `{ "type": "tool_use", "id": "...", "name": "...", "input": {...} }`，工具产出结果在 `user` 消息中呈现为 `{ "type": "tool_result", "tool_use_id": "...", "content": "..." }`；
     - **工具清单映射**：转换为 Anthropic 标准 `{ "name": "...", "description": "...", "input_schema": {...} }`；
  3. **基于状态机的多事件 SSE 解码器 (Event-Stream FSM)**：
     Anthropic 采用独特的多事件帧协议，解码器维护以下有限状态转移：
     - `event: message_start` ➔ 初始化消息 ID，记录 `message.usage.input_tokens`；
     - `event: content_block_start` ➔ 开启新的内容块（判断 `type: "text"`、`type: "thinking"` 还是 `type: "tool_use"`）；
     - `event: content_block_delta` ➔ 流式派发：
       - `text_delta` ➔ 文本正文通道；
       - `thinking_delta` ➔ **Claude 3.7 专享深度思考通道**（无损暴露给前端思考折叠卡片）；
       - `input_json_delta` ➔ 工具调用参数缓冲拼接器；
     - `event: content_block_stop` ➔ 封口当前 Block；
     - `event: message_delta` ➔ 捕获 `delta.stop_reason`（如 `tool_use`、`end_turn`）并累加 `output_tokens`；
     - `event: message_stop` ➔ 优雅关闭当前通道；
  4. **Prompt Caching 提示词缓存与用量核算**：
     - 向超长系统提示词与工程 RepoMap 自动打标 `cache_control: { "type": "ephemeral" }`；
     - 从 `message.usage` 中精确提取 `cache_creation_input_tokens` 与 `cache_read_input_tokens`，计算缓存节省率并推送至 Token 监控看板。
- **质量验收标准**：
  - 构造官方包含 Thinking 与 Tool Use 的 Anthropic 混合事件流，状态机无漏帧，思考过程与工具调用精准分离上屏。

#### 2.6 中立规范数据抽象层 (`pkg/protocol/canonical.go`)
- **设计目标**：在微内核引擎与具体模型协议间建立隔离防线。无论底层接入的是 OpenAI 还是 Claude，微内核内部一律处理中立的 `CanonicalMessage` 与 `CanonicalToolCall`；
- **热插拔收益**：用户在会话进行中若从 Claude 3.7 切换至 DeepSeek，协议适配层自动在毫秒级将历史上下文无损互转，零记忆丢失，零语法冲突。
- **质量验收标准**：
  - 双向往返转换单元测试（`OpenAI ➔ Canonical ➔ Claude ➔ Canonical ➔ OpenAI`），数据内容与工具 ID 100% 幂等无损。

---

### 阶段 3：外部进程 MCP stdio/JSON-RPC 2.0 隔离宿主 (Sprint 3)

#### 3.1 跨平台子进程管道沙箱与生命周期看门狗 (`internal/host/loader_mcp.go`)
- **核心实现细节**：
  - 针对 Windows 平台通过系统属性注入 `CREATE_NO_WINDOW = 0x08000000`：
    ```go
    cmd.SysProcAttr = &syscall.SysProcAttr{
        HideWindow: true,
        CreationFlags: 0x08000000,
    }
    ```
  - 标准输入输出双向管道绑定（`StdinPipe` 发送 JSON-RPC，`StdoutPipe` 读取并使用带长度前缀的 Framer 分包解析）；
  - 优雅停机保护：先发送 `notifications/cancelled` ➔ 发送 `SIGTERM` ➔ 超过 1000ms 未退出则强制 `Process.Kill()`。
- **质量验收标准**：
  - 在 Windows 下拉起第三方 Python/Node.js MCP 进程完全无黑框闪烁；
  - 外部进程异常退出时，看门狗捕获 SIGCHLD/ExitCode 并触发结构化重试机制。

#### 3.2 动态工具清单与 OpenAPI 3 自动发现
- **核心实现细节**：
  - 发起 MCP `initialize` 握手与客户端能力协商；
  - 发起 `tools/list`，将远端返回的 JSON Schema 动态包装为本地 `ToolPlugin` 实例注册进 `Registry`；
  - 暴露给大模型统一格式，接收大模型 `tool_calls` 后通过 `tools/call` 进行 IPC 派发并回收结果。
- **质量验收标准**：
  - 挂载标准官方 SQLite MCP Server，工具探测耗时 $< 200\text{ms}$，参数验证不匹配直接在本地阻断。

---

### 阶段 4：双环执行引擎与事件总线状态机 (Sprint 4)

#### 4.1 统一双环有限状态机 (`internal/core/engine/fsm.go`)
- **状态流转严密图**：
  - `STATE_IDLE` ➔ `STATE_OBSERVING` ➔ `STATE_REASONING` ➔ `STATE_ACTING` ➔ `STATE_VERIFYING` ➔ （满足终止？`STATE_COMPLETED` : 回到 `STATE_OBSERVING`）；
- **核心容错与自愈控制**：
  - 最大步数保护：默认 $MaxSteps = 15$，防止死循环；
  - 上下文自动修剪：当累积 Token 超过模型上下文窗口 80% 时，自动触发 `ContextCompaction`，丢弃过往轮次的非关键工具大段输出，保留架构摘要与最新修改事实。
- **质量验收标准**：
  - 编写完整的状态机测试矩阵，覆盖正常闭环、工具执行失败自愈、达到步数上限强制中断。

#### 4.2 基于环形缓冲区的高性能异步事件总线 (`internal/core/eventbus/eventbus.go`)
- **核心实现细节**：
  - 采用无锁/低锁环形缓冲队列（Ring Buffer），单事件分发延迟 $< 500\text{ns}$；
  - 定义标准事件结构体 `AgentEvent`（含 `EventID`, `Timestamp`, `SessionID`, `Type`, `Payload`）；
  - 慢消费者保护：通道满时丢弃不关键的 debug 跟踪事件，严格保证关键状态（`tool.start`, `tool.done`, `agent.error`）可靠送达。
- **质量验收标准**：
  - 10,000 事件并发基准压测无锁争用，内存分配平滑。

---

### 阶段 5：表现层适配、集成自愈与编译交付 (Sprint 5)

#### 5.1 环回传输层实现 (`internal/transport/http/`)
- **核心实现细节**：
  - 基于 Go 原生 `http.Server` 监听 `127.0.0.1` 动态可用端口（写入临时锁文件供桌面端读取）；
  - 强安全头校验：所有请求必须携带微内核随机生成的握手 Token（`X-Tcode-Token`），杜绝本地恶意网页 CSRF 劫持；
  - `/api/chat/stream`：标准 SSE 协议（`Content-Type: text/event-stream`、`Cache-Control: no-cache`），支持客户端断连时通过 `req.Context().Done()` 级联通知上游 LLM 协程中止。

#### 5.2 生产环境压测与单二进制打包
- **编译构建命令规范**：
  ```bash
  # Windows 静态生产编译
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w -X 'tcode/internal/version.GitCommit=$(git rev-parse --short HEAD)'" -o bin/tcode-daemon.exe ./cmd/tcode-daemon
  ```
- **硬性发布门禁**：
  - [ ] 编译产物体积 $\le 30\text{MB}$；
  - [ ] 常驻内存 $\le 45\text{MB}$；
  - [ ] `go test -race ./...` 全部通过；
  - [ ] `golangci-lint run` 0 警告 0 报错。
