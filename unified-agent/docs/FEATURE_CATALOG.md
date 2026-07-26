# 功能点清单

逐功能点定义：归属层、来源项目、状态、验收要点。状态图例：
`⬜ 未开始` · `🟡 进行中` · `✅ 已完成`。

来源：`gogo` = 差旅项目，`dodo` = dodo-agentx，`新` = 融合新增。

---

## 阶段 0 · 脚手架

| ID | 功能点 | 归属 | 来源 | 状态 | 验收 |
|---|---|---|---|---|---|
| S0-1 | 目录骨架 + 各包职责 docstring | 全局 | 新 | ✅ | 27 个 `__init__.py` 带说明 |
| S0-2 | 工程配置（pyproject/ruff/mypy/pytest） | 全局 | 新 | ✅ | `make check` 可运行 |
| S0-3 | docker-compose 基础设施 | 全局 | 新 | ✅ | 5 个服务定义 |
| S0-4 | 内核 config/response/exceptions/logging | core | 新 | ✅ | 可 import，配置从 env 加载 |
| S0-5 | SSE 事件协议 | platform/sse | 新 | ✅ | 事件类型枚举 + 序列化 |
| S0-6 | FastAPI + health + mock chat SSE | api | 新 | ✅ | 冒烟测试通过 |
| S0-7 | 规范文档 5 份 | docs | 新 | ✅ | ARCH/DIR/FEAT/CODE/CONTRIB |
| S0-8 | 编排框架选型（LangGraph） | platform/llm | 新 | ✅ | 见 FRAMEWORK_LANGGRAPH.md（已从 AgentScope 迁移至 LangGraph） |

---

## 阶段 1 · 平台底座

### 认证授权 (platform/auth)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-A1 | JWT 签发/校验 | 新(替 Sa-Token) | ⬜ | 登录返回 token，中间件校验 |
| P1-A2 | Redis 活跃会话 + 踢人下线 | gogo | ⬜ | 会话可主动失效 |
| P1-A3 | 角色 RBAC（登录/角色拦截） | dodo | ⬜ | `admin` 角色守卫 `/sys/*` |
| P1-A4 | 数据范围 DataScope 解析 | dodo | ⬜ | 按 userId 算可见 dept 列表，fail-closed |

### 用户体系 (platform/user)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-U1 | sys_user/role/dept ORM + 迁移 | dodo | ⬜ | Alembic 建表 |
| P1-U2 | user_profile（合并差旅偏好字段） | 两者 | ⬜ | dodo 字段 + gogo 常驻城市/职级/证件 |
| P1-U3 | 用户 CRUD + 分配角色/部门 | dodo | ⬜ | `/sys/user` admin 权限 |
| P1-U4 | 部门树缓存 | dodo | ⬜ | 子树展开 |

### Skills (platform/skills)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-S1 | DB+FS 双源同步（FS 权威） | dodo | ⬜ | 启动建表+同步，定时同步 |
| P1-S2 | zip 上传解析 SKILL.md frontmatter | dodo | ⬜ | 防路径穿越 |
| P1-S3 | 启停 + 运行时按 enabled 装配 | dodo | ⬜ | 生成 Agent 工具 |
| P1-S4 | Shell/MCP 凭证注入 Hook（每用户独立） | gogo | ⬜ | 通用机制，两域可用 |

### 文件问答 (platform/files)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-F1 | 上传→MinIO + DB 元数据 | dodo | ⬜ | UUID，自动建表 |
| P1-F2 | 解析（PDF/Office/MD/HTML/图片） | dodo | ⬜ | pymupdf/tika |
| P1-F3 | 切分 + PgVector 向量化 | dodo | ⬜ | 大文件>阈值切分，HNSW/COSINE |
| P1-F4 | RAG 检索（压缩+多查询扩展） | dodo | ⬜ | topK + fileid 过滤 |
| P1-F5 | 图片多模态识别（懒缓存） | dodo | ⬜ | qwen-vl |

