# 07 - 客户端白屏根因防御、模块级锚定弹窗与全功能状态记忆体系

> **归档编号**：KNOW-07  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：UI 稳定性保障 / 错误边界 / 锚定浮层 / 全功能状态持久化与记忆机制

---

## ① 知识点与问题背景 (Context & Problem Statement)

在复杂桌面端 Agent IDE 的迭代开发中，用户反馈了以下三项致命体验问题：
1. **点击设置与导航栏白屏**：点击左侧导航栏“设置”或“能力插件”时，整个应用界面瞬间变为白屏，无法恢复；
2. **模型弹窗位置脱节与联动缺失**：点击输入框底部的模型胶囊时，弹窗出现在页面右上角而非当前模块上方；且在设置中心切换渠道后，对话框未能实时同步模型；
3. **状态记忆丢失**：重启应用或刷新后，此前切换的执行模式（Coding / SwarmFlow）、选中的大模型、打开的代码文件 Tabs、展开/折叠的项目树状态全部复位为默认值，严重割裂开发上下文。

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. React 渲染异常导致白屏的本质
- 当子组件（如 `SettingsModal` 或 `LeftPanel`）在渲染 JSX 表达式时访问了未初始化的属性（如 `ch.models.length`、`channelForm.models.join(',')`、`p.sessions.flatMap(...)`），若未做安全判空，JavaScript 运行时会抛出未捕获的 `TypeError: Cannot read properties of undefined`；
- React 在渲染阶段遇到未捕获异常时，默认会卸载整棵 DOM 树，直接呈现白屏；若没有配置顶层 `<ErrorBoundary>` 错误边界，用户将面对空白窗口。

### 2. 弹窗锚定 (Anchor Positioning) 错位机制
- 弹出浮层（Popover）的绝对定位（`absolute`）必须严格依附于触发按钮所在的**相对定位容器（`relative`）**；
- 之前仅在顶部 Header 中挂载了一个全局唯一的 Dropdown 节点，当用户点击底部的模型胶囊时，触发了同一个布尔状态，导致浮层渲染在顶部 Header 内部，造成视线和操作上的完全脱节。

### 3. 前端易失性状态与持久化记忆图谱
桌面端 IDE 必须区分“瞬态临时变量”与“用户工作流上下文”：

```
┌─────────────────────────────────────────────────────────────┐
│                   全功能状态记忆体系 (Persistence Matrix)      │
├──────────────────────┬──────────────────────┬───────────────┤
│ 状态类别              │ 记忆键名 (Storage Key)│ 恢复时机       │
├──────────────────────┼──────────────────────┼───────────────┤
│ 当前生效大模型        │ tcode_active_model   │ GatewayStore  │
│ 执行模式 (Coding/Swarm)│ tcode_execution_mode │ ChatPanel     │
│ SwarmFlow Token 预算 │ tcode_swarm_budget   │ ChatPanel     │
│ 活动视图 (Chat/Editor)│ tcode_primary_view   │ App           │
│ 侧边栏活动 Tab        │ tcode_active_tab     │ App           │
│ 终端抽屉展开状态      │ tcode_terminal_open  │ App           │
│ 编辑器打开的文件 Tabs  │ tcode_open_tabs_v2   │ WorkspaceStore│
│ 当前聚焦编辑文件      │ tcode_active_tab_v2  │ WorkspaceStore│
│ 当前活跃项目与会话    │ tcode_active_proj_v2 │ SessionStore  │
│ 项目树折叠状态        │ tcode_collapsed_v2   │ LeftPanel     │
│ 深度思考过程折叠状态  │ tcode_collapsed_th   │ ChatPanel     │
└──────────────────────┴──────────────────────┴───────────────┘
```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 顶层 ErrorBoundary 错误边界与自愈保护 (`ErrorBoundary.tsx`)
在 `App.tsx` 最外层挂载优雅降级错误边界，拦截任何组件级未捕获异常，并提供一键重载：

```tsx
export class ErrorBoundary extends Component<Props, State> {
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#FAF8F5] p-6 text-center select-none">
          <AlertTriangle className="w-8 h-8 text-[#C62828] mb-4" />
          <h2 className="text-base font-bold text-[#1E1C1A]">Tcode 工作台遇到异常，已自动保护会话状态</h2>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#D96B27] text-white rounded-lg">
            重新加载工作台
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 2. 属性链防御与安全默认值
在所有遍历与字符串拼接位置推行**防御性空数组/空串保护**：
- `{(ch.models || []).length} 个模型`
- `value={(channelForm.models || []).join(', ')}`
- `(safeProjects.flatMap(p => (p.sessions || []).flatMap(s => s.tags || [])))`

### 3. 双模块独立锚定与向上/向下自适应 Popover
在 `ChatPanel.tsx` 中解耦顶部与底部弹窗：
- **顶部 Header 模型按钮**：内部挂载 `top-full mt-1.5` 向下浮动菜单；
- **底部输入栏模型胶囊**：内部挂载 `bottom-full mb-1.5` 向上浮动菜单，并添加 `slide-in-from-bottom-2` 动画；
- 底部弹窗内集成 `[ ⚙️ 管理 AI 模型网关与渠道... ]` 快捷入口，一键直通网关设置。

### 4. 网关模型与对话框双向强联动
- 在 `useGatewayStore` 中维护 `activeModelId` 和 `setActiveModel`，与 `localStorage` 实时同步；
- 当在“设置中心”切换渠道或模型时，Chat Header 和底栏胶囊立即无缝更新；
- 当在对话框弹窗中切换模型时，当前会话的 `model_id`、全局 `activeModelId` 以及网关设置立即同步生效。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **持久化键名带版本隔离**：
   在 `localStorage` 键名中加入版本号（如 `tcode_open_tabs_v2`），避免旧版本遗留的脏数据导致类型解析崩溃；
2. **TypeScript 接口命名冲突**：
   在同文件中避免局部 `interface` 与全局导出 `interface` 同名导致 `TS2395: Merged declaration` 编译报错；
3. **Outside-Click 监听器清理**：
   浮层绑定全局 `mousedown` 事件时，必须在组件卸载或浮层关闭时精准 `removeEventListener`，防止内存泄漏或多次触发。
