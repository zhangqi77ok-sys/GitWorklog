# 统一智能体平台（Unified Agent）

融合 **gogo（差旅多 Agent）** 与 **dodo-agentx（Text2SQL 数据分析）** 两个项目，用 **Python + LangGraph + FastAPI** 重构为一个统一平台。

**核心原则**：通用能力（认证/用户、Skills、文件问答、记忆、SSE、中断、MCP）全局只做一份；两个业务域（差旅、数据分析）作为插件挂在平台底座上。

## 快速开始

### 方式 A：Docker Compose 一键全量启动（推荐）

直接启动应用服务及全部依赖基础设施（MySQL / Redis / PgVector / MinIO / mcp-echarts），自动完成建表与演示账号初始化：

```bash
# 1. 复制环境配置（可选填模型 Key）
cp .env.example .env

# 2. 一键构建并后台启动全部服务
docker compose up -d --build

# 3. 访问前端
# 浏览器打开 http://localhost:8010/ ，使用演示账号 admin / admin123 登录
```

---

### 方式 B：本地开发模式启动

```bash
# 1. 建虚拟环境并安装
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -e ".[dev]"

# 2. 启动基础服务并初始化数据库
docker compose up -d mysql redis pgvector minio mcp-echarts
PYTHONPATH=. python scripts/init_db.py --seed

# 3. 启动应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```



> 未配模型 Key 时聊天走「降级流」，链路完整可见；配 Key 后为真实智能体回复。

## 文档导航（先读这些）

| 文档 | 内容 |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | **配置与启动**（最小/完整两档、接 live、排错） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 分层架构、模块边界、数据流 |
| [docs/DIRECTORY_GUIDE.md](docs/DIRECTORY_GUIDE.md) | **每个目录做什么**、依赖规则 |
| [docs/FEATURE_CATALOG.md](docs/FEATURE_CATALOG.md) | **功能点清单**（含状态、归属、来源） |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | 编码规范、命名、类型、错误处理 |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | 开发流程、git 规范、提交前检查 |
| [docs/FRAMEWORK_LANGGRAPH.md](docs/FRAMEWORK_LANGGRAPH.md) | 编排框架（LangGraph）与迁移记录 |
| [docs/NEEDS_LIVE.md](docs/NEEDS_LIVE.md) | 需 live 环境/密钥验证的清单 |

融合总体规划见 [gogo-dodo-fusion-plan.md](gogo-dodo-fusion-plan.md)。

## 分层总览

```
接入层 (app/api)      FastAPI + SSE
编排层 (app/orchestrator)  Supervisor + 三层意图
领域层 (app/domains)   travel（差旅） / data（数据分析）
平台底座 (app/platform)  auth/user/skills/files/memory/session/mcp/hooks/sse/llm
内核   (app/core)     config/response/exceptions/logging
```

## 常用命令

```bash
make lint       # ruff 检查
make format     # ruff 格式化
make typecheck  # mypy
make test       # pytest
make check      # 提交前全套
```
