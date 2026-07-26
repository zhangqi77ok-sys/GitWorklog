# 架构设计

## 1. 设计目标

1. **去重**：两个源项目重叠的通用能力，融合后全局只保留一份实现。
2. **可插拔**：业务域（travel/data）是插件，新增业务域不改动平台底座。
3. **单一入口**：一套 FastAPI + SSE 服务，一个编排层统一路由。
4. **框架统一**：编排与 Agent 运行时统一用 LangGraph，不引入第二个编排框架。

## 2. 分层模型

```
┌─────────────────────────────────────────────────────────────┐
│ 接入层  app/api                                                │
│   FastAPI 路由：仅参数校验/鉴权/调用/封装响应，无业务逻辑        │
├─────────────────────────────────────────────────────────────┤
│ 编排层  app/orchestrator                                       │
│   Supervisor（意图路由+结果聚合） + intent（三层意图识别）       │
├─────────────────────────────────────────────────────────────┤
│ 领域层  app/domains                                            │
│   travel（差旅多 Agent） · data（Text2SQL）                    │
│   仅依赖 platform，域之间互不依赖                               │
├─────────────────────────────────────────────────────────────┤
│ 平台底座  app/platform                                         │
│   auth user skills files memory session mcp hooks sse llm      │
│   通用能力唯一实现，两域共享                                    │
├─────────────────────────────────────────────────────────────┤
│ 内核  app/core                                                 │
│   config response exceptions logging；零业务依赖               │
└─────────────────────────────────────────────────────────────┘
基础设施：MySQL · Redis · PgVector · MinIO · DashScope/DeepSeek · MCP
```

## 3. 依赖规则（强约束）

- 依赖方向**只能向下**：api → orchestrator → domains → platform → core。
- **禁止**：platform 依赖 domains；domain A 依赖 domain B；core 依赖任何上层。
- 领域层通过平台底座提供的接口使用通用能力，不得自建第二套（如自己再写一套认证）。
- 违反依赖规则的 import 由 CI 检查（后续加 import-linter）。

## 4. 一次对话的数据流

```
用户 → POST /api/chat (SSE)
  → 接入层校验 + 鉴权（platform/auth）
  → 编排层 pipeline：
       ① 查询改写（可选）
       ② 三层意图识别（L1 规则→L2 向量→L3 LLM）
       ③ 路由决策：单意图高置信 → 直跳目标 Agent；否则 → Supervisor
  → 目标 Agent 执行（travel 子 Agent 群 / data 分析 Agent）
       · 调用 platform 能力：记忆、文件、MCP、Skills
       · Hook 全程：进度推送、熔断、上下文压缩
  → SSE 事件流式回传（platform/sse 统一协议）
  → 会话/记忆持久化，支持中断续跑
```

## 5. 关键技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| Agent 框架 | **LangGraph** (create_react_agent) | 生产事实标准、状态机/checkpointer 可控性强、生态最大；模型走 LangChain ChatOpenAI 接 DashScope/DeepSeek 兼容端点 |
| 认证 | JWT + Redis 会话 | 替代 Sa-Token；保留踢人/单点/中断广播语义 |
| SQL AST | sqlglot | 替代 jsqlparser；多方言、AST 改写强 |
| 向量库 | PgVector（统一） | 去掉 gogo 的 InMemory 分叉 |
| 长期记忆 | PgVector 语义记忆为主 | 百炼作可选 provider，避免双份 |
| 被查询业务库 | 独立只读连接 | data 域查询隔离，不污染平台库 |

## 6. 模块边界速记

- **core**：任何模块可 import，它不 import 任何业务模块。
- **platform**：能力的“唯一实现处”。判断“这个功能该放哪”——如果两个域都可能用，放 platform。
- **domains**：只放某一个业务域特有的东西。差旅单只属于 travel，Text2SQL 只属于 data。
- **orchestrator**：只做“分发”，不做“执行”。任何具体业务动作都在 domains。
