import asyncio
from typing import Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timezone

@dataclass
class PlatformEvent:
    topic: str
    payload: dict[str, Any]
    sender: str = "system"
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable[[PlatformEvent], Any]]] = {}

    def subscribe(self, topic: str, handler: Callable[[PlatformEvent], Any]) -> None:
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)

    def publish(self, event: PlatformEvent) -> None:
        handlers = self._subscribers.get(event.topic, []) + self._subscribers.get("*", [])
        for h in handlers:
            try:
                if asyncio.iscoroutinefunction(h):
                    asyncio.create_task(h(event))
                else:
                    h(event)
            except Exception as e:
                print(f"[EventBus Error] in {h}: {e}")

_global_bus = EventBus()
def get_event_bus() -> EventBus:
    return _global_bus
