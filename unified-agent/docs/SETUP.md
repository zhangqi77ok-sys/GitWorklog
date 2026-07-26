# 配置与启动指南

本文档给出两档启动方式：
- **最小启动**：仅需 Python，验证服务、登录、聊天链路（未配模型时走降级流）。
- **完整启动**：起全部基础设施 + 模型 Key，跑真实数据分析 / 差旅智能体。

---

## 1. 前置要求

| 组件 | 版本 | 说明 |
|---|---|---|
| Python | ≥ 3.12 | 必需 |
| Docker + Docker Compose | 最新 | 完整启动用（起 MySQL/Redis/PgVector/MinIO） |
| 模型 API Key | — | DashScope（通义）或 DeepSeek，二选一即可跑真实对话 |

---

## 2. 安装

```bash
cd unified-agent

# 建虚拟环境
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash
# .venv\Scripts\activate           # Windows CMD/PowerShell
# source .venv/bin/activate        # macOS/Linux

# 安装依赖（含开发工具 ruff/mypy/pytest）
pip install -e ".[dev]"
```

---

## 3. 配置环境变量

```bash
cp .env.example .env
```

`.env` 关键项（完整清单见 `.env.example`）：

| 变量 | 作用 | 最小启动 | 完整启动 |
|---|---|---|---|
| `AUTH_JWT_SECRET` | JWT 签名密钥 | 建议改 | **必须**改成长随机串 |
| `DB_*` | 平台主库（用户/会话/差旅） | SQLite 免配 | 指向 MySQL |
| `DATA_DB_*` | data 域被查询业务库（只读隔离） | — | 指向业务库（如 sakila） |
| `DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` | 模型 | 留空→降级 | 填其一→真实对话 |
| `PGVECTOR_*` | 文件 RAG 向量库 | — | 文件问答需要 |
| `MINIO_*` | 文件/图表对象存储 | — | 文件上传需要 |

> `.env` 不入库（已在 `.gitignore`）。密钥只放 `.env`，禁止硬编码。

**模型选择逻辑**（`app/platform/llm/models.py`）：`strong` 角色优先 DeepSeek、回退 DashScope 强模型；`fast` 角色用 DashScope flash。填任一 Key 即可。

---

## 4. 最小启动（仅 Python，验证链路）

无需 Docker。默认 `DB_*` 指向 MySQL，最小启动可临时用 SQLite——把 `.env` 的
`DB_HOST` 留默认但改用内存/文件库最简单的方式是直接跑（若无 MySQL，登录相关接口
需要 DB；纯看降级聊天链路可跳过登录）。

```bash
uvicorn app.main:app --reload
```

- 打开 `http://localhost:8000/` → 前端页面
- `curl http://localhost:8000/health` → `{"code":0,"data":{"status":"up"}}`
- 发消息（未配模型 Key）→ 看到「路由到 data/travel + 降级占位流」，链路完整可见

> 登录需要用户表，故完整体验建议走下面的完整启动。

---

## 5. 完整启动

### 5.1 起基础设施

```bash
docker compose up -d
```

启动 5 个服务：

| 服务 | 端口 | 默认凭证 | 用途 |
|---|---|---|---|
| mysql | 3306 | root/root | 平台主库 |
| redis | 6379 | — | 会话/缓存/中断广播/熔断 |
| pgvector | 5432 | postgres/postgres | 文件 RAG + 语义记忆 |
| minio | 9000(API)/9001(控制台) | minioadmin/minioadmin | 文件/图表 |
| mcp-echarts | 3033 | — | 图表 MCP |

检查：`docker compose ps`（全部 Up）。

### 5.2 建表 + 演示账号

```bash
PYTHONPATH=. python scripts/init_db.py --seed
```

- 建全部表
- 写入演示账号 **admin / admin123**（admin 角色、ALL 数据范围）

### 5.3 启动并验证

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

1. 浏览器打开 `http://localhost:8000/`
2. 用 `admin / admin123` 登录
3. 发消息：
   - 「统计各部门销售额」→ 路由到 **data** 域
   - 「帮我订下周去上海的机票」→ 路由到 **travel** 域
   - 配了模型 Key → 真实智能体回复；未配 → 降级占位流（路由与 SSE 链路仍完整可见）

---

## 6. 接入真实智能体（生产）

未配 Key 时 chat 用降级工厂（恒返回 None → mock 流）。启用真实 Agent 需三步（代码已就位）：

1. **实现 `DomainContextProvider`**（`app/orchestrator/factory.py` 定义的协议）：按请求的 DB session + 登录用户组装 `data_tools()` / `travel_tools()`：
   - data 域：`Text2SqlTools(schema, glossary, ExecuteSqlPipeline(guard, rewriter, MySQLReadOnlyRunner()), scope)`
   - travel 域：`TravelTools(TravelAgentContext(session, user_id, dept_id, policy))`
2. **chat 换工厂**：`app/api/chat.py` 里把 `_DegradingFactory()` 换成 `DomainAgentFactory(你的 provider)`。
3. **文件问答接 live**：`FileManager(MinioStorage(), PgVectorIndex(), embed=DashScope向量函数)`；首次调用 `PgVectorIndex().ensure_schema()` 建向量表。

配好 Key + provider 后，即从降级无缝切真实，核心逻辑零改动。

---

## 7. 常用命令

```bash
make run         # uvicorn 热重载
make infra       # docker compose up -d
make lint        # ruff 检查
make format      # ruff 格式化
make typecheck   # mypy
make test        # pytest
make check       # 提交前全套（lint + typecheck + test）
```

Windows 无 make 时直接用对应命令（见 Makefile）。

---

## 8. 排错

| 现象 | 原因 | 解决 |
|---|---|---|
| 登录返回 40100 | 未建表/无账号 | 跑 `scripts/init_db.py --seed` |
| 聊天一直降级流 | 未配模型 Key | `.env` 填 DASHSCOPE/DEEPSEEK Key |
| `No module named 'app'` | 未设 PYTHONPATH | 用 `uvicorn app.main:app` 或 `PYTHONPATH=. python ...` |
| 连接 MySQL/Redis 失败 | 基础设施未起 | `docker compose ps` 确认，检查 `.env` 连接项 |
| PgVector 报 `type vector` | 扩展未启用/表未建 | 调用 `PgVectorIndex().ensure_schema()`（含 CREATE EXTENSION） |
| 端口占用 | 3306/6379/5432/9000 被占 | 改 `docker-compose.yml` 端口映射与 `.env` |

---

## 9. 运行测试

```bash
pytest                    # 全部（157 项，无需 live 基础设施）
pytest tests/domains      # 仅某目录
```

测试全部用内存替身（SQLite/mock），不依赖任何 live 服务，可离线跑。