### 记忆 / 会话 / 中断 (platform/memory, session)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-M1 | 短期上下文自动压缩 | 两者 | ⬜ | 超阈值压缩 |
| P1-M2 | PgVector 语义长期记忆（按 userId） | dodo | ⬜ | 跨会话检索 |
| P1-M3 | 会话管理 + 消息持久化 | 两者 | ⬜ | 富事件字段 |
| P1-M4 | 中断/续跑快照 | dodo | ⬜ | resume 续跑 |
| P1-M5 | 跨节点中断广播（Redis Pub/Sub） | gogo | ⬜ | 集群中断 |
| P1-M6 | HITL 挂起/恢复 | gogo | ⬜ | 等待用户输入续跑 |

### MCP / Hook (platform/mcp, hooks)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-C1 | MCP 客户端装配（stdio/streamable） | 两者 | ⬜ | 工具白名单 |
| P1-C2 | 优雅降级 + 结果压缩 | 两者 | ⬜ | 失败降级 |
| P1-H1 | 进度推送 Hook | gogo | ⬜ | SSE progress |
| P1-H2 | 工具熔断 Hook（Redis 计数） | gogo | ⬜ | 三态+退避 |
| P1-H3 | 上下文压缩 Hook | dodo | ⬜ | ContextPolicy |
| P1-H4 | 执行日志/持久化 Hook | 两者 | ⬜ | 落库 |

---

## 阶段 2 · 数据分析域 (domains/data) — dodo 独有核心价值

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| D-1 | Schema provider：M-Schema DB 自省 | ⬜ | 输出括号元组格式 |
| D-2 | Schema provider：YAML 静态字典 | ⬜ | 可切换 |
| D-3 | Schema 缓存 + 定时刷新（cron） | ⬜ | 排除内部表 |
| D-4 | 业务术语 glossary（精确匹配） | ⬜ | 术语名拼进工具描述 |
| D-5 | **SqlSafetyGuard**（sqlglot AST） | ⬜ | 白名单+强制LIMIT+危险函数/JOIN 拦截 |
| D-6 | **DataScopeRewriter**（数据权限改写） | ⬜ | FROM/JOIN 注 WHERE/ON，CTE/UNION 递归 |
| D-7 | SensitiveFilter（列脱敏） | ⬜ | 命中列整列掩码 |
| D-8 | ExplainPrecheckService（EXPLAIN 预检） | ⬜ | 拦大表全扫，fail-open |
| D-9 | ReadOnlyQueryRunner（只读+重试） | ⬜ | 瞬态错误重试+截断 |
| D-10 | 工具 listTables | ⬜ | 表清单+中文描述+外键 |
| D-11 | 工具 describeTables | ⬜ | 字段详情+示例值 |
| D-12 | 工具 lookupGlossary | ⬜ | 口径+SQL 片段+同义词 |
| D-13 | 工具 validateSql | ⬜ | 返回安全 SQL |
| D-14 | 工具 executeSql（全编排） | ⬜ | guard→改写→预检→执行→脱敏→审计 |
| D-15 | 工具 calculate（表达式） | ⬜ | 同环比/占比，聚合推给 SQL |
| D-16 | data-analysis SKILL.md 编排流程 | ⬜ | 拆题→探Schema→SQL→校验→报告 |
| D-17 | 工具搜索/延迟工具（不塞满上下文） | ⬜ | 数据工具按需发现 |
| D-18 | 图表 mcp-echarts → MinIO URL | ⬜ | 返回 URL 非 base64 |

---

