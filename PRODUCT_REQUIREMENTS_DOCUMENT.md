# CodeMind-Hub 全景产品需求与架构设计规范 (PRD v2.0)

> **产品定位**：新一代企业级开源极简 AI 编程桌面工作台 (Cursor-Alternative Native IDE)  
> **核心主张**：基于“总线-子线”与“搭积木”架构，构建**安全可靠、极致省 Token、高度人机协同**的自主编程智能体底座。  
> **设计团队**：Agent 产品经理、UI/UX 设计师、前端架构师、Rust 原生核心工程师、Python 治具工程师

---

## 🏛️ 一、四大核心系统底座 (Four Foundational Pillars)

本项目坚决摒弃传统 AI 工具的面条式堆叠与黑盒失控，确立**四大核心系统底座**：

```
                              ┌─────────────────────────────────────────────────────────┐
                              │            CodeMind-Hub 四大核心系统底座                 │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
        ┌──────────────────────────┬───────────────────────┴──────────────────┬──────────────────────────┐
        ▼                          ▼                                          ▼                          ▼
【1. 总线-子线底座】        【2. 积木解耦底座】                       【3. 极致省Token底座】      【4. 安全系统底座】
- 单例调度总线 GatewayBus   - 表现积木 (标题/树/聊天/终端)             - 确定性KV Cache前缀对齐   - Git 影子快照秒级回退
- 插拔子线 (Claude/Ollama)  - 核心积木 (AST/Diff/Memory)              - AST 骨架剪枝 (90%省量)   - 权限双轨制 (人审 vs 自决)
- 零耦合、热插拔与秒级熔断  - 独立成块，无循环依赖，高内聚可单测       - 原子级精准 Diff Patch    - AST 语法落盘前置防御
```

### 1.1 总线与子线架构底座 (Bus & Subline Substrate)
- **调度总线 (`GatewayBus`)**：作为中央单一消息总线，只负责状态流转、上下文路由与事件分发，不夹带任何具体供应商的特化逻辑；
- **标准化子线插槽 (`IProviderSubline`)**：Claude、OpenCode、Codex、阿里百炼、本地私有 Ollama 及 MCP 工具均以“独立子线插件”挂载；
- **平滑降级与无缝扩充**：新增或替换任意模型子线无需触碰前端任何一行 UI 代码。

### 1.2 搭积木解耦底座 (Decoupled Building-Blocks Substrate)
- 拒绝过度封装的复杂继承层级，坚持模块原子化：
  - **表现积木**：Titlebar、ActivityBar、LeftPanel、ChatColumn、EditorWorkspace；
  - **核心积木**：AST 抽取器、Unified Diff 补丁器、Memory 记忆网格、Test 治具运行器；
  - 每个积木块均拥有独立的接口契约，可独立替换、独立单测、独立演进。

### 1.3 极致省 Token 认知底座 (LLM-Native Extreme Token Efficiency Substrate)
站在 AI 模型底层原理（Transformer 注意力机制、KV Cache 前缀复用与自回归输出代价）的最高维度，全流程压缩 Token 开销：
1. **确定性静态前缀流水线 (Deterministic KV Cache Preservation)**：
   - 模型厂商（Claude、OpenAI、DeepSeek）对**完全一致的 Token 前缀**提供高达 90% 的命中折扣与 10x 推理加速；
   - 彻底消灭将易变时间戳、动态 Git 状态插在 System Prompt 首部的行业通病，将系统规则与工具定义严格冻结在首部，动态上下文置于尾部，确保 **KV Cache 命中率稳定在 90%~95% 以上**！
2. **AST 骨架代码剪枝 (AST Skeleton Pruning)**：
   - 跨文件关联时，严禁无脑读取数百行具体实现；
   - 骨架分析器自动剔除函数体实现（`{ ... }` / `pass`），仅向上下文喂入接口签名、类型定义与 Docstring，**从 2500 Token 瞬间压缩至 80 Token（缩减 96%）**！
3. **原子级精准 Diff Patch 替代全量覆写**：
   - 模型的输出 Token 比输入贵 3~4 倍且耗时极长。修改 1000 行文件中的 3 行代码时，强制输出原子精确补丁块（Search/Replace Block），**输出 Token 消耗由 1200 Token 降至 25 Token**！
4. **智能终端与编译器噪声抑制 (Compiler/Terminal Noise Filter)**：
   - Rust 微内核在进程管道层过滤进度条、转轮、下载动画与非致命告警，仅向 LLM 喂入关键 Error 行与故障定位上下文（减少 90% 终端输出 Token）。
