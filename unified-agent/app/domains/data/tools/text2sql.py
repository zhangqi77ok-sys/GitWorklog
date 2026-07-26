"""Text2SQL 六工具链的可调用实现（对应 dodo 的工具）。

这些函数是**纯业务逻辑**，通过依赖注入拿到 schema provider / glossary /
executeSql pipeline / 当前用户数据范围。装配 Agent 时用 LangChain 的
StructuredTool 包装这些方法交给 create_react_agent（见 domains/data/agent.py）。

工具执行不直接触达 LLM；executeSql 内部走已测的 ExecuteSqlPipeline。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domains.data.schema.glossary import Glossary
from app.domains.data.schema.mschema import MschemaFormatter, SchemaProvider
from app.domains.data.sql.executor import ExecuteSqlPipeline
from app.domains.data.sql.guard import SqlSafetyError
from app.platform.auth.datascope import DataScopeResult


@dataclass
class DataAgentContext:
    """一次会话内 data 域工具共享的上下文（由装配层注入）。"""

    schema: SchemaProvider
    glossary: Glossary
    pipeline: ExecuteSqlPipeline
    scope: DataScopeResult


class Text2SqlTools:
    """把上下文绑定成一组工具方法。装配层将每个方法注册为 FunctionTool。"""

    def __init__(self, ctx: DataAgentContext) -> None:
        self.ctx = ctx

    def list_tables(self) -> str:
        """列出所有可查询的表及中文描述。回答任何数据问题的第一步。"""
        return MschemaFormatter.format_table_list(self.ctx.schema.list_tables())

    def describe_tables(self, table_names: list[str]) -> str:
        """查看指定表的字段详情（类型/主键/注释/示例）。写 SQL 前必须调用，禁止凭记忆。"""
        parts: list[str] = []
        for name in table_names:
            t = self.ctx.schema.describe_table(name)
            if t is None:
                parts.append(f"# 表 {name} 不存在")
            else:
                parts.append(MschemaFormatter.format_table(t))
        return "\n\n".join(parts)

    def lookup_glossary(self, term: str) -> str:
        """查询业务术语的标准口径（定义 + 可复用 SQL 片段）。遇到业务术语必须先查。"""
        hit = self.ctx.glossary.lookup(term)
        if hit is None:
            available = "、".join(self.ctx.glossary.term_names())
            return f"未找到术语「{term}」。已知术语：{available}"
        snippet = f"\nSQL 片段：{hit.sql_snippet}" if hit.sql_snippet else ""
        return f"{hit.name}：{hit.definition}{snippet}"

    def execute_sql(self, sql: str) -> str:
        """执行只读 SQL 查询并返回结果。会自动做安全校验、数据权限过滤、脱敏。"""
        try:
            result = self.ctx.pipeline.execute(sql, self.ctx.scope)
        except SqlSafetyError as e:
            return f"SQL 未通过安全校验：{e}。请修正后重试。"
        if not result.rows:
            return "查询无结果。"
        header = " | ".join(result.columns)
        lines = [
            " | ".join(str(row.get(c, "")) for c in result.columns) for row in result.rows[:50]
        ]
        return f"执行 SQL：{result.executed_sql}\n\n{header}\n" + "\n".join(lines)
