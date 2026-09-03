# Tcode 工业级前端工程落地任务计划 (Production-Grade Frontend WBS)

> **版本**：v2.0.0-PROD  
> **负责人**：Tcode 资深前端架构师与 UI/UX 体验工程师  
> **设计基准**：[`prototype/web_prototype.html`](../web_prototype.html) 与 [`docs/UI_DESIGN_SPEC.md`](./UI_DESIGN_SPEC.md)  
> **技术栈**：React 19 + TypeScript 5.5 (Strict) + Tailwind CSS v4 + Zustand + Monaco Editor + Xterm.js 5.x + @tanstack/react-virtual  
> **工程指标**：万行 Diff 渲染 60fps、终端 10 万行日志零卡顿、Monaco 实例池化零泄漏、SSE 智能重连、100% 严格类型守卫

---

## 🎯 一、技术选型与工业级依赖体系 (Architecture & Libs)

坚决杜绝“把前端当玩具写”，必须满足大型代码仓库的高性能交互需求：
- **核心框架**：React 19 原生并发模式（利用 `useTransition` 分离低优 Diff 渲染，保证输入流始终高响应）；
- **类型安全**：TypeScript 5.5（强制开启 `strict: true`、`noUncheckedIndexedAccess: true`，禁止任何 `any` 侵入）；
- **分层状态治理架构**：
  - **持久业务状态**（会话历史、工作区配置）：Zustand 结合 IndexedDB（`idb-keyval`）异步分片落地，杜绝 LocalStorage 5MB 溢出与同步 IO 卡顿；
  - **瞬态交互状态**（打字机逐字缓冲、展开折叠、拖拽尺寸）：严格限制在组件树局部，绝不污染全局 Store，避免雪崩式全量 Re-render；
- **大数据量虚拟化渲染**：`@tanstack/react-virtual`（针对长会话流、终端输出、审计流虚拟化渲染）；
- **虚拟终端引擎**：`@xterm/xterm` 5.3+ 配合 `@xterm/addon-canvas` 与 `@xterm/addon-fit`；
- **编辑器核心**：`monaco-editor`，配置独立 Web Worker（`editor.worker.js`, `ts.worker.js`），彻底解放 UI 主线程。

---

## 📋 二、核心分层工程落地 WBS (5 大生产级模块)

