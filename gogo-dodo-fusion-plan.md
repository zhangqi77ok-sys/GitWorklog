# GoGo × dodo-agentx 融合重构全局规划（Python 版）

> 目标：把 **gogo-agent（AgentScope 多 Agent 差旅系统）** 和 **dodo-agentx（Text2SQL 数据分析智能体）** 用 **Python** 重构，融合成一个统一的智能体平台。核心原则：**相同能力只做一份，各自独有能力作为业务插件保留**。
>
> 文档版本：v1 · 2026-07-26

---

## 一、结论先行（TL;DR）

1. **不重写两遍通用能力。** 两个项目在「用户/权限、Skills、文件问答、记忆、聊天/SSE、中断/会话、MCP」七个维度高度重叠，融合后这七块合并成**一套共享平台底座（core-platform）**。
2. **保留两个业务域作为插件。** gogo 的「多 Agent 差旅编排 + 意图识别 + 差旅业务」和 dodo 的「Text2SQL 数据分析全套」是各自独有价值，作为两个**领域能力包（domain packages）**挂在底座上。
3. **编排框架选 AgentScope（Python）。** gogo 本就是 AgentScope（Java），概念零迁移；dodo 依赖的 spring-ai-agentx-core 各项能力（ReAct/上下文压缩/记忆/中断/工具搜索/timeline/trace）在 AgentScope Python 都有对应物。用一个框架统一，不引入第二个编排框架。
4. **一个统一入口。** 一套 FastAPI + SSE 服务、一个 Supervisor（对应 gogo 的 MasterAgent）做意图路由，把请求分发到差旅子 Agent 群或数据分析 Agent。

---

## 二、现状盘点：两个项目在做什么

### 2.1 gogo-agent（差旅，AgentScope-Java）
- **多 Agent 编排**：MasterAgent + 8 个 SubAgent（行程管理/规划/审核/预订/报销/信息），SubAgent 以「工具」形式注册给 Master。
- **三层意图识别**：L1 规则(<50ms) → L2 向量(DashScope Embedding) → L3 LLM 兜底，单意图高置信可直跳子 Agent。
- **14 个 Hook**：进度推送、会话持久化、活跃 Agent 续跑、工具熔断、API Key 注入、CLI 结果压缩、动态时间注入等。
- **记忆**：AutoContextMemory（短期压缩）+ 百炼 BailianLongTermMemory（差旅偏好，AGENT_CONTROL 模式）。
- **业务域**：差旅单、审批、政策规则引擎、预订记录、冲突检测、报销。
- **Skills**：5 个（tuniu-cli / flight-manager / flyai / rolling-go-hotel / reimbursement）。
- **基础设施**：MySQL(`gogo_travel`) + Redis + Sa-Token + DashScope(Qwen) + 百炼；MCP 两个（天气 Streamable-HTTP、签证 stdio）；外部 API wttr.in + NewsData.io。**无 MinIO、无 Tavily、无 PgVector。**

### 2.2 dodo-agentx（数据分析，spring-ai-agentx）
- **Text2SQL 六工具链**：listTables → describeTables → lookupGlossary → 生成 SQL → validateSql → executeSql → calculate。
- **SQL 安全纵深**：SqlSafetyGuard（jsqlparser AST 白名单+强制 LIMIT+危险函数/JOIN 拦截）、ExplainPrecheckService（EXPLAIN 预检）、ReadOnlyQueryRunner（只读+重试）。
- **数据权限 SQL 改写**：DataScopeRewriter + PermissionRule，按表注入 WHERE/ON（4 级 DataScope：ALL/DEPT_AND_SUB/DEPT/SELF）。
- **脱敏**：SensitiveFilter 按列名整列掩码。
- **Schema 感知**：M-Schema 双 provider（实时自省 + YAML 字典）+ 业务术语 glossary。
- **图表**：mcp-echarts → MinIO URL。
- **基础设施**：MySQL(`dodo_agentx`) + PgVector + Redis + MinIO + Sa-Token；主模型 DeepSeek，多模态/Embedding 用 DashScope；MCP 两个（Tavily 搜索、mcp-echarts 出图）。
- **框架能力（agentx-core）**：ReactAgent、ContextPolicy/ContextCompactor、三层记忆、中断快照(JdbcPauseStateStore)、内置工具(Bash/Python/FileSystem/Grep/Skills/SubAgent/AskUser)、**工具搜索(延迟工具按需发现)**、stage/timeline/trace。

