# 10 - 自主 Agent 多轮工具闭环 (Multi-Turn Loop) 与 DSML 工具调用解析

> **归档编号**：KNOW-10  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：Agent 认知循环 / 工具调用解析 / 多轮自动闭环

---

## ① 知识点与问题背景 (Context & Problem Statement)

用户发送“帮我审查一下项目架构”等复杂编程指令时，大模型（如 `deepseek-v4-flash` / OpenCode）返回了如下 DSML 格式的工具调用代码段：

```xml
我来看一下项目的整体结构。

<|DSML|tool_calls>
<|DSML|invoke name="Lookup">
<|DSML|parameter name="path" string="true">.</|DSML|parameter>
</|DSML|invoke>
</|DSML|tool_calls>
```

**问题现象**：模型输出完上述 `<|DSML|...>` 工具标签后，**对话突然中断**，没有显示工具执行结果，也没有继续输出项目架构审查报告。

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. 对话中断的根本原因
- 像 DeepSeek、Qwen、OpenCode 等 AI 编程模型，在需要查看代码或搜索目录时，会优先发出工具调用指令（Tool Calls）；
- 原系统仅执行了“单轮流式接收”，将模型吐出的 XML 标签直接打在屏幕上，随后触发了流式结束事件（`agent_stream_done`）；
- **缺乏工具闭环循环**：没有解析 `<|DSML|invoke>` 指令，没有在本地执行 `Lookup`（目录扫描）或 `read_file`（读取文件），更没有把工具返回的结果作为下一轮上下文传回给大模型，导致模型无法拿到数据继续生成，对话被迫中断。

### 2. 自主 Agent 多轮自动闭环原理 (Multi-Turn Agent Loop)

真正的 Agentic IDE 必须具备**内外双环多轮自主协作逻辑**：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tcode 自主 Agent 多轮闭环架构                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. 接收 User Prompt ("帮我审查一下项目架构")                            │
│ 2. Turn 1: 调大模型获取思考 -> 模型输出 <|DSML|invoke name="Lookup">  │
│ 3. 拦截解析: parseToolCallsFromText() 提取工具名与参数                 │
│ 4. 本地工具执行: executeToolCall("Lookup", { path: "." })               │
│ 5. 上下文追加: 将 [Tool Output] 作为 user 消息追加至历史 Payload       │
│ 6. Turn 2: 自动发起下一轮 LLM 请求 -> 模型基于文件列表输出完整架构报告│
│ 7. 任务完成: 终止循环并保存完整会话                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. DSML 工具调用解析器 (`tauriBridge.ts`)

```typescript
export function parseToolCallsFromText(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  if (!text) return calls;

  const invokeRegex = /<\|DSML\|invoke\s+name=["']([^"']+)["']>([\s\S]*?)<\/\|DSML\|invoke>/g;
  let match: RegExpExecArray | null;

  while ((match = invokeRegex.exec(text)) !== null) {
    const toolName = match[1];
    const body = match[2];
    const args: Record<string, any> = {};

    const paramRegex = /<\|DSML\|parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\|DSML\|parameter>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = paramRegex.exec(body)) !== null) {
      args[pMatch[1]] = pMatch[2].trim();
    }
    calls.push({ name: toolName, args });
  }
  return calls;
}
```

### 2. 工具本地适配执行网桥 (`executeToolCall`)
映射 `Lookup`、`read_file`、`execute_command` 至真正的底层文件系统与终端 API：

```typescript
async function executeToolCall(toolName: string, args: Record<string, any>, workspacePath: string): Promise<string> {
  const normName = toolName.trim().toLowerCase();
  if (normName === 'lookup' || normName === 'read_workspace_tree') {
    const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(args.path || '.')}`);
    const data = await res.json();
    return `[目录结构 ${args.path}]:\n` + data.tree.map((t: any) => `${t.is_dir ? '📁' : '📄'} ${t.name}`).join('\n');
  }
  // 适配 read_file, execute_command ...
}
```

### 3. 流式分发中心的多轮自动循环 (`stream_chat_prompt`)

在 `stream_chat_prompt` 中引入 `while (turn < MAX_TURNS && shouldContinueLoop)`：
- 每轮接收完成后自动 `parseToolCallsFromText(turnContent)`；
- 若检测到工具调用，自动执行工具并将结果写回 `apiPayloadMessages`；
- 循环进入 Turn 2，直到模型不再要求调用工具，或者达到最大轮数限制。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **死循环防护机制**：
   设置 `MAX_TURNS = 5`，防止模型在特定场景下无限循环调用工具导致配额耗尽；
2. **工具卡片平滑流式渲染**：
   在工具执行时，向 UI 实时 emit 反馈节点（`> 🔧 【Agent 自动调用工具】` 与 `> 🛠️ 【工具返回输出】`），使用户能够实时直观掌控 Agent 的每一步操作过程。