```text
frontend/src/
├── app/
│   ├── layout/                    # 主视口三态流体分栏架构 (Single-Focus Shell)
│   │   ├── ActivityBar.tsx        # 48px 图标导航与 Tooltip 挂载
│   │   ├── WorkspaceSwitcher.tsx  # 顶栏单焦点平滑切换胶囊
│   │   └── SplitViewContainer.tsx # 左右弹性拖拽容器 (双击复位黄金分割)
│   ├── chat/                      # 智能对话工作台
│   │   ├── message/               # 消息气泡树 (流式打字、思考折叠、选择卡片)
│   │   └── input/                 # 输入舱 (双向 @ 引用、/ 指令与审核开关)
│   ├── terminal/                  # 底部集成终端抽屉
│   │   ├── TerminalDrawer.tsx     # 抽屉外壳与 Ctrl+` 全局键盘快捷键
│   │   ├── XtermView.tsx          # 真实 Xterm 终端实例挂载与双向管道
│   │   └── TraceStreamView.tsx    # SSE 执行链路虚拟化渲染
│   ├── git/                       # 生产级 Git 源代码管理中心
│   │   ├── GitPanel.tsx           # 双层暂存 (Staged vs Working)
│   │   ├── AiCommitBox.tsx        # AI 提炼 Conventional Commits
│   │   ├── GitBranchModal.tsx     # 居中分支模态窗 (检出与新建)
│   │   └── SnapshotModal.tsx      # 影子快照一键无损回退
│   ├── analytics/                 # 模型使用量与 Token 效能监控大盘
│   │   ├── UsageCockpit.tsx       # 全景监控工作舱 (今日/7天/30天切片)
│   │   ├── KpiMetricsGrid.tsx     # 4 大 KPI 仪表盘
│   │   ├── ThroughputCanvas.tsx   # 24 小时高帧率 Canvas 柱状时序波形
│   │   └── AuditVirtualList.tsx   # 虚拟化调用审计流水
│   └── modals/                    # 统一人机弹窗 (居中、显式[X]、Esc退出)
├── core/
│   ├── store/                     # Zustand 分层数据源
│   │   ├── workspaceStore.ts      # 视图聚焦模式与分栏比例
│   │   ├── sessionStore.ts        # 会话树与上下文
│   │   └── gitStore.ts            # 暂存区与快照状态
│   ├── monaco/                    # Monaco 编辑器与 Diff 实例池管理
│   │   ├── editorPool.ts          # 实例复用池 (防内存暴涨)
│   │   └── diffViewer.tsx         # 行级/块级比对组件
│   └── transport/                 # 微内核长连接通信客户端
│       ├── sseClient.ts           # 智能指数退避重连 SSE
│       └── wsClient.ts            # 终端流控 WebSocket
```

---

### 阶段 1：单焦点工作区调度器与 Monaco 实例池 (Sprint 1)

#### 1.1 顶栏单焦点平滑切换胶囊与自适应流转 (`app/layout/`)
- **状态机定义**：
  ```typescript
  export type WorkspaceViewMode = 'chat' | 'split' | 'editor';
  interface WorkspaceLayoutState {
    mode: WorkspaceViewMode;
    splitRatio: number; // 0.2 ~ 0.8，默认 0.5
    setMode: (mode: WorkspaceViewMode) => void;
    setSplitRatio: (ratio: number) => void;
    triggerSmartSplit: (filePath: string, diffContent?: string) => void;
  }
  ```
- **核心实现细节**：
  - 在全宽对话（`mode === 'chat'`）模式下，若用户点击对话流内的文件修改卡片，`triggerSmartSplit` 触发，平滑过渡至 `split` 模式，右侧自动载入并滚动到修改行；
  - 窗口尺寸小于 960px（笔记本屏幕）时，自动降级禁用双栏，防止视口坍缩。
- **质量验收标准**：
  - 切换过渡动画达 60fps，零跳闪；
  - 双击分栏拖拽手柄准确复位为 50%:50%。

#### 1.2 Monaco 编辑器与 Diff 实例池化管理 (`core/monaco/editorPool.ts`)
- **内存泄漏防御策略**：
  - 严禁在组件每次挂载/卸载时重复执行 `monaco.editor.create()` 与 `createDiffEditor()`；
  - 构建单例编辑器池（`EditorPool`），在切换视图模式时仅移动 DOM 挂载节点（`domNode.appendChild(pool.getDiffEditorContainer())`），彻底规避频繁垃圾回收（GC）导致的界面卡顿。
- **质量验收标准**：
  - 连续切换 100 次视图与文件，Chrome 堆内存曲线平稳，内存增量 $< 5\text{MB}$。

---

### 阶段 2：Xterm 5.x 真实虚拟终端抽屉与双向流控 (Sprint 2)

#### 2.1 终端抽屉布局与全局快捷键调度 (`app/terminal/TerminalDrawer.tsx`)
- **核心实现细节**：
  - 全局键盘监听挂载在顶层 Window：
    ```typescript
    if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
      e.preventDefault();
      useTerminalStore.getState().toggleOpen();
    }
    ```
  - 支持快捷键在任意层级一键呼出与隐藏（高度默认 230px，最大化 48vh，记录用户自定义拖拽高度至 IndexedDB）。

#### 2.2 Xterm 5.x Canvas 加速与 WebSocket 双向绑定 (`app/terminal/XtermView.tsx`)
- **核心实现细节**：
  - 加载 `@xterm/addon-canvas`，将终端文字渲染交由 GPU Canvas 加速，突破 DOM 节点性能瓶颈；
  - 加载 `@xterm/addon-fit`，监听窗口与抽屉拉伸（`ResizeObserver`），动态计算并向微内核上报 `rows` 与 `cols`；
  - 双向二进制数据通信：用户手敲按键通过 WebSocket 直接发送，微内核标准输出秒级回显，支持常用 ANSI 转义颜色码。
- **质量验收标准**：
  - 持续执行高频输出命令（如 `find /` 或大规模构建编译），界面无假死，保持流畅滚动。

---

### 阶段 3：生产级 Git 控制中心与差异比对系统 (Sprint 3)

#### 3.1 双层暂存工作流与乐观更新 (`app/git/GitPanel.tsx`)
- **核心实现细节**：
  - 界面分为 **`已暂存 (STAGED CHANGES)`** 与 **`未暂存更改 (CHANGES)`**；
  - 用户点击 `+` (暂存) 时，前端立即执行乐观 UI 更新（将其移入暂存列表），同时向微内核发起异步 `git add`；若后台返回失败，自动回滚 UI 并弹出错误 Toast；
  - 放弃文件修改（`git restore`）时，弹出统一人机工程学确认浮层，杜绝误触丢弃代码。
- **质量验收标准**：
  - 无论仓库改动包含 2 个还是 200 个文件，状态流转无延迟迟滞。

#### 3.2 AI Conventional Commits 提炼打字组件 (`app/git/AiCommitBox.tsx`)
- **核心实现细节**：
  - 用户点击 **`[🪄 AI 提炼]`**，向微内核发起当前暂存区 Diff 分析请求；
  - 采用打字机流式渐显动画（`StreamTypewriter`），逐字打入规范描述（如 `feat(core): implement zero-copy ring buffer event bus`）；
  - 支持快捷键 `Ctrl + Enter` 一键提交。

#### 3.3 居中模态弹窗组规范落地 (`app/git/modals/`)
- **严格遵循【铁律 5】**：
  - `GitBranchModal.tsx` 与 `SnapshotModal.tsx` 严格居中；
  - 右上角配置显式 `[X]` 关闭按钮，附悬停 Tooltip；
  - 支持遮罩点击关闭与全局 `Esc` 层级阻断退出；
  - 影子快照列表点击“一键秒级恢复”，向微内核发送快照 SHA，工作区磁盘与 Monaco 状态毫秒级无损复原。

---

### 阶段 4：多模型使用量与 Token 效能监控大盘 (Sprint 4)

#### 4.1 全景工作舱与多维 KPI 仪表盘 (`app/analytics/`)
- **核心实现细节**：
  - 活动栏导航位切换专属工作舱（`UsageCockpit.tsx`），支持 `Esc` 秒级切回对话；
  - 4 大 KPI 卡片数据格式化：
    1. **今日 Tokens 吞吐**：千分位逗号格式化，区分输入/输出比例与昨日环比；
    2. **预估计费支出**：双币种自动折算（`¥ 4.28 / $0.61`），计算日限额使用率百分比（`8.5%`）；
    3. **平均首字延迟 (TTFT)**：毫秒级实时加权计算；
    4. **Prompt Cache 节省率**：公式 $\frac{\text{Cached Tokens}}{\text{Total Input Tokens}} \times 100\%$，直观展现节约成本。

#### 4.2 24 小时吞吐波形 Canvas 高帧率渲染 (`app/analytics/ThroughputCanvas.tsx`)
- **核心实现细节**：
  - 抛弃厚重的外部第三方图表库（减小体积 1.5MB），采用原生 HTML5 Canvas 绘制；
  - 支持鼠标悬停高亮当前时间段柱子，浮出微阴影气泡卡片，展示具体时刻的输入 Tokens、输出 Tokens 与调用峰值；
  - 高 DPI 屏幕（Retina）物理像素自适应（处理 `devicePixelRatio`，杜绝柱状图模糊毛边）。

#### 4.3 虚拟化实时调用审计流 (`app/analytics/AuditVirtualList.tsx`)
- **核心实现细节**：
  - 挂载 `@tanstack/react-virtual`，仅渲染视口内可见的 10~15 个审计条目，即使后端推送 5,000 笔流水，内存占用亦恒定；
  - 顶部提供 **「导出 CSV 报表」**：使用原生 `Blob` 生成 `tcode-token-usage-audit.csv` 并自动触发浏览器下载，零后端生成负担。

---

### 阶段 5：通信韧性、全链路容灾与安装包构建发布 (Sprint 5)

#### 5.1 智能指数退避重连 SSE 客户端 (`core/transport/sseClient.ts`)
- **核心容灾算法**：
  - 使用 `fetch` 结合 `ReadableStream` 手动解码 SSE（替代功能简陋的原生 `EventSource`，原生不支持自定义 Headers 与 POST 请求）；
  - 当微内核重启或网络波动中断时，触发退避算法：
    $$T_{retry} = \min(T_{max}, T_{base} \times 2^n) \pm Jitter$$
    其中 $T_{base}=100\text{ms}, T_{max}=5000\text{ms}$，带随机抖动防止并发请求风暴。

#### 5.2 全局错误边界与代码质量门禁
- **核心保护机制**：
  - 根组件包裹 `GlobalErrorBoundary`，捕获未处理的 React 渲染异常，提供“一键重置当前工作区”与“复制崩溃堆栈”按钮，杜绝全屏纯白崩溃；
- **硬性发布门禁**：
  - [ ] `tsc --noEmit` 0 警告 0 类型错误；
  - [ ] `npm test` 单元测试覆盖率 $\ge 80\%$；
  - [ ] `npm run build:installer` 构建通过，生成生产独立安装包并完成静默安装调用测试。