---

## 三、重叠矩阵（去重的依据）

| 能力 | gogo-agent | dodo-agentx | 融合决策 |
|---|---|---|---|
| **认证/登录** | Sa-Token(Redis)+ 明文密码 | Sa-Token(Redis)+ 角色 RBAC | ✅ **合一**：统一 auth 服务，用 JWT/session（Python 无 Sa-Token，见选型） |
| **用户/角色/部门** | user_account/user_profile | sys_user/sys_role/sys_dept + 多部门 | ✅ **合一**：以 dodo 的 sys_* 模型为主（更完整），gogo 的差旅偏好字段并入 profile |
| **数据范围/权限改写** | 仅功能鉴权 | 4 级 DataScope + SQL AST 改写 | ⭐ **dodo 独有**：作为数据分析域的权限能力保留 |
| **Skills** | AgentScope ClasspathSkillRepository + 凭证 Hook | DB+FS 双源 + zip 上传 + SkillsTool | ✅ **合一**：统一 Skills 管理（DB+FS），凭证注入 Hook 抽成通用机制 |
| **文件问答/RAG** | 3 个打包知识库(docx/xlsx)，无上传 | 上传→Tika→切分→PgVector→RAG+多模态 | ✅ **合一**：用 dodo 的完整方案（上传+PgVector+多模态），gogo 的打包知识库作为预置数据集 |
| **联网搜索** | wttr.in + NewsData.io | Tavily MCP | ✅ **合一**：统一「搜索工具」抽象，两套数据源都作为可插拔 provider |
| **聊天/SSE** | SseEmitter，11 种事件 | agentx SSE，AgentStreamEvent | ✅ **合一**：统一 SSE 事件协议（FastAPI StreamingResponse） |
| **记忆** | AutoContext + 百炼长期记忆 | AgentChatMemory + PgVector 语义记忆 | ✅ **合一**：统一记忆抽象；长期记忆后端二选一或都支持（见风险） |
| **中断/会话回放** | Redis 广播 + PendingTool(HITL) | JdbcPauseStateStore 快照 resume | ✅ **合一**：统一中断/续跑机制（AgentScope 提供） |
| **MCP 客户端** | 天气/签证 | Tavily/echarts | ✅ **合一**：统一 MCP 客户端装配 + 工具白名单 + 降级 |
| **工具熔断** | ToolCircuitBreakerHook(Redis) | — | ✅ 提升为平台通用 Hook |
| **多 Agent 编排/意图** | Master + SubAgent + 三层意图 | 单 Agent（工具搜索） | ⭐ **gogo 独有**：作为平台编排层复用 |
| **Text2SQL 全套** | — | 六工具链 + 安全 + Schema | ⭐ **dodo 独有**：作为数据分析域保留 |
| **图表出图** | — | mcp-echarts → MinIO | ⭐ dodo 独有，可提升为平台通用工具 |
| **差旅业务域** | 差旅单/审批/政策/预订/报销 | — | ⭐ gogo 独有：作为差旅域保留 |

**去重收益**：七块通用能力（auth/user、Skills、文件 RAG、SSE、记忆、中断、MCP）从「两份实现」收敛为「一份平台底座」。

---

## 四、技术选型（Python）

