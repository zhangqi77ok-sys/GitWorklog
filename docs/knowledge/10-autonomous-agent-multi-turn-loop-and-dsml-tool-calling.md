# 10 - OpenAI 规范 Tools 定义接入与 `> 调用 1 个工具` UI 折叠渲染

> **归档编号**：KNOW-10  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：OpenAI Tools 规范 / UI 提取渲染 / DSML 过滤器

---

## ① 知识点与问题背景 (Context & Problem Statement)

用户贴出两张对比截图并提出严重质疑：
1. **渲染问题**：原界面直接将模型返回的原始 XML 标签 `<|DSML|tool_calls> <|DSML|invoke name="Lookup">` 以代码框形式强行画在聊天泡泡里，不仅极其丑陋，而且导致文字截断与中途挂起；
2. **OpenAI 规范未对齐**：请求大模型 API 时没有按照 OpenAI Function Calling 标准传递 `tools` 字段定义，导致模型只能依靠文本输出 XML，而无法正确使用 API 级工具规范。

参照行业成熟 Agent 界面（如图 2），工具调用必须渲染为优雅折叠的 **`> ⚙️ 调用 1 个工具`** 卡片，且聊天泡泡中绝不允许出现原始 XML 标签。

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. 为什么不能直接将 XML 渲染在聊天泡泡中？
- 模型输出的 `<|DSML|...>` 属于底层 Agent 指令控制流，并非用户可见的对话自然语言；
- 如果直接作为 Markdown/Pre 渲染在主消息泡泡内，会导致逻辑混淆、文本重复与排版破坏。

### 2. OpenAI 标准 Tools 接口规范
在发往 OpenAI/AgentRouter/DeepSeek 的 Payload 中，必须显式携带 `tools` 结构定义：

```json
"tools": [
  {
    "type": "function",
    "function": {
      "name": "Lookup",
      "description": "列出项目工作区指定路径下的文件与子目录结构",
      "parameters": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "目标相对路径" }
        },
        "required": ["path"]
      }
    }
  }
]
```

### 3. UI 隔离渲染架构 (Message vs. ToolCallCard)
- **自然文本与控制标签解耦**：使用 `sanitizeTextContent` 过滤掉所有的 `<|DSML|...>` 与 `<tool_call>...</tool_call>` 字符串；
- **独立组件 Rendering**：将提取出的工具调用结构化存储在 `msg.toolCalls` 数组中，在对话视图中使用专属 `ToolCallCard` 组件渲染为 **`> ⚙️ 调用 1 个工具`**，支持点击展开/折叠查看输入参数与执行输出。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 前端渲染解耦与 `ToolCallCard` 组件 (`ToolCallCard.tsx`)

```tsx
export const ToolCallCard: React.FC<{ toolCalls: ToolCallItem[] }> = ({ toolCalls }) => {
  return (
    <div className="flex flex-col gap-1.5 my-1.5 max-w-[85%] w-full">
      {toolCalls.map((tool, idx) => (
        <div key={idx} className="border border-[#E6DFD5] bg-[#FAF8F5] rounded-xl overflow-hidden text-xs">
          <button className="flex items-center justify-between w-full px-3 py-2 bg-[#F4EFEA]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1E1C1A]">调用 1 个工具</span>
              <span className="text-[10px] text-[#8A847C] font-mono bg-white px-1.5 py-0.5 rounded border border-[#E6DFD5]">
                {tool.name}
              </span>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
};
```

### 2. 主消息泡泡的 XML 过滤与气泡渲染 (`ChatPanel.tsx`)

```tsx
{msg.toolCalls && msg.toolCalls.length > 0 && (
  <ToolCallCard toolCalls={msg.toolCalls} />
)}

{(() => {
  const cleanText = (msg.content || '')
    .replace(/<\|DSML\|tool_calls>[\s\S]*?<\/\|DSML\|tool_calls>/g, '')
    .replace(/<\|DSML\|invoke\s+name=["'][^"']+["']>[\s\S]*?<\/\|DSML\|invoke>/g, '')
    .trim();

  if (!cleanText && msg.role === 'assistant' && msg.toolCalls?.length) return null;

  return (
    <div className="max-w-[85%] rounded-2xl p-3.5 bg-white border border-[#E6DFD5]">
      <div className="whitespace-pre-wrap">{cleanText}</div>
    </div>
  );
})()}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止原始控制标签落盘与直接渲染**；
2. **多模态与多协议兼容**：无论模型通过 OpenAI 原生 `delta.tool_calls` 返回还是通过文本 `DSML` 返回，均在 Bridge 层统一清洗归一化为标准的 `toolCalls` 数组传给 UI。
