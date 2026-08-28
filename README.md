# CodeMind Studio · Cockpit Agentic Desktop Studio (v0.10.0)

> **新一代桌面端智能编程与多智能体协同开发工作台**  
> 基于 **React 19 + Tauri v2 + Rust** 打造，深度融合 **Google Antigravity 智能体网关**、**真实工程知识图谱 (Graph-RAG)**、**长期与短期双层记忆系统**、**5 星严谨度认知对齐** 与 **IntelliJ IDEA 风格 Git 中枢**。

---

## 🌟 核心特性概览 (Core Features)

### 1. 🚀 Google Antigravity & Cockpit 生产级流式大模型网关
- **Google Antigravity 官方深度集成**：完整支持 Antigravity 官方 OAuth 授权、长期有效刷新令牌（Refresh Token / RT 自动保活）与 API Key 直连模式。
- **全模型矩阵热切换**：
  - `gemini-2.5-pro` (Antigravity Core 百万上下文 / 深度思考链)
  - `gemini-2.0-flash` (Antigravity Fast 急速响应)
  - `gemini-1.5-pro` (Antigravity Reasoning 复杂工程推理)
  - 同时支持 **DeepSeek (V3/R1)**、**Anthropic Claude**、**阿里百炼 (Qwen)**、**Ollama 本地大模型** 等多渠道秒级切换。
- **ReAct 智能体状态机**：显式执行 `Thought → Action → Observation → Delivery` 闭环，支持实时流式 Chunk 渲染与 Deep Thinking 思考链折叠展示。

---

### 2. 🕸️ 真实工程代码知识图谱 (Project Graph-RAG)
- **真代码拓扑建模**：彻底告别静态 Demo，动态扫描项目 AST 语法树、依赖拓扑与文件结构，生成交互式工程知识图谱。
- **SVG 可视化画布**：支持自由平移拖拽、滚轮缩放与节点高亮联动。
- **意图驱动注入 (Graph-RAG)**：在会话中提问时，系统自动抽取与问题关联度最高的工程核心拓扑，自动注入 System Prompt 上下文。

---

### 3. 🧠 长期 (LTM) 与短期 (STM) 项目双层记忆系统
- **短期情景记忆 (STM)**：滑动窗口维护多轮会话精细状态，结合 AST 语法骨架保留压缩（保持 95% 代码语义上下文）。
- **长期沉淀记忆 (LTM)**：跨会话自动提取当前工程的**核心架构决策**、**业务模块约定**与**规范指南**，存储于本地持久化记忆库，让 AI 越用越懂你的项目。

---

### 4. ⭐⭐⭐⭐⭐ 5 星严谨度评价与动态认知对齐机制
- **认知分级反馈闭环**：
  - **1~2 星（差评 / 缺陷警示）**：沉淀到 `negative_critique`，**下次关联同类话题时自动激活【🛡️ 最高严谨度防御模式】**，强制执行多维边界排查与防御性推导，严禁模糊推断。
  - **4~5 星（黄金范本）**：沉淀到 `golden_reference`，后续相似任务自动复用其优秀的分层与代码规范。
  - **3 星（常规及格）**：标准对待。

---

### 5. 🌐 生产级原生互联网实时搜索检索 (Native Web Search)
- **拒绝 Demo / 拒绝假联网**：通过 Rust 底层原生网络抓取，彻底突破浏览器 CORS 限制。
- **实时网络事实注入**：在提问时点亮 `[ 🌐 联网 ]`，自动从互联网抓取最新技术文档与事实，融入大模型提示词。
- **可视化引用卡片**：AI 回复卡片顶部清晰展示 `[ 🌐 实时互联网搜索检索已融合 (N 篇权威参考源) ]`，支持直接点击链接打开原始网页。

---

### 6. ⑂ IntelliJ IDEA 风格 Git 分支与操作浮层 (Git Hub Popover)
- **轻量级浮层 Popover**：点击底部分支按钮（如 `[ ⑂ main ]`），在正上方优雅弹出 320px 紧凑浮层，点击外部或按 `Esc` 自动收起。
- **一键快捷 Git 动作**：
  - `📥 Update Project (Git Pull)`
  - `📤 Push Commits (Git Push)`
  - `🔄 Fetch All Remotes (Git Fetch)`
- **分支检索与检出**：
  - 顶部即时搜索框过滤本地与远程分支；
  - `+ 新建分支` 内联快速创建并自动检出；
  - 实时指示 `Working tree clean` 与未提交修改文件状态。

---

### 7. 📁 原生 Windows 文件夹对话框与会话状态可视化
- **纯正桌面体验**：废除浏览器 Web API 弹窗，直调 Windows 原生目录选择器，无任何浏览器权限警告。
- **会话状态标识**：运行中绿色转动圆标（🟢 `animate-spin`）、空闲蓝色圆标（🔵）、异常红色脉冲（🔴）。

---

## 🛠️ 技术架构栈 (Technology Stack)

| 层次 | 选型与组件 |
| :--- | :--- |
| **前端应用层** | React 19, TypeScript, Vite 6, Tailwind CSS, Lucide React |
| **桌面核心层** | Tauri v2, Rust (tokio, serde, tauri-plugin-shell) |
| **安装与打包向导** | Modern Win32 C/C++ GUI Setup Wizard (ClearType, GDI, ShellAPI, RCDATA Payload) |
| **协议与网关** | OpenAI API, Google Antigravity Protocol (OAuth/RT), Anthropic, Ollama |
| **工程上下文与检索** | Graph-RAG Engine, AST Extractor, Project Memory Store, Web Search Engine |

---

## 📦 快速上手与本地构建 (Quickstart)

### 1. 安装依赖与环境要求
- **Node.js**: `>= 20.0.0` (推荐 pnpm `>= 9.0`)
- **Rust**: `>= 1.78.0` (含 `cargo`, `rustc`)
- **C/C++ 工具链** (用于编译原生安装向导): MinGW-w64 / GCC + Windres

```bash
# 克隆仓库
git clone https://github.com/zhangqi77ok-sys/agent-learning.git
cd agent-learning

# 安装前端依赖
pnpm install
```

### 2. 本地开发调试
```bash
# 启动前端开发服务器
pnpm dev

# 启动 Tauri 原生桌面端开发模式
pnpm tauri dev
```

### 3. 生产版本打包
```bash
# 1. 编译前端生产静态资源
pnpm build

# 2. 编译 Rust Tauri 优化原生执行程序
cd src-tauri
cargo build --release
cd ..

# 3. 制作绿色离线分发包并打包 Win32 安装向导
# 使用 gcc 编译 setup_wizard.c 生成 CodeMind-Studio-Tauri-Setup-v0.10.0.exe
```

---

## 📄 许可协议 (License)

本项目基于 [MIT License](LICENSE) 开源发布。
欢迎提交 Issue 与 Pull Request 共同打造极致的 AI 智能编程工作台！
