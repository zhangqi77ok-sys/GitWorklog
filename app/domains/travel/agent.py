"""travel 域 Agent 装配（LangGraph create_react_agent + 差旅工具）。

两种形态：
- 单体：只挂基础差旅工具，行为与接子 Agent 前一致（默认，向后兼容）
- 主从：额外挂上六个子 Agent 的委派工具（O-6），复杂任务派下去做

主从形态下主 Agent 只做「听懂 + 派活 + 汇总」，具体业务在子 Agent 里，
这样每个子 Agent 的工具集就是它的权限边界（见 agents/tools.py）。

业务逻辑走已测的 travel service / policy engine。构建 Agent 需 live 模型。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.domains.travel.agents.tools import SubAgentContext
from app.domains.travel.tools.travel_tools import TravelTools
from app.platform.llm.toolkit_builder import build_tools

TRAVEL_AGENT_SYSTEM_PROMPT = """你是企业差旅助手，覆盖差旅申请、行程、预订与政策咨询。
- 创建差旅单前确认出发地、目的地、起止日期（ISO 格式）。系统会自动检测时间冲突。
- 涉及预算/舱位时用 check_policy 校验是否符合公司政策。
- 用 list_my_orders 查询用户已有差旅单。
- 用中文清晰回复，涉及金额时说明单位。"""

SUPERVISOR_PROMPT = """你是企业差旅助手的调度者，手下有若干专职子智能体。
- 先判断用户要办的是哪类事，再把任务**完整地**派给对应的子智能体，
  不要自己臆测业务规则或金额。
- 一件事需要多步时按顺序派：例如先规划、再申请、再预订。
- 子智能体返回失败或提出追问时，如实转达给用户，不要擅自替用户做决定。
- 涉及花钱的操作（预订、出票）必须先向用户确认金额与类型。
- 用中文清晰回复，涉及金额时说明单位。"""


def tool_callables(tools: TravelTools) -> dict[str, Callable[..., str]]:
    return {
        "create_travel_order": tools.create_travel_order,
        "list_my_orders": tools.list_my_orders,
        "cancel_travel_order": tools.cancel_travel_order,
        "check_policy": tools.check_policy,
        "query_weather": tools.query_weather,
        "query_city_info": tools.query_city_info,
    }


def build_travel_tools(tools: TravelTools) -> list[Any]:
    return build_tools(tool_callables(tools))


def build_travel_agent(tools: TravelTools, model: Any, checkpointer: Any = None) -> Any:
    """装配 travel 域 ReAct Agent（LangGraph，需 live 模型）。

    checkpointer 传入才支持中断续跑与 HITL（P1-M4/M6）；不传则行为不变。
    """
    from langgraph.prebuilt import create_react_agent

    return create_react_agent(
        model=model,
        tools=build_travel_tools(tools),
        prompt=TRAVEL_AGENT_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )


def build_travel_supervisor_agent(ctx: SubAgentContext, model: Any) -> Any:
    """装配主从形态：主 Agent 只挂六个子 Agent 的委派工具（O-6）。

    刻意不再挂基础工具——否则主 Agent 会绕过子 Agent 直接操作，
    子 Agent 的权限边界就形同虚设。
    """
    from langgraph.prebuilt import create_react_agent

    from app.domains.travel.agents.factory import subagent_delegation_tools

    return create_react_agent(
        model=model,
        tools=build_tools(subagent_delegation_tools(ctx, model)),
        prompt=SUPERVISOR_PROMPT,
    )