| 维度 | Java 原方案 | Python 选型 | 说明 |
|---|---|---|---|
| Agent 框架 | AgentScope-Java / spring-ai-agentx | **AgentScope（Python）** `agentscope-ai/agentscope` | 与 gogo 同源，dodo 能力可映射；一个框架统一编排 |
| Web/接口 | Spring Boot MVC/WebFlux | **FastAPI + SSE(StreamingResponse)** / 可选 WebSocket | 异步、SSE 原生、生态成熟 |
| 认证 | Sa-Token | **fastapi-users 或自建 JWT + Redis session** | Python 无 Sa-Token；用 JWT + Redis 存活跃会话，复刻「Token + 角色 + 数据范围」 |
| ORM | MyBatis-Plus | **SQLAlchemy 2.x + Alembic** | 迁移管理用 Alembic |
| 关系库 | MySQL | **MySQL**（保留） | 业务表、权限表、会话/记忆表 |
| 向量库 | PgVector(dodo) / InMemory(gogo) | **PgVector（统一）** | 统一到 PgVector，去掉 InMemory 分叉 |
| 对象存储 | MinIO(dodo) | **MinIO（保留）** | 文件、图表图片 |
| 缓存/广播 | Redis | **Redis**（保留） | session、Schema 缓存、中断广播(Pub/Sub)、熔断计数 |
| **SQL AST 解析** | **jsqlparser** | **sqlglot**（首选）或 sqlparse | ⭐ 关键替换：dodo 的 SQL 安全校验+权限改写全靠 AST，Python 用 sqlglot 重写（支持多方言、AST 改写强） |
| 文档解析 | Apache Tika | **unstructured / tika-python / pymupdf** | 文件问答解析 |
| 数学计算 | exp4j | **Python 原生 / numexpr / sympy** | CalculateTool 计算 |
| 主模型 | DeepSeek(dodo) / Qwen(gogo) | **可配置多模型**：DeepSeek + Qwen + GLM | 通过 AgentScope 模型抽象统一配置 |
| Embedding/多模态 | DashScope | **DashScope（保留）** | text-embedding-v4 + qwen-vl |
| 长期记忆 | 百炼(gogo) / PgVector 语义(dodo) | **统一语义记忆（PgVector）为主**，百炼作为可选 provider | 见风险章节 |
| 图表 | mcp-echarts | **mcp-echarts（保留，MCP）** | 框架无关，直接复用 |

> 选型原则：**能保留的基础设施都保留（MySQL/Redis/MinIO/PgVector/DashScope/MCP），只替换语言绑定层**。真正需要「找 Python 等价物」的只有两处：Sa-Token → JWT，jsqlparser → sqlglot。

---

## 五、目标架构

```
┌───────────────────────────────────────────────────────────────────┐
│  接入层  FastAPI 统一服务  ·  /chat (SSE)  ·  /auth  ·  /files       │
│          /skills  ·  /sys/*  ·  /session  ·  统一 SSE 事件协议        │
├───────────────────────────────────────────────────────────────────┤
│  编排层  Supervisor（= gogo MasterAgent）                            │
│          三层意图识别(规则/向量/LLM) → 路由                          │
│            ├─→ 差旅 SubAgent 群（多 Agent 协作）                     │
│            └─→ 数据分析 Agent（Text2SQL 工具搜索）                   │
├───────────────────────────────────────────────────────────────────┤
│  领域层（业务插件，各自独有）                                        │
│   ┌─────────────────────────┐   ┌──────────────────────────────┐   │
│   │ travel-domain (gogo)     │   │ data-domain (dodo)           │   │
│   │ · 行程管理/规划/审核     │   │ · Text2SQL 六工具链          │   │
│   │ · 预订/报销/政策引擎     │   │ · SQL 安全(sqlglot AST)      │   │
│   │ · 差旅 Skills(tuniu 等)  │   │ · 数据权限改写/脱敏          │   │
│   │ · 差旅业务表             │   │ · Schema 感知/glossary/图表  │   │
│   └─────────────────────────┘   └──────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│  平台底座 core-platform（唯一一份，两域共享）                        │
│   auth/user/role/dept  ·  Skills 管理  ·  文件问答(上传/RAG/多模态)  │
│   记忆(短期压缩+语义长期)  ·  会话/中断/续跑  ·  MCP 客户端          │
│   Hook 体系(进度/持久化/熔断/凭证注入/压缩)  ·  统一 SSE 事件        │
├───────────────────────────────────────────────────────────────────┤
│  基础设施  MySQL · Redis · PgVector · MinIO · DashScope · MCP        │
└───────────────────────────────────────────────────────────────────┘
```

**关键点**：
- 领域层两个包互不依赖，都只依赖 core-platform。新增业务域（如未来的 HR、客服）只需再挂一个领域包。
- Supervisor 只做「意图识别 + 路由 + 结果聚合」，不含任何业务逻辑。
- Text2SQL 用 AgentScope 的「工具搜索/延迟工具」机制，避免把六个数据工具塞满上下文（对应 dodo 的 deferredTools）。

---

## 六、建议目录结构（Python Monorepo）

