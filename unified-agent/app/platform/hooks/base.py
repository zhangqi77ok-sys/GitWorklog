"""Agent Hook 基础设施：生命周期协议 + 串联执行链。

现有 SSE 链路是拉模式的 AsyncGenerator（orchestrator/runtime.py），没有 callback 抽象。
Hook 因此设计成「观察 + 追加事件」：每个钩子看到原始 LangGraph 事件与转换后的 SSEEvent，
可以返回额外事件插进流里，但不改写主流程。

不采用 LangChain BaseCallbackHandler：那需要模块级 import langchain，
破坏本仓库「langchain 一律函数内延迟 import、保证离线可 import」的约定。

铁律：单个 Hook 抛异常只记日志，绝不中断主链路——可观测性不该拖垮业务。
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger
from app.platform.sse.events import SSEEvent

logger = get_logger(__name__)


@dataclass
class HookContext:
    """一次 Agent 运行的上下文，贯穿整条 Hook 链。

    user_id 为 None 表示匿名请求（未登录），此时持久化类 Hook 应跳过落库。
    state 供各 Hook 存放自己的中间量，key 建议用 Hook 名前缀避免撞车。
    """

    query: str
    domain: str = "general"
    user_id: int | None = None
    conversation_id: str | None = None
    state: dict[str, Any] = field(default_factory=dict)


class AgentHook(Protocol):
    """Agent 生命周期钩子。三个时点均可返回要插入流中的事件（默认不插）。

    on_event 同时拿到原始 LangGraph 事件 dict 与 bridge 转换后的 SSEEvent
    （后者为 None 表示该原始事件不透传给前端），因此既能做协议级观察，
    也能做原始事件级统计。
    """

    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]: ...

    def on_event(
        self, ctx: HookContext, raw: dict[str, Any], sse: SSEEvent | None
    ) -> Iterable[SSEEvent]: ...

    def on_finish(self, ctx: HookContext) -> Iterable[SSEEvent]: ...


@dataclass
class BaseHook:
    """可继承的空实现，子类只覆盖关心的时点。"""

    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]:
        return ()

    def on_event(
        self, ctx: HookContext, raw: dict[str, Any], sse: SSEEvent | None
    ) -> Iterable[SSEEvent]:
        return ()

    def on_finish(self, ctx: HookContext) -> Iterable[SSEEvent]:
        return ()


@dataclass
class HookChain:
    """按注册顺序执行多个 Hook，聚合它们产出的事件。

    任一 Hook 抛异常时记录 error 日志并跳过该 Hook，其余照常执行。
    """

    hooks: list[Any] = field(default_factory=list)

    def _safe(self, hook: Any, phase: str, call: Any) -> list[SSEEvent]:
        try:
            return list(call())
        except Exception as exc:  # 宽捕获是刻意的：Hook 不得拖垮主链路
            logger.error(
                "hook_failed",
                hook=type(hook).__name__,
                phase=phase,
                error=str(exc),
            )
            return []

    def on_start(self, ctx: HookContext) -> list[SSEEvent]:
        out: list[SSEEvent] = []
        for h in self.hooks:
            out.extend(self._safe(h, "on_start", lambda h=h: h.on_start(ctx)))
        return out

    def on_event(
        self, ctx: HookContext, raw: dict[str, Any], sse: SSEEvent | None
    ) -> list[SSEEvent]:
        out: list[SSEEvent] = []
        for h in self.hooks:
            out.extend(self._safe(h, "on_event", lambda h=h: h.on_event(ctx, raw, sse)))
        return out

    def on_finish(self, ctx: HookContext) -> list[SSEEvent]:
        out: list[SSEEvent] = []
        for h in self.hooks:
            out.extend(self._safe(h, "on_finish", lambda h=h: h.on_finish(ctx)))
        return out
