"""LangGraph astream_events(v2) → 统一 SSE 事件协议 的转换桥。

LangGraph compiled graph 的 astream_events 产出 dict 事件，关键类型：
  on_chat_model_stream  → 增量文本(data.chunk.content)
  on_tool_start / on_tool_end → 工具调用进度
  on_chain_end（顶层 graph）→ 完成
本桥把它们映射为 platform/sse/events.py 的 SSEEvent，前端只消费一套协议。

纯映射逻辑（读事件 dict），不依赖 live 模型，可离线测试。
"""

from __future__ import annotations

from typing import Any

from app.platform.sse.events import SSEEvent, SSEEventType


def _chunk_text(data: Any) -> str:
    """从 on_chat_model_stream 的 data 中取增量文本。"""
    chunk = data.get("chunk") if isinstance(data, dict) else None
    if chunk is None:
        return ""
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content
    # content 可能是分块列表（如 [{'type':'text','text':...}]）
    if isinstance(content, list):
        parts = [
            c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"
        ]
        return "".join(parts)
    return ""


def convert(evt: dict[str, Any]) -> SSEEvent | None:
    """把单个 LangGraph 事件 dict 转为 SSEEvent。无需透传的返回 None。"""
    etype = evt.get("event", "")
    data = evt.get("data", {}) or {}
    name = evt.get("name", "")

    if etype == "on_chat_model_stream":
        text = _chunk_text(data)
        if not text:
            return None
        return SSEEvent(event=SSEEventType.MESSAGE, data={"text": text})

    if etype == "on_tool_start":
        return SSEEvent(
            event=SSEEventType.PROGRESS,
            data={"phase": "tool_call", "tool": name},
        )

    if etype == "on_tool_end":
        return SSEEvent(
            event=SSEEventType.PROGRESS,
            data={"phase": "tool_result", "tool": name},
        )

    return None
