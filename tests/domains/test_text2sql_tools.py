"""Text2SQL 工具链测试：用 fake runner + YAML schema，不依赖模型。"""

from __future__ import annotations

from app.domains.data.schema.glossary import Glossary, GlossaryTerm
from app.domains.data.schema.mschema import (
    ColumnMeta,
    TableMeta,
    YamlSchemaProvider,
)
from app.domains.data.sql.executor import (
    ExecuteSqlPipeline,
    QueryResult,
    QueryRunner,
)
from app.domains.data.sql.guard import SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter, PermissionRule
from app.domains.data.tools.text2sql import DataAgentContext, Text2SqlTools
from app.platform.auth.datascope import DataScope, DataScopeResult


class FakeRunner(QueryRunner):
    def run(self, sql: str) -> QueryResult:
        return QueryResult(columns=["name", "cnt"], rows=[{"name": "北京", "cnt": 42}])


def _tools() -> Text2SqlTools:
    schema = YamlSchemaProvider(
        [
            TableMeta(
                name="orders",
                comment="订单",
                columns=[ColumnMeta(name="id", type="int", primary_key=True)],
            )
        ]
    )
    glossary = Glossary([GlossaryTerm(name="活跃客户", definition="近30天下单", sql_snippet="...")])
    pipeline = ExecuteSqlPipeline(
        guard=SqlSafetyGuard(),
        rewriter=DataScopeRewriter({"orders": PermissionRule(table="orders", dept_col="dept_id")}),
        runner=FakeRunner(),
    )
    ctx = DataAgentContext(
        schema=schema,
        glossary=glossary,
        pipeline=pipeline,
        scope=DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None),
    )
    return Text2SqlTools(ctx)


def test_list_tables() -> None:
    out = _tools().list_tables()
    assert "orders" in out and "订单" in out


def test_describe_tables() -> None:
    out = _tools().describe_tables(["orders"])
    assert "id" in out and "PK" in out


def test_describe_missing_table() -> None:
    out = _tools().describe_tables(["ghost"])
    assert "不存在" in out


def test_lookup_glossary_hit() -> None:
    out = _tools().lookup_glossary("活跃客户")
    assert "近30天" in out


def test_lookup_glossary_miss_lists_known() -> None:
    out = _tools().lookup_glossary("不存在的词")
    assert "活跃客户" in out


def test_execute_sql_ok() -> None:
    out = _tools().execute_sql("SELECT name, count(*) cnt FROM orders GROUP BY name")
    assert "北京" in out and "42" in out


def test_execute_sql_blocks_dangerous() -> None:
    out = _tools().execute_sql("DROP TABLE orders")
    assert "安全校验" in out
