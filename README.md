# Tcode (Next-Gen AI Agentic Studio)

新一代开源 AI 编程桌面工作台，基于 **Tauri v2 + Tokio 异步 Rust Core Daemon + React 19 + TypeScript**，采用 **Inner/Outer Loop 统一双环执行内核**、**Rail 能力插件体系** 与 **Swarm Flow 算子化多智能体编排流**，严格遵循暖米白（`#FAF8F5`）、工作台米灰（`#F4EFEA`）与陶土暖橙（`#D96B27`）的极简工程人机美学规范。

---

## 🏛️ 一、核心架构设计 (Unified Dual-Loop & SwarmFlow Architecture)

Tcode 打破了单体硬编码调度逻辑，将 Agent 的执行循环、能力轨道、多智能体协同编排与表现层彻底解耦：

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Tcode Frontend (React 19 + TypeScript)                    │
│      [ 单焦点主工作区 (智能对话 / Monaco编辑器 聚合切换) | Diff 对比 | 终端抽屉 | 纯净空状态 ]       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Tauri v2 Zero-Copy IPC / Typed Event Streams
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          Tcode Rust Core Daemon (Tokio Async Engine)                   │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Swarm Flow 算子化多智能体编排流 (Swarm Flow Operators)            │  │
│  │    budget() ➔ parallel() ➔ compact() ➔ pipeline() ➔ agent_session() ➔ human() ➔ 🏆 return │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 驱动所有 Agent 节点运行同一套执行内核       │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      Unified Dual-Loop Engine (统一双环执行内核)                   │  │
│  │                                                                                  │  │
│  │    🔄 Outer Loop: 状态评估与多轮收敛 (判断是否再来一轮 / 终止准则 / 预算核销)          │  │
│  │        │                                                                         │  │
│  │        ▼                                                                         │  │
│  │    ⚡ Inner Loop: 单轮四步闭环 (Observe ➔ Reason ➔ Act ➔ Verify)                  │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ 生命周期固定钩子链式分发                    │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                       Rail Plugin Ecosystem (能力即插件，挂载在固定钩子)           │  │
│  │  ┌───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐ │  │
│  │  │ 🛡️ SafetyRail │ 🧠 MemoryRail │ 🔌 ToolRail   │ 🗺️ PlanningRail│ 📊 ObsRail   │ │  │
│  │  │  Priority 100 │  Priority 80  │  Priority 60  │  Priority 40  │  Priority 20 │ │  │
│  │  │  • on_before_act│ • on_after_obs│ • dispatch    │ • subtasks    │ • live trace │ │  │
│  │  │  • 越界指令阻断 │ • RepoMap注入 │ • MCP协议通信 │ • DAG拓扑编排 │ • SSE事件流  │ │  │
│  │  └───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 二、三大核心技术亮点与设计哲学

### 1. Inner Loop / Outer Loop：同一套执行内核，覆盖所有场景
* **统一调度**：不论是独立工作的单个 Agent、被委派处理子任务的 Agent，还是 Swarm 团队里的一名成员，跑的都是同一套执行内核：
  * **Inner Loop (内层执行闭环)**：负责单轮迭代的 `Observe (观察)` ➔ `Reason (推理)` ➔ `Act (行动)` ➔ `Verify (验证)`；
  * **Outer Loop (外层循环收敛)**：判断任务是否真正完成、是否满足终止准则、根据验证结论判断“要不要再来一轮（Self-Healing）”。
* **零重构成本**：开发者不需要为每一种使用场景重新设计一套调度逻辑。

### 2. Rail 机制：能力即插件，想接就接
* **能力挂载在生命周期钩子上**：安全策略、记忆管理、任务规划、工具治理、语义理解、可观测事件……全部以 `Rail` 形式挂载在执行生命周期的固定钩子上：
  * `on_before_observe` / `on_after_observe`
  * `on_before_reason` / `on_after_reason`
  * `on_before_act` / `on_after_act`
  * `on_before_verify` / `on_after_verify`
  * `on_outer_loop_check`
