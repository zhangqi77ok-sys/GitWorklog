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
from app.platform.hooks.base import HookChain, HookContext
from app.platform.sse import bridge, events
from app.platform.sse.events import SSEEvent

logger = get_logger(__name__)


async def run_agent_stream(
    agent: Any,
    query: str,
    hooks: HookChain | None = None,
    ctx: HookContext | None = None,
) -> AsyncGenerator[SSEEvent, None]:
    """运行 LangGraph Agent，逐事件转成 SSEEvent，结束补发 DONE。

    agent: langgraph create_react_agent 返回的 compiled graph。
    hooks: 可选 Hook 链，观察事件并可插入额外事件（进度/持久化等）。
    """
    inputs = {"messages": [{"role": "user", "content": query}]}
    hctx = ctx or HookContext(query=query)

    if hooks is not None:
        for e in hooks.on_start(hctx):
            yield e

    async for evt in agent.astream_events(inputs, version="v2"):
        sse = bridge.convert(evt)
        if sse is not None:
            yield sse
        if hooks is not None:
            for e in hooks.on_event(hctx, evt, sse):
                yield e

    if hooks is not None:
        for e in hooks.on_finish(hctx):
            yield e
    yield events.done()


async def mock_stream(
    query: str,
    hooks: HookChain | None = None,
    ctx: HookContext | None = None,
) -> AsyncGenerator[SSEEvent, None]:
    """降级流：未配置模型时逐字回显，保证链路可用。

    同样跑 Hook 链——降级态下会话依然要落库、进度依然要推送，
    否则「没配 Key」就等于「可观测性和持久化全失效」。
    降级路径没有 LangGraph 原始事件，raw 传空 dict。
    """
    hctx = ctx or HookContext(query=query)
    if hooks is not None:
        for e in hooks.on_start(hctx):
            yield e

    degraded = events.SSEEvent(
        event=events.SSEEventType.PROGRESS,
        data={"phase": "degraded", "note": "未配置模型 API Key，返回占位响应"},
    )
    body = [degraded, events.message(f"[降级模式] 已收到：{query}")]
    for token in ("（", "配置 ", "DASHSCOPE_API_KEY", " 后启用真实智能体", "）"):
        body.append(events.message(token))

    for i, evt in enumerate(body):
        if i > 1:
            await asyncio.sleep(0.02)
        yield evt
        if hooks is not None:
            for e in hooks.on_event(hctx, {}, evt):
                yield e

    if hooks is not None:
        for e in hooks.on_finish(hctx):
            yield e
    yield events.done()


async def resolve_stream(
    query: str,
    agent: Any | None = None,
    hooks: HookChain | None = None,
    ctx: HookContext | None = None,
) -> AsyncGenerator[SSEEvent, None]:
    """有 agent 走真实运行，否则降级。异常也降级为 error 事件，不抛 500。"""
    if agent is None:
        async for e in mock_stream(query, hooks=hooks, ctx=ctx):
            yield e
        return
    try:
        async for e in run_agent_stream(agent, query, hooks=hooks, ctx=ctx):
            yield e
    except Exception as exc:
        logger.exception("agent_run_failed", error=str(exc))
        yield events.error(f"智能体运行失败：{exc}")