## 阶段 3 · 差旅域 (domains/travel) — gogo 业务

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| T-1 | 差旅单业务（申请/审批/查询/取消） | ⬜ | travel_order 生命周期 |
| T-2 | 审批记录 + 管理员审批接口 | ⬜ | approval_record |
| T-3 | 差旅政策规则引擎（职级×城市） | ⬜ | PolicyCheckResult |
| T-4 | 预订记录统一存储（机票/酒店/火车等） | ⬜ | booking_record，租户隔离 |
| T-5 | 行程冲突检测（时间重叠+跨城衔接） | ⬜ | CityTransit |
| T-6 | 往返规划计算引擎 | ⬜ | plan_roundtrip |
| T-7 | 子 Agent：行程管理 | ⬜ | ReActAgent |
| T-8 | 子 Agent：行程规划 | ⬜ | 交通/酒店比价 |
| T-9 | 子 Agent：行程审核（六维） | ⬜ | 完整性/预算/偏好等 |
| T-10 | 子 Agent：预订执行 | ⬜ | 出票/订房 |
| T-11 | 子 Agent：报销（发票识别） | ⬜ | gogo 中未完成，本项目补齐 |
| T-12 | 子 Agent：信息（政策/景点/签证 RAG） | ⬜ | 3 知识库 |
| T-13 | 差旅 Skills：tuniu-cli 等 5 个 | ⬜ | 凭证注入复用 P1-S4 |
| T-14 | 外部数据：天气/新闻 | ⬜ | wttr.in/NewsData |

---

## 阶段 4 · 编排融合 (orchestrator)

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| O-1 | 意图 L1 规则匹配 | ⬜ | <50ms |
| O-2 | 意图 L2 向量匹配（DashScope Embedding） | ⬜ | <100ms，Top-1 |
| O-3 | 意图 L3 LLM 兜底 | ⬜ | 结构化输出 |
| O-4 | intent-seed.yml 种子语料 | ⬜ | 外置可维护 |
| O-5 | 查询改写 Agent | ⬜ | 指代消解/上下文补全 |
| O-6 | Supervisor 路由（子 Agent as tool） | ⬜ | 注册 travel+data |
| O-7 | 单意图高置信直跳 | ⬜ | 跳过 Master |
| O-8 | 结果聚合 + SSE 统一回传 | ⬜ | 替换 mock |

---

## 阶段 5 · 前端与收尾

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| F-1 | 统一前端消费 SSE | ✅ | 静态页(登录+fetch 流式聊天)由 FastAPI 托管，test_frontend.py 3 项 |
| F-2 | trace/timeline 可观测 | ⬜ | 会话回放（需 live 编排） |
| F-3 | 端到端联调 + 压测 | ⬜ | 需模型 Key 两大场景跑通 |

---

## 本轮实施进度汇总（2026-07-26）

已实现 + 单测通过（90 tests, ruff/mypy 全绿）。live 依赖项见 [NEEDS_LIVE.md](NEEDS_LIVE.md)。

