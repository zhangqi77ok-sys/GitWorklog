# 功能点清单

逐功能点定义：归属层、来源项目、状态、验收要点。状态图例：
`⬜ 未开始` · `🟡 部分完成` · `✅ 已完成`。

`🟡` 用于「离线逻辑已实现并测过，但仍缺关键环节或需 live 环境验证」，
验收列写明缺什么。这样清单不会把「接口已就绪」误报成「功能已可用」。

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
| P1-A1 | JWT 签发/校验 | 新(替 Sa-Token) | ✅ | 登录返回 token，依赖校验；test_auth.py |
| P1-A2 | Redis 活跃会话 + 踢人下线 | gogo | ⬜ | 会话可主动失效 |
| P1-A3 | 角色 RBAC（登录/角色拦截） | dodo | ✅ | `require_role('admin')` 守卫 `/sys/*`；test_api_sys.py |
| P1-A4 | 数据范围 DataScope 解析 | dodo | ✅ | 按 userId 算可见 dept，fail-closed |

### 用户体系 (platform/user)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-U1 | sys_user/role/dept ORM + 迁移 | dodo | 🟡 | ORM + scripts/init_db.py 建表；Alembic 迁移脚本未写 |
| P1-U2 | user_profile（合并差旅偏好字段） | 两者 | ✅ | dodo 字段 + gogo 常驻城市/职级/证件 |
| P1-U3 | 用户 CRUD + 分配角色/部门 | dodo | ✅ | `/sys/user` admin 权限 |
| P1-U4 | 部门树缓存 | dodo | ✅ | 子树展开 |

### Skills (platform/skills)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-S1 | DB+FS 双源同步（FS 权威） | dodo | ✅ | 启动建表+同步；test_skills.py |
| P1-S2 | zip 上传解析 SKILL.md frontmatter | dodo | ✅ | 防路径穿越已测 |
| P1-S3 | 启停 + 运行时按 enabled 装配 | dodo | ✅ | `/api/skills` 启停 |
| P1-S4 | Shell/MCP 凭证注入 Hook（每用户独立） | gogo | ✅ | `hooks/credentials.py`：按用户取凭证 + 缺失键显式报出 |

### 文件问答 (platform/files)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-F1 | 上传→MinIO + DB 元数据 | dodo | 🟡 | 编排 + MinioStorage 适配器已实现；需连真实 MinIO 验证 |
| P1-F2 | 解析（PDF/Office/MD/HTML/图片） | dodo | ✅ | pymupdf/文本/图片标记；test_files.py |
| P1-F3 | 切分 + PgVector 向量化 | dodo | 🟡 | 切分器已测、PgVectorIndex 已实现；需真实实例验证检索质量 |
| P1-F4 | RAG 检索（压缩+多查询扩展） | dodo | 🟡 | topK + fileid 过滤已实现；需 live embedding |
| P1-F5 | 图片多模态识别（懒缓存） | dodo | ⬜ | 需 qwen-vl（见 NEEDS_LIVE.md） |

### 记忆 / 会话 / 中断 (platform/memory, session)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-M1 | 短期上下文自动压缩 | 两者 | ✅ | `hooks/context_compact.py`：超阈值保 system+近 N 条，中段摘要 |
| P1-M2 | PgVector 语义长期记忆（按 userId） | dodo | 🟡 | MemoryStore 协议 + 内存实现；PgVector 后端未写 |
| P1-M3 | 会话管理 + 消息持久化 | 两者 | ✅ | ORM+service+`/session`；chat 已真实落库（test_api_chat_persist.py） |
| P1-M4 | 中断/续跑快照 | dodo | ⬜ | 需 LangGraph checkpointer 接线 |
| P1-M5 | 跨节点中断广播（Redis Pub/Sub） | gogo | 🟡 | 单机 SessionRegistry 已测；Redis Pub/Sub 与中断 API 均未做 |
| P1-M6 | HITL 挂起/恢复 | gogo | ⬜ | 事件类型已定义，挂起/恢复逻辑未做 |

### MCP / Hook (platform/mcp, hooks)

