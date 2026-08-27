# 编排框架：LangGraph（迁移记录）

日期：2026-07-26 · LangGraph 1.2.9 / langchain-core 1.5.1 / langchain-openai 1.4.1

## 决策

编排与 Agent 运行时用 **LangGraph**（`create_react_agent`），取代早期评估的 AgentScope。
理由：生产事实标准、状态机 + checkpointer 可控性最强、生态与资料最多；模型统一走
LangChain `ChatOpenAI` 接 DashScope / DeepSeek 的 OpenAI 兼容端点。

## 迁移影响（受控）

框架只锁在适配层，业务逻辑框架无关，故迁移仅改 **5 个 app 文件 + 对应测试**：

| 文件 | 迁移内容 |
|---|---|
| `platform/llm/models.py` | AgentScope ChatModel → LangChain `ChatOpenAI`（兼容端点） |
| `platform/llm/toolkit_builder.py` | AgentScope Toolkit → LangChain `StructuredTool.from_function` |
| `domains/data/agent.py` | Agent 装配 → `create_react_agent(model, tools, prompt)` |
| `domains/travel/agent.py` | 同上 |
| `orchestrator/runtime.py` | `reply_stream` → 图的 `astream_events(version="v2")` |
| `platform/sse/bridge.py` | AgentScope 事件 → LangGraph `astream_events` dict 事件映射 |

**未受影响（75 个文件）**：SQL 安全护栏 / 数据权限改写 / 脱敏 / Schema / glossary /
差旅业务与政策 / 认证 / 用户权限 / 意图识别 / 会话持久化 / Skills / SSE 协议 / config。
这正是「框架只锁适配层」架构决策的回报。

## LangGraph 能力对齐（dodo 依赖）

| dodo/gogo 依赖 | LangGraph 对应 |
|---|---|
| ReAct 循环 | `create_react_agent`（预置图） |
| 工具调用 | LangChain `StructuredTool`，模型 `bind_tools` |
| 流式事件 | 图 `astream_events(version="v2")`：on_chat_model_stream / on_tool_start / on_tool_end |
| 中断续跑 | `checkpointer` + `interrupt_before/after`（后续接线） |
| HITL | `interrupt()` + checkpointer（后续接线） |
| 状态管理 | StateGraph 显式 state（create_react_agent 内置 messages state） |
| 多 Agent 编排 | Supervisor 模式（我们的 orchestrator 层已实现路由，后续可换 langgraph-supervisor） |

## 集成验证（无 Key）

`build_data_tools` / `build_travel_tools` 产出真实 LangChain 工具（单测覆盖）。
`create_react_agent` 已实测接收我们的工具与 prompt（用 FakeListChatModel 验证到
`bind_tools` 环节——fake 模型不支持 bind_tools 属预期，真实模型即可）。

## 需 live 验证

真实模型对话、工具实际调用、多 Agent 协作、中断续跑 —— 需 DashScope/DeepSeek Key。
装配与降级已就位，填 Key 即从降级切真实。
