"""工具熔断器（对应 gogo 的 ToolCircuitBreakerHook）。

三态：CLOSED（正常）→ 失败累计达阈值 → OPEN（熔断，快速失败）
→ 冷却期后 → HALF_OPEN（试探）→ 成功则 CLOSED，失败则重新 OPEN。
按工具维度独立计数。纯逻辑，时间通过 now 注入以便测试；
生产用 Redis 共享计数（见 store 接口），此处为单机内存实现。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class BreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """熔断开启，拒绝调用。"""


@dataclass
class BreakerConfig:
    failure_threshold: int = 5  # 连续失败达此数则熔断
    cooldown_seconds: float = 30.0  # OPEN 冷却时长


@dataclass
class _ToolState:
    state: BreakerState = BreakerState.CLOSED
    failures: int = 0
    opened_at: float = 0.0


@dataclass
class CircuitBreaker:
    config: BreakerConfig = field(default_factory=BreakerConfig)
    _tools: dict[str, _ToolState] = field(default_factory=dict)

    def _get(self, tool: str) -> _ToolState:
        return self._tools.setdefault(tool, _ToolState())

    def allow(self, tool: str, now: float) -> bool:
        """调用前检查是否放行。OPEN 冷却到期自动转 HALF_OPEN。"""
        st = self._get(tool)
        if st.state == BreakerState.OPEN:
            if now - st.opened_at >= self.config.cooldown_seconds:
                st.state = BreakerState.HALF_OPEN
                return True
            return False
        return True

    def on_success(self, tool: str) -> None:
        st = self._get(tool)
        st.failures = 0
        st.state = BreakerState.CLOSED

    def on_failure(self, tool: str, now: float) -> None:
        st = self._get(tool)
        if st.state == BreakerState.HALF_OPEN:
            # 试探失败，立即重新熔断
            st.state = BreakerState.OPEN
            st.opened_at = now
            return
        st.failures += 1
        if st.failures >= self.config.failure_threshold:
            st.state = BreakerState.OPEN
            st.opened_at = now

    def state_of(self, tool: str) -> BreakerState:
        return self._get(tool).state
