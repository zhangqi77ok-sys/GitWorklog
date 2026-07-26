"""Agent 运行时测试：fake LangGraph agent 事件流 → SSE、降级流、异常降级。"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass

from app.orchestrator.runtime import mock_stream, resolve_stream, run_agent_stream
from app.platform.hooks.base import HookChain, HookContext
from app.platform.hooks.persistence import InMemoryMessageSink, PersistenceHook
from app.platform.hooks.progress import ProgressHook
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


# ---------- Hook 接线 ----------


async def test_hooks_wrap_real_agent_stream() -> None:
    """Hook 的 start/finish 事件应插进流里，工具调用被计入步数。"""
    ctx = HookContext(query="q", domain="data")
    hooks = HookChain(hooks=[ProgressHook(clock=lambda: 0.0)])
    events = await _collect(run_agent_stream(FakeAgent(), "q", hooks=hooks, ctx=ctx))

    phases = [e.data.get("phase") for e in events if e.event == SSEEventType.PROGRESS]
    assert "start" in phases
    assert "finish" in phases
    finish = next(e for e in events if e.data.get("phase") == "finish")
    assert finish.data["steps"] == 1  # FakeAgent 有一次 on_tool_start
    assert events[-1].event == SSEEventType.DONE  # DONE 仍在最后


async def test_hooks_also_run_on_degraded_path() -> None:
    """没配模型 Key 时同样要落库、推进度——否则降级=可观测性全失效。"""
    sink = InMemoryMessageSink()
    ctx = HookContext(query="你好", user_id=1, conversation_id="c1")
    hooks = HookChain(hooks=[ProgressHook(clock=lambda: 0.0), PersistenceHook(sink=sink)])

    await _collect(resolve_stream("你好", agent=None, hooks=hooks, ctx=ctx))

    assert [m["role"] for m in sink.saved] == ["user", "assistant"]
    assert sink.saved[0]["content"] == "你好"
    assert "降级模式" in sink.saved[1]["content"]