```
unified-agent/
├── pyproject.toml                 # uv / poetry 管理
├── app/
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 统一配置（pydantic-settings）
│   │
│   ├── platform/                  # ⭐ 平台底座（唯一一份，两域共享）
│   │   ├── auth/                  # JWT + Redis session + 角色/数据范围
│   │   ├── user/                  # sys_user/role/dept + profile
│   │   ├── skills/                # DB+FS 双源、zip 上传、SkillsTool、凭证注入 Hook
│   │   ├── files/                 # 上传→解析→切分→PgVector→RAG、多模态
│   │   ├── memory/                # 短期压缩 + 语义长期记忆
│   │   ├── session/               # 会话管理、中断/续跑、SSE emitter 注册
│   │   ├── mcp/                   # MCP 客户端装配、白名单、降级
│   │   ├── hooks/                 # 进度/持久化/熔断/压缩/凭证 Hook（通用）
│   │   ├── sse/                   # 统一 SSE 事件协议 + 序列化
│   │   └── llm/                   # 多模型配置（DeepSeek/Qwen/GLM）+ Embedding
│   │
│   ├── orchestrator/              # ⭐ 编排层（gogo MasterAgent 平移）
│   │   ├── supervisor.py          # Supervisor Agent
│   │   ├── intent/                # 三层意图（规则/向量/LLM）+ intent-seed.yml
│   │   └── pipeline.py            # 改写→意图→路由→直跳/Master
│   │
│   ├── domains/
│   │   ├── travel/                # ⭐ gogo 差旅域
│   │   │   ├── agents/            # 行程管理/规划/审核/预订/报销/信息
│   │   │   ├── tools/             # 差旅单/预订/冲突/规划计算工具
│   │   │   ├── business/          # 差旅单/审批/政策引擎/预订记录
│   │   │   └── skills/            # tuniu-cli / flight-manager / rolling-go-hotel ...
│   │   └── data/                  # ⭐ dodo 数据分析域
│   │       ├── agent.py           # 数据分析 Agent（工具搜索）
│   │       ├── tools/             # listTables/describeTables/lookupGlossary/
│   │       │                      #   validateSql/executeSql/calculate
│   │       ├── sql/               # sqlglot AST：SqlSafetyGuard/DataScopeRewriter/脱敏
│   │       ├── schema/            # M-Schema provider(自省+yaml)/glossary/缓存
│   │       └── skills/            # data-analysis SKILL.md
│   │
│   └── api/                       # FastAPI 路由（chat/auth/files/skills/sys/session）
│
├── migrations/                    # Alembic
├── skills/                        # 文件系统 Skills（FS 权威源）
├── datasets/                      # gogo 预置知识库（政策/景点 docx/xlsx）
└── docker-compose.yml             # MySQL/Redis/PgVector/MinIO/mcp-echarts
```

---

## 七、数据模型融合

两个项目各有一套库（`gogo_travel` / `dodo_agentx`），融合为**一套统一库 + 领域表前缀隔离**：

| 分类 | 表 | 来源 | 融合处理 |
|---|---|---|---|
| 用户权限 | `sys_user` `sys_role` `sys_dept` `sys_user_role` `sys_user_dept` | dodo（更完整） | **主模型**，gogo 的 user_account 并入 |
| 用户档案 | `user_profile` | 两者 | 合并：dodo 字段 + gogo 差旅偏好（常驻城市/职级/证件/航班偏好） |
| 会话/消息 | `chat_conversation` `chat_message` / `agentx_session` | 两者各有 | 统一为一套会话表，消息支持 gogo 的富事件(progress/thinking/travelData/timeline) |
| 记忆 | `agentx_semantic_memory` | dodo | 保留（PgVector），gogo 百炼记忆迁入或作可选后端 |
| Skills | `agentx_skill` | dodo | 保留，DB+FS 双源 |
| 文件 | `agentx_file` `vector_file_info` | dodo | 保留 |
| 中断快照 | `agentx_pause_state` | dodo | 保留 |
| API Key | `user_api_key` | gogo | 保留（AES 加密，第三方凭证租户隔离） |
| **差旅业务** | `travel_order` `approval_record` `booking_record` `travel_policy_rule` | gogo | 保留（travel 域专属） |
| **数据分析样本** | 改造 sakila（`sys_user` 关联、`dept_id`） | dodo | 保留（data 域演示库，独立 schema 或独立库） |

