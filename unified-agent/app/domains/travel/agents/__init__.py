"""差旅子 Agent：行程管理/规划/审核/预订/报销/信息。基于 LangGraph create_react_agent。

装配见 factory.py（注册表驱动），各自的工具集见 tools.py。
主 Agent 通过 subagent_delegation_tools 把它们当普通工具委派（O-6）。
"""

from __future__ import annotations

from app.domains.travel.agents.factory import (
    SPEC_BY_KEY,
    SUBAGENTS,
    SubAgentSpec,
    build_all_subagents,
    build_subagent,
    subagent_delegation_tools,
    tool_callables,
)
from app.domains.travel.agents.tools import SubAgentContext

__all__ = [
    "SPEC_BY_KEY",
    "SUBAGENTS",
    "SubAgentContext",
    "SubAgentSpec",
    "build_all_subagents",
    "build_subagent",
    "subagent_delegation_tools",
    "tool_callables",
]
