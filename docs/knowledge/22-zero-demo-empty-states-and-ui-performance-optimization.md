# 桌面端纯净零假数据 (Zero Demo & Clean Empty State) 治理与模板级渲染性能优化

> 归档分类：前端架构 / UI性能优化 / 铁律 0.5 实践 / 铁律 1.5 闭环  
> 对应版本：Tcode Studio v2.0.0+  
> 遵循规约：`AGENTS.md`【铁律 0.5: 严禁假数据与 Demo 占位铁律】与【铁律 0.8: UI/UX 规范】

---

## ① 知识点与问题背景 (Context & Problem Statement)

在现代客户端软件（桌面端 / Web 端）演进过程中，开发者在早期原型阶段常会预填部分“演示数据（Demo Data）”（如假对话气泡、假命令历史、写死的 Diff 变更、预填的 API Key）。然而当系统进入工程化交付时，这些遗留假数据会引发严重的问题：
1. **违背纯净真实原则**：新安装软件在用户尚未进行任何配置或操作时，界面却展示虚假的会话记录与假工具调用，严重混淆用户的真实工作区状态；
2. **违背 Fail-Closed 铁律**：未配置任何上游网络渠道时，系统静默 fallback 到假渠道或假模型，导致真实错误被掩盖；
3. **按钮响应迟钝与卡顿（UI Sluggishness）**：
   - 模板内联方法（如 `v-html="renderMarkdown(msg.content)"`）在没有缓存的情况下，每次点击界面上的任何按钮导致组件状态刷新时，都会触发全量消息的 Markdown 引擎与正则高频同步重编译，严重抢占 JavaScript 主线程几十至上百毫秒，造成用户感知上的“点击半天没反应”；
   - 弹窗唤起与标签切换绑定同步数据扫描（如打开知识图谱时同步等待全项目 AST 语法分析完成才弹出弹窗），缺少 Loading 骨架屏与即时乐观反馈。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 模板内联函数调用的 Render 瀑布效应 (Template Method Invocation Cascade)
在 Vue / React 等虚拟 DOM 框架中，模板中绑定的函数调用每次组件重新执行 Render / Patch 时都会被无条件调用：
```html
<!-- 危险的反模式：每次任何响应式变量变动，都会重新 parse 一遍全部历史消息 -->
<div v-html="renderMarkdown(msg.content)"></div>
```
当会话中存在长文本、代码块或数十条消息时，哪怕用户只是点击了一个普通的展开按钮、折叠终端或切换 Tag，Vue 都会同步触发数十次 `marked.parse` 解析与正则表达式遍历，导致严重的主线程掉帧卡顿。

### 2. LRU Map 编译缓存架构
通过引入基于内存的 LRU Map 编译缓存，将 Markdown 字符串与渲染后的 HTML 进行映射关联：
```ts
const markdownCache = new Map<string, string>()
export function renderMarkdown(content: string): string {
  if (!content) return ''
  const cached = markdownCache.get(content)
  if (cached !== undefined) return cached // O(1) 毫秒级命中
  const rendered = marked.parse(content) as string
  markdownCache.set(content, rendered)
  return rendered
}
```
命中缓存时耗时瞬间降至 0ms，彻底消除点击按钮时由 Markdown 重复解析带来的渲染雪崩。

### 3. 非阻塞乐观 UI 与即时物理反馈 (Optimistic & Non-Blocking UI)
- **弹窗瞬间唤起**：将 `isModalOpen.value = true` 作为首要同步指令，保证用户点击按钮的瞬间（0ms）弹窗已渲染上屏；
- **内部异步加载**：耗时的后端数据拉取（如 AST 扫描、文件树读取）放在后台并发进行，弹窗内部通过优雅的 Loading 骨架指示器告知用户正在计算；
- **微位移触感（Micro-Haptics）**：为所有操作按钮统一注入 CSS `:active { transform: scale(0.96); }`，保证手指或鼠标点击的瞬间具备明确的物理反馈，杜绝“用户以为没点中而反复重复点击”。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 彻底清空假数据与建立纯净空状态 (`App.vue` & `chatStore.ts`)

- **对话与会话空状态**：
  ```html
  <div v-if="!currentSession.messages || currentSession.messages.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-8 select-none my-auto">
    <div class="w-14 h-14 rounded-2xl bg-white border border-black/[0.08] shadow-xs flex items-center justify-center text-2xl mb-4">💬</div>
    <h3 class="text-sm font-bold text-[#18181B] mb-1.5">Tcode Agentic Studio</h3>
    <p class="text-xs text-[#71717A] max-w-sm mb-5 leading-relaxed">当前暂无活跃对话。请在下方输入框键入编程任务，或点击【＋新建会话】开始。</p>
    <button @click="createNewSession" class="px-3.5 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-semibold shadow-xs hover:bg-[#B8551B]">＋ 新建会话</button>
  </div>
  ```
- **Git 变更与 Diff 视窗**：
  - 移除 `gitStatus.working || ['main.go', 'app.go']` 假数据，改为真实 `gitStatus.working || []`；
  - `isDiffOpen` 默认设为 `false`，不强制抢占 45% 屏幕；无选定文件时展示纯净 Clean 状态。
- **设置面板与终端**：
  - 渠道、MCP、技能、规则无配置时统一展示优雅的空卡片引导；
  - `terminalOutputs` 与 `commandHistory` 初始设为空数组 `[]`。

### 2. 知识图谱非阻塞即时唤起与平滑加载

```ts
function openKnowledgeGraphModal() {
  isKnowledgeGraphOpen.value = true // 0ms 瞬间打开弹窗
  if (astNodes.value.length === 0 && !isGraphLoading.value) {
    scanASTGraph() // 后台异步扫描，不卡死主线程
  }
}

async function scanASTGraph() {
  isGraphLoading.value = true
  try {
    const nodes = await wailsBridge.getProjectASTGraph()
    astNodes.value = nodes || []
  } finally {
    isGraphLoading.value = false
  }
}
```

### 3. 全局按钮触感反馈注入

```css
button {
  transition: transform 0.08s ease, background-color 0.15s ease, opacity 0.15s ease;
}
button:active {
  transform: scale(0.96);
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **严禁在 Bridge / Mock 层注入静态演示数据**：
   在网络请求或跨进程 IPC 桥接层（如 `wailsBridge.ts`），严禁使用类似 `return mockData` 作为未连接时的 fallback。未连接或无数据时必须返回标准空集合（`[]`）或抛出结构化错误，让上层 UI 呈现真实的 Empty State，彻底杜绝“界面明明没连网关却显示一堆在线假模型”的虚假繁荣。
2. **防范生命周期中的同步阻塞**：
   在 `onMounted` 钩子中，切忌使用 `await Promise.all([...])` 串行等待所有非核心数据（如 Diff 对比、代码语法树、全量规则）加载完成。初次挂载仅需拉取当前会话和核心配置，次级数据按需触发或平滑后台拉取。
3. **Markdown 渲染防抖与预编译策略**：
   对于超高频变化的流式生成消息（Streaming Tokens），可使用微任务防抖（requestAnimationFrame）或仅编译当前正在增长的最后一条消息，历史消息严格命中缓存，保证 60fps 丝滑流畅。