5. **分级滑动记忆网格 (Multi-Tier Memory Compactor)**：
   - **L0 恒定核心层**：项目根规则与 Spec 契约永远保真；
   - **L1 浓缩事实层**：历史对话滚动浓缩为条目化决策事实（Facts）；
   - **L2 活跃滚动层**：仅最后 2 轮保持原始明细，杜绝长会话 Token 爆炸与失忆。

### 1.4 安全系统底座 (Security & Reversible Substrate)
- **Git 影子快照与秒级回退**：任何文件写入与高危指令前自动打快照（`[CodeMind Checkpoint]`），界面提供常驻 **`↩️ 影子回退`** 按钮，点击秒级 `git reset --hard`；
- **双轨权限治理**：支持一键切换 `[ 🛡️ 逐次审核 ]` 与 `[ 🤖 智能决策 ]`，兼顾审查把控与自动化自愈；
- **AST 语法防腐门禁**：落盘前在内存中校验语法，严防死守半截残缺代码；
- **无窗口静默进程隔离**：Tauri Rust 原生通道调用，消除 Windows 弹窗黑框干扰。

---

## 🔍 二、GitHub Top 20 竞品深度洞察与取舍矩阵

| 竞品名称 | 核心亮点 (吸收进本项目) | 核心痛点与缺陷 (本项目严格规避) | 本项目吸收转化设计 |
| :--- | :--- | :--- | :--- |
| **Cursor** | 多文件流式渲染流畅，体验一体化 | 商业闭源、代码索引强制上云、订阅捆绑 | 打造纯本地可自托管的 Cursor 级桌面体验 |
| **Cline** | Plan/Act 双模式，工具调用透明可见 | 长任务 Token 消耗极度恐怖，频繁打扰用户 | 引入分级压缩总线，提供智能自主决策降频 |
| **Aider** | Git 深度绑定，极其省 Token | 纯 CLI 终端交互，缺乏可视化 Diff 审批 | 吸收 Git 影子检查点，做成图形化一键回退 |
| **Continue** | 任意自填 API Key / Ollama 本地模型 | 缺乏端到端 Agentic 自主规划自愈闭环 | 吸收全渠道灵活配置，纳入 GatewayBus 子线 |
| **Windsurf** | "Cascade" 流式上下文追溯极快 | 私有闭源生态，难以自定义网络 Relay | 吸收紧凑上下文条，融入 AST 图谱感知 |
| **Void** | 开源 Cursor 替代思路，基于 VS Code Fork | 维护 VS Code Fork 极其沉重，更新脱节 | 摆脱沉重 Fork，采用轻量级 Tauri v2 微内核 |
| **OpenHands** | 完整的全自动化软件工程师 Agent | 极度沉重，强依赖 Docker 环境 | 剔除容器依赖，采用极简无黑框原生系统调用 |
| **Roo Code** | 细粒度多角色分工（Architect / Coder） | 规则配置复杂，学习成本偏高 | 简化为“📐 规划”与“💻 落地”双模式极速热切 |

---

## 🤝 三、人机协同动态交互选择体系 (Dynamic Human-in-the-Loop)

当 Agent 在推理过程中遇到技术分叉或歧义时，**严禁盲猜代劳**，主动触发结构化微型卡片挂起：

```markdown
[[ASK_OPTIONS]]
{
  "type": "ask_options",
  "question": "检测到组件状态扩展需求，请选择架构路径：",
  "single_select": true,
  "options": [
    { "id": "extend", "label": "扩展现有全局 Store (Recommended)", "description": "单例状态源，无额外模板代码" },
    { "id": "slice", "label": "新建独立子模块 Slice", "description": "严格模块隔离，适合大型复杂功能" }
  ],
  "allow_custom_input": true
}
```
- **核心场景**：架构选型分叉、高危爆炸半径确认、测试失败自愈策略决策；
- **交互体验**：单选圆点/多选复选框，自带 `(推荐)` 标签与自定义补充输入框；确认后平滑折叠为 24px 决策胶囊，注入工作记忆。

---

## 🔐 四、双轨权限治理与智能自主决策引擎

- **🛡️ 严格逐次审核模式 (Strict Approval)**：
  - 彻底关闭自动落盘，智能体生成的每项文件修改与终端命令均需人工点击 `⚡ 批准`；
- **🤖 智能自主决策模式 (Autonomous Agent)**：
  - 无需频繁干预，Agent 基于最优技术路径、AST 正确性与测试反馈自主推进；
  - 每次落盘前**强制建立影子快照**，开发者随时一键还原；
- **⚡ 风险自适应熔断模式 (Risk-Adaptive Circuit Breaker)**：
  - 常规增改代码自动放行；删除文件、修改核心锁文件自动触发熔断降级为人审。

---

