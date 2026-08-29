# Tcode 全景架构设计规范 (ARCHITECTURE.md)

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
            TokenMeterHUD["TokenMeterHUD (会话总消耗/KV命中率/窗口水位计/成本估算)"]
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

    subgraph SecuritySubstrate ["6. 权限治理与安全底座 (Permission & Security Substrate)"]
        PermissionGateway["PermissionPolicy (逐次审核 vs 智能自主决策)"]
        GitShadow["Git 影子快照引擎 (写前自动快照 · 一键秒级回退)"]
        OptionsCard["OptionsCard (动态交互选择卡片 · 单选/多选/补充输入)"]
    end

    UI <--> NativeBridge
    NativeBridge <--> RustCore
    RustCore --> DiskIO & SysCmd & GitCheckpoint & WebSearchEngine
    UI <--> GatewayBus
    GatewayBus --> Sublines --> Relays
    Sublines <--> Extensions
    UI <--> DomainBrain
    DomainBrain <--> HarnessSuite
    UI <--> SecuritySubstrate <--> GatewayBus
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

---

## 8. v1.1.9 架构演进与容灾持久化子系统

### 8.1 Dual-Layer Fail-Safe Storage Architecture (双层容灾存储架构)

```
┌────────────────────────────────────────────────────────┐
│               前端 React 状态层 (State Layer)           │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
     ┌──────────────────────┐ ┌──────────────────────────────────────┐
     │ Layer 1: WebView2    │ │ Layer 2: 物理磁盘 JSON 引擎           │
     │ Persistent Profile   │ │ (POST /api/storage)                  │
     │ (%LOCALAPPDATA%/...) │ │ (%LOCALAPPDATA%/Tcode/storage)│
     └──────────────────────┘ └──────────────────┬───────────────────┘
                                                 │
                                                 ▼
                                     ┌───────────────────────┐
                                     │ codemind_sessions.json│
                                     │ session_messages.json │
                                     │ codemind_projects.json│
                                     └───────────────────────┘
```

### 8.2 Prompt Execution Queue Pipeline (问答调度队列流水线)

```
[用户 Prompt 提交] ──▶ 是否正在流式生成?
                             ├── 否 ──▶ 立即启动 SSE 真流式传输 ──▶ 右下角切换为转动红圆圈 (支持随时打断)
                             └── 是 ──▶ 压入 PromptQueue 调度队列
                                             │
                                             ├── 支持 [⚡ 顶替当前] (打断当前 + 抢占执行)
                                             ├── 支持 [✏️ 编辑] (就地行内修改)
                                             ├── 支持 [🔼 / 🔽] (调整排队优先级)
                                             ├── 支持 [🗑️ 撤回] (注销移出队列)
                                             └── 当前回答完成后自动 FIFO 顺延调用
```


---

## 9. Agent Loop Controller：可观察的 Think → Execute → Observe → Continue

`App` 是当前原型的编排器；`ChatColumn` 仅负责承载审批模态框与渲染消息，`MarkdownCard` 是无副作用展示层。解析、授权判定、执行反馈和结果查找收敛在 `src/services/agentLoop.ts`，防止“视觉上是动作而执行器不识别”的双重语义。

```mermaid
sequenceDiagram
    actor User
    participant Controller as App AgentLoop Controller
    participant Model as LLM SSE
    participant Approval as Approval Modal
    participant Host as Host Executor
    participant View as MarkdownCard

    User->>Controller: Act prompt
    loop 至无动作或达到 10 轮
        Controller->>Model: messages + 前轮执行反馈
        Model-->>Controller: 流式内容
        Controller->>Controller: parseAgentActions(content)
        Controller->>View: actionId + pending/executing 状态
        alt 需要审核
            Controller->>Approval: Promise<ActionApprovalDecision>
            Approval-->>Controller: allow / reject / allow-all
        end
        Controller->>Host: write / command
        Host-->>Controller: ActionResult(actionId, status, output)
        Controller->>View: 按 actionId 更新状态
        Controller->>Model: [Tcode 执行引擎反馈]
    end
```

