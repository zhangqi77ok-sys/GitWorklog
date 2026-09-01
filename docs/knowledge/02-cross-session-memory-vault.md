# 02 - AI Agent 跨会话长期工程记忆层与提示词动态注入机制

## ① 知识点与问题背景 (Context & Problem Statement)

在传统的对话式 AI 编程助手中，每次新建会话（New Session）或重启应用后，Agent 会“遗忘”之前所有的工程约定：
- 例如用户曾强调过：“本项目严格使用 TypeScript，杜绝使用 any”、“所有状态修改必须通过统一 Store 单例，禁止在组件内 new 实例”；
- 用户在后续新建会话中不得不反复声明同一条规则，体验割裂。
- **目标**：在不需要庞大向量数据库的前提下，打造轻量级、跨会话可继承、用户可管理、并在每次 System Prompt 首部置顶注入的长期工程记忆层（Memory Vault）。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 用户意图与规约语句的主动捕获机制
并非会话中的所有文字都是“规则”。记忆层通过高置信度正则与自然语言纠偏特征锚定提取：
- **触发关键词群**：`/(?:以后|不要|严禁|必须|习惯|请用|统一使用|总是|规范|约定|prefer|always|never|rule)[\s:：]+([^\n。；!！]+)/gi`
- **分类策略**：
  - `code_style`：涉及样式、命名（camelCase、snake_case）、格式、标点；
  - `architecture_rule`：涉及单例、Store、Factory、模块引用、契约定义；
  - `project_convention`：涉及测试命令、Git 分支命名、构建步骤等。

### 2. 双重持久化存储 (Two-Tier Persistence)
- **前端 LocalStorage**：毫秒级加载，UI 实时响应；
- **磁盘文件存储**：通过宿主接口同步沉淀至工程目录或用户配置目录下的 `memories.json`，确保重启后不丢失。

### 3. Token 敏感度与 System Prompt 顶部置顶注入
- 长期记忆不能无限膨胀，否则会挤占上下文窗口导致模型推理速度下降。
- **紧凑压缩算法**：仅提取 Top N（默认前 6 条）按置信度排序的高频记忆，格式化为极简清单置顶于 System Prompt：
  ```markdown
  【🧠 跨会话长期工程记忆 (Project & User Conventions)】
  1. [类型与空安全第一原则]: 本项目严格使用 TypeScript 强类型，杜绝 any。
  2. [测试与质量自愈规范]: 运行单元测试统一使用 Vitest (npm test)。
  ```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 核心记忆存储模块实现
代码落地位置：`prototype/src/services/memoryStore.ts`（或 `src/store/useMemoryStore.ts`）。
提供 `saveMemory`、`loadSavedMemories`、`extractMemoriesFromConversation`、`buildMemoryPromptSnippet` 标准 API。

### 2. 在 Agent 执行循环中的接入方式
在每次组装 LLM 请求消息列表时：
```typescript
import { buildMemoryPromptSnippet } from '../services/memoryStore';

export function assembleSystemPrompt(basePrompt: string): string {
  const memorySnippet = buildMemoryPromptSnippet(6);
  if (!memorySnippet) return basePrompt;
  return `${memorySnippet}\n\n${basePrompt}`;
}
```

### 3. 可视化管理面板
在设置或规则面板（`RulesMemoryPanel.tsx`）中提供可视化列表，支持：
- 查看置信度、来源会话、分类徽章；
- 支持用户手动添加规则，支持一键单条删除或批量清空。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **避免死循环过度记忆**：
   提取记忆时必须过滤掉 Agent 自身的回复，仅提取 `role === 'user'` 的指令，防止模型说“我记住了”反被误当成新规则。
2. **字符长度限制**：
   单条记忆有效长度严格限制在 6 ~ 120 字符之间，过滤掉过于简短（如“好的”）或过于冗长的长篇大论。