| ID | 功能点 | 来源 | 状态 | 验收 |
|---|---|---|---|---|
| P1-C1 | MCP 客户端装配（stdio/streamable） | 两者 | 🟡 | 配置 + 工具白名单已测；真实 server 连接需 live |
| P1-C2 | 优雅降级 + 结果压缩 | 两者 | 🟡 | 降级路径已通；结果压缩未做 |
| P1-H1 | 进度推送 Hook | gogo | ✅ | `hooks/progress.py`：start/finish 阶段事件 + 工具步数、耗时 |
| P1-H2 | 工具熔断 Hook | gogo | ✅ | 三态熔断已接进 `toolkit_builder`，两域工具全覆盖、按工具隔离 |
| P1-H3 | 上下文压缩 Hook | dodo | ✅ | ContextPolicy + Summarizer 协议（无模型走截断兜底） |
| P1-H4 | 执行日志/持久化 Hook | 两者 | ✅ | 累加流式增量落库，富事件进 `extra`；降级态同样生效 |

---

## 阶段 2 · 数据分析域 (domains/data) — dodo 独有核心价值

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| D-1 | Schema provider：M-Schema DB 自省 | ⬜ | MschemaProvider 仅接口占位，需 live DB |
| D-2 | Schema provider：YAML 静态字典 | ✅ | 可切换，已测 |
| D-3 | Schema 缓存 + 定时刷新（cron） | ⬜ | 排除内部表 |
| D-4 | 业务术语 glossary（精确匹配） | ✅ | 术语名拼进工具描述 |
| D-5 | **SqlSafetyGuard**（sqlglot AST） | ✅ | 白名单+强制LIMIT+危险函数/JOIN 拦截；21 用例 |
| D-6 | **DataScopeRewriter**（数据权限改写） | ✅ | FROM/JOIN 注 WHERE/ON，CTE/UNION 递归；7 用例 |
| D-7 | SensitiveFilter（列脱敏） | ✅ | 命中列整列掩码 |
| D-8 | ExplainPrecheckService（EXPLAIN 预检） | ✅ | 拦全表扫描/巨量扫描/未命中索引；EXPLAIN 自身故障 fail-open |
| D-9 | ReadOnlyQueryRunner（只读+重试） | 🟡 | MySQLReadOnlyRunner 已实现（SQLite 测）；需真实只读库 |
| D-10 | 工具 listTables | ✅ | 表清单+中文描述+外键 |
| D-11 | 工具 describeTables | ✅ | 字段详情+示例值 |
| D-12 | 工具 lookupGlossary | ✅ | 口径+SQL 片段+同义词 |
| D-13 | 工具 validateSql | ✅ | 返回安全 SQL |
| D-14 | 工具 executeSql（全编排） | ✅ | guard→改写→预检→执行→脱敏→审计 全链路；被拦尝试同样留痕 |
| D-15 | 工具 calculate（表达式） | ✅ | 同环比/占比，聚合推给 SQL |
| D-16 | data-analysis SKILL.md 编排流程 | ✅ | 拆题→探Schema→SQL→校验→报告 |
| D-17 | 工具搜索/延迟工具（不塞满上下文） | ⬜ | 数据工具按需发现 |
| D-18 | 图表 mcp-echarts → MinIO URL | ⬜ | 返回 URL 非 base64 |

---

