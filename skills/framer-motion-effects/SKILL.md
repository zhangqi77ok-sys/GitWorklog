---
name: framer-motion-effects
description: 现代前端交互动效与动画物理专家。精通 Framer Motion、CSS View Transitions API、Spring 弹性物理、手势拖拽、页面平滑过渡与 60fps 硬件加速。
---

# 现代前端交互动效与 Framer Motion 指南

---

## 🌊 1. 动效设计哲学与核心原则

- **功能性动效（Functional Motion）**：动效必须具备指导用户视觉动线、解释状态转变的目的，严禁无意义的过度晃动。
- **Spring 弹性物理与阻尼**：
  - 避免机械生硬的线性运动，采用自然弹簧物理参数：`type: "spring", stiffness: 400, damping: 30`。
- **退出与进入对称（AnimatePresence）**：
  - 列表项增删、模态框启闭必须使用 `<AnimatePresence mode="wait">` 实现平滑 Exit 动画，杜绝突兀闪烁。

---

## 🚀 2. 核心动画代码范例

- **列表项交错渐入 (Stagger Children)**：
  ```tsx
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  };
  ```

- **原生 View Transitions API (跨页面/视图平滑共享元素过渡)**：
  ```javascript
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      switchTab(newTabId);
    });
  } else {
    switchTab(newTabId);
  }
  ```

---

## ⚡ 3. 性能保障与 Prefers-Reduced-Motion

- 仅对 `transform` 和 `opacity` 进行动画，触发 GPU 独立图层加速（Compositor-only properties），严禁对 `width`, `height`, `top`, `margin` 进行补间动画。
- 强制支持媒体查询 `@media (prefers-reduced-motion: reduce)`，为敏感用户降级为即时切换。