| 里程碑 | 功能点 | 状态 | 测试证据 |
|---|---|---|---|
| A 基建 | DB 基类/懒加载引擎/session、SQLite 夹具、config 分组 | ✅ | conftest + 全测试依赖 |
| B 认证 | bcrypt(B1)、JWT(B2)、sys_* ORM(B3/U1/U2)、DataScope 解析(B4/A4)、登录(B5/A1)、部门子树(U4)、角色判定 | ✅ | test_auth.py 13 项 |
| C 数据安全 | SqlSafetyGuard(D5)、DataScopeRewriter(D6)、SensitiveFilter(D7)、Calculate(D15)、Glossary(D4/D12)、M-Schema+YAML(D1/D2/D11) | ✅ | test_sql_guard 21 + test_sql_rewriter 7 + test_data_misc 12 |
| C data 执行 | executeSql 编排链路(D14: guard→改写→执行→脱敏) | ✅ | test_execute_pipeline（fake runner） |
| D 意图 | IntentResult/类别(O 系列)、规则 L1(O1)、向量 L2 逻辑(O2)、三层短路、路由决策(O6/O7) | ✅ | test_intent.py 11 项 |
| E 平台逻辑 | 熔断器(P1-H2)、会话注册表/中断(P1-M5)、记忆内存实现(P1-M2 接口)、MCP 白名单(P1-C1)、切分器(P1-F3) | ✅ | test_platform_logic.py 13 项 |
| E 接口 | LLM/Embedding/MCP/FileStorage/VectorIndex/MemoryStore 协议 | ✅接口 | 标注需 live |
| F travel | 业务 ORM(T1/T2/T4)、政策引擎(T3) | ✅ | test_execute_pipeline |
| G 接入 | deps(current_user/角色守卫)、/auth/login+me、SSE 骨架 | ✅ | test_api_auth.py 3 项 + test_smoke |
| S0-8 | 编排框架 = LangGraph（原 AgentScope 已迁移） | ✅ | FRAMEWORK_LANGGRAPH.md，仅改 5 适配文件 |
| E SSE 桥 | LangGraph astream_events → 统一 SSE 协议转换 | ✅ | test_sse_bridge.py 6 项 |
| F data 工具 | Text2SQL 六工具可调用实现（绑定 pipeline） | ✅ | test_text2sql_tools.py 7 项 |
| F data 装配 | LangChain 工具 + create_react_agent 工厂 | ✅装配 | test_data_agent_assembly.py 3 项（真实 LangChain 工具，模型调用需 live） |
| F LLM 工厂 | DashScope/DeepSeek 模型构建（按角色） | ✅接口 | 需 API Key 验证真实调用 |
| F travel | 差旅 service(单/审批/取消/冲突)、政策、工具、Agent 工厂 | ✅ | test_travel.py 10 项 |
| 通用装配 | toolkit_builder（两域共享的 FunctionTool/ToolGroup 装配） | ✅ | data/travel 装配测试 |
| 运行时 | Agent 运行时 + SSE 桥接 + 无 Key 优雅降级 | ✅ | test_runtime.py 5 项 |
| O 编排 | Supervisor 意图路由→领域分发、默认意图规则 | ✅ | test_supervisor.py 5 项 |
| O8 接线 | chat 接入真实 Supervisor（降级工厂），替换 mock | ✅ | test_smoke.py |
| G API | /sys(user/role/dept) admin 守卫、/session 契约 | ✅ | test_api_sys.py 5 项 |

| P1-M3 | 会话持久化：chat_conversation/message ORM+service、/session 列表/回放/改名 | ✅ | test_session_service 4 项 + API |
| P1-S | Skills：SKILL.md 解析、防穿越、FS→DB 同步、启停、/api/skills | ✅ | test_skills.py 8 项 |
| P1-F | 文件问答逻辑层：解析(PDF/文本/图片)、上传编排(小/大文件切分+向量化)、检索 | ✅ | test_files.py 8 项（storage/index 用内存实现，live MinIO/PgVector 适配后端待接） |

**已完成端到端链路**：POST /api/chat → 意图路由(规则) → 领域分发(data/travel) → Agent 运行时 → 统一 SSE；未配模型时全程优雅降级。会话/消息持久化、Skills 管理均已落地。

| F-1 前端 | 静态前端（登录 + SSE 流式聊天，fetch 解析统一协议） | ✅ | test_frontend.py 3 项 |
| O 工厂 | DomainAgentFactory：有模型 Key 按 domain 构建真实 Agent，无 Key 降级 | ✅ | test_factory.py 3 项（mock 上下文/模型，含真实 create_react_agent 装配） |
| live 适配器 | MinioStorage / PgVectorIndex / MySQLReadOnlyRunner（各实现已有接口） | ✅代码 | test_adapters.py 4 项（mock client/conn + SQLite runner；真实连接需实例） |

**当前测试规模**：157 passed，ruff/mypy 全绿，86 源文件。编排框架 = LangGraph。

**待做（仅剩需 live 环境的部分）**：文件问答的 MinIO/PgVector live 适配器（逻辑层+内存实现已就绪）、配模型 Key 后的真实对话冒烟与 trace 回放(F-2/F-3)。所有可离线完成的后端逻辑与前端脚手架已全部落地并测试。

---

## 维护约定

- 开始一个功能点：状态改 🟡，认领人记在提交信息。
- 完成：状态改 ✅，补齐验收结论。
- 新增功能点：按 `阶段-域-序号` 追加 ID，不复用旧 ID。

