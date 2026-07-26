"""T-7~T-12 子 Agent 工具集 + O-6 委派机制测试。

真实模型调用需 live，此处用 FakeChat（同 test_factory.py 的手法）验证装配；
工具本身的行为则是真跑业务逻辑 + SQLite，不打桩。
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.domains.travel.agents.factory import (
    SPEC_BY_KEY,
    SUBAGENTS,
    build_all_subagents,
    build_subagent,
    subagent_delegation_tools,
    tool_callables,
)
from app.domains.travel.agents.tools import (
    BookingTools,
    InfoTools,
    ManageTools,
    PlanTools,
    ReimburseTools,
    ReviewTools,
    SubAgentContext,
)
from app.domains.travel.business import service
from app.domains.travel.business.policy import PolicyKey, PolicyLimit, TravelPolicyEngine
from app.domains.travel.business.transit import CityTransit
from app.platform.llm.delegation import as_tool, extract_final_text


def _ctx(session: Session, **kw: Any) -> SubAgentContext:
    policy = TravelPolicyEngine(
        {PolicyKey("P7", 1): PolicyLimit(hotel_budget=80000, flight_class="economy")}
    )
    transit = CityTransit()
    transit.put("北京", "广州", 6.0)
    base: dict[str, Any] = {
        "session": session,
        "user_id": 1,
        "dept_id": 10,
        "policy": policy,
        "transit": transit,
        "job_level": "P7",
    }
    base.update(kw)
    return SubAgentContext(**base)


def _approved_order(session: Session) -> int:
    o = service.create_order(
        session,
        user_id=1,
        dept_id=10,
        origin="北京",
        destination="上海",
        start_date="2026-10-01",
        end_date="2026-10-03",
    )
    service.approve_order(session, o.id, approver_id=2, approved=True)
    return o.id


# ---------------- T-7 管理 ----------------


def test_manage_create_and_list(db_session: Session) -> None:
    t = ManageTools(_ctx(db_session))
    out = t.create_travel_order("北京", "上海", "2026-10-01", "2026-10-03")
    assert "已创建差旅单" in out
    assert "北京" in t.list_my_orders()


def test_manage_blocks_conflicting_dates(db_session: Session) -> None:
    t = ManageTools(_ctx(db_session))
    t.create_travel_order("北京", "上海", "2026-10-01", "2026-10-03")
    out = t.create_travel_order("北京", "广州", "2026-10-02", "2026-10-04")
    assert "冲突" in out


def test_manage_cancel_reports_failure_as_text(db_session: Session) -> None:
    """业务异常要转成文本给 LLM，不能抛出去。"""
    t = ManageTools(_ctx(db_session))
    assert "取消失败" in t.cancel_travel_order(999)


# ---------------- T-8 规划 ----------------


def test_plan_trip_reports_budget(db_session: Session) -> None:
    t = PlanTools(_ctx(db_session))
    out = t.plan_trip("北京", "上海", "2026-10-01", "2026-10-04", 1)
    assert "住 3 晚" in out
    assert "800.00 元" in out  # 每晚上限
    assert "方案可行" in out


def test_plan_trip_flags_missing_policy(db_session: Session) -> None:
    t = PlanTools(_ctx(db_session, job_level="P99"))
    assert "未找到对应差旅政策" in t.plan_trip("北京", "上海", "2026-10-01", "2026-10-02", 1)


def test_plan_transit_gives_earliest_date(db_session: Session) -> None:
    t = PlanTools(_ctx(db_session))
    out = t.check_city_transit("北京", "2026-10-02", "广州", "2026-10-02")
    assert "衔接不可行" in out
    assert "2026-10-03" in out  # 给出可行日期而不只是拒绝


def test_plan_suggest_return(db_session: Session) -> None:
    assert "2026-10-04" in PlanTools(_ctx(db_session)).suggest_return_date("2026-10-01", 3)


# ---------------- T-9 审核 ----------------


def test_review_passes_clean_order(db_session: Session) -> None:
    oid = _approved_order(db_session)
    out = ReviewTools(_ctx(db_session)).review_travel_order(oid, 70000, "economy")
    assert "审核通过" in out


def test_review_flags_over_policy(db_session: Session) -> None:
    oid = _approved_order(db_session)
    out = ReviewTools(_ctx(db_session)).review_travel_order(oid, 999999, "first")
    assert "审核未通过" in out
    assert "✗" in out


def test_review_missing_order(db_session: Session) -> None:
    assert "未找到" in ReviewTools(_ctx(db_session)).review_travel_order(999, 1, "economy")


# ---------------- T-10 预订 ----------------


def test_booking_flow(db_session: Session) -> None:
    oid = _approved_order(db_session)
    t = BookingTools(_ctx(db_session))
    out = t.book(oid, "flight", 120000)
    assert "已登记预订" in out and "1200.00 元" in out

    listing = t.list_order_bookings(oid)
    assert "flight" in listing and "有效合计" in listing


def test_booking_rejects_unapproved_order(db_session: Session) -> None:
    o = service.create_order(
        db_session,
        user_id=1,
        dept_id=10,
        origin="北京",
        destination="上海",
        start_date="2026-11-01",
        end_date="2026-11-02",
    )
    out = BookingTools(_ctx(db_session)).book(o.id, "flight", 1000)
    assert "预订失败" in out and "审批通过" in out


def test_booking_cancel_then_confirm_fails(db_session: Session) -> None:
    oid = _approved_order(db_session)
    t = BookingTools(_ctx(db_session))
    t.book(oid, "hotel", 50000)
    bookings = t.list_order_bookings(oid)
    bid = int(bookings.split("#")[1].split()[0])
    t.cancel(bid)
    assert "确认失败" in t.confirm(bid)


# ---------------- T-11 报销 ----------------


def test_reimburse_accepts_valid(db_session: Session) -> None:
    oid = _approved_order(db_session)
    BookingTools(_ctx(db_session)).book(oid, "hotel", 100000)
    out = ReimburseTools(_ctx(db_session)).check_invoices(oid, ["A1"], [50000], ["2026-10-02"])
    assert "校验通过" in out


def test_reimburse_reports_all_problems(db_session: Session) -> None:
    oid = _approved_order(db_session)
    out = ReimburseTools(_ctx(db_session)).check_invoices(
        oid, ["A1", "A1"], [50000, 50000], ["2026-10-02", "2026-09-01"]
    )
    assert "未通过" in out


def test_reimburse_rejects_mismatched_lists(db_session: Session) -> None:
    oid = _approved_order(db_session)
    out = ReimburseTools(_ctx(db_session)).check_invoices(oid, ["A1", "A2"], [1], ["2026-10-02"])
    assert "长度必须一致" in out


# ---------------- T-12 信息 ----------------


def test_info_query_and_compliance(db_session: Session) -> None:
    t = InfoTools(_ctx(db_session))
    assert "800.00 元" in t.query_policy("P7", 1)
    assert "符合差旅政策" in t.check_compliance("P7", 1, 70000, "economy")
    assert "不符合" in t.check_compliance("P7", 1, 999999, "first")


def test_info_missing_policy_is_explicit(db_session: Session) -> None:
    assert "未找到" in InfoTools(_ctx(db_session)).query_policy("P99", 3)


# ---------------- 注册表 / 权限边界 ----------------


def test_registry_has_six_subagents() -> None:
    assert len(SUBAGENTS) == 6
    assert set(SPEC_BY_KEY) == {"manage", "plan", "review", "booking", "reimburse", "info"}


def test_tool_names_unique_across_registry() -> None:
    names = [s.name for s in SUBAGENTS]
    assert len(names) == len(set(names))


@pytest.mark.parametrize("spec", SUBAGENTS, ids=lambda s: s.key)
def test_declared_methods_exist_and_documented(spec: Any, db_session: Session) -> None:
    """每个方法都要有 docstring——那是 LLM 看到的工具说明。"""
    calls = tool_callables(spec, _ctx(db_session))
    assert set(calls) == set(spec.methods)
    for name, fn in calls.items():
        assert fn.__doc__, f"{spec.key}.{name} 缺少 docstring"


def test_reimburse_agent_cannot_book(db_session: Session) -> None:
    """工具即权限：报销子 Agent 拿不到预订工具，就不可能误下单。"""
    calls = tool_callables(SPEC_BY_KEY["reimburse"], _ctx(db_session))
    assert "book" not in calls
    assert "confirm" not in calls


def test_review_agent_is_read_only(db_session: Session) -> None:
    calls = tool_callables(SPEC_BY_KEY["review"], _ctx(db_session))
    assert set(calls) == {"review_travel_order"}


# ---------------- O-6 委派 ----------------


class FakeAgent:
    def __init__(self, reply: str = "子任务已完成") -> None:
        self.reply = reply
        self.received: list[str] = []

    def invoke(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.received.append(payload["messages"][-1]["content"])
        return {"messages": [{"role": "assistant", "content": self.reply}]}


class BoomAgent:
    def invoke(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("子 Agent 崩了")


def test_as_tool_delegates_and_returns_text() -> None:
    agent = FakeAgent("已创建差旅单 #1")
    tool = as_tool(agent, "travel_manage_agent", "管理差旅单")
    assert tool("帮我申请出差") == "已创建差旅单 #1"
    assert agent.received == ["帮我申请出差"]
    assert tool.__name__ == "travel_manage_agent"
    assert tool.__doc__ == "管理差旅单"


def test_as_tool_converts_failure_to_text() -> None:
    """委派失败要交还父 Agent 决策，不能炸掉整轮对话。"""
    out = as_tool(BoomAgent(), "x", "d")("任务")
    assert "执行失败" in out


def test_as_tool_handles_empty_reply() -> None:
    assert "未返回内容" in as_tool(FakeAgent(""), "x", "d")("任务")


@pytest.mark.parametrize(
    ("result", "expected"),
    [
        ({"messages": [{"content": "文本"}]}, "文本"),
        ({"messages": [{"content": [{"type": "text", "text": "分块"}]}]}, "分块"),
        ({"messages": []}, "{'messages': []}"),
    ],
)
def test_extract_final_text_shapes(result: Any, expected: str) -> None:
    assert extract_final_text(result) == expected


# ---------------- 装配（fake 模型） ----------------


def _fake_model() -> Any:
    from langchain_core.language_models.chat_models import BaseChatModel
    from langchain_core.messages import AIMessage
    from langchain_core.outputs import ChatGeneration, ChatResult

    class FakeChat(BaseChatModel):
        @property
        def _llm_type(self) -> str:
            return "fake"

        def _generate(self, messages, stop=None, run_manager=None, **kw):  # type: ignore[no-untyped-def]
            return ChatResult(generations=[ChatGeneration(message=AIMessage(content="ok"))])

        def bind_tools(self, tools, **kw):  # type: ignore[no-untyped-def]
            return self

    return FakeChat()


@pytest.mark.parametrize("spec", SUBAGENTS, ids=lambda s: s.key)
def test_each_subagent_assembles(spec: Any, db_session: Session) -> None:
    agent = build_subagent(spec, _ctx(db_session), _fake_model())
    assert hasattr(agent, "astream_events")


def test_build_all_and_delegation_tools(db_session: Session) -> None:
    ctx, model = _ctx(db_session), _fake_model()
    agents = build_all_subagents(ctx, model)
    assert len(agents) == 6

    tools = subagent_delegation_tools(ctx, model)
    assert set(tools) == {s.name for s in SUBAGENTS}
    # 委派工具必须带描述，否则父 Agent 不知道何时该派
    for name, fn in tools.items():
        assert fn.__doc__, f"{name} 缺少委派说明"
