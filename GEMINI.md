# Tcode Project Rules & Agent Directives (GEMINI.md)

This project strictly enforces all guidelines and rules documented in [`AGENTS.md`](./AGENTS.md).

## 🚨 项目级最高优先强制铁律：三大专业技能优先对齐 (Always-On Mandatory Rule)

每次执行任何任务、功能开发、组件编写、样式修改、状态调整或系统调用前，**必须优先通读并对齐以下三大专业 Skill 规范**：

1. 🎨 **`ui-ux` (`.agents/skills/ui-ux/SKILL.md`)**：
   - 严格执行 Warm Minimalist 暖色极简视觉系统：底色 `#FAF8F5`、侧边面板 `#F4EFEA`、主品牌强调色 `#D96B27`、代码炭黑 `#1E1C1A`；
   - 严格执行 16:9 人机工程学工作台空间比例；
   - 弹窗严格居中、支持 Esc 退出、具备显式 `[X]` 关闭按钮，严禁浏览器原生弹窗；
   - 能用图标展示处一律用图标，且所有图标必须包含鼠标悬停 Tooltip 提示；
   - 对话流消息中思考过程、工具调用卡片与回复必须层级清晰、时序对齐。

2. ⚛️ **`react-web` (`.agents/skills/react-web/SKILL.md`)**：
   - React 19 积木式单向数据流架构，单一职责解耦；
   - Zustand 状态分离：持久化状态走 `useProjectSessionStore` / `useWorkspaceStore`，瞬态 UI 走局部状态；
   - 精准选择器订阅避免全局重新渲染雪崩；
   - 100% 严格 TypeScript 类型守卫，全链路判空（`?.` 与 `??`），杜绝运行时白屏；
   - 消息清洗严禁 `cleanText || rawText` 造成未清洗标签回退。

3. 🦀 **`rust` (`.agents/skills/rust/SKILL.md`)**：
   - 100% Safe Rust 内存安全原则；
   - 生产环境严禁 `unwrap()` / `expect()`，必须统一返回强类型 `Result<T, E>`；
   - Windows 外部进程必须配置 `CREATE_NO_WINDOW`（`0x08000000`），杜绝黑框弹窗；
   - 严格路径规范化（Canonicalize）与工作区沙箱防护；
   - 任何文件修改前自动建立轻量影子 Git 快照，支持秒级无损回退。

详细完整规则见 [`AGENTS.md`](./AGENTS.md) 与 [`.agents/rules/mandatory-prior-skills.md`](./.agents/rules/mandatory-prior-skills.md)。