* **优先级裁决 (Priority Chain)**：通过 `priority: u32` 决定谁先谁后、谁能覆盖谁（例如 `SafetyRail` 拥有 P-100 最高裁决权，可直接阻断不安全命令）；
* **极低扩展成本**：想加一条自定义规则、接一个内部工具，完全不用改动执行内核，照着 `RailHandler` 接口实现一个 handler 即可。

### 3. Swarm Flow：可自由拼装的编排算子流
多智能体协同不是一套固定的拓扑，而是一组像函数式流水线一样的自由编排算子：
* **`budget()`**：查询剩余 Token / 成本预算与并发配额，自适应决定 Worker 扇出系数；
* **`parallel()` (Launch Barrier Synchronization)**：并发派发至 $N$ 个 Worker，执行栅栏同步等待全部分支生成候选完毕；
* **`compact()` (Filter Empty Results)**：过滤空结果与异常失败分支，保留健康候选集；
* **`pipeline()` (Streaming Review)**：流式传递结果至复核流水线，独立审查打分；
* **`agent_session()` (Stateful Arbiter)**：有状态仲裁者智能体，聚合候选方案与审查评分，决选最优方案；
* **`human()` (Human Fallback)**：当仲裁者置信度不足（$<80\%$）或存在高危操作时，优雅唤起人工兜底介入；
* **`return` (Final Result)**：交付确认产物，完成端到端闭环。

---

## 🌟 三、工作台系统功能矩阵

### 1. 单焦点主工作区聚合切换 (Single-Focus Primary Workspace)
* **告别三列挤压**：彻底解决“对话 + 编辑器同时平铺”导致的屏幕局促感，采用 Cursor / Windsurf 一线规范的聚焦视图切换；
* **顶栏与活动栏一键切换**：
  * `[💬 智能对话 (Chat)]`：全宽舒适阅读与任务编排；
  * `[📝 代码工作区 (Editor)]`：全宽展示 Monaco 代码编辑器、Diff 双栏比对视窗与终端；
* **顺滑联动**：点击左侧文件树时自动切至代码工作区；在对话中审查 Diff 时自动无缝跳转。

### 2. sub2api 架构纯净模型网关 (Model Gateway Cockpit)
* **一个厂商添加多个渠道**：支持针对同一厂商（如 OpenAI、Claude、DeepSeek）动态添加任意多个独立渠道与账号池；
* **全认证模式支持**：支持 `API Key`, `Sub2 订阅导入`, `Cap 凭据包导入`, `OAuth 2.0 官方授权`, `自建中转/代理`；
* **极速探活测速**：一键真实连通性测试，毫秒级返回 HTTP 状态码与首字延迟（TTFT）；支持自动拉取端点可用模型列表。

### 3. MCP 与 SKILL 业界标准管理中心
* **Anthropic MCP 协议**：支持表单创建、Claude Desktop JSON (`{ "mcpServers": { ... } }`) 一键导入、官方预设模版挂载（Postgres, SQLite, GitHub, Brave）、编辑修改与启停；
* **Agent Skills 技能清单**：支持通过触发指令（`/review`, `/tdd`, `/security`）挂载自定义专业提示词。

### 4. 纯净零数据初始状态 (Zero Demo & Clean Empty State)
* 严格执行无假数据铁律，初次启动呈现干净的 0 项目、0 会话状态，只有用户显式打开本地项目后才载入工作区。

---

## 🎨 四、视觉与人机工程学规范

* **主背景色**：`#FAF8F5` (Warm Cream 柔和暖米白)
* **工作台底色**：`#F4EFEA` (Workspace Muted 米灰)
* **品牌强调色**：`#D96B27` (Terracotta Orange 陶土暖橙)
* **代码暖黑**：`#1E1C1A` (Code Dark 暖炭黑)
* **人机工学**：单主轴聚焦切换，16:9 原生工作台视野。

---

## 🛠️ 五、本地构建与安装包运行

### 1. 运行单元测试
```bash
npm test
```

### 2. 启动前端开发调试
```bash
npm run dev
```

### 3. 一键构建生产环境 Windows 安装包
```bash
npm run build:installer
```
* **构建产物**：
  * `Tcode-Setup.exe`（项目根目录）
  * `release/Tcode-Setup-v2.0.0.exe`
  * `prototype/swarm_flow_interactive.html`（可交互编排原型系统）
