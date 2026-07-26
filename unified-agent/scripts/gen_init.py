"""一次性脚本：为每个包目录生成带职责说明 docstring 的 __init__.py。

运行：python scripts/gen_init.py
生成后可删除；仅用于初始化骨架。
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"

# 目录 -> 职责说明（模块 docstring）
DOCS: dict[str, str] = {
    "app": "统一智能体平台应用包：接入层、编排层、领域层、平台底座的根命名空间。",
    "app/core": (
        "跨层通用内核：配置(config)、统一响应(R)、日志、异常、常量。"
        "不依赖任何业务或框架细节，供全项目引用。"
    ),
    "app/api": (
        "接入层 FastAPI 路由。仅做参数校验、鉴权、调用 service/orchestrator、"
        "封装统一响应/SSE。不写业务逻辑。"
    ),
    # ---- 平台底座（唯一一份，两域共享）----
    "app/platform": "平台底座根包：所有通用能力只在此实现一份，travel/data 两域共享。",
    "app/platform/auth": (
        "认证与授权：JWT 签发/校验、Redis 活跃会话、角色 RBAC、"
        "数据范围(DataScope: ALL/DEPT_AND_SUB/DEPT/SELF)。对应原 Sa-Token。"
    ),
    "app/platform/user": (
        "用户/角色/部门模型与管理：sys_user/sys_role/sys_dept + user_profile。"
        "SQLAlchemy 模型 + service + /sys/* 接口的领域逻辑。"
    ),
    "app/platform/skills": (
        "Skills 管理：DB+FS 双源、zip 上传、启停、SKILL.md 解析、"
        "运行时按 enabled 装配为 Agent 工具、Shell/MCP 凭证注入 Hook。"
    ),
    "app/platform/files": (
        "文件问答/RAG：上传→解析(Tika/pymupdf)→切分→PgVector 向量化→检索，"
        "含图片多模态识别。两域共享的唯一文件仓。"
    ),
    "app/platform/memory": (
        "记忆抽象：短期上下文自动压缩 + PgVector 语义长期记忆(按 userId 跨会话)。"
        "统一后端，避免百炼/PgVector 双份。"
    ),
    "app/platform/session": (
        "会话生命周期：会话管理、中断/续跑快照、SSE emitter 注册、跨节点中断广播(Redis Pub/Sub)。"
    ),
    "app/platform/mcp": (
        "MCP 客户端装配：统一连接(stdio/streamable-http)、工具白名单、优雅降级、结果压缩。"
    ),
    "app/platform/hooks": (
        "通用 Agent Hook：进度推送、会话持久化、工具熔断、上下文压缩、"
        "凭证注入。领域无关，两域复用。"
    ),
    "app/platform/sse": (
        "统一 SSE 事件协议：事件类型定义(message/thinking/progress/"
        "travel_data/plan_update/user_interaction/done/error 等) + 序列化。"
    ),
    "app/platform/llm": (
        "模型接入：多模型配置(DeepSeek/Qwen/GLM) + Embedding(DashScope) + "
        "多模态。通过 AgentScope 模型抽象按场景选择。"
    ),
    # ---- 编排层 ----
    "app/orchestrator": (
        "编排层：Supervisor(=原 gogo MasterAgent) 做意图路由与结果聚合，"
        "不含业务逻辑。把 travel 子 Agent 群与 data Agent 注册为可路由目标。"
    ),
    "app/orchestrator/intent": (
        "三层意图识别：L1 规则(关键词/正则) → L2 向量(DashScope Embedding) → "
        "L3 LLM 兜底；种子语料 intent-seed.yml。"
    ),
    # ---- 领域层：travel（gogo 独有）----
    "app/domains": "领域层根包：各业务域插件，只依赖 platform，互不依赖。",
    "app/domains/travel": "差旅域(源自 gogo)：多 Agent 协作完成申请→规划→审核→预订→报销。",
    "app/domains/travel/agents": (
        "差旅子 Agent：行程管理/规划/审核/预订/报销/信息。基于 AgentScope ReActAgent。"
    ),
    "app/domains/travel/tools": (
        "差旅工具：差旅单读写、行程冲突检测、往返规划计算、HITL 用户交互。"
    ),
    "app/domains/travel/business": (
        "差旅业务域：差旅单、审批、政策规则引擎、预订记录、报销。含 ORM 模型与 service。"
    ),
    "app/domains/travel/skills": "差旅 Skills：tuniu-cli / flight-manager / rolling-go-hotel 等。",
    # ---- 领域层：data（dodo 独有）----
    "app/domains/data": "数据分析域(源自 dodo-agentx)：Text2SQL 自然语言查库并产出分析报告。",
    "app/domains/data/tools": (
        "Text2SQL 六工具链：listTables/describeTables/lookupGlossary/"
        "validateSql/executeSql/calculate。"
    ),
    "app/domains/data/sql": (
        "SQL 安全纵深(sqlglot AST)：SqlSafetyGuard(白名单+强制LIMIT+危险函数拦截)、"
        "DataScopeRewriter(数据权限改写)、SensitiveFilter(脱敏)、只读执行器、EXPLAIN 预检。"
    ),
    "app/domains/data/schema": (
        "Schema 感知：M-Schema provider(DB 自省 + YAML 字典)、业务术语 glossary、"
        "Schema 缓存与定时刷新。"
    ),
    "app/domains/data/skills": "数据分析 Skills：data-analysis SKILL.md 编排全流程。",
}


def main() -> None:
    for rel, doc in DOCS.items():
        pkg = ROOT / rel
        pkg.mkdir(parents=True, exist_ok=True)
        init = pkg / "__init__.py"
        init.write_text(f'"""{doc}"""\n', encoding="utf-8")
        print(f"wrote {init.relative_to(ROOT)}")
    print(f"\n共生成 {len(DOCS)} 个 __init__.py")


if __name__ == "__main__":
    main()
