---
name: ui-ux-pro-max
description: 顶级 UI/UX 体验设计专家与 Anti-Slop 视觉审查引擎。专注于现代高品质界面设计、色彩系统、间距网格、卡片层次与微交互动效。
---

# UI/UX Pro Max 体验设计与视觉审查规范

本技能专为打造现代化、非平庸（Anti-Generic/Anti-Slop）的顶级 Web/App 界面体验而设计，融合 Apple 人机交互指南（HIG）、Google Material You、Refactoring UI 与现代 Web 极致美学。

---

## 🎨 1. 色彩与视觉层次规范 (Color & Visual Hierarchy)

- **主色与强调色 (Primary & Accent)**：
  - 避免单调纯灰/黑白，使用带色相倾向的深色（如 Indigo/Slate 暗色系 `#0b0f19`、`#111827`）提升高级感。
  - 强调色（Accent）仅用于核心 CTA 按钮、选中状态与焦点，面积不超过画面的 10%。
- **背景层级堆叠 (Layering & Surfaces)**：
  - `Base`: 最底层主背景（如 `#090d16`）。
  - `Card`: 容器卡片背景（如 `#131b2e`，带 1px 细微半透明边框 `rgba(255, 255, 255, 0.08)`）。
  - `Elevated / Popover`: 浮动层（带柔和多层混合阴影 `0 10px 30px -10px rgba(0,0,0,0.5)` 与 Backdrop Blur 毛玻璃特效）。
- **文字对比度梯度**：
  - Primary Text: `#f8fafc` (90%~95% 不透明度)
  - Secondary Text: `#94a3b8` (60%~70% 不透明度)
  - Tertiary / Muted: `#64748b` (40%~50% 不透明度)
  - 严禁使用过浅或低于 WCAG AA 4.5:1 标准的文字色彩。

---

## 📐 2. 空间与间距网格系统 (Spacing & Layout Grid)

- **8pt 网格原则**：所有 padding、margin、gap 严格遵循 4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px 梯度。
- **防止视觉疲劳 (Anti-Slop Card Fatigue)**：
  - 避免界面全部由等大方块卡片铺满。通过视觉权重对比（大标题、Hero 区块、统计数字高亮、不对称网格）建立明确的视觉动线。
  - 列表与表格中善用分隔线、轻量背景斑马纹与悬浮响应（Hover Elevation）。

---

## 🔤 3. 现代字体排版系统 (Typography)

- **字体栈选择**：优先选用现代无衬线系统字体栈（Inter, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif）。
- **字号与行高黄金配比**：
  - Display/Hero: 32px~48px / Line-Height: 1.1~1.2 / Font-Weight: 700~800 / Tracking: -0.02em
  - Headings (H1/H2): 20px~24px / Line-Height: 1.3 / Font-Weight: 600 / Tracking: -0.01em
  - Body (正文): 14px~15px / Line-Height: 1.5~1.6 / Font-Weight: 400
  - Captions/Small: 11px~12px / Line-Height: 1.4 / Font-Weight: 500

---

## ✨ 4. 微交互与动效质感 (Micro-interactions & Polish)

- **按钮与控件状态**：
  - Hover: 轻微亮度提升（`filter: brightness(1.1)` 或背景微调）、轻微 Y 轴位移（`-1px`）。
  - Active: 轻微缩放反馈（`transform: scale(0.98)`）。
  - Focus: 醒目的双层焦点光圈（Focus Ring，如 `0 0 0 2px var(--bg), 0 0 0 4px var(--primary)`）。
- **过渡曲线**：避免线性 `linear`，采用 `cubic-bezier(0.16, 1, 0.3, 1)` 或 `ease-out`，过渡时间控制在 150ms~250ms 之间。

---

## 🛠 5. 常见反模式审查 (Anti-Patterns to Avoid)

1. ❌ **过度圆角失真**：卡片切忌无脑 30px 大圆角，推荐统一 8px~14px，圆角需与内部子元素呈同心圆比例递减。
2. ❌ **强刺眼饱和纯黑纯白**：避免 `#000000` 纯黑背景配 `#ffffff` 纯白大字，使用自然深色 Slate/Zinc。
3. ❌ **内容空态遗漏**：所有列表、卡片、图表必须设计优雅的 Loading Skeleton 骨架屏与 Empty State 空状态插图文案。
4. ❌ **信息层级混乱**：同一视窗内严禁出现 3 个以上同级别的主操作按钮（Primary Button）。