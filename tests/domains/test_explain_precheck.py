"""D-8 EXPLAIN 预检测试：拦全表扫描/巨量扫描，EXPLAIN 自身故障则放行。"""

from __future__ import annotations

from typing import Any

import pytest

from app.domains.data.sql.executor import ExecuteSqlPipeline, QueryResult
from app.domains.data.sql.explain import (
    ExplainPolicy,
    ExplainPrecheckService,
    MySQLExplainRunner,
)
from app.domains.data.sql.guard import SqlSafetyError, SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter, PermissionRule
from app.platform.auth.datascope import DataScope, DataScopeResult


class FakeExplain:
    def __init__(self, plan: list[dict[str, Any]]) -> None:
        self.plan = plan
        self.called_with: str | None = None

    def explain(self, sql: str) -> list[dict[str, Any]]:
        self.called_with = sql
        return self.plan


class BoomExplain:
    def explain(self, sql: str) -> list[dict[str, Any]]:
        raise RuntimeError("EXPLAIN 不被支持")


def _svc(plan: list[dict[str, Any]], **kw: Any) -> ExplainPrecheckService:
    return ExplainPrecheckService(FakeExplain(plan), ExplainPolicy(**kw))


# ---------- 放行 ----------


def test_indexed_small_scan_passes() -> None:
    _svc([{"table": "orders", "type": "ref", "key": "idx_user", "rows": 120}]).check("SELECT 1")


def test_empty_plan_passes() -> None:
    _svc([]).check("SELECT 1")


def test_fail_open_when_explain_unavailable() -> None:
    """预检是护栏不是闸门：EXPLAIN 自己挂了不该阻断正常查询。"""
    ExplainPrecheckService(BoomExplain()).check("SELECT 1")


# ---------- 拦截 ----------


def test_blocks_full_table_scan() -> None:
    svc = _svc(
        [{"table": "orders", "type": "ALL", "key": None, "rows": 500_000}],
        full_scan_row_limit=100_000,
        max_scanned_rows=10_000_000,
    )
    with pytest.raises(SqlSafetyError) as e:
        svc.check("SELECT * FROM orders")
    assert "全表扫描" in str(e.value)
    assert "orders" in str(e.value)


def test_blocks_excessive_total_rows() -> None:
    svc = _svc(
        [
            {"table": "a", "type": "ref", "key": "k", "rows": 800_000},
            {"table": "b", "type": "ref", "key": "k", "rows": 800_000},
        ],
        max_scanned_rows=1_000_000,
    )
    with pytest.raises(SqlSafetyError) as e:
        svc.check("SELECT ...")
    assert "1600000" in str(e.value).replace(",", "")


def test_blocks_missing_index_on_large_table() -> None:
    svc = _svc(
        [{"table": "big", "type": "index", "key": "", "rows": 300_000}],
        no_index_row_limit=100_000,
        max_scanned_rows=10_000_000,
    )
    with pytest.raises(SqlSafetyError) as e:
        svc.check("SELECT ...")
    assert "未命中索引" in str(e.value)


def test_error_message_guides_rewrite() -> None:
    """错误文本要能让 Agent 知道怎么改，而不只是「被拒绝」。"""
    svc = _svc(
        [{"table": "orders", "type": "ALL", "key": None, "rows": 999_999}],
        full_scan_row_limit=1000,
        max_scanned_rows=10_000_000,
    )
    with pytest.raises(SqlSafetyError) as e:
        svc.check("SELECT * FROM orders")
    assert "索引" in str(e.value) or "过滤" in str(e.value)


# ---------- 列名大小写与缺失 ----------


def test_tolerates_uppercase_and_missing_columns() -> None:
    """不同驱动返回的列名大小写不一，缺列也不该 KeyError。"""
    _svc([{"TABLE": "t", "TYPE": "ref", "KEY": "k", "ROWS": 10}]).check("SELECT 1")
    _svc([{"table": "t"}]).check("SELECT 1")  # 全缺 → rows=0，放行


def test_non_numeric_rows_treated_as_zero() -> None:
    _svc([{"table": "t", "type": "ALL", "key": None, "rows": "N/A"}]).check("SELECT 1")


# ---------- 接进执行编排 ----------


class FakeRunner:
    def __init__(self) -> None:
        self.ran: str | None = None

    def run(self, sql: str) -> QueryResult:
        self.ran = sql
        return QueryResult(columns=["id"], rows=[{"id": 1}], executed_sql=sql)


def _pipeline(precheck: ExplainPrecheckService | None, runner: FakeRunner) -> ExecuteSqlPipeline:
    return ExecuteSqlPipeline(
        guard=SqlSafetyGuard(),
        rewriter=DataScopeRewriter(
            {"orders": PermissionRule(table="orders", dept_col="dept_id", user_col="user_id")}
        ),
        runner=runner,
        precheck=precheck,
    )


def _scope() -> DataScopeResult:
    return DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None)


def test_pipeline_skips_precheck_when_not_injected() -> None:
    """不注入预检时链路照常工作（无 live 环境仍可用）。"""
    runner = FakeRunner()
    _pipeline(None, runner).execute("SELECT id FROM orders", _scope())
    assert runner.ran is not None


def test_pipeline_blocks_before_execution() -> None:
    """预检不通过时绝不能真的去执行。"""
    runner = FakeRunner()
    svc = _svc(
        [{"table": "orders", "type": "ALL", "key": None, "rows": 9_000_000}],
        full_scan_row_limit=1000,
    )
    with pytest.raises(SqlSafetyError):
        _pipeline(svc, runner).execute("SELECT id FROM orders", _scope())
    assert runner.ran is None  # 没有落到 runner


def test_precheck_sees_rewritten_sql() -> None:
    """必须对权限改写后的 SQL 预检，否则会高估扫描量误拦安全查询。"""
    runner = FakeRunner()
    fake = FakeExplain([{"table": "orders", "type": "ref", "key": "k", "rows": 10}])
    svc = ExplainPrecheckService(fake)
    _pipeline(svc, runner).execute("SELECT id FROM orders", _scope())

    assert fake.called_with is not None
    assert fake.called_with == runner.ran  # 预检与执行看到的是同一条 SQL


def test_live_runner_builds_explain_statement() -> None:
    """live 实现应把 SQL 包成 EXPLAIN 语句（不连库，仅验证拼装）。"""
    captured: dict[str, str] = {}

    class FakeConn:
        def __enter__(self) -> FakeConn:
            return self

        def __exit__(self, *a: Any) -> None:
            return None

        def execute(self, stmt: Any) -> list[Any]:
            captured["sql"] = str(stmt)
            return []

    class FakeEngine:
        def connect(self) -> FakeConn:
            return FakeConn()

    assert MySQLExplainRunner(FakeEngine()).explain("SELECT 1") == []
    assert captured["sql"].startswith("EXPLAIN ")
