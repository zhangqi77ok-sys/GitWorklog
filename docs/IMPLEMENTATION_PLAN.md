# 实施计划（构建顺序）

本文件定义**按依赖排序的构建顺序**，以及每个组件的「可测策略」。目标：在无 live 基础设施/模型 Key 的情况下，尽可能实现**真实逻辑 + 单元测试通过**；确需 live 服务的部分，写成干净接口 + 适配器 + mock 测试，并标注「需 live 验证」。

## 测试基础设施策略

| 生产依赖 | 测试替身 | 说明 |
|---|---|---|
| MySQL | SQLite（内存） | SQLAlchemy 模型跨方言，测试用 SQLite |
| Redis | fakeredis / 内存 dict | 会话、缓存、熔断计数 |
| PgVector | 接口 + mock | 向量检索逻辑测独立单元 |
| MinIO | 接口 + mock | 上传/取回接口，测 mock |
| 模型 API | 接口 + mock | LLM/Embedding 调用抽象成 provider |
| MCP server | 接口 + mock | 客户端装配逻辑测 mock |

**纯逻辑组件（无需任何 infra，100% 可测）**：SQL 安全(sqlglot)、数据权限改写、脱敏、意图规则匹配、glossary、JWT、密码哈希、DataScope 解析、计算工具。这些优先做且必须有充分回归。

## 构建顺序

### 里程碑 A：数据与内核基建
- A1 SQLAlchemy 基类 + 引擎 + session（sync，端点侧 threadpool）
- A2 测试夹具（SQLite 内存 engine、fake redis）
- A3 config 增补 data 库/pgvector/minio/mcp 分组

### 里程碑 B：认证与用户（platform/auth, user）— 纯逻辑为主
- B1 密码哈希（bcrypt）
- B2 JWT 签发/校验
- B3 sys_user/role/dept/关联 ORM 模型
- B4 DataScope 枚举 + 解析器（按 user 算可见 dept，fail-closed）
- B5 auth service（登录）+ 依赖注入（current_user / require_role）
- B6 user service（CRUD/分配角色部门/部门树缓存）
- B7 API：/auth /sys/*

### 里程碑 C：数据分析域安全内核（domains/data）— dodo 皇冠、纯逻辑
- C1 SqlSafetyGuard（sqlglot：白名单+强制LIMIT+危险函数/多语句/JOIN 拦截）
- C2 DataScopeRewriter（AST 注 WHERE/ON，CTE/UNION/子查询递归）
- C3 SensitiveFilter（列名脱敏）
- C4 CalculateTool（表达式）
- C5 glossary（yaml 精确匹配）
- C6 M-Schema formatter + YAML provider

### 里程碑 D：编排意图（orchestrator/intent）— 纯逻辑
- D1 IntentResult 模型 + 类别
- D2 规则匹配器（L1）
- D3 向量匹配器接口（L2，embedding provider mock）
- D4 路由 pipeline（改写→意图→路由决策）

### 里程碑 E：平台能力接口层（需 live 验证的做接口+mock）
- E1 SSE session/emitter 注册 + 中断信号
- E2 记忆抽象（短期/语义接口）
- E3 文件问答接口（上传/解析/切分/检索接口）
- E4 MCP 客户端装配接口
- E5 LLM provider 抽象（DashScope/DeepSeek 适配器）
- E6 Hook 体系（进度/熔断/压缩，纯逻辑部分测）

### 里程碑 F：领域执行装配（需 LangGraph + 模型）
- F1 data 域 Agent 装配（工具链接线，标注需 live）
- F2 travel 域业务模型 + 工具 + 子 Agent（标注需 live）
- F3 Supervisor 编排接线

### 里程碑 G：接入与收尾
- G1 API 全量接线 + 鉴权中间件
- G2 端到端（mock 模型）冒烟
- G3 README/CATALOG 状态刷新

## 完成定义

- 纯逻辑组件：单测覆盖正常+边界+安全用例，`make check` 全绿。
- infra 组件：接口清晰、适配器实现、mock 测试通过、docstring 标注「需 live 验证」。
- 每完成一个功能点，刷新 FEATURE_CATALOG 状态。
- 全程 ruff + mypy + pytest 保持绿。

## 诚实边界

以下**必须**你的 live 环境 + 密钥才能端到端验证，本轮只交付「代码 + 接口 + mock 测试」：真实模型对话、真实向量检索质量、真实 MinIO/MCP/外部 API、多 Agent 实际协作效果（编排框架为 LangGraph，见 FRAMEWORK_LANGGRAPH.md）。
