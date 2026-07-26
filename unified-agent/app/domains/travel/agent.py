"""travel 域 Agent 装配（LangGraph create_react_agent + 差旅工具）。

业务逻辑走已测的 travel service / policy engine。构建 Agent 需 live 模型。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.domains.travel.tools.travel_tools import TravelTools
from app.platform.llm.toolkit_builder import build_tools

TRAVEL_AGENT_SYSTEM_PROMPT = """你是企业差旅助手，覆盖差旅申请、行程、预订与政策咨询。
- 创建差旅单前确认出发地、目的地、起止日期（ISO 格式）。系统会自动检测时间冲突。
- 涉及预算/舱位时用 check_policy 校验是否符合公司政策。
- 用 list_my_orders 查询用户已有差旅单。
- 用中文清晰回复，涉及金额时说明单位。"""


def tool_callables(tools: TravelTools) -> dict[str, Callable[..., str]]:
    return {
        "create_travel_order": tools.create_travel_order,
        "list_my_orders": tools.list_my_orders,
        "cancel_travel_order": tools.cancel_travel_order,
        "check_policy": tools.check_policy,
    }


def build_travel_tools(tools: TravelTools) -> list[Any]:
    return build_tools(tool_callables(tools))


def build_travel_agent(tools: TravelTools, model: Any) -> Any:
    """装配 travel 域 ReAct Agent（LangGraph，需 live 模型）。"""
    from langgraph.prebuilt import create_react_agent

    return create_react_agent(
        model=model,
        tools=build_travel_tools(tools),
        prompt=TRAVEL_AGENT_SYSTEM_PROMPT,
    )
