---
name: web-performance-cwv
description: Core Web Vitals 与前端极致性能调优专家。专注于 LCP、INP、CLS 指标深度优化、代码分割、长列表虚拟滚动、资源预加载与内存泄漏排查。
---

# 前端极致性能优化与 Core Web Vitals (CWV) 规范

---

## ⚡ 1. Core Web Vitals 核心指标基准与优化手段

1. **LCP (Largest Contentful Paint - 最大内容绘制 < 2.5s)**：
   - 首屏 Hero 图片添加 `fetchpriority="high"` 与预加载 `<link rel="preload">`。
   - 关键 CSS 内联，非关键 CSS/JS 异步加载（`defer` / `async`）。
2. **INP (Interaction to Next Paint - 交互到下次绘制延迟 < 200ms)**：
   - 长任务拆分：使用 `scheduler.yield()` 或 `setTimeout(..., 0)` 将耗时 JS 计算打碎，避免阻塞主线程响应用户点击。
   - 防抖与节流：对窗口 Resize、实时搜索 Input 严格实施 Debounce/Throttle。
3. **CLS (Cumulative Layout Shift - 累积布局偏移 < 0.1)**：
   - 所有 `<img>` 和 `<video>` 标签必须显式指定 `width` 和 `height` 或 `aspect-ratio` 预留占位空间。
   - 动态插入内容时预先渲染 Skeleton 骨架屏，禁止突兀下推已有内容。

---

## 🏎️ 2. 大数据量长列表虚拟滚动 (Virtual Scrolling)

- 当表格/列表项超过 100 条时，必须采用虚拟滚动（仅渲染视口可视区域的 DOM 节点，如 TanStack Virtual）。
- 图片列表必须开启原生懒加载 `loading="lazy"` 与 IntersectionObserver 监听。

---

## 🧹 3. 内存泄漏与事件清理防范

- 组件卸载时（`useEffect` cleanup / `onUnmounted`）必须主动清除定时器（`clearInterval`）、取消 WebSocket / EventSource 订阅、移除 window 全局事件监听。