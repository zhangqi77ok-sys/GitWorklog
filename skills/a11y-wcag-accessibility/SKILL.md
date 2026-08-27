---
name: a11y-wcag-accessibility
description: Web 无障碍体验（a11y）与 WCAG 2.2 标准审查专家。精通语义化 HTML5、ARIA 属性与角色、全键盘导航支持、Focus Trap 焦点捕获与屏幕阅读器兼容。
---

# Web 无障碍 (a11y) 与 WCAG 2.2 标准规范

---

## 🎯 1. 核心无障碍三大基石

1. **语义化 HTML 优先 (Semantic First)**：
   - 按钮必须是 `<button>`，禁止 `<div onclick>`。
   - 链接跳转必须是 `<a href>`，标题按 `<h1>`~`<h6>` 严格层级嵌套，禁止跨级跳跃。
2. **全键盘可操作性 (Full Keyboard Navigation)**：
   - 确保所有可交互元素均可通过 `Tab` 键聚焦，且具备清晰醒目的 `:focus-visible` 轮廓线（Focus Ring）。
   - 自定义弹出层（弹窗、菜单、抽屉）在打开时自动将焦点移入首个可操作项，按 `ESC` 键关闭并归还焦点。
3. **色彩与对比度合规 (WCAG 2.2 AA/AAA)**：
   - 常规正文文本与背景对比度必须 ≥ 4.5:1。
   - 大字号文本（≥18pt 或 ≥14pt 粗体）对比度必须 ≥ 3:1。
   - 严禁单独依赖颜色传达信息（如错误状态必须同时展示图标或错误提示文案）。

---

## 🏷️ 2. ARIA 属性与屏幕阅读器无障碍声明

- **Icon 按钮**：无文本的纯图标按钮必须显式添加 `aria-label="关闭窗口"` 或 `<span class="sr-only">关闭</span>`。
- **状态通知与动态内容**：使用 `aria-live="polite"` 让屏幕阅读器实时朗读异步操作结果（如 Toast 通知或长查询结果）。
- **折叠与下拉状态**：显式声明 `aria-expanded={isOpen}` 与 `aria-controls="panel-id"`。