## 阶段 3 · 差旅域 (domains/travel) — gogo 业务

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| T-1 | 差旅单业务（申请/审批/查询/取消） | 🟡 | service 全通（test_travel.py）；**无 HTTP 路由，仅 Agent 工具可达** |
| T-2 | 审批记录 + 管理员审批接口 | 🟡 | approval_record + approve_order 已测；管理员审批接口未写 |
| T-3 | 差旅政策规则引擎（职级×城市） | ✅ | PolicyCheckResult + `load_policy_engine` 从 DB 装规则，无规则时 fail-closed |
| T-4 | 预订记录统一存储（机票/酒店/火车等） | 🟡 | booking_record ORM 已建；无 service/工具 |
| T-5 | 行程冲突检测（时间重叠+跨城衔接） | 🟡 | 时间重叠已测；**CityTransit 跨城衔接未做** |
| T-6 | 往返规划计算引擎 | ⬜ | plan_roundtrip |
| T-7 | 子 Agent：行程管理 | ⬜ | `domains/travel/agents/` 为空包 |
| T-8 | 子 Agent：行程规划 | ⬜ | 交通/酒店比价 |
| T-9 | 子 Agent：行程审核（六维） | ⬜ | 完整性/预算/偏好等 |
| T-10 | 子 Agent：预订执行 | ⬜ | 出票/订房 |
| T-11 | 子 Agent：报销（发票识别） | ⬜ | gogo 中未完成，本项目补齐 |
| T-12 | 子 Agent：信息（政策/景点/签证 RAG） | ⬜ | 3 知识库 |
| T-13 | 差旅 Skills：tuniu-cli 等 5 个 | ⬜ | 凭证注入机制已就绪(P1-S4)，Skills 本身未写 |
| T-14 | 外部数据：天气/新闻 | ⬜ | wttr.in/NewsData |

---

## 阶段 4 · 编排融合 (orchestrator)

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| O-1 | 意图 L1 规则匹配 | ✅ | 按特异度择优（修掉顺序误判）+ 动宾插入正则；11 条覆盖用例 |
| O-2 | 意图 L2 向量匹配（DashScope Embedding） | 🟡 | 匹配逻辑已测（mock embedding）；种子语料已就位，需 live 验证召回质量 |
| O-3 | 意图 L3 LLM 兜底 | ⬜ | pipeline 留了注入点，无实现 |
| O-4 | intent-seed.yml 种子语料 | ✅ | 规则+向量种子外置，`INTENT_SEED_PATH` 可覆盖，损坏回退内置兜底 |
| O-5 | 查询改写 Agent | ⬜ | 指代消解/上下文补全 |
| O-6 | Supervisor 路由（子 Agent as tool） | 🟡 | 领域级路由已通；子 Agent as tool 机制未做 |
| O-7 | 单意图高置信直跳 | ✅ | 高置信直投领域 Agent；低置信不驱动领域 Agent 而发 SUGGESTIONS 澄清 |
| O-8 | 结果聚合 + SSE 统一回传 | ✅ | chat 已接真实 DomainAgentFactory + Hook 链，替换掉恒降级的占位工厂 |

---

## 阶段 5 · 前端与收尾

| ID | 功能点 | 状态 | 验收 |
|---|---|---|---|
| F-1 | 统一前端消费 SSE | ✅ | 静态页(登录+fetch 流式聊天)由 FastAPI 托管，test_frontend.py 3 项 |
| F-2 | trace/timeline 可观测 | ⬜ | 会话回放（需 live 编排） |
| F-3 | 端到端联调 + 压测 | ⬜ | 需模型 Key 两大场景跑通 |

---

## 实施进度

**当前规模**：224 tests passed，ruff / ruff format / mypy 全绿，97 源文件。编排框架 = LangGraph。

### 本轮（Hook 体系 + 真实接线）

| 项 | 内容 | 证据 |
|---|---|---|
| Hook 基础设施 | `hooks/base.py`：HookContext / AgentHook 协议 / HookChain（单 Hook 异常隔离） | test_hooks.py |
| P1-H1 | 进度 Hook：阶段事件 + 步数 + 耗时，不与 bridge 的工具事件重复 | test_hooks.py |
| P1-H2 | 熔断**接线**到 `toolkit_builder`（此前只有孤立数据结构，全仓库无调用方） | test_hooks.py 3 项 |
| P1-H3 | 上下文压缩 + Summarizer 协议 | test_hooks.py 3 项 |
| P1-H4 | 会话持久化 Hook + MessageSink 协议 + DbMessageSink | test_hooks.py + test_api_chat_persist.py |
| P1-S4 | 凭证注入：按用户隔离，缺失键显式报出 | test_hooks.py 2 项 |
| O-8 | **修复 chat 假接线**：原 `_DegradingFactory.build()` 恒返回 None，真实工厂从未接入；`conversation_id` 收了不用，聊天记录从不落库 | test_api_chat_persist.py 3 项 |
| T-3 补齐 | `load_policy_engine`：政策引擎此前无任何 DB 加载入口 | test_travel.py |
| 工程 | `pyproject.toml` 补 `fakeredis`（conftest 依赖它却未声明，干净检出跑不了测试） | pytest 可安装运行 |

