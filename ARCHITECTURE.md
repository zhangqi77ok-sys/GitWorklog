# CodeMind-Hub 全景架构设计规范 (ARCHITECTURE.md)

> **设计哲学**：单一主轴、高度解耦、积木思想、Harness 治具思想、ReAct 循环思想，拒绝过度封装。  
> 基于 **Tauri v2 (Rust 原生内核) + React 19 + TypeScript + GatewayBus 积木总线**。

---

## 🏛️ 一、分层解耦架构全景图 (Layered Architecture)

```mermaid
graph TB
    subgraph UI ["1. 表现层 (Presentation Layer · React 19 + TS)"]
        Titlebar["Titlebar (无边框原生标题栏 · 项目面包屑 · 状态指示)"]
        ActivityBar["ActivityBar (42px 极简侧边图标栏)"]
        LeftPanel["LeftPanel (会话管理 · 标签过滤 · 真实磁盘文件树)"]
        ChatColumn["ChatColumn (流式推理 · Plan/Act 模式切换 · 上下文工具条)"]
        EditorWorkspace["EditorWorkspace (多文件原生标签 · Monaco代码预览 · 抽屉式终端)"]
    end

    subgraph Bus ["2. 模型网关总线层 (GatewayBus · 积木式可插拔)"]
        GatewayBus["GatewayBus (单例调度中枢)"]
        subgraph Sublines ["独立子线 (IProviderSubline)"]
            ClaudeLine["ClaudeSubline (Anthropic 原生流)"]
            OpenCodeLine["OpenCodeSubline (OpenCode 本地引擎)"]
            CodexLine["CodexSubline (OpenAI 协议族)"]
            DashScopeLine["DashScopeSubline (阿里百炼)"]
            OllamaLine["OllamaSubline (本地大模型直连)"]
        end
        subgraph Relays ["中转协议适配 (IRelayAdapter)"]
            DirectRelay["DirectRelay (官方接口直连)"]
            NewApiRelay["NewApiRelay (NewAPI 格式适配)"]
            Sub2ApiRelay["Sub2ApiRelay (聚合渠道适配)"]
        end
        subgraph Extensions ["扩展支持"]
            McpSubline["McpSubline (Model Context Protocol)"]
            AuditSubline["AuditLogSubline (Token 计量与耗时审计)"]
        end
    end

    subgraph NativeIPC ["3. 原生系统交互层 (Tauri v2 · Rust Core)"]
        NativeBridge["nativeService (TypeScript IPC Bridge)"]
        RustCore["src-tauri/src/lib.rs (Rust 原生内核)"]
        DiskIO["真实文件读写 / 递归目录遍历"]
        SysCmd["execute_system_command (无窗口静默执行)"]
        GitCheckpoint["Git 影子快照与一键秒级回退"]
        WebSearchEngine["native_web_search (Rust 原生突破 CORS 结构化检索)"]
    end

    subgraph DomainBrain ["4. 工程大脑与领域层 (Domain & Memory Mesh)"]
        ASTParser["astExtractor (抽象语法树抽取 Class / Function / Import)"]
        GraphRAG["projectKnowledgeGraphService (D3 力导向代码拓扑图谱)"]
        MemoryMesh["projectMemoryService (短期情景记忆 + 长期决策沉淀)"]
        DiffEngine["diffService (Unified Diff 逐行解析与原子 Patch)"]
    end

    subgraph HarnessSuite ["5. 治具与自愈自纠闭环 (Harness & TDD/SDD)"]
        SpecContract["SpecContract (接口契约与前置规约定义)"]
        TDDRunner["TDDRunner (测试驱动开发 · 红绿测试套件)"]
        SelfLoop["SelfCorrectingLoop (Plan → Spec → Test → Code → Fix 循环)"]
        DualIronMan["DualIronMan (Builder 蓝军建设者 vs Critic 红军质询者)"]
    end

    UI <--> NativeBridge
    NativeBridge <--> RustCore
    RustCore --> DiskIO & SysCmd & GitCheckpoint & WebSearchEngine
    UI <--> GatewayBus
    GatewayBus --> Sublines --> Relays
    Sublines <--> Extensions
    UI <--> DomainBrain
    DomainBrain <--> HarnessSuite
```

---

## 🔄 二、ReAct 智能体与自愈闭环数据流 (Dataflow Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 开发者 (User)
    participant UI as ChatColumn / EditorWorkspace
    participant Bus as GatewayBus
    participant Brain as AST & Memory Mesh
    participant Harness as TestHarness & Dual Iron-Man
    participant Rust as Tauri Native Core (Rust)

    Dev->>UI: 提出需求 / 提问
    UI->>Brain: 提取项目 AST 拓扑、短期记忆与 Git 上下文
    Brain-->>UI: 返回精准工程上下文
    UI->>Bus: 发起流式推理 (BusStreamRequest)
    Bus-->>UI: 实时推送 Thought 思考链与 Token Chunks
    
    alt Plan 模式 (仅规划)
        Bus-->>UI: 输出结构化任务拆解，严格禁止写盘
        UI-->>Dev: 展示方案，等待审批
    else Act 模式 (可执行落地)
        Bus-->>UI: 输出目标文件变更 [[TOOL_CALL]]
        UI->>Harness: 触发 SDD 契约校验与 TDD 红绿前检
        Harness->>Harness: 双向钢人审查 (Builder vs Critic)
        opt 校验通过并用户批准
            UI->>Rust: createGitCheckpoint (创建影子快照)
            UI->>Rust: write_file_content (真实写盘)
            UI->>Rust: execute_system_command (运行测试验证)
            Rust-->>UI: 测试通过 100% (Green)
            UI-->>Dev: 呈现 Diff 比对与完成反馈 (支持一键影子回退)
        end
    end
```

---

## 📐 三、模块解耦规约 (Decoupling Principles)

1. **零循环依赖**：`services/bus/` 绝不反向依赖 UI 组件，仅通过纯接口（`IProviderSubline`, `BusStreamRequest`, `BusStreamCallbacks`）通信；
2. **单一职责 (SRP)**：每个厂商子线独立文件（`ClaudeSubline.ts`, `OpenCodeSubline.ts` 等），新增厂商只需实现标准子线接口注册至 `GatewayBus`，无需修改任何 UI 代码；
3. **安全第一 (Safety First)**：所有系统命令与文件写操作均通过 Tauri IPC 约束并在执行前自动触发 Git 影子快照，确保随时可秒级还原。
