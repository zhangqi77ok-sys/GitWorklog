"""D-14 SQL 审计测试：成功/被拦都留痕、审计故障不影响查询、落库内容正确。"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

import app.core.db as core_db
from app.domains.data.models import SqlAuditLog
from app.domains.data.sql.audit import (
    MAX_SQL_CHARS,
    AuditRecord,
    InMemoryAuditSink,
    SqlAuditor,
)
from app.domains.data.sql.audit_sink import DbAuditSink
from app.domains.data.sql.executor import ExecuteSqlPipeline, QueryResult
from app.domains.data.sql.explain import ExplainPolicy, ExplainPrecheckService
from app.domains.data.sql.guard import SqlSafetyError, SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter, PermissionRule
from app.platform.auth.datascope import DataScope, DataScopeResult


class FakeRunner:
    def __init__(self, rows: int = 2, boom: bool = False) -> None:
        self.rows = rows
        self.boom = boom
        self.ran: str | None = None

    def run(self, sql: str) -> QueryResult:
        if self.boom:
            raise RuntimeError("连接中断")
        self.ran = sql
        return QueryResult(
            columns=["id"],
            rows=[{"id": i} for i in range(self.rows)],
            executed_sql=sql,
        )


class BoomSink:
    def save(self, record: AuditRecord) -> None:
        raise RuntimeError("审计库挂了")


def _scope() -> DataScopeResult:
    return DataScopeResult(scope=DataScope.ALL, user_id=7, visible_dept_ids=None)


def _pipeline(auditor: SqlAuditor | None, runner: FakeRunner, **kw: object) -> ExecuteSqlPipeline:
    return ExecuteSqlPipeline(
        guard=SqlSafetyGuard(),
        rewriter=DataScopeRewriter(
            {"orders": PermissionRule(table="orders", dept_col="dept_id", user_col="user_id")}
        ),
        runner=runner,
        auditor=auditor,
        **kw,  # type: ignore[arg-type]
    )


# ---------- 成功路径 ----------


def test_successful_query_is_audited() -> None:
    sink = InMemoryAuditSink()
    ticks = iter([10.0, 10.25])
    runner = FakeRunner(rows=3)
    _pipeline(SqlAuditor(sink, clock=lambda: next(ticks)), runner).execute(
        "SELECT id FROM orders", _scope()
    )

    assert len(sink.records) == 1
    rec = sink.records[0]
    assert rec.success is True
    assert rec.user_id == 7
    assert rec.row_count == 3
    assert rec.raw_sql == "SELECT id FROM orders"
    assert "LIMIT" in rec.executed_sql.upper()  # 记的是实际执行的 SQL
    assert rec.duration_ms == 250
    assert rec.error == ""


# ---------- 被拦路径（审计的主要价值） ----------


def test_guard_rejection_is_audited() -> None:
    """被 guard 拒绝的越界尝试必须留痕。"""
    sink = InMemoryAuditSink()
    runner = FakeRunner()
    with pytest.raises(SqlSafetyError):
        _pipeline(SqlAuditor(sink), runner).execute("DROP TABLE orders", _scope())

    assert len(sink.records) == 1
    rec = sink.records[0]
    assert rec.success is False
    assert rec.raw_sql == "DROP TABLE orders"
    assert rec.executed_sql == ""  # 没走到改写，本就不该有执行语句
    assert rec.error
    assert runner.ran is None  # 确实没执行


def test_precheck_rejection_is_audited() -> None:
    """被 EXPLAIN 预检拦下的也要留痕，且记的是改写后的 SQL。"""

    class Plan:
        def explain(self, sql: str) -> list[dict[str, object]]:
            return [{"table": "orders", "type": "ALL", "key": None, "rows": 9_000_000}]

    sink = InMemoryAuditSink()
    runner = FakeRunner()
    # 总行数上限放宽，让「全表扫描」成为触发的规则
    precheck = ExplainPrecheckService(
        Plan(), ExplainPolicy(full_scan_row_limit=1000, max_scanned_rows=10_000_000)
    )
    with pytest.raises(SqlSafetyError):
        _pipeline(SqlAuditor(sink), runner, precheck=precheck).execute(
            "SELECT id FROM orders", _scope()
        )

    rec = sink.records[0]
    assert rec.success is False
    assert rec.executed_sql  # 已经改写过了
    assert "全表扫描" in rec.error
    assert runner.ran is None  # 预检拦下后没有真的执行


def test_runner_failure_is_audited() -> None:
    sink = InMemoryAuditSink()
    with pytest.raises(RuntimeError):
        _pipeline(SqlAuditor(sink), FakeRunner(boom=True)).execute(
            "SELECT id FROM orders", _scope()
        )
    assert sink.records[0].success is False
    assert "连接中断" in sink.records[0].error


# ---------- 健壮性 ----------


def test_audit_failure_does_not_break_query() -> None:
    """审计是旁路：审计库挂了，用户的查询照样要返回结果。"""
    runner = FakeRunner(rows=1)
    result = _pipeline(SqlAuditor(BoomSink()), runner).execute("SELECT id FROM orders", _scope())
    assert len(result.rows) == 1


def test_pipeline_without_auditor_still_works() -> None:
    """不注入审计时链路照常（向后兼容）。"""
    runner = FakeRunner()
    _pipeline(None, runner).execute("SELECT id FROM orders", _scope())
    assert runner.ran is not None


def test_long_sql_is_truncated() -> None:
    """单条巨型语句不得撑爆审计表。"""
    sink = InMemoryAuditSink()
    SqlAuditor(sink).record(
        user_id=1,
        scope="ALL",
        raw_sql="x" * (MAX_SQL_CHARS + 500),
        executed_sql="y" * (MAX_SQL_CHARS + 500),
        success=True,
    )
    assert len(sink.records[0].raw_sql) == MAX_SQL_CHARS
    assert len(sink.records[0].executed_sql) == MAX_SQL_CHARS


def test_long_error_is_truncated() -> None:
    sink = InMemoryAuditSink()
    SqlAuditor(sink).record(
        user_id=1,
        scope="ALL",
        raw_sql="s",
        executed_sql="",
        success=False,
        error="e" * 900,
    )
    assert len(sink.records[0].error) == 500


# ---------- DB sink ----------


def test_db_sink_persists(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    """DbAuditSink 自开事务落库，内容与记录一致。"""
    monkeypatch.setattr(core_db, "_session_factory", lambda: db_session)

    DbAuditSink().save(
        AuditRecord(
            user_id=42,
            scope="DEPT",
            raw_sql="SELECT 1",
            executed_sql="SELECT 1 LIMIT 100",
            success=False,
            row_count=0,
            error="被拦",
            duration_ms=12,
        )
    )

    row = db_session.execute(select(SqlAuditLog)).scalars().one()
    assert row.user_id == 42
    assert row.scope == "DEPT"
    assert row.success == 0  # 便于按「被拦」筛选
    assert row.error == "被拦"
    assert row.duration_ms == 12
