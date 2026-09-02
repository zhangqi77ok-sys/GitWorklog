---
name: react-web
description: >-
  Lead React Web Architect specializing in React 19, TypeScript, Zustand state management, and modern Web engineering.
  Must be consulted first before creating or editing any React components, hooks, stores, or frontend services.
  Enforces building-block component modularity, single source of truth state, selective subscriptions,
  virtualized streaming performance, zero prop drilling, decoupled event buses, and robust type safety.
---

# React Web 现代前端工程与架构专业规约 (React Web Skill)

本技能为 Tcode 前端架构的**核心工程准则**。在进行任何 React 19 组件编写、状态管理、数据流设计、性能优化或样式修改前，必须优先查阅本规约。

---

## ⚛️ 1. React 19 与组件设计哲学 (Component Design)

### 1.1 积木式单向数据流 (Building-Block Modularity)
1. **单一职责原则**：每个组件只负责一个关注点。例如聊天界面拆解为：
   - `ChatPanel`：整体调度与输入流控；
   - `MessageBubble`：消息容器与角色身份；
   - `ThinkingBlock`：可折叠思考推理流；
   - `ToolCallCard`：折叠式工具调用与执行指标；
   - `MarkdownRenderer`：安全的高亮代码块与 Markdown 渲染；
   - `PromptQueueBar`：任务队列与流式状态胶囊。
2. **纯净组件与隔离**：
   - 严禁组件间出现循环导入；
   - 严禁在子组件内部私自修改父层传入的引用对象；
   - 优先通过 Props 传递清晰明确的回调函数。

---

## 🗄️ 2. 状态管理规范 (Zustand State Architecture)

### 2.1 状态分层与边界划分
1. **领域与持久化状态 (Domain State)**：
   - 会话、工程目录、模型网关配置存放在 `useProjectSessionStore` 与 `useWorkspaceStore`；
   - 必须通过轻量持久化中间件保存到 `localStorage`，并在读取时带有自动数据迁移与洗涤机制。
2. **UI 瞬时状态 (UI Ephemeral State)**：
   - 弹窗开关、当前拖拽尺寸、流式缓冲区属于瞬态，由组件本地 `useState` 或专用的 UI Store 管理；
   - 避免将高频变动的流式文本（Streaming Chunks）盲目写入持久化 Store，防止高频全量刷盘。
3. **精准选择器订阅 (Selective Subscription)**：
   ```tsx
   // 正确做法：按需订阅局部字段，杜绝全 Store 订阅造成的雪崩式重新渲染
   const activeSessionId = useProjectSessionStore((s) => s.activeSessionId);
   const addMessage = useProjectSessionStore((s) => s.addMessage);
   ```

---

## ⚡ 3. 渲染性能与流式高吞吐 (Render Performance)

1. **局部更新优化**：
   - 流式生成的推理过程（Thought）与输出内容（Content）必须使用增量追加方式；
   - 使用 `useMemo` 与 `useCallback` 稳定传递给大型列表的函数句柄；
2. **长列表与大数据渲染**：
   - 大规模代码 Diff 与超长会话消息，必须做好 DOM 节点按需渲染与高度折叠；
   - 代码编辑器使用 Monaco Editor 懒加载机制，避免随首屏主 Bundle 一次性加载阻塞冷启动；
3. **零闪烁与安全回退 (No Flash / Fallback)**：
   - 永远不要在组件渲染层写入 `cleanText || rawText` 导致回退暴露清洗前的控制字符；
   - 消息内容必须先经过标准净化管道。

---

## 🛡️ 4. TypeScript 严格类型工程规范 (TypeScript Strictness)

1. **严禁隐式与随意使用 `any`**：
   - 所有数据实体必须在 `src/types/` 中显式声明接口（`ChatMessage`, `ProjectRecord`, `ToolCallRecord`, `ToolSchema`）；
   - 外部 IPC 返回数据必须经过类型断言或 Zod/校验守卫；
2. **空值守卫与防御性编程**：
   - 始终考虑 `undefined`、`null`、空数组 `[]` 的边界；
   - 使用可选链 `?.` 与空值合并运算符 `??`，杜绝 `Cannot read properties of undefined` 白屏崩溃。

---

## 🎨 5. 现代 CSS 与 Tailwind 规范 (Tailwind CSS)

1. **原子化实用类优先**：
   - 遵循项目 Tailwind CSS 4 设计 tokens，保持统一间距与圆角；
2. **自定义 CSS 规范**：
   - 仅在需要复杂动画、滚动条美化或全局主题覆盖时在 `src/styles/base.css` 中编写纯净 CSS；
   - 绝不使用未隔离的全局标签样式污染子组件。
