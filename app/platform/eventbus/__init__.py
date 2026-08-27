"""微内核分布式事件总线 (EventBus & Typed Agent Events)。

用于实现多智能体解耦通信、父子 Agent 消息派发与 Peer Agent 监听机制。
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Coroutine
from enum import Enum


class AgentEventType(str, Enum):
    TASK_CREATED = "task_created"
    CODE_GENERATED = "code_generated"
    CODE_REVIEW_REQUESTED = "code_review_requested"
    CODE_REVIEW_COMPLETED = "code_review_completed"
    TEST_EXECUTION_REQUESTED = "test_execution_requested"
    TEST_EXECUTION_COMPLETED = "test_execution_completed"
    FILE_MODIFIED = "file_modified"
    GRAPH_UPDATED = "graph_updated"
    SESSION_STATE_CHANGED = "session_state_changed"


@dataclass
class AgentEvent:
    event_type: AgentEventType | str
    sender_agent: str
    target_agent: str | None = None
    conversation_id: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    event_id: str = field(default_factory=lambda: f"evt-{int(datetime.utcnow().timestamp()*1000)}")


EventHandler = Callable[[AgentEvent], Coroutine[Any, Any, None] | None]


class EventBus:
    """全局异步事件总线，支持主题订阅、广播与精准路由。"""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
        self._history: list[AgentEvent] = []
        self._max_history = 500

    def subscribe(self, event_type: AgentEventType | str, handler: EventHandler) -> None:
        key = str(event_type.value if isinstance(event_type, AgentEventType) else event_type)
        if handler not in self._subscribers[key]:
            self._subscribers[key].append(handler)

    def unsubscribe(self, event_type: AgentEventType | str, handler: EventHandler) -> None:
        key = str(event_type.value if isinstance(event_type, AgentEventType) else event_type)
        if handler in self._subscribers[key]:
            self._subscribers[key].remove(handler)

    async def publish(self, event: AgentEvent) -> None:
        """异步发布事件并触发所有注册的处理器。"""
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        key = str(event.event_type.value if isinstance(event.event_type, AgentEventType) else event.event_type)
        handlers = list(self._subscribers.get(key, [])) + list(self._subscribers.get("*", []))
        for h in handlers:
            try:
                res = h(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as exc:
                print(f"[EventBus Error] in handler {h} for {event.event_type}: {exc}")

    def get_history(self, conversation_id: str | None = None, limit: int = 50) -> list[AgentEvent]:
        if conversation_id:
            return [e for e in self._history if e.conversation_id == conversation_id][-limit:]
        return self._history[-limit:]

    def clear(self) -> None:
        self._subscribers.clear()
        self._history.clear()


# 全局单例
_global_bus = EventBus()


def get_event_bus() -> EventBus:
    return _global_bus