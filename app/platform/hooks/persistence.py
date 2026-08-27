"""H4 执行日志 / 会话持久化 Hook。

累加流式 MESSAGE 增量拼出完整回答，运行结束时落一条 user + 一条 assistant。
progress/thinking 等富事件序列化进 ChatMessage.extra（session/models.py 就是为此预留的）。

不直接 import session.service：改用 MessageSink Protocol 注入，
既避开 platform 内部横向耦合，也让 Hook 能用内存 sink 完整测试。
匿名请求（user_id / conversation_id 为 None）直接跳过，不落库。
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.platform.hooks.base import BaseHook, HookContext
from app.platform.sse.events import SSEEvent, SSEEventType

_BUF_KEY = "persist.buffer"
_RICH_KEY = "persist.rich"

# 需要收进 extra 的富事件类型
_RICH_TYPES = {
    SSEEventType.PROGRESS,
    SSEEventType.THINKING,
    SSEEventType.TRAVEL_DATA,
    SSEEventType.PLAN_UPDATE,
    SSEEventType.CHART,
    SSEEventType.TABLE,
}


class MessageSink(Protocol):
    """消息落库接缝。live 实现包 session.service.append_message。"""

    def save(self, conversation_id: str, role: str, content: str, extra: str = "") -> None: ...


@dataclass
class InMemoryMessageSink:
    """测试用：把落库调用记录在 list 里。"""

    saved: list[dict[str, str]] = field(default_factory=list)

    def save(self, conversation_id: str, role: str, content: str, extra: str = "") -> None:
        self.saved.append(
            {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "extra": extra,
            }
        )


@dataclass
class PersistenceHook(BaseHook):
    """把一轮问答落库。sink 由上层注入（DB 适配器或内存实现）。"""

    sink: Any = field(default_factory=InMemoryMessageSink)

    def _enabled(self, ctx: HookContext) -> bool:
        return ctx.conversation_id is not None and ctx.user_id is not None

    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]:
        ctx.state[_BUF_KEY] = []
        ctx.state[_RICH_KEY] = [
            {"event": SSEEventType.PROGRESS.value, "data": {"phase": "start", "domain": ctx.domain}}
        ]
        return ()

    def on_event(
        self, ctx: HookContext, raw: dict[str, Any], sse: SSEEvent | None
    ) -> Iterable[SSEEvent]:
        if sse is None:
            return ()
        if sse.event == SSEEventType.MESSAGE:
            text = sse.data.get("text", "")
            if text:
                ctx.state.setdefault(_BUF_KEY, []).append(text)
        elif sse.event in _RICH_TYPES:
            ctx.state.setdefault(_RICH_KEY, []).append({"event": sse.event.value, "data": sse.data})
        return ()

    def on_finish(self, ctx: HookContext) -> Iterable[SSEEvent]:
        if not self._enabled(ctx):
            return ()
        conv_id = ctx.conversation_id
        assert conv_id is not None  # _enabled 已保证
        answer = "".join(ctx.state.get(_BUF_KEY, []))
        rich = ctx.state.get(_RICH_KEY, [])
        extra = json.dumps({"events": rich}, ensure_ascii=False) if rich else ""

        self.sink.save(conv_id, "user", ctx.query, "")
        self.sink.save(conv_id, "assistant", answer, extra)
        return ()
