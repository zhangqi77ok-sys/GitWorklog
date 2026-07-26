# 需 live 环境验证清单

本轮已交付「代码 + 接口 + mock 测试」，以下部分**必须**你的 live 基础设施 / 模型密钥才能端到端验证。已实现的是干净接口 + 适配点，接线时替换 mock 即可。

## 需 live 的组件

| 组件 | 已交付 | 需 live 验证 |
|---|---|---|
| 模型对话/流式 | `platform/llm/provider.py` 接口 | DashScope/DeepSeek 适配器 + 真实调用 |
| Embedding | `EmbeddingProvider` 接口；意图向量匹配用 mock 测过 | 真实 text-embedding-v4 + 检索质量 |
| 多模态图片 | `files/service.py` 接口 | qwen-vl 识别 |
| 文件 RAG | 切分器+编排已测；`MinioStorage`/`PgVectorIndex` 适配器已实现（mock 测试） | 连真实 MinIO + PgVector 实例验证上传/检索质量 |
| data 只读执行 | `MySQLReadOnlyRunner` 已实现（SQLite 测试） | 连真实 MySQL 业务库（独立只读连接） |
| 语义长期记忆 | `memory/base.py` 接口 + 内存实现（测试用） | PgVector 存储 + 真实相似度 |
| MCP 客户端 | `mcp/client.py` 配置+白名单（白名单已测） | 真实 stdio/streamable server 连接与工具调用 |
| executeSql 只读执行 | 编排链路已用 fake runner 测通 | 真实 MySQL 只读连接 + EXPLAIN 预检 |
| M-Schema 自省 | YAML provider 已测 | `MschemaProvider` 连库实时自省 |
| Agent 装配（travel/data） | 工具/安全/业务逻辑已实现并测试 | LangGraph create_react_agent + 真实模型工具调用 |
| Supervisor 编排 | 意图识别/路由决策已测 | 接真实领域 Agent + 子 Agent 调度 |
| 会话中断广播 | 单机注册表已测 | Redis Pub/Sub 跨节点 |

## 编排框架（已定：LangGraph）

编排与 Agent 运行时用 LangGraph（`create_react_agent`），见 FRAMEWORK_LANGGRAPH.md。
中断续跑 / HITL 用 checkpointer + interrupt 机制，属后续接线项（当前装配 + 降级已就位）。

## 接线 live 的步骤（供后续）

1. 配 `.env`（模型 Key、DB、Redis、PgVector、MinIO）
2. `docker compose up -d` 起基础设施
3. 实现各接口的 live 适配器（storage/index/mcp）
4. chat 的降级工厂改为按 domain 调 build_data_agent / build_travel_agent（需模型 Key）
5. 端到端冒烟：一条数据分析 + 一条差旅
6. 端到端冒烟：一条数据分析 + 一条差旅
