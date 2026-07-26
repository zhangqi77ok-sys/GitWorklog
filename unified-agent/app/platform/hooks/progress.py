"""H1 进度推送 Hook（对应 gogo 的进度 SSE）。

分工：platform/sse/bridge.py 已经把 on_tool_start / on_tool_end 转成
PROGRESS {"phase": "tool_call"|"tool_result", "tool": ...}，本 Hook 不重复发那些，
只补 bridge 看不到的**阶段级**信息：运行开始、运行结束（含步数与耗时）。

时钟通过 clock 注入（同 circuit_breaker 的 now 参数约定），便于测试断言耗时。
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any

from app.platform.hooks.base import BaseHook, HookContext
from app.platform.sse.events import SSEEvent, SSEEventType

_STEPS_KEY = "progress.steps"
_START_KEY = "progress.started_at"


def _default_clock() -> float:
    import time

    return time.monotonic()


@dataclass
class ProgressHook(BaseHook):
    """发出 start / finish 两个阶段事件，并统计工具调用步数。"""

    clock: Callable[[], float] = field(default=_default_clock)

    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]:
        ctx.state[_STEPS_KEY] = 0
        ctx.state[_START_KEY] = self.clock()
        return (
            SSEEvent(
                event=SSEEventType.PROGRESS,
                data={"phase": "start", "domain": ctx.domain},
            ),
        )

    def on_event(
        self, ctx: HookContext, raw: dict[str, Any], sse: SSEEvent | None
    ) -> Iterable[SSEEvent]:
        if raw.get("event") == "on_tool_start":
            ctx.state[_STEPS_KEY] = int(ctx.state.get(_STEPS_KEY, 0)) + 1
        return ()

    def on_finish(self, ctx: HookContext) -> Iterable[SSEEvent]:
        started = ctx.state.get(_START_KEY)
        elapsed_ms = int((self.clock() - started) * 1000) if started is not None else 0
        return (
            SSEEvent(
                event=SSEEventType.PROGRESS,
                data={
                    "phase": "finish",
                    "steps": int(ctx.state.get(_STEPS_KEY, 0)),
                    "elapsed_ms": elapsed_ms,
                },
            ),
        )
