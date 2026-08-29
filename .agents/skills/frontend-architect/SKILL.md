---
name: frontend-architect
description: >-
  Senior Frontend Architect for modern desktop web technologies (React 19 + TypeScript + Tailwind).
  Enforces building-block component modularity, single source of truth state management,
  high-performance virtualized streams, zero prop drilling, decoupled event buses,
  and robust type safety.
---

# 前端架构师专业规约 (Frontend Architect Skill)

## 🏗️ 架构原则 (Building-Block Architecture)
1. **积木式单向依赖**：
   - 每个 UI 组件独立成块，无循环导入，无跨层级状态篡改；
   - 采用单一数据源（Single Source of Truth），标签页与会话树状态严格同步；
2. **总线驱动模式 (Event-Driven)**：
   - 前端通过 GatewayBus 与后台通信，UI 仅感知标准化流式接口（`BusStreamRequest`, `BusStreamCallbacks`）；
   - 推理 Chunk 渲染采用轻量局部刷新，杜绝全局重新渲染卡顿；
3. **零运行时错误 (Zero-Crash Discipline)**：
   - 100% 严格 TypeScript 类型守卫，禁止隐式 `any`；
   - 异常情况提供优雅降级（Graceful Fallback）并显式展示给用户。