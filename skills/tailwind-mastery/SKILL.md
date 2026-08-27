---
name: tailwind-mastery
description: Tailwind CSS 4.0 与现代化 CSS 架构大师。精通 Flexbox/Grid 复杂自适应布局、Container Queries、:has() 伪类、Fluid 响应式、动态变体与性能优化。
---

# Tailwind CSS 4.0 现代化样式架构指南

---

## 🚀 1. 现代 CSS 新特性与 Tailwind 进阶语法

- **Container Queries (容器查询)**：
  - 当组件在不同侧边栏或主内容区宽度变化时，使用 `@container` 与 `@sm:`、`@md:` 替代传统屏幕媒体查询，实现真正的自适应卡片。
- **`:has()` 父选择器**：
  - 利用 `has-[:checked]:border-primary` 或 `has-[[data-state=open]]:bg-accent` 声明式控制父级容器样式，彻底告别复杂的 JS 状态同步。
- **Fluid 流式排版与间距**：
  - 使用 `clamp()` 与 Tailwind Arbitrary Values（如 `text-[clamp(1.5rem,4vw,2.5rem)]`）实现跨设备平滑缩放。

---

## 📐 2. 经典响应式排版模式 (Layout Patterns)

- **自适应卡片网格 (Auto-fit Grid)**：
  ```html
  <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 sm:gap-6">
    <!-- 卡片内容 -->
  </div>
  ```
- **粘性吸顶与滚动容器 (Sticky Header & Scrollable Body)**：
  ```html
  <div class="flex flex-col h-full overflow-hidden">
    <header class="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b">Header</header>
    <main class="flex-1 overflow-y-auto p-4">Main Content</main>
  </div>
  ```

---

## 🎨 3. 代码整洁与可维护性法则

1. **逻辑顺序分组**：布局/定位 (`relative flex`) ➔ 盒模型/间距 (`p-4 m-2`) ➔ 视觉/边框 (`bg-card border rounded-lg`) ➔ 文字排版 (`text-sm font-semibold`) ➔ 交互状态 (`hover: scale: active:`).
2. **拒绝过度内联嵌套**：当同一组 class 超过 3 次重复时，使用 `@utility`、CVA 或提取为独立子组件。