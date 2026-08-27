---
name: vue3-vite-expert
description: Vue 3.5、Nuxt 3 与 Vite 现代响应式前端开发专家。精通 Composition API、<script setup>、Pinia 状态机、VueUse 组合式函数与高阶响应式性能优化。
---

# Vue 3.5 & Vite 现代响应式开发规范

---

## ⚡ 1. Composition API 与 `<script setup>` 最佳实践

- **强类型 Props 与 Emits**：
  ```vue
  <script setup lang="ts">
  interface Props {
    title: string;
    count?: number;
  }
  const props = withDefaults(defineProps<Props>(), {
    count: 0,
  });

  const emit = defineEmits<{
    (e: "update", value: number): void;
    (e: "close"): void;
  }>();
  </script>
  ```
- **Composables (组合式函数) 封装**：
  - 业务逻辑抽离为 `useFeature` 格式，支持响应式 Ref 传参（`toValue()` 解包），内部自动管理 `onMounted` 与 `onUnmounted` 事件监听销毁。

---

## 🏪 2. Pinia 状态架构与响应式解构防坑

- 严格使用 `defineStore("id", () => { ... })` Setup 语法风格。
- 解构 Store 属性时必须使用 `storeToRefs(store)`，防止响应式连接丢失（Reactivity Loss）。

---

## 🚀 3. Vite 极速构建与性能优化

- 启用路由懒加载与动态 `import()` 组件导入。
- 大列表渲染使用 `shallowRef` 避免对深层只读数据递归建立 Proxy 监听开销。