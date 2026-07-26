"""Agent 运行时测试：fake LangGraph agent 事件流 → SSE、降级流、异常降级。"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass

from app.orchestrator.runtime import mock_stream, resolve_stream, run_agent_stream
from app.platform.sse.events import SSEEventType


@dataclass
class FakeChunk:
    content: str


class FakeAgent:
    """模拟 LangGraph compiled graph 的 astream_events(version=...)。"""

    async def astream_events(self, inputs, version="v2", **kw):  # type: ignore[no-untyped-def]
        yield {"event": "on_tool_start", "name": "execute_sql", "data": {}}
        yield {"event": "on_chat_model_stream", "data": {"chunk": FakeChunk("分析结果：42 条")}}
        yield {"event": "on_tool_end", "name": "execute_sql", "data": {}}


class BoomAgent:
    async def astream_events(self, inputs, version="v2", **kw):  # type: ignore[no-untyped-def]
        raise RuntimeError("model down")
        yield  # pragma: no cover


async def _collect(gen: AsyncGenerator) -> list:  # type: ignore[type-arg]
    return [e async for e in gen]


async def test_run_agent_stream_maps_events() -> None:
    events = await _collect(run_agent_stream(FakeAgent(), "多少条数据"))
    kinds = [e.event for e in events]
    assert SSEEventType.MESSAGE in kinds
    assert SSEEventType.PROGRESS in kinds
    assert kinds[-1] == SSEEventType.DONE  # 运行时结束补发


async def test_mock_stream_degraded() -> None:
    events = await _collect(mock_stream("你好"))
    assert events[0].event == SSEEventType.PROGRESS
    assert events[-1].event == SSEEventType.DONE
    assert any("降级" in str(e.data) for e in events)


async def test_resolve_stream_no_agent_degrades() -> None:
    events = await _collect(resolve_stream("hi", agent=None))
    assert events[-1].event == SSEEventType.DONE


async def test_resolve_stream_with_agent() -> None:
    events = await _collect(resolve_stream("q", agent=FakeAgent()))
    assert any(e.event == SSEEventType.MESSAGE for e in events)


async def test_resolve_stream_agent_error_becomes_error_event() -> None:
    events = await _collect(resolve_stream("q", agent=BoomAgent()))
    assert events[-1].event == SSEEventType.ERROR
