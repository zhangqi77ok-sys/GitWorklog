"""travel 域测试：service 生命周期、冲突检测、工具、装配（真实 LangChain 工具）。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.domains.travel.agent import build_travel_tools, tool_callables
from app.domains.travel.business import service
from app.domains.travel.business.policy import (
    PolicyKey,
    PolicyLimit,
    TravelPolicyEngine,
)
from app.domains.travel.tools.travel_tools import TravelAgentContext, TravelTools


# ---------- service ----------
def test_order_lifecycle(db_session: Session) -> None:
    order = service.create_order(
        db_session,
        user_id=1,
        dept_id=10,
        origin="北京",
        destination="上海",
        start_date="2026-08-01",
        end_date="2026-08-03",
    )
    assert order.status == "submitted"
    approved = service.approve_order(db_session, order.id, approver_id=2, approved=True)
    assert approved.status == "approved"


def test_cancel_approved_rejected(db_session: Session) -> None:
    order = service.create_order(
        db_session,
        user_id=1,
        dept_id=10,
        origin="A",
        destination="B",
        start_date="2026-09-01",
        end_date="2026-09-02",
    )
    service.approve_order(db_session, order.id, approver_id=2, approved=True)
    try:
        service.cancel_order(db_session, order.id)
        raise AssertionError("已审批不应可取消")
    except ValueError:
        pass


def test_time_conflict(db_session: Session) -> None:
    service.create_order(
        db_session,
        user_id=1,
        dept_id=10,
        origin="A",
        destination="B",
        start_date="2026-08-01",
        end_date="2026-08-05",
    )
    assert service.has_time_conflict(db_session, 1, "2026-08-03", "2026-08-04")
    assert not service.has_time_conflict(db_session, 1, "2026-08-10", "2026-08-12")


# ---------- tools ----------
def _tools(session: Session) -> TravelTools:
    policy = TravelPolicyEngine(
        {PolicyKey("P7", 1): PolicyLimit(hotel_budget=80000, flight_class="economy")}
    )
    ctx = TravelAgentContext(session=session, user_id=1, dept_id=10, policy=policy)
    return TravelTools(ctx)


def test_tool_create_and_conflict(db_session: Session) -> None:
    tools = _tools(db_session)
    out = tools.create_travel_order("北京", "上海", "2026-08-01", "2026-08-03")
    assert "已创建" in out
    # 重叠时间
    out2 = tools.create_travel_order("北京", "广州", "2026-08-02", "2026-08-04")
    assert "冲突" in out2


def test_tool_check_policy(db_session: Session) -> None:
    tools = _tools(db_session)
    assert "符合" in tools.check_policy("P7", 1, 50000, "economy")
    assert "不符合" in tools.check_policy("P7", 1, 99999, "business")


# ---------- 装配 ----------
def test_travel_tool_callables(db_session: Session) -> None:
    names = set(tool_callables(_tools(db_session)).keys())
    assert names == {
        "create_travel_order",
        "list_my_orders",
        "cancel_travel_order",
        "check_policy",
        "query_weather",
        "query_city_info",
    }


def test_build_travel_tools(db_session: Session) -> None:
    tools = build_travel_tools(_tools(db_session))
    assert len(tools) == 6
    names = {t.name for t in tools}
    assert "create_travel_order" in names
    assert "query_weather" in names
