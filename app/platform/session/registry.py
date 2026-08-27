"""会话运行时注册表（对应 gogo 的 SseEmitterRegistry + AgentExecutionRegistry）。

- SSE 发射器注册：按会话 id 记录活跃流，支持中断
- 中断信号：标记会话需停止；跨节点广播由 Redis Pub/Sub 适配器完成（见 interrupt_bus）
本类为单机内存实现，逻辑可测；集群下由 Redis 版替换。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SessionRegistry:
    _active: set[str] = field(default_factory=set)
    _interrupted: set[str] = field(default_factory=set)

    def register(self, session_id: str) -> None:
        self._active.add(session_id)
        self._interrupted.discard(session_id)  # 新一轮清除旧中断标记

    def unregister(self, session_id: str) -> None:
        self._active.discard(session_id)
        self._interrupted.discard(session_id)

    def is_active(self, session_id: str) -> bool:
        return session_id in self._active

    def interrupt(self, session_id: str) -> bool:
        """请求中断。返回是否有活跃会话被标记。"""
        if session_id in self._active:
            self._interrupted.add(session_id)
            return True
        return False

    def is_interrupted(self, session_id: str) -> bool:
        return session_id in self._interrupted


class RedisSessionRegistry(SessionRegistry):
    """支持 Redis Pub/Sub 广播的跨节点会话注册表（P1-M5）。"""

    CHANNEL = "agent:session:interrupt"

    def __init__(self, redis_client: Any) -> None:
        super().__init__()
        self.redis = redis_client

    def interrupt(self, session_id: str) -> bool:
        import contextlib

        marked = super().interrupt(session_id)
        if self.redis is not None:
            with contextlib.suppress(Exception):
                self.redis.publish(self.CHANNEL, session_id)
        return marked or True

    def handle_broadcast_message(self, session_id: str) -> None:
        """接收并处理来自 Pub/Sub 的中断广播消息。"""
        if session_id in self._active:
            self._interrupted.add(session_id)


_global_registry: SessionRegistry | None = None


def get_session_registry() -> SessionRegistry:
    """获取全局单例会话注册表。"""
    global _global_registry
    if _global_registry is None:
        _global_registry = SessionRegistry()
    return _global_registry


def set_session_registry(registry: SessionRegistry) -> None:
    """设置全局会话注册表（用于依赖注入或测试替换）。"""
    global _global_registry
    _global_registry = registry
