---
name: react-nextjs-architect
description: React 19、Next.js 15 App Router 与 Vite 前端全栈架构专家。精通 Server/Client 组件解耦、TanStack Query 数据缓存、Zustand 状态管理与高性能渲染。
---

# React 19 & Next.js 15 现代前端全栈架构规范

---

## ⚡ 1. React 19 与 Server/Client 组件解耦法则

- **Server Components By Default**：
  - 所有页面与数据获取组件默认保持为 Server Component（无需 `"use server"` 标记）。
  - 仅在需要 `useState`, `useEffect`, `onClick`, `onChange` 或浏览器专属 API 时，在叶子节点标记 `"use client"`。
- **React 19 新特性应用**：
  - 使用 `use()` hook 读取 Promise 与 Context，消除多层冗余的 `useEffect` 数据加载模版代码。
  - 使用 `useActionState` 与 `useOptimistic` 处理表单提交与即时乐观 UI 更新（Optimistic UI Updates）。

---

## 🗄️ 2. 状态管理与数据流最佳实践

- **服务端状态 (Server State)**：
  - 统一采用 **TanStack Query (React Query)** 管理异步请求、请求去重、分页加载与后台静默刷新（Stale-While-Revalidate）。
- **客户端全局状态 (Client State)**：
  - 复杂跨组件状态使用轻量响应式的 **Zustand**，避免 Redux 的繁琐样板代码或 Context 的无脑全量 re-render。
  ```typescript
  import { create } from 'zustand';

  interface AppState {
    theme: 'dark' | 'light';
    toggleTheme: () => void;
  }

  export const useAppStore = create<AppState>((set) => ({
    theme: 'dark',
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  }));
  ```

---

## 🔒 3. 性能与防御性编码守则

- **防止不必要的 Re-render**：
  - 引用类型 Props 使用 `useMemo` / `useCallback` 稳定引用；列表渲染使用稳定业务主键 `key={item.id}`，严禁使用 index 作为 key。
- **Suspense 与 Error Boundary**：
  - 每个独立数据展示区块外层包裹 `<Suspense fallback={<Skeleton />}>` 与 `<ErrorBoundary>`，确保局部错误不导致整页白屏崩溃。