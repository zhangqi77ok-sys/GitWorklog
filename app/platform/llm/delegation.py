"""O-6 子 Agent as tool：把一个已编译的 Agent 包成父 Agent 可调用的工具。

多 Agent 协作的最小可用形态——父 Agent 把子任务当成一次工具调用委派出去，
不需要引入 langgraph-supervisor 之类的额外框架。

与 toolkit_builder 的契约保持一致：返回 `Callable[[str], str]`，
于是子 Agent 可以和普通工具混在同一个列表里装配，父 Agent 无需区别对待。

子 Agent 失败转成文本返回而非抛出——委派失败应该让父 Agent 看到并另想办法，
而不是把整轮对话炸掉（同 data/tools/text2sql.py 的既有约定）。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


def extract_final_text(result: Any) -> str:
    """从 LangGraph Agent 的 invoke 结果里取最终回答文本。

    正常形态是 {"messages": [...]}，取最后一条的 content；
    content 可能是 str 或分块列表（同 sse/bridge 的处理）。
    """
    messages = result.get("messages") if isinstance(result, dict) else None
    if not messages:
        return str(result)
    content = getattr(messages[-1], "content", None)
    if content is None and isinstance(messages[-1], dict):
        content = messages[-1].get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"
        ]
        return "".join(parts)
    return str(content or "")


def as_tool(agent: Any, name: str, description: str) -> Callable[..., str]:
    """把子 Agent 包成一个「接受任务描述、返回结果文本」的工具函数。

    name/description 会被 toolkit_builder 读走生成 LLM 可见的工具 schema，
    所以 description 要写清这个子 Agent 擅长什么、什么时候该派给它。
    """

    def _delegate(task: str) -> str:
        try:
            result = agent.invoke({"messages": [{"role": "user", "content": task}]})
        except Exception as exc:  # 宽捕获是刻意的：委派失败交还父 Agent 决策
            logger.warning("subagent_delegation_failed", subagent=name, error=str(exc))
            return f"子智能体 {name} 执行失败：{exc}"
        text = extract_final_text(result)
        logger.info("subagent_delegated", subagent=name, chars=len(text))
        return text or f"子智能体 {name} 未返回内容"

    _delegate.__name__ = name
    _delegate.__doc__ = description
    return _delegate
