"""六个差旅子 Agent 的装配与注册表。

结构与 domains/*/agent.py 保持一致：prompt → tool_callables → build_tools →
create_react_agent，langgraph 延迟 import 以保证离线可 import。

装配用注册表驱动而不是写六个几乎相同的函数——它们只在
「prompt / 工具类 / 委派描述」三处不同，重复六遍只会让改一处忘五处。

委派描述（delegate_desc）写给**父 Agent** 看，决定它什么时候把活派下来，
所以要写清能力边界，尤其是「不能做什么」。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.domains.travel.agents.tools import (
    BookingTools,
    InfoTools,
    ManageTools,
    PlanTools,
    ReimburseTools,
    ReviewTools,
    SubAgentContext,
)
from app.platform.llm.delegation import as_tool
from app.platform.llm.toolkit_builder import build_tools

_SHARED_RULES = (
    "只用工具返回的事实回答，不要编造单号、金额或政策。"
    "工具返回失败信息时，如实转述并说明下一步该怎么做。"
)


@dataclass(frozen=True)
class SubAgentSpec:
    key: str
    name: str  # 委派工具名（父 Agent 可见）
    prompt: str
    tools_cls: type
    methods: tuple[str, ...]
    delegate_desc: str


SUBAGENTS: tuple[SubAgentSpec, ...] = (
    SubAgentSpec(
        key="manage",
        name="travel_manage_agent",
        prompt=("你是差旅单管理助手，负责差旅单的申请、查询与取消。" + _SHARED_RULES),
        tools_cls=ManageTools,
        methods=("create_travel_order", "list_my_orders", "cancel_travel_order"),
        delegate_desc=(
            "处理差旅单本身的增删查：申请出差、查看我的差旅单、取消差旅单。"
            "不负责订票、报销或政策解释。输入用自然语言描述要办的事。"
        ),
    ),
    SubAgentSpec(
        key="plan",
        name="travel_plan_agent",
        prompt=(
            "你是行程规划助手，负责算往返方案、住宿夜数、预算上限与跨城衔接可行性。" + _SHARED_RULES
        ),
        tools_cls=PlanTools,
        methods=("plan_trip", "suggest_return_date", "check_city_transit"),
        delegate_desc=(
            "规划往返行程：算住几晚、预算上限、允许舱位，以及多段行程之间"
            "来不来得及赶路。不会真的下单或创建差旅单。"
        ),
    ),
    SubAgentSpec(
        key="review",
        name="travel_review_agent",
        prompt=(
            "你是行程审核助手，按完整性/政策/预算/时间冲突/跨城衔接/偏好六个维度审核，"
            "把所有问题一次说清。" + _SHARED_RULES
        ),
        tools_cls=ReviewTools,
        methods=("review_travel_order",),
        delegate_desc=(
            "审核已有差旅单是否合规，一次给出全部问题。需要提供差旅单号、"
            "每晚房价（分）与舱位。只做判定，不修改任何数据。"
        ),
    ),
    SubAgentSpec(
        key="booking",
        name="travel_booking_agent",
        prompt=(
            "你是预订执行助手，负责登记与确认机票/酒店等预订。"
            "预订会产生实际花费：金额或类型不明确时必须先追问，不要猜。" + _SHARED_RULES
        ),
        tools_cls=BookingTools,
        methods=("book", "confirm", "cancel", "list_order_bookings"),
        delegate_desc=(
            "执行预订类操作：登记预订、确认出票、取消预订、查询某单的预订明细。"
            "仅对已审批通过的差旅单有效。涉及实际花费，派单前请确认金额已明确。"
        ),
    ),
    SubAgentSpec(
        key="reimburse",
        name="travel_reimburse_agent",
        prompt=("你是报销助手，负责校验发票能否报销。发现问题要一次列全。" + _SHARED_RULES),
        tools_cls=ReimburseTools,
        methods=("check_invoices",),
        delegate_desc=(
            "校验差旅发票：查重、核对开票日期是否在差旅期间、比对已确认预订金额。"
            "不负责下单或修改差旅单。"
        ),
    ),
    SubAgentSpec(
        key="info",
        name="travel_info_agent",
        prompt=(
            "你是差旅政策问答助手。只回答政策规则相关问题；"
            "签证、景点等知识库尚未接入，遇到这类问题要如实说明而不是猜测。" + _SHARED_RULES
        ),
        tools_cls=InfoTools,
        methods=("query_policy", "check_compliance"),
        delegate_desc=(
            "查询差旅政策：某职级在某等级城市的住宿上限与舱位，以及给定房价/舱位是否合规。"
            "签证与景点知识库未接入，不要派这类问题过来。"
        ),
    ),
)

SPEC_BY_KEY = {s.key: s for s in SUBAGENTS}


def tool_callables(spec: SubAgentSpec, ctx: SubAgentContext) -> dict[str, Callable[..., str]]:
    """按 spec 取出该子 Agent 允许使用的方法——工具即权限。"""
    impl = spec.tools_cls(ctx)
    return {m: getattr(impl, m) for m in spec.methods}


def build_subagent(spec: SubAgentSpec, ctx: SubAgentContext, model: Any) -> Any:
    """装配单个子 Agent（LangGraph，需 live 模型）。"""
    from langgraph.prebuilt import create_react_agent

    return create_react_agent(
        model=model,
        tools=build_tools(tool_callables(spec, ctx)),
        prompt=spec.prompt,
    )


def build_all_subagents(ctx: SubAgentContext, model: Any) -> dict[str, Any]:
    """装配全部六个子 Agent，返回 {key: agent}。"""
    return {s.key: build_subagent(s, ctx, model) for s in SUBAGENTS}


def subagent_delegation_tools(ctx: SubAgentContext, model: Any) -> dict[str, Callable[..., str]]:
    """把六个子 Agent 各自包成一个委派工具，供主 Agent 装配（O-6）。"""
    agents = build_all_subagents(ctx, model)
    return {s.name: as_tool(agents[s.key], s.name, s.delegate_desc) for s in SUBAGENTS}
