# 跨语言工作区技术栈自适应探测与多轮自主 ReAct 自然收敛自愈状态机

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，系统总结在 Tcode Studio 纯原生桌面智能体中，针对多语言工程环境自适应感知（Language-Agnostic Stack Detection）、“以大模型零工具调用（Zero Tool Calls）与目标完成为自然终止准则”的多轮自主自愈状态机，以及前端多轮思考与工具执行时序流动的完整工程实践经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在自主代码智能体（Autonomous Coding Agent）执行复杂重构、Bug 修复或跨文件编码任务时，传统实现常存在以下两大核心致命偏差：
1. **单一语言的硬编码偏见（Language Bias）**：
   - 调度系统如果预设了宿主自身的语言命令（如写死 `go test` 或 `npm test`），当用户打开 Python、Rust、Java、C++ 或混合前端项目时，自动化闭环就会瞬间瘫痪或执行错误的命令；
   - 智能体必须具备跨语言的中立感知能力，自动识别工作区真实特征并让大模型自主决策验证工具；
2. **循环终止条件的本末倒置（Arbitrary Turn Caps vs Natural Convergence）**：
   - 将“固定 10 轮或 15 轮上限”作为主导逻辑是错误的。任务可能在第 1 轮就已由模型总结完成，也可能在第 3 轮通过自愈达成目标；
   - **智能体的核心自然终止准则必须是“模型认为目标达成并不再调用任何工具（Zero Tool Calls）”**，只有在极端死锁异常时才由看门狗兜底，绝不能用机械的轮数硬性切断有效任务。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 跨语言工程特征轻量自适应探测 (Language-Agnostic Detection)
微内核在每次会话前，毫秒级探测工作区根目录的标记元文件（`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`, `pom.xml`, `build.gradle`）：
- **解析框架与构建链**：
  - `package.json` ➔ 提取 Vue 3 / React / Svelte 框架，锁定 `npm/pnpm/yarn` 与 `npm test`；
  - `Cargo.toml` ➔ 锁定 `cargo` 与 `cargo test`；
  - `pyproject.toml` / `requirements.txt` ➔ 锁定 `pytest` 与 `pip`；
  - `go.mod` ➔ 锁定 `go test` 与 `go vet`；
  - `pom.xml` / `build.gradle` ➔ 锁定 `mvn/gradle`；
- **环境上下文注入**：
  将识别出的技术栈特征结构化拼接为 `[工作区技术栈自适应环境感知]` 语块注入 System Prompt，大模型根据环境自适应选用正确的工具链，绝不盲目试探。

### 2. 目标达成驱动与 Zero Tool Calls 自然收敛状态机
- **状态流转拓扑**：
```
       ┌─────────────────────────────────────────────────────────┐
       │             启动自主多轮自愈循环 (Loop Turn N)          │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │        大模型流式推理 (Stream Thinking + Actions)        │
       └────────────────────────────┬────────────────────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
   【未下发任何 tool_calls】                         【下发了 1 个或多个 tool_calls】
   (模型判定目标已达成或已完成回复)                     (调用写文件 / 终端命令 / MCP等)
             │                                             │
             ▼                                             ▼
   【自然收敛：流式输出答复】                     ┌─────────────────────────────────┐
   【本次任务圆满交付完成！】                     │ 物理执行各算子并收集输出         │
                                                 │ (若写盘自动追加 LSP 语法诊断)    │
                                                 └────────────────┬────────────────┘
                                                                  │
                                                                  ▼
                                                 ┌─────────────────────────────────┐
                                                 │ 将执行结果作为 role: tool 回传   │
                                                 └────────────────┬────────────────┘
                                                                  │
                                                                  ▼
                                                 ┌─────────────────────────────────┐
                                                 │ 自动进入下一轮循环 (自愈/继续验证) │
                                                 └────────────────┬────────────────┘
                                                                  │
                                                                  └────── 循环继续
```
- **自然退出**：只要模型不再下发 `tool_calls`，直接 break 退出循环；
- **自愈驱动**：当模型第一轮修改了文件，LSP 编译器自动诊断出未引包或语法红线并附加到工具输出中；模型在第二轮看到该诊断红线，会自动进行二次修复，直至测试全绿、无工具下发自然交付。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 多语言特征探测器实现
在 `internal/core/sandbox/env_detect.go` 中：
```go
func DetectProjectStack(workspace string) ProjectStackInfo {
    // 依次探测 package.json / Cargo.toml / go.mod / pyproject.toml / pom.xml
    // 生成包含 PrimaryLanguage, Framework, BuildTool, TestCommand 的元数据
}
```

### 2. 自然收敛多轮循环在 `app.go` 中的挂载
```go
const maxWatchdogTurns = 12
for turn := 1; turn <= maxWatchdogTurns; turn++ {
    toolCalls, err := llm.StreamChat(context.Background(), llmReq, handlers)

    // 核心自然收敛：模型不再调用工具时立即跳出循环
    if err != nil || len(toolCalls) == 0 {
        break
    }

    // 物理执行算子并追加至 conversation
    for _, tc := range toolCalls {
        output := executeTool(tc)
        conversation = append(conversation, llm.Message{
            Role:       "tool",
            ToolCallID: tc.ID,
            Name:       toolName,
            Content:    output,
        })
    }
}
```

### 3. 前端多轮工具与思考时序流动展现
在 `frontend/src/components/ChatCockpit.vue` 中：
- `onToolStart` 与 `onToolEnd` 将每个工具事件累加到 `msg.tools` 数组中；
- 模板通过 `v-for="(tItem, tIdx) in msg.tools"` 垂直堆叠呈现多轮执行卡片；
- 工具卡片直观标示「第 N 轮」、执行状态指示灯与参数摘要，展开可查阅完整终端/诊断输出。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **上下文截断防雪崩 (Context Token Management)**：
   - 多轮自愈迭代中，每一轮工具输出会使 `conversation` 消息数组增多；
   - 必须限制历史上下文轮次（选取最近 N 轮），避免上下文窗口溢出或 Token 开销过快增加。
2. **看门狗计数器只防死锁不作主逻辑**：
   - 将 `maxWatchdogTurns` 设置在合理水位（如 10~15 轮），它只在发生不可预期的逻辑死锁或模型陷入无休止重复报错时兜底熔断，正常绝大多数任务在 1~3 轮内即可自然收敛。
3. **混合多语言工程兼容 (Monorepo)**：
   - 很多工程是 Go/Rust 后端 + Vue/React 前端的混合架构；
   - 探测器必须支持识别混合栈（如 `混合技术栈 (Go + Web)`），同时暴露双方的构建命令，供大模型全景参考。
