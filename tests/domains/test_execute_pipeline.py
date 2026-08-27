"""executeSql 编排 + 差旅政策 + 差旅 ORM 测试。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.data.sql.executor import (
    ExecuteSqlPipeline,
    QueryResult,
    QueryRunner,
)
from app.domains.data.sql.guard import SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter, PermissionRule
from app.domains.data.sql.sensitive import MASK
from app.domains.travel.business.models import TravelOrder
from app.domains.travel.business.policy import (
    PolicyKey,
    PolicyLimit,
    TravelPolicyEngine,
)
from app.platform.auth.datascope import DataScope, DataScopeResult


# ---------- executeSql 编排（fake runner） ----------
class FakeRunner(QueryRunner):
    def __init__(self) -> None:
        self.last_sql = ""

    def run(self, sql: str) -> QueryResult:
        self.last_sql = sql
        return QueryResult(
            columns=["id", "password"],
            rows=[{"id": 1, "password": "secret"}],
        )


def _pipeline(runner: QueryRunner) -> ExecuteSqlPipeline:
    return ExecuteSqlPipeline(
        guard=SqlSafetyGuard(),
        rewriter=DataScopeRewriter(
            {"users": PermissionRule(table="users", dept_col="dept_id", user_col="id")}
        ),
        runner=runner,
    )


def test_execute_applies_guard_rewrite_and_mask() -> None:
    runner = FakeRunner()
    pipe = _pipeline(runner)
    scope = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[10])
    result = pipe.execute("SELECT id, password FROM users", scope)
    # guard 强制 LIMIT + rewriter 注入部门过滤
    assert "LIMIT" in runner.last_sql.upper()
    assert "dept_id" in runner.last_sql.lower()
    # 脱敏生效
    assert result.rows[0]["password"] == MASK


def test_execute_all_scope_no_filter() -> None:
    runner = FakeRunner()
    pipe = _pipeline(runner)
    scope = DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None)
    pipe.execute("SELECT id FROM users", scope)
    assert "dept_id" not in runner.last_sql.lower()


# ---------- 差旅政策引擎 ----------
def _engine() -> TravelPolicyEngine:
    return TravelPolicyEngine(
        {
            PolicyKey("P7", 1): PolicyLimit(hotel_budget=80000, flight_class="economy"),
            PolicyKey("P9", 1): PolicyLimit(hotel_budget=150000, flight_class="business"),
        }
    )


def test_policy_compliant() -> None:
    r = _engine().check("P7", 1, hotel_price=50000, flight_class="economy")
    assert r.compliant


def test_policy_over_budget() -> None:
    r = _engine().check("P7", 1, hotel_price=99999, flight_class="economy")
    assert not r.compliant
    assert any("超过预算" in x for x in r.reasons)


def test_policy_over_class() -> None:
    r = _engine().check("P7", 1, hotel_price=50000, flight_class="business")
    assert not r.compliant


def test_policy_no_rule() -> None:
    r = _engine().check("P1", 9, hotel_price=1, flight_class="economy")
    assert not r.compliant


# ---------- 差旅 ORM ----------
def test_travel_order_crud(db_session: Session) -> None:
    db_session.add(
        TravelOrder(
            user_id=1,
            dept_id=10,
            origin="北京",
            destination="上海",
            start_date="2026-08-01",
            end_date="2026-08-03",
            status="submitted",
        )
    )
    db_session.commit()
    order = db_session.execute(select(TravelOrder)).scalar_one()
    assert order.destination == "上海"
    assert order.status == "submitted"
