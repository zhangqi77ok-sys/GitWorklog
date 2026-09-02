---
name: ui-ux
description: >-
  Elite UI/UX Product Designer and Ergonomic Engineer for AI Developer Tools, IDEs, and Desktop Workbenches.
  Must be consulted first before any UI, layout, color, component, or interaction changes.
  Enforces warm minimalist design systems (#FAF8F5 cream base + #D96B27 terracotta accent),
  16:9 widescreen layout ergonomics, high information density with zero visual noise,
  pure tab management, collapsible drawers, accessible modals, and transparent diff interaction.
---

# UI/UX 体验与人机工程设计专业规约 (UI/UX Skill)

本技能为 Tcode 桌面端产品的**第一设计准则**。在进行任何界面布局、样式视觉、组件交互、弹窗或信息流修改前，必须优先查阅本规约。

---

## 🎨 1. 视觉系统与调色盘规范 (Warm Minimalist Design Tokens)

### 1.1 基础色盘 (Base Palette)
- **App Base (底色)**: `#FAF8F5` (柔和暖米白纸质基底，彻底消除纯白 `#FFFFFF` 刺眼强反光，保护长时间编码视力)
- **Surface / Sidebar (侧边与容器)**: `#F4EFEA` (工具栏与侧面板自然分层微暖底色)
- **Card Background (卡片背景)**: `#FFFFFF` 搭配 `#E6DFD5` 极细边框（`border border-[#E6DFD5]`）
- **Primary Accent (主品牌橙)**: `#D96B27` (低饱和陶土暖橙，用于聚焦、主按钮、激活高亮、主品牌标识)
- **Primary Hover (悬停橙)**: `#C45D1E`
- **Text Primary (主文本暖炭黑)**: `#1E1C1A`
- **Text Muted (副文本暖灰)**: `#8A847C`
- **Code / Terminal Base (代码底色)**: `#1E1C1A` 搭配 `#A3E635`（柔和荧光绿）与 `#F3F4F6`（代码字符）

### 1.2 边框与阴影规范 (Borders & Shadows)
- 严禁使用厚重拟物投影；
- 统一使用极轻量阴影：`shadow-xs` / `shadow-2xs` 或纯 1px 细线边框 `border-[#E6DFD5]`；
- 状态过渡使用 `transition-all duration-150 ease-out`。

---

## 📐 2. 16:9 人体工程学空间布局 (Ergonomic Layout)

### 2.1 整体比例分配
- **活动栏 (Activity Bar)**: 紧凑固定宽 `42px`，全图标导航，带鼠标悬停 Tooltip 说明；
- **侧边栏 (Left Panel)**: 默认宽 `260px`，支持双击折叠与拖拽宽度，提供会话管理与文件树切换；
- **核心双环工作区 (Dual-Loop Workbench)**:
  - **左侧智能对话/推理流 (Chat & Reasoning Stream)**: 弹性占比约 40% ~ 45%；
  - **右侧代码工作区 (Editor & Code Workspace)**: 弹性占比约 55% ~ 60%，顶部保持纯净标签页；
  - **底部辅助抽屉 (Bottom Drawer)**: 可折叠终端、日志、差异比对面板（高 220px，支持一键展开/收起）。

### 2.2 密度与留白控制
- 遵循高信息密度无冗余原则；
- 按钮和输入框标准高度控制在 `28px ~ 32px`；
- 对话流气泡内外边距保持在 `p-3` ~ `p-3.5`，行高 `leading-relaxed`。

---

## 🪟 3. 弹窗与交互设计规范 (Modals & Dialogs)

1. **绝对禁止浏览器原生弹窗**：严禁使用 `alert()`、`confirm()`、`prompt()`；
2. **居中与遮罩**：所有弹窗使用 `fixed inset-0 z-50`，背景 `bg-black/30 backdrop-blur-xs`，内容框严格水平垂直居中；
3. **闭环操作**：
   - 右上角必须带有清晰的关闭按钮 `[X]`；
   - 必须支持按键盘 `Escape` 键一键退出；
   - 必须支持点击外部遮罩区安全退出；
4. **原生文件选择**：凡涉及目录或工程路径选择，必须触发 Rust/Tauri 原生文件夹对话框，严禁让用户在网页文本框手动输入路径。

---

## 💬 4. 智能对话与流式渲染体验规范 (Chat & Stream UX)

1. **思考过程展示 (Thinking Block)**：
   - 默认折叠展示大模型思考过程，带有明显的 `🧠 深度思考推理过程` 胶囊；
   - 支持一键展开/折叠，展开后为柔和暗色背景，内容支持 Markdown 与换行；
2. **工具调用卡片 (ToolCallCard)**：
   - 工具调用不作为原始 XML 或代码块显示，而是折叠为 `> ⚙️ 调用 X 个工具 [ Lookup, read_file ]`；
   - 用户点击后展开查看入参和返回片段；
3. **时序与合并 (Sequence Integrity)**：
   - 一次问答的一系列多轮工具调用与最终报告，合并在同一个 Assistant 消息块中，紧密跟随在用户的提问气泡下方；
   - 严禁出现断层或提问跑到回答下方的错乱。

---

## ♿ 5. 可访问性与微交互 (A11y & Micro-Interactions)

1. **图标提示 (Tooltips)**：每个纯图标按钮必须通过 `title="..."` 或悬停气泡阐明其功能；
2. **色彩对比度**：正文文字与底色对比度必须满足 WCAG AAA（`#1E1C1A` 在 `#FAF8F5` 上对比度 > 14:1）；
3. **加载与进度反馈**：所有异步或流式任务必须具备微妙的脉冲呼吸灯或进度指示，严禁静默无响应。
