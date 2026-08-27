"""data 域 Agent 装配（LangGraph create_react_agent + Text2SQL 工具）。

工具走已测的 ExecuteSqlPipeline。构建 Agent 需 live 模型（ChatOpenAI）。
- tool_callables / build_data_tools：纯装配，可离线测（真实 LangChain 工具）
- build_data_agent：需 langgraph + live 模型
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.domains.data.tools.text2sql import Text2SqlTools
from app.platform.llm.toolkit_builder import build_tools

DATA_AGENT_SYSTEM_PROMPT = """你是数据分析智能体。回答数据问题时严格遵循：
1. 先 list_tables 了解有哪些表；写 SQL 前必须 describe_tables 确认字段，禁止凭记忆。
2. 遇到业务术语先 lookup_glossary 取标准口径。
3. 只写只读 SELECT；聚合交给 SQL，最终标量计算用工具。
4. execute_sql 会自动做安全校验/权限过滤/脱敏；失败时按错误提示修正重试。
5. 最终产出结构化的中文分析结论。"""


def tool_callables(tools: Text2SqlTools) -> dict[str, Callable[..., str]]:
    return {
        "list_tables": tools.list_tables,
        "describe_tables": tools.describe_tables,
        "lookup_glossary": tools.lookup_glossary,
        "execute_sql": tools.execute_sql,
    }


def build_data_tools(tools: Text2SqlTools) -> list[Any]:
    """把 Text2SQL 工具转成 LangChain 工具列表。"""
    return build_tools(tool_callables(tools))


def build_data_agent(tools: Text2SqlTools, model: Any, checkpointer: Any = None) -> Any:
    """装配 data 域 ReAct Agent（LangGraph，需 live 模型）。

    checkpointer 传入才支持中断续跑与 HITL（P1-M4/M6）；不传则行为不变。
    """
    from langgraph.prebuilt import create_react_agent

    return create_react_agent(
        model=model,
        tools=build_data_tools(tools),
        prompt=DATA_AGENT_SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
