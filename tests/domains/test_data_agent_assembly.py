"""data 域装配测试：LangChain 工具构建（真实 langchain_core API，无需模型）。"""

from __future__ import annotations

from app.domains.data.agent import build_data_tools, tool_callables
from app.domains.data.schema.glossary import Glossary, GlossaryTerm
from app.domains.data.schema.mschema import TableMeta, YamlSchemaProvider
from app.domains.data.sql.executor import ExecuteSqlPipeline, QueryResult, QueryRunner
from app.domains.data.sql.guard import SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter
from app.domains.data.tools.text2sql import DataAgentContext, Text2SqlTools
from app.platform.auth.datascope import DataScope, DataScopeResult


class FakeRunner(QueryRunner):
    def run(self, sql: str) -> QueryResult:
        return QueryResult(columns=["x"], rows=[{"x": 1}])


def _tools() -> Text2SqlTools:
    ctx = DataAgentContext(
        schema=YamlSchemaProvider([TableMeta(name="t", comment="表")]),
        glossary=Glossary([GlossaryTerm(name="X", definition="d")]),
        pipeline=ExecuteSqlPipeline(
            guard=SqlSafetyGuard(),
            rewriter=DataScopeRewriter({}),
            runner=FakeRunner(),
        ),
        scope=DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None),
    )
    return Text2SqlTools(ctx)


def test_tool_callables_complete() -> None:
    names = set(tool_callables(_tools()).keys())
    assert names == {"list_tables", "describe_tables", "lookup_glossary", "execute_sql"}


def test_build_data_tools_are_langchain_tools() -> None:
    tools = build_data_tools(_tools())
    assert len(tools) == 4
    names = {t.name for t in tools}
    assert "execute_sql" in names
    # LangChain 工具应带从 docstring 提取的描述
    execute = next(t for t in tools if t.name == "execute_sql")
    assert execute.description


def test_tool_is_invocable() -> None:
    tools = build_data_tools(_tools())
    list_tables = next(t for t in tools if t.name == "list_tables")
    # 直接调用底层函数（LangChain BaseTool.invoke 需参数 dict）
    out = list_tables.invoke({})
    assert "表" in out