**已验证的端到端链路**：`POST /api/chat` → 意图路由 → 领域分发 → Hook 链（进度/持久化）→ 统一 SSE。
实跑确认：匿名请求返回 `phase:start` / `phase:finish` 进度事件且无 500；登录用户消息真实落进 `chat_message`；
非法 token 降级为匿名而非报错。未配模型 Key 时全程优雅降级，**降级态 Hook 依然生效**。

### 第二轮（意图覆盖 + 直跳 + EXPLAIN 预检）

| 项 | 内容 | 证据 |
|---|---|---|
| O-1 | **修优先级误判**：原按规则列表顺序取首个命中，DATA_ANALYSIS 在前且含泛词「多少」，「订机票多少钱」被判成数据分析。改为按命中文本特异度择优 | test_intent_seed.py |
| O-1 | **修漏判**：关键词是子串匹配，「订去上海的机票」匹配不到「订机票」→ 落 general，请求到不了差旅域。补动宾插入正则 | 11 条参数化覆盖用例 |
| O-4 | `intent-seed.yml` 外置规则 + L2 向量种子；`INTENT_SEED_PATH` 可覆盖；YAML 损坏/类别未知均回退兜底不致整体失效 | test_intent_seed.py 7 项 |
| O-7 | `direct_dispatch` 此前只 log 不用。高置信直投领域 Agent；**低置信不再拿弱猜测驱动领域 Agent**（差旅工具能创建真实订单），改发 SUGGESTIONS 澄清并走 general；AGENT_SWITCH 事件补齐 direct/confidence/source 便于排查路由 | test_supervisor.py 3 项 |
| D-8 | `ExplainPrecheckService`：全表扫描/巨量扫描/未命中索引三类拦截，错误文本给出改写指引；EXPLAIN 自身故障 fail-open。接在**权限改写之后**（对改写前 SQL 预检会高估扫描量误拦） | test_explain_precheck.py 13 项 |

实跑复验：「帮我订去上海的机票」现路由到 `travel`（此前 `general`），
事件为 `{"domain":"travel","intent":"travel_booking","direct":true,"confidence":0.9,"source":"rule"}`。

### 第三轮（SQL 审计）

| 项 | 内容 | 证据 |
|---|---|---|
| D-14 | `SqlAuditor` + `AuditSink` 协议 + `sql_audit_log` 表。**成功与被拦两条路径都留痕**——被 guard / 预检拒绝的越界尝试才是事后追责与调参的依据。SQL 与错误文本落库前截断，防单条巨型语句撑爆审计表 | test_sql_audit.py 9 项 |
| D-14 | 审计是旁路：sink 抛异常只记日志，用户查询照常返回 | `test_audit_failure_does_not_break_query` |
| 工程 | `scripts/init_db.py` 与 `tests/conftest.py` 均靠显式 import 触发模型注册，新增 ORM 模块必须两处都补，否则表建不出来 | 实测 14 张表含 `sql_audit_log` |

### 下一步建议（按性价比）

1. **O-3 L3 LLM 兜底 / O-5 查询改写** —— 规则覆盖不到的长尾靠这两个接住。
3. **T-5/T-6 → T-7~T-12** —— 先补跨城衔接与往返规划两个前置，再做 6 个子 Agent。
4. **P1-A2 / P1-M4 / P1-M6** —— 踢人下线、中断续跑、HITL，都需要 Redis/checkpointer 接线。
5. 需 live 环境的部分见 [NEEDS_LIVE.md](NEEDS_LIVE.md)。

---

## 维护约定

- 开始一个功能点：状态改 🟡，认领人记在提交信息。
- 完成：状态改 ✅，补齐验收结论。
- **只有离线逻辑 + 测试都到位才算 ✅**；接口就绪但缺关键环节或需 live 验证的一律 🟡，并在验收列写明缺什么。
- 新增功能点：按 `阶段-域-序号` 追加 ID，不复用旧 ID。
