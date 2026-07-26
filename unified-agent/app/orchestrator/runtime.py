"""Agent 运行时：跑 LangGraph Agent 并把事件流转成统一 SSE 事件。

- run_agent_stream：真实运行 LangGraph create_react_agent 的图（需 live 模型）
- mock_stream：无模型/降级时的占位流
- resolve_stream：根据是否有 agent 自动选择，供 chat 接入层调用

设计要点：SSE 转换用已测的 platform/sse/bridge，与 LangGraph 解耦；
运行时对「未配置模型」优雅降级，不让接口 500。
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from typing import Any

from app.core.logging import get_logger
from app.platform.sse import bridge, events
from app.platform.sse.events import SSEEvent

logger = get_logger(__name__)


async def run_agent_stream(agent: Any, query: str) -> AsyncGenerator[SSEEvent, None]:
    """运行 LangGraph Agent，逐事件转成 SSEEvent，结束补发 DONE。

    agent: langgraph create_react_agent 返回的 compiled graph。
    """
    inputs = {"messages": [{"role": "user", "content": query}]}
    async for evt in agent.astream_events(inputs, version="v2"):
        sse = bridge.convert(evt)
        if sse is not None:
            yield sse
    yield events.done()


async def mock_stream(query: str) -> AsyncGenerator[SSEEvent, None]:
    """降级流：未配置模型时逐字回显，保证链路可用。"""
    yield events.SSEEvent(
        event=events.SSEEventType.PROGRESS,
        data={"phase": "degraded", "note": "未配置模型 API Key，返回占位响应"},
    )
    yield events.message(f"[降级模式] 已收到：{query}")
    for token in ("（", "配置 ", "DASHSCOPE_API_KEY", " 后启用真实智能体", "）"):
        await asyncio.sleep(0.02)
        yield events.message(token)
    yield events.done()


async def resolve_stream(query: str, agent: Any | None = None) -> AsyncGenerator[SSEEvent, None]:
    """有 agent 走真实运行，否则降级。异常也降级为 error 事件，不抛 500。"""
    if agent is None:
        async for e in mock_stream(query):
            yield e
        return
    try:
        async for e in run_agent_stream(agent, query):
            yield e
    except Exception as exc:
        logger.exception("agent_run_failed", error=str(exc))
        yield events.error(f"智能体运行失败：{exc}")
