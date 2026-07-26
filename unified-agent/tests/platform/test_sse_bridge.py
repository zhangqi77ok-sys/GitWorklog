"""SSE 桥测试：用 mock 的 LangGraph astream_events dict 事件验证映射。

不依赖 live 模型 —— 桥读事件 dict，构造对应形状即可。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.platform.sse.bridge import convert
from app.platform.sse.events import SSEEventType


@dataclass
class FakeChunk:
    content: str


def test_chat_model_stream_maps_to_message() -> None:
    evt = {"event": "on_chat_model_stream", "data": {"chunk": FakeChunk(content="你好")}}
    e = convert(evt)
    assert e is not None
    assert e.event == SSEEventType.MESSAGE
    assert e.data["text"] == "你好"


def test_chat_model_stream_list_content() -> None:
    evt = {
        "event": "on_chat_model_stream",
        "data": {"chunk": FakeChunk(content=[{"type": "text", "text": "片段"}])},
    }
    e = convert(evt)
    assert e is not None
    assert e.data["text"] == "片段"


def test_empty_chunk_returns_none() -> None:
    evt = {"event": "on_chat_model_stream", "data": {"chunk": FakeChunk(content="")}}
    assert convert(evt) is None


def test_tool_start_maps_to_progress() -> None:
    evt = {"event": "on_tool_start", "name": "execute_sql", "data": {"input": {}}}
    e = convert(evt)
    assert e is not None
    assert e.event == SSEEventType.PROGRESS
    assert e.data["tool"] == "execute_sql"
    assert e.data["phase"] == "tool_call"


def test_tool_end_maps_to_progress() -> None:
    evt = {"event": "on_tool_end", "name": "execute_sql", "data": {"output": "ok"}}
    e = convert(evt)
    assert e is not None
    assert e.data["phase"] == "tool_result"


def test_unmapped_event_returns_none() -> None:
    assert convert({"event": "on_chain_start", "data": {}}) is None