> 建议：核心平台 + travel 域用一套主库；data 域的**被查询业务库**（sakila）保持独立连接，避免智能体查询污染平台库，也天然契合 dodo「只读查询专用连接」的安全设计。

---

## 八、分阶段实施路线

从「地基 → 单域打通 → 第二域 → 编排融合 → 前端」推进，每阶段可独立验证。

### 阶段 0 · 脚手架与基础设施（1 周）
- [ ] 建 monorepo、pyproject、config、docker-compose（MySQL/Redis/PgVector/MinIO/mcp-echarts）
- [ ] 跑通 AgentScope Python 最小 ReAct + DashScope/DeepSeek 模型接入
- [ ] FastAPI + SSE 骨架，一条「hello agent」流式链路
- **验收**：能通过 SSE 和一个最简单的 AgentScope Agent 对话

### 阶段 1 · 平台底座 core-platform（2~3 周）
- [ ] auth：JWT + Redis session，复刻角色 + 数据范围（DataScope 枚举）
- [ ] user/role/dept：SQLAlchemy 模型 + Alembic 迁移 + `/sys/*` 接口
- [ ] session/记忆/中断：接 AgentScope 的 memory + 中断快照，统一会话表
- [ ] files：上传→解析→切分→PgVector→RAG + 多模态图片识别
- [ ] skills：DB+FS 双源 + zip 上传 + SkillsTool + 凭证注入 Hook
- [ ] mcp：统一 MCP 客户端装配 + 白名单 + 降级
- [ ] hooks：进度推送 / 持久化 / 熔断 / 上下文压缩（通用）
- **验收**：一个「通用助手」Agent 能登录、传文件问答、用 Skills、被中断续跑

### 阶段 2 · 数据分析域 data-domain（2~3 周，dodo 独有价值优先）
- [ ] schema：M-Schema provider（DB 自省 + yaml）+ glossary + 缓存/定时刷新
- [ ] **sql（关键）**：用 **sqlglot** 重写 SqlSafetyGuard（白名单+强制 LIMIT+危险函数/JOIN 拦截）、DataScopeRewriter（AST 注 WHERE/ON）、SensitiveFilter
- [ ] tools：listTables/describeTables/lookupGlossary/validateSql/executeSql/calculate
- [ ] ReadOnlyQueryRunner（只读连接+重试）、ExplainPrecheckService（EXPLAIN 预检）
- [ ] data-analysis SKILL.md 编排流程 + 工具搜索（延迟工具）
- [ ] 图表：接 mcp-echarts → MinIO URL
- **验收**：自然语言查改造 sakila，产出带图表的分析报告，越权/危险 SQL 被拦

### 阶段 3 · 差旅域 travel-domain（3~4 周，gogo 业务最重）
- [ ] 差旅业务表 + 服务：差旅单/审批/政策引擎/预订记录/冲突检测
- [ ] SubAgent 群：行程管理/规划/审核/预订/报销/信息（AgentScope Agent）
- [ ] 差旅工具：差旅单读写/冲突/行程规划计算/HITL 交互
- [ ] 差旅 Skills：tuniu-cli / flight-manager / rolling-go-hotel（凭证注入 Hook 复用底座）
- [ ] RAG 知识库：政策/景点/指南（datasets 预置）
- **验收**：完成一次「申请→规划→审核→预订」多 Agent 协作流程

### 阶段 4 · 编排融合 orchestrator（1~2 周）
- [ ] Supervisor：把 travel SubAgent 群 + data Agent 都注册为可路由目标
- [ ] 三层意图识别（规则 + DashScope 向量 + LLM）+ intent-seed.yml
- [ ] pipeline：改写→意图→路由→单意图直跳/Master 兜底
- **验收**：一个入口同时处理「帮我订下周去上海的差旅」和「上月各部门差旅花费 Top5」

### 阶段 5 · 前端与收尾（1~2 周）
- [ ] 统一前端（复用 gogo 的 React，或新建）消费统一 SSE 事件协议
- [ ] 可观测：trace/timeline、日志脱敏
- [ ] 端到端联调、压测、文档
- **验收**：单一 Web 入口跑通两大场景 + 通用能力

> 总工期估算：约 **10~15 周**（单人；多人可并行阶段 2/3）。阶段 1 是关键路径，务必先稳。

---

## 九、风险与关键决策点

