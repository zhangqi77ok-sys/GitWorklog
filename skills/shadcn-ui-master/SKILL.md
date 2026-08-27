---
name: shadcn-ui-master
description: Shadcn/UI 与 Radix Primitives 核心组件架构专家。精通原子化组件设计、cn/clsx/tailwind-merge 样式合并、无障碍模态框、抽屉、下拉菜单与暗黑主题系统。
---

# Shadcn/UI & Radix Primitives 组件设计规范

本技能专为构建高内聚、低耦合、强类型与全无障碍（a11y）的现代企业级前端组件库而设计。

---

## 🧱 1. 组件原子化与合成模式 (Composition & CVA)

- **Class Variance Authority (CVA)**：
  - 使用 `cva` 定义组件变体（Variants）与尺寸（Sizes），禁止内联长字符串拼接。
  ```typescript
  import { cva, type VariantProps } from "class-variance-authority";
  import { cn } from "@/lib/utils";

  export const buttonVariants = cva(
    "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
          destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
          outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
          ghost: "hover:bg-accent hover:text-accent-foreground",
          link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
          default: "h-9 px-4 py-2",
          sm: "h-8 rounded-md px-3 text-xs",
          lg: "h-10 rounded-md px-8",
          icon: "h-9 w-9",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
  );
  ```

- **cn 样式合并工具**：
  ```typescript
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```

---

## ♿ 2. Radix Primitives 无障碍交互规范

- **Dialog / Modal**：必须包含 `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`，支持 `ESC` 关闭与 Focus Trap 焦点锁定。
- **Dropdown / Popover**：支持键盘上下方向键导航、回车激活、自适应视口翻转（Collision Boundary & SideOffset）。
- **Tooltip**：必须设置 `delayDuration={200}` 防止移动鼠标时疯狂闪烁。

---

## 🌗 3. CSS 变量与暗黑主题系统

- 严格遵循 HSL 语义化 CSS 变量架构（`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`）。
- 切换暗黑模式只需在 `<html>` 标签添加/移除 `.dark` 类，禁止硬编码 hex 颜色。