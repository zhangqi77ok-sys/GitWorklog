# 目录职责指南

每个目录的职责、放什么、不放什么。新增文件前先对照本表确认落点。

## 顶层

| 路径 | 职责 |
|---|---|
| `app/` | 应用代码根 |
| `docs/` | 规范与设计文档 |
| `migrations/` | Alembic 数据库迁移脚本 |
| `skills/` | 文件系统 Skills（FS 权威源，与 DB 同步） |
| `datasets/` | 预置数据集（差旅政策/景点等打包知识库） |
| `tests/` | 测试，目录结构镜像 `app/` |
| `scripts/` | 一次性/运维脚本 |

## app/core —— 内核

| 文件 | 职责 |
|---|---|
| `config.py` | 全项目唯一配置入口（pydantic-settings） |
| `response.py` | 统一响应体 `R[T]` |
| `exceptions.py` | 异常体系 `BizError` + FastAPI 处理器 |
| `logging.py` | 结构化日志 + 脱敏 |

**规则**：零业务依赖；被所有上层引用；不 import 任何业务模块。

## app/api —— 接入层

| 文件 | 职责 |
|---|---|
| `health.py` | 健康检查 |
| `chat.py` | 聊天 SSE 入口（阶段 0 mock，阶段 4 接 Supervisor） |
| `auth.py`（待建） | 登录/登出/当前用户 |
| `files.py`（待建） | 文件上传/预览/删除 |
| `skills.py`（待建） | Skills 管理 |
| `sys.py`（待建） | 用户/角色/部门管理 |
| `session.py`（待建） | 会话列表/回放/删除 |

**规则**：只做参数校验、鉴权、调用下层、封装 `R`/SSE。**禁止写业务逻辑**（业务在 platform/domains 的 service）。

## app/platform —— 平台底座（通用能力唯一实现）

| 子包 | 职责 | 关键组件（规划） |
|---|---|---|
| `auth/` | 认证授权 | JWT 签发校验、Redis 会话、角色 RBAC、DataScope |
| `user/` | 用户体系 | sys_user/role/dept 模型 + service |
| `skills/` | Skills 管理 | DB+FS 双源、zip 上传、SkillsTool、凭证注入 Hook |
| `files/` | 文件问答 RAG | 上传→解析→切分→PgVector→检索、多模态 |
| `memory/` | 记忆 | 短期压缩 + PgVector 语义长期记忆 |
| `session/` | 会话中断 | 会话管理、快照续跑、SSE 注册、Redis 中断广播 |
| `mcp/` | MCP 客户端 | 统一装配、白名单、降级、结果压缩 |
| `hooks/` | 通用 Hook | 进度、持久化、熔断、上下文压缩、凭证注入 |
| `sse/` | SSE 协议 | `events.py` 事件类型定义 + 序列化 |
| `llm/` | 模型接入 | 多模型配置 + Embedding + 多模态 |

**规则**：判断“功能该不该放这”——**两个域都可能用 → 放 platform**。域专属的不放。

## app/orchestrator —— 编排层

| 路径 | 职责 |
|---|---|
| `supervisor.py`（待建） | Supervisor Agent：把各域 Agent 注册为路由目标 |
| `pipeline.py`（待建） | 改写→意图→路由→直跳/兜底 |
| `intent/` | 三层意图识别 + `intent-seed.yml` |

**规则**：只“分发”，不“执行”。不含任何业务动作。

## app/domains/travel —— 差旅域（源自 gogo）

| 子包 | 职责 |
|---|---|
| `agents/` | 行程管理/规划/审核/预订/报销/信息 子 Agent |
| `tools/` | 差旅单读写、冲突检测、往返规划、HITL 交互 |
| `business/` | 差旅单/审批/政策引擎/预订记录 ORM + service |
| `skills/` | tuniu-cli / flight-manager / rolling-go-hotel |

## app/domains/data —— 数据分析域（源自 dodo-agentx）

| 子包 | 职责 |
|---|---|
| `tools/` | Text2SQL 六工具链 |
| `sql/` | SqlSafetyGuard/DataScopeRewriter/SensitiveFilter/只读执行/EXPLAIN 预检（sqlglot） |
| `schema/` | M-Schema provider + glossary + 缓存 |
| `skills/` | data-analysis SKILL.md |

**规则**：两域互不 import；共享能力走 platform。

## 命名约定（目录/文件）

- 包/模块：`snake_case`，语义化（`data_scope.py` 而非 `ds.py`）。
- 一个文件一个主职责；service 与 model 分文件。
- 测试文件 `test_<被测模块>.py`，目录镜像 `app/`。