## 🎨 五、UI/UX 人体工程学设计规范 (Cursor 风格柔和暖色)

1. **色彩基调 (Warm Minimalist Palette)**：
   - **基底色 (App Base)**：`#FAF8F5` (Warm Cream 柔和暖米白，消除刺眼冷白反光)；
   - **工作台表面 (Surface)**：`#F4EFEA` (Warm Soft Ivory，自然微弱分层)；
   - **强调色 (Accent)**：`#D96B27` (低饱和陶土暖橙，克制用于运行状态与关键动作)；
   - **代码/终端块**：`#1E1C1A` (暖炭黑底色搭配 `#A3E635` 柔和荧光绿字符)。
2. **布局人体工程学 (16:9 Ergonomic Ratio)**：
   - **42px 窄图标活动栏**：极简单列，包含文件、搜索、Git、图谱、网关入口；
   - **240px 左侧面板**：包含会话管理（支持 `#feat` 标签）与真实磁盘树；
   - **弹性 45% 中间流式对话区**：纵向卡片排布，输入框上方横向固定操作工具条（`+ add context`、模式切换、权限切换）；
   - **弹性 55% 右侧代码与终端工作区**：顶部纯净文件多标签页，底部 24px 抽屉式终端把手。
3. **极简克制原则**：
   - 彻底禁用：大号笨重圆角按钮、拟物阴影、无意义装饰卡片；控件高度严格控制在 24-28px，最大化代码可视面积。

---

## 🚀 六、全景功能排期与优先级规划 (MoSCoW Matrix)

| 优先级 | 功能模块 | 描述与价值 |
| :--- | :--- | :--- |
| **P0 (Must-Have)** | **GatewayBus 核心总线** | 支持多渠道（OpenCode、Claude、Codex、百炼、Ollama）秒级热切换与子线注册 |
| **P0 (Must-Have)** | **安全底座 (Git 影子快照)** | 写入操作前无条件快照，界面常驻一键秒级影子回退 (`git reset --hard`) |
| **P0 (Must-Have)** | **极致省 Token 引擎** | 确定性 KV Cache 前缀冻结、AST 骨架裁剪 (省90%)、原子精准 Diff Patch |
| **P0 (Must-Have)** | **Plan/Act 双模式切换** | 输入框上方一键切换：Plan 模式只分析不写盘，Act 模式可落地执行 |
| **P0 (Must-Have)** | **人机动态选择卡片 (OptionsCard)** | 遇到分叉主动挂起，支持单选/多选/自定义输入补充并即时唤醒 |
| **P0 (Must-Have)** | **双轨权限治理 (PermissionPolicy)** | 支持“逐次人工审核”与“智能自主决策”一键切换，自带影子快照兜底 |
| **P0 (Must-Have)** | **防偷懒原子级补丁器** | 严防 `// rest of code` 惰性占位，只做高精度原子 Unified Patch |
| **P0 (Must-Have)** | **死循环熔断与三振出局** | 连续 3 次修错自动熔断回退到健康快照，弹出交互卡片由人裁决 |
| **P0 (Must-Have)** | **SDD + TDD 工作流** | 编码前自动在对话流中输出 Spec 契约与前置红绿测试 |
| **P1 (Should-Have)** | **分级上下文压缩总线** | L0不可压缩/L1事实浓缩/L2滚动，杜绝遗忘与长会话 Token 膨胀 |
| **P1 (Should-Have)** | **反向引用影响雷达** | 修改公共函数签名时，通过 AST 拓扑自动把下游调用方列入待办 |
| **P1 (Should-Have)** | **智能终端输出噪声过滤器** | Rust 管道层过滤无用日志转轮，提取关键 Error 行，节省 90% 终端 Token |
| **P1 (Should-Have)** | **积木式斜杠指令与配方库** | 输入 `/` 瞬间唤醒 `/test`、`/review`、`/doc` 等模块化动作 |
| **P1 (Should-Have)** | **真实工程 AST 知识图谱** | 提取类名、函数签名与调用关系，轻量注入 System Prompt |
| **P2 (Could-Have)** | **任务自适应模型动态路由** | Plan 用思考模型，Act 用极速代码模型，自带 Token 成本看板 |
| **P2 (Could-Have)** | **一键物理级纯离线私密模式** | 屏蔽一切外部公网请求，仅绑定本地 Ollama，彻底保障数据合规 |
| **P2 (Could-Have)** | **MCP 协议子线动态挂载** | 兼容 Model Context Protocol 本地工具动态导入 |
| **P3 (Won't-Have)** | **复杂虚拟多 Agent 公司** | 坚决剔除 MetaGPT 式多角色互相对话的虚幻冗余消耗，坚持实用结对 |
