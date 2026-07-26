# 编码规范

工具强制执行的部分由 ruff/mypy 保证；本文档记录工具管不到的约定。

## 1. 语言与版本

- Python ≥ 3.12，全量 type hints。
- 每个模块首行 `from __future__ import annotations`（延迟注解求值）。

## 2. 命名

| 对象 | 规范 | 示例 |
|---|---|---|
| 模块/包 | snake_case | `data_scope.py` |
| 类 | PascalCase | `SqlSafetyGuard` |
| 函数/变量 | snake_case | `rewrite_sql` |
| 常量 | UPPER_SNAKE | `MAX_LIMIT` |
| 私有 | 前缀 `_` | `_mask_processor` |
| 类型变量 | 单大写字母 | `T` |

- 语义化命名，不用缩写（`describe_tables` 而非 `desc_tbl`）。

## 3. 类型与数据模型

- 对外数据结构（请求/响应/事件）用 **Pydantic BaseModel**，不用裸 dict。
- ORM 用 SQLAlchemy 2.x `Mapped[]` 声明式。
- 公开函数必须完整类型注解（mypy `disallow_untyped_defs`）。
- 可空用 `X | None`，不用 `Optional[X]`。

## 4. 分层与依赖（呼应 ARCHITECTURE §3）

- import 只能向下：api→orchestrator→domains→platform→core。
- 领域间零 import；共享走 platform。
- 业务逻辑放 service，不放 api 路由函数里。

## 5. 错误处理

- 可预期错误抛 `BizError`（或子类 `AuthError`/`NoPermissionError`），带错误码。
- 不吞异常（禁止空 `except: pass`）；需忽略时注释原因。
- 对外不泄露内部堆栈（prod 由异常处理器兜底）。

## 6. 配置与密钥

- 一切配置走 `app.core.config.settings`，**禁止散落的 `os.getenv`**。
- 密钥只从环境变量/`.env` 读，**禁止硬编码**（源项目 pom.xml 硬编码 API Key 是反面教材）。
- 日志中的敏感字段由 `logging._mask_processor` 脱敏。

## 7. 异步

- I/O 密集（DB/HTTP/Redis）优先 async；CPU 密集放线程池。
- SSE 用 async generator + sse-starlette。
- 阻塞库（同步 SQLAlchemy）在异步端点里用 `run_in_threadpool` 包裹，或用 async 驱动。

## 8. SQL 安全（data 域铁律）

- 用户可触达的查询**只读**：仅 SELECT/WITH。
- 一切执行前过 `SqlSafetyGuard`（sqlglot AST）+ 强制 LIMIT。
- 数据权限改写、脱敏在执行链路内完成，不依赖 LLM 自觉。
- 被查询库用独立只读连接，与平台库隔离。

## 9. Agent / 工具

- 工具函数职责单一，docstring 写清参数与返回（LLM 会读）。
- 大量工具用「工具搜索/延迟工具」按需暴露，避免上下文膨胀。
- 敏感操作（下单/写库）加确认或审计。

## 10. 注释与文档

- 每个模块有 docstring 说明职责（见现有 `__init__.py`）。
- 注释解释「为什么」，不复述「做什么」。
- 复杂算法/安全相关逻辑必须注释意图。

## 11. 测试

- 新功能点配测试，目录镜像 `app/`。
- SQL 安全/权限改写是高风险区，必须有用例回归（含越权、危险 SQL、边界）。
- 提交前 `make check` 全绿。
