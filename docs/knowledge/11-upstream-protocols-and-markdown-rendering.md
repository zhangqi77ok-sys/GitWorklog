# 11. OpenAI 双上游协议、Claude 独立协议适配、流式防中断与 Markdown 渲染引擎设计

## ① 知识点与问题背景 (Context & Problem Statement)

在智能体客户端研发与生产接入过程中，出现了以下核心问题与缺陷：
1. **上游模型协议兼容性缺失**：
   - 现存代码将所有大模型调用均硬编码为 OpenAI Chat Completions（`POST {base}/chat/completions`）；
   - 当连接 Anthropic Claude 官方端点（需 `POST /v1/messages` 且必须顶层指定 `system` 与 `max_tokens`）或新一代 OpenAI Responses API（`POST /v1/responses`）时，因请求结构、Header 认证方式（`x-api-key` vs `Authorization`）与 SSE 事件格式不同，直接导致请求 400/404 报错或无法解析流式事件。
2. **输出容易中断与文字/段落丢失**：
   - 流式接收 chunk 时对单个 delta 字符串调用了 `clean.trim()`，导致包含纯空格、缩进或换行 `\n` 的 chunk 被强制抹成空字符串并丢弃，破坏了段落换行与代码格式，偶发截断中断。
3. **内容渲染粗糙混乱 (Markdown 与表格失效)**：
   - 消息渲染直接采用 `<div className="whitespace-pre-wrap">`，导致 Markdown 表格呈现为原始管道符文本，标题、代码高亮、复制按钮与引用块完全无法呈现。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 主流上游大模型协议矩阵对比

| 协议类型 (ID) | 标准 API 端点 | 认证 Header | 请求体关键约束 | 流式 SSE 事件特征 |
| :--- | :--- | :--- | :--- | :--- |
| **`openai-chat`** | `/v1/chat/completions` | `Authorization: Bearer <key>` | `{ messages: [{role, content}], model, stream: true }` | `data: {"choices":[{"delta":{"content":...}}]}` |
| **`openai-responses`** | `/v1/responses` | `Authorization: Bearer <key>` | `{ input: "...", instructions: "...", model, stream: true }` | `event: response.text.delta`, `data: {"delta":...}` |
| **`anthropic-messages`** | `/v1/messages` | `x-api-key: <key>`, `anthropic-version: 2023-06-01` | **顶层 `system: string`**，`max_tokens: 8192` (必填)，`messages` 内**严禁**包含 `{role: "system"}` | `event: content_block_delta`, `delta: {"type":"text_delta","text":...}` / `thinking_delta` |

### 2. 流式中断与文字缺失的根本原因剖析

在传统的字符串清洗逻辑中，若在**接收单个流式 chunk** 时执行了 `text.trim()`：
- 场景 1：当模型输出 `"\n\n### 1. 架构分析"` 时，第一个 chunk 可能是 `"\n\n"`，经过 `trim()` 变成 `""`，由于 `if (chunk)` 为假，所有的换行符全部被静默丢弃；
- 场景 2：代码缩进 `    const a = 1;` 开头的 4 个空格被 `trim()` 剥除，导致代码格式彻底破坏；
- 场景 3：SSE 粘包时若遇到 `\r\n`，若没有按行正确切分并保留缓冲余量，会导致 JSON 解析异常从而中断流式循环。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 构建上游多协议适配引擎 (`src/services/upstreamAdapters.ts`)
- **自动协议推断 (`inferUpstreamProtocol`)**：根据端点 URL 与模型名称自动匹配 `openai-chat`、`openai-responses`、`anthropic-messages`；
- **请求构造器 (`buildUpstreamRequest`)**：
  - 针对 Claude Messages API，将 system prompt 自动提升至顶层 `system`，过滤并剥离 messages 数组中的 system 角色，注入 `max_tokens: 8192` 与 `anthropic-version: 2023-06-01`；
  - 针对 OpenAI Responses API，提取 `input` 与 `instructions`；
- **统一流式解析器 (`parseSseLine`)**：
  - 解析 Claude 的 `text_delta` 与 `thinking_delta`；
  - 解析 OpenAI 的 `delta.content` 与 `delta.reasoning_content`；
  - 识别 `[DONE]` 与 `message_stop`。

### 2. 改造流式接收循环 (`src/services/tauriBridge.ts`)
- 消除 chunk 阶段的 `trim()` 清洗，直接原样 `emit('agent_text_chunk', { chunk: parsed.textDelta })`，确保空格、换行、制表符 100% 保真传递；
- 仅在最终持久化与渲染层处理 DSML 工具标签。

### 3. 构建专用高性能 Markdown 渲染器 (`src/components/chat/MarkdownRenderer.tsx`)
- **GFM 表格支持**：将 `| 表头 |` 解析为响应式 HTML `<table>`，具备米灰暖色表头 (`#F4EFEA`) 与斑马纹；
- **暗黑暖色代码块**：背景色为 `#1E1C1A`，配备语言标识、代码字体与一键复制功能；
- **全排版要素**：支持多级标题 (`h1-h4`)、加粗 (`**`)、行内代码 (`` `code` ``)、引用块 (`>`) 与列表。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **Claude API System Prompt 绝不可混在 messages 数组中**：
   Anthropic 官方 API 严格校验消息体。如果在 `messages` 中传入 `{ role: "system" }` 会直接抛出 `400 Invalid request: system role is not allowed in messages`。必须将其放置在顶层 `system` 字段中。
2. **流式 Chunk 严禁调用 `trim()`**：
   任何流式 SSE 管道中，对于 chunk 级别的字符串必须保持“只拼接、不修剪（No Trim in Stream）”，清洗与格式化只能在整体流结束（Done）后或在 UI 渲染层执行。
3. **Markdown 渲染防 XSS 与标签穿透**：
   在渲染前先剔除 `<|DSML|...>` 等系统指令标签，防止未闭合的 XML 标签破坏 React DOM 树。
