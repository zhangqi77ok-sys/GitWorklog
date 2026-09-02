---
description: 项目级最高前置规则：每次执行任务前必须优先通读并对齐 UI/UX、React Web 与 Rust 三大专业技能规范
always_on: true
---

# 项目级强制前置规则：三大专业技能优先对齐法则 (Mandatory Prior Skill Consultation)

在 Tcode 项目中，任何涉及功能分析、需求设计、交互设计、前端组件重构、状态变更、底层服务与系统调用的任务，**每次都必须在开始行动前优先通读并严格对齐以下三大专业技能（Skills）规约**：

---

## 📋 每次开发前必查清单 (Mandatory Pre-Flight Check)

### 1. 🎨 `ui-ux` (UI/UX 体验与人机工程设计规约)
- **技能路径**: `.agents/skills/ui-ux/SKILL.md` (或全局 `~/.gemini/skills/ui-ux/SKILL.md`)
- **必查要点**:
  - [ ] 是否遵循 Warm Minimalist 暖色极简调色盘：App Base `#FAF8F5`、Surface `#F4EFEA`、主强调色 `#D96B27`、代码底色 `#1E1C1A`？
  - [ ] 是否符合 16:9 宽屏人机工程学比例（活动栏 42px、会话侧栏 260px、对话 45%、代码 55%、底部抽屉 220px）？
  - [ ] 弹窗是否严禁使用浏览器原生 `alert/confirm/prompt`，并实现屏幕严格居中、Esc 退出、显式 `[X]` 关闭？
  - [ ] 所有纯图标操作是否配置了鼠标悬停 Tooltip / title 提示？
  - [ ] 对话流中思考过程、工具调用卡片与最终回复是否层级清晰、时序紧密对齐？

---

### 2. ⚛️ `react-web` (React 19 + TypeScript 现代前端架构规约)
- **技能路径**: `.agents/skills/react-web/SKILL.md` (或全局 `~/.gemini/skills/react-web/SKILL.md`)
- **必查要点**:
  - [ ] 组件是否坚持积木式单一职责（如 `ChatPanel`、`MessageBubble`、`ThinkingBlock`、`ToolCallCard`、`MarkdownRenderer` 相互解耦）？
  - [ ] Zustand 状态管理是否划分清晰：持久化业务状态走 `useProjectSessionStore`，瞬态 UI 走局部状态？
  - [ ] 是否使用精准选择器订阅（`useStore(s => s.field)`），避免全局重渲染雪崩？
  - [ ] 是否存在任何隐式 `any`？空值守卫（`?.` 与 `??`）是否完备，杜绝 `Cannot read properties of undefined`？
  - [ ] 消息清洗是否杜绝 `cleanText || rawText` 导致的回退漏洞？

---

### 3. 🦀 `rust` (Rust 原生内核与系统架构规约)
- **技能路径**: `.agents/skills/rust/SKILL.md` (或全局 `~/.gemini/skills/rust/SKILL.md`)
- **必查要点**:
  - [ ] 是否 100% 遵循 Safe Rust 原则，严禁无场景滥用 `unsafe`？
  - [ ] 生产代码中是否彻底杜绝 `unwrap()` / `expect()`，统一返回 `Result<T, E>` 强类型错误？
  - [ ] 外部进程与命令调用是否配置 Windows 专属 `CREATE_NO_WINDOW`（`0x08000000`），杜绝黑框弹窗？
  - [ ] 异步任务是否遵循非阻塞原则，密集型任务是否使用 `tokio::task::spawn_blocking`？
  - [ ] 文件与目录操作是否执行严格的路径规范化（Canonicalize）与沙箱防御，并在修改前触发影子快照？

---

## 🚨 违规阻断令
**严禁绕过上述三大技能规范直接编写代码或提交变更！若发现任何违背上述三大技能准则的设计或实现，一律打回重构。**