### 9.1 前端契约
- `AgentAction`：`id`、`type`、`target`、`code`、`isHighRisk`；由围栏块顺序和内容生成确定性标识；
- `ActionResult`：追加 `actionId`，与动作一对一关联，状态覆盖 `pending | executing | success | failed | rejected`；
- `shouldRequireActionApproval(policy, action, allowLowRiskInSession)`：唯一权限判定入口；`allow-all` 不绕过高风险审核；
- `formatExecutionFeedback(actions, results)`：仅输出执行事实，截断宿主输出，供下一轮决策；
- SSE 流使用显式完成标识与尾缓冲解析；对话历史由局部快照维护，禁止借 React `setState` 回读历史。

### 9.2 组件边界
`ActionApprovalModal` 只产生决策，不执行宿主请求；`App` 将其转化为 Promise 并串行执行动作。`MarkdownCard` 通过 `actionId` 查找结果，只提供复制、代码展开和文件定位。`ChatColumn` 不维护第二套动作队列、自动授权或执行回调。

### 9.3 测试治具
纯函数测试覆盖围栏解析、多动作稳定标识、策略、反馈及状态匹配；其中必须包含空/未闭合代码块、拒绝、失败、风险自适应和会话授权不跨越高风险动作。SSE/宿主集成测试属于下一阶段，须以 mock stream 覆盖 `[DONE]` 和尾缓冲行为。


---

## 10. Windows Installer Pipeline（当前 PyInstaller 宿主）

构建入口为根 `build_installer.py` 与 `npm run build:installer`。该入口先构建和验证 `prototype`，再将 `prototype/dist` 作为数据资源嵌入窗口化 Python 宿主 `Tcode.exe`，最后将核心 EXE 嵌入窗口化单文件安装向导 `Tcode-Setup.exe`。

安装后宿主固定监听 `127.0.0.1:8010`：`/health` 供进程探活，`/` 提供已嵌入的静态前端。构建和验证都使用当前源码，绝不拷贝 `release/` 内的历史二进制。Tauri 链路保留为后续主轴迁移目标；在其完整构建脚本落地前，当前受支持的 Windows 安装器采用这一可复现的 Python 宿主链路。


---

## 🏛️ 八、宿主网关与三栏百分比流体架构 (HostGateway & Layout Engine)

```mermaid
graph TB
    subgraph View ["1. 表现层与流体布局 (React 19)"]
        LeftCol["LeftPanel (18% 百分比自适应 · 12%~35%)"]
        ChatCol["ChatColumn (flex: 1 · 最小 320px 弹性自适应)"]
        WorkCol["EditorWorkspace (32% 百分比自适应 · 20%~50%)"]
        AgentRunView["AgentRunCard (目标验收清单 + 内部 Step 链路)"]
    end

    subgraph SecurityGateway ["2. 统一宿主安全网关 (HostGateway)"]
        Shield["SecurityShield (敏感凭据脱敏审查)"]
        Guard["SandboxGuard (破坏性指令分类与沙箱阻断)"]
        Gateway["HostGatewayService (统一 IPC 抽象与派发)"]
    end

    subgraph DesktopHost ["3. 桌面宿主服务 (Python Desktop Core)"]
        TermExec["/api/terminal/exec (命令执行与管道捕获)"]
        FSReadWrite["/api/fs/read & /api/fs/write (文件原子 IO)"]
        GitShadowEngine["/api/git/checkpoint & /api/git/revert (物理文件级影子快照与回滚)"]
    end

    View --> SecurityGateway
    Shield --> Guard --> Gateway
    Gateway --> TermExec & FSReadWrite & GitShadowEngine
```

### 核心架构原则
1. **单一入口 openFile**：全链路收敛为 `handleOpenFile(path, fileName, line)`；
2. **百分比流体拖拽**：基于全局 `PointerEvent` 监听与百分比弹性分配，双击复位；
3. **真实物理闭环**：杜绝模拟 Toast，回滚与读写直接作用于磁盘与 Git 检查点。
