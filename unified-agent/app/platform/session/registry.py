"""会话运行时注册表（对应 gogo 的 SseEmitterRegistry + AgentExecutionRegistry）。

- SSE 发射器注册：按会话 id 记录活跃流，支持中断
- 中断信号：标记会话需停止；跨节点广播由 Redis Pub/Sub 适配器完成（见 interrupt_bus）
本类为单机内存实现，逻辑可测；集群下由 Redis 版替换。
"""

from __future__ import annotations

from dataclasses import dataclass, field


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