| # | 风险/决策 | 说明 | 建议 |
|---|---|---|---|
| R1 | **jsqlparser → sqlglot 的语义等价** | dodo 的 SQL 安全和权限改写是纯 AST 操作，sqlglot 的方言/AST 行为与 jsqlparser 不完全一致（如 JOIN 注入、CTE/UNION 遍历） | 阶段 2 优先做，配充分的 SQL 用例回归测试；这是整个融合技术风险最高点 |
| R2 | **长期记忆后端二选一** | gogo 用百炼(AGENT_CONTROL)，dodo 用 PgVector 语义记忆，机制不同 | 统一到 PgVector 语义记忆为主；百炼作为可选 provider（差旅偏好场景）。避免维护两套 |
| R3 | **AgentScope Python 能力覆盖度** | 需确认 Python 版是否齐备提供：工具搜索/延迟工具、中断快照 resume、timeline/trace、Hook。dodo 这些来自自研 agentx-core | 阶段 0 做一次「能力对齐 spike」，缺的能力评估自建成本 |
| R4 | **多模型协调** | gogo 用 Qwen，dodo 主推理用 DeepSeek（带 thinking） | 用 AgentScope 模型抽象，按 Agent/场景配置不同模型，配置化而非硬编码 |
| R5 | **Sa-Token → JWT 的会话语义** | Sa-Token 有踢人下线、单点登录、Redis 会话等特性 | 用 JWT + Redis 活跃会话表复刻，注意「跨节点中断广播」用 Redis Pub/Sub 保留 |
| R6 | **两域并存的上下文隔离** | Supervisor 路由后，两域的工具/记忆/文件不应互相串 | 会话上下文按域隔离，共享的只有 user/权限/文件仓 |
| R7 | **Skills 凭证注入机制平移** | gogo 的 Shell/MCP API_KEY 动态注入 Hook 较特殊（每用户独立凭证） | 抽成底座通用「凭证注入」机制，travel/data 域都能用 |

---

## 十、去重清单（一句话检查表）

融合后，以下每一项**全局只允许有一份实现**：

- ☑ 一套认证（JWT + Redis）——不是两套 Sa-Token
- ☑ 一套用户/角色/部门模型——不是 user_account + sys_user 两份
- ☑ 一套文件问答（上传→PgVector→RAG+多模态）——不是各搞各的知识库
- ☑ 一套 Skills 管理（DB+FS + 凭证注入）——不是两套加载器
- ☑ 一套记忆（短期压缩 + PgVector 语义）——不是百炼 + PgVector 双份
- ☑ 一套 SSE 事件协议——不是两套事件定义
- ☑ 一套 MCP 客户端装配——不是各接各的
- ☑ 一套中断/续跑机制
- ☑ 一套 Hook 体系（进度/熔断/压缩/凭证）

**允许各自独有（不去重）**：
- ⭐ travel 域：多 Agent 编排范式、差旅业务、差旅 Skills
- ⭐ data 域：Text2SQL 六工具链、SQL 安全、数据权限改写、脱敏、Schema 感知、图表

---

## 附：与原 Java 项目的对应速查

| 平台底座能力 | gogo-Java 出处 | dodo-Java 出处 | Python 落点 |
|---|---|---|---|
| 认证 | business/auth (Sa-Token) | AuthController/StpInterfaceImpl | platform/auth |
| 用户权限 | user_account/user_profile | sys_user/role/dept + DataScope | platform/user |
| Skills | ClasspathSkillRepository + 凭证 Hook | SkillManager + SkillsTool | platform/skills |
| 文件 RAG | RagKnowledgeConfig（打包） | FileManageService + EmbeddingService | platform/files |
| 记忆 | AutoContext + Bailian | AgentChatMemory + SemanticMemoryStore | platform/memory |
| 会话/中断 | AgentSessionManager + Redis 广播 | JdbcPauseStateStore | platform/session |
| MCP | 天气/签证 McpClientWrapper | Tavily/echarts AgentxMcpConfig | platform/mcp |
| Hook | 14 个 hook | ContextPolicy/ContextCompactor | platform/hooks |
| 编排/意图 | MasterAgent + intent 三层 | — | orchestrator |
| Text2SQL | — | tools/ + service/ + schema | domains/data |
| 差旅业务 | business/ + agent/ | — | domains/travel |

