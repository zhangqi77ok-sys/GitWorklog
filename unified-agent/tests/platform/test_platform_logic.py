"""平台层可测逻辑：熔断器、会话注册表、记忆、MCP 白名单、切分器。"""

from __future__ import annotations

import pytest

from app.platform.files.service import split_overlap
from app.platform.hooks.circuit_breaker import (
    BreakerConfig,
    BreakerState,
    CircuitBreaker,
)
from app.platform.mcp.client import filter_allowed
from app.platform.memory.base import InMemoryMemoryStore
from app.platform.session.registry import SessionRegistry


# ---------- 熔断器 ----------
def test_breaker_opens_after_threshold() -> None:
    cb = CircuitBreaker(BreakerConfig(failure_threshold=3, cooldown_seconds=10))
    for _ in range(3):
        cb.on_failure("weather", now=0.0)
    assert cb.state_of("weather") == BreakerState.OPEN
    assert not cb.allow("weather", now=1.0)  # 冷却期内拒绝


def test_breaker_half_open_after_cooldown() -> None:
    cb = CircuitBreaker(BreakerConfig(failure_threshold=1, cooldown_seconds=10))
    cb.on_failure("t", now=0.0)
    assert not cb.allow("t", now=5.0)  # 冷却中
    assert cb.allow("t", now=10.0)  # 冷却到期 -> HALF_OPEN 放行
    assert cb.state_of("t") == BreakerState.HALF_OPEN


def test_breaker_half_open_success_closes() -> None:
    cb = CircuitBreaker(BreakerConfig(failure_threshold=1, cooldown_seconds=1))
    cb.on_failure("t", now=0.0)
    cb.allow("t", now=2.0)  # HALF_OPEN
    cb.on_success("t")
    assert cb.state_of("t") == BreakerState.CLOSED


def test_breaker_half_open_failure_reopens() -> None:
    cb = CircuitBreaker(BreakerConfig(failure_threshold=1, cooldown_seconds=1))
    cb.on_failure("t", now=0.0)
    cb.allow("t", now=2.0)  # HALF_OPEN
    cb.on_failure("t", now=2.0)
    assert cb.state_of("t") == BreakerState.OPEN


def test_breaker_success_resets_failures() -> None:
    cb = CircuitBreaker(BreakerConfig(failure_threshold=3))
    cb.on_failure("t", now=0.0)
    cb.on_failure("t", now=0.0)
    cb.on_success("t")
    cb.on_failure("t", now=0.0)
    assert cb.state_of("t") == BreakerState.CLOSED  # 未累计到阈值


# ---------- 会话注册表 ----------
def test_session_register_and_interrupt() -> None:
    reg = SessionRegistry()
    reg.register("s1")
    assert reg.is_active("s1")
    assert reg.interrupt("s1")
    assert reg.is_interrupted("s1")


def test_session_interrupt_unknown() -> None:
    assert not SessionRegistry().interrupt("nope")


def test_session_reregister_clears_interrupt() -> None:
    reg = SessionRegistry()
    reg.register("s1")
    reg.interrupt("s1")
    reg.register("s1")  # 新一轮
    assert not reg.is_interrupted("s1")


# ---------- 记忆 ----------
def test_memory_isolation_by_user() -> None:
    m = InMemoryMemoryStore()
    m.add(1, "喜欢靠窗座位")
    m.add(2, "喜欢过道座位")
    r1 = m.search(1, "座位", top_k=5)
    assert len(r1) == 1
    assert "靠窗" in r1[0].content


# ---------- MCP 白名单 ----------
def test_mcp_filter_allowed() -> None:
    assert filter_allowed(["a", "b", "c"], ["a", "c"]) == ["a", "c"]
    assert filter_allowed(["a", "b"], []) == ["a", "b"]  # 空 = 全放行


# ---------- 切分器 ----------
def test_split_small_text_single_chunk() -> None:
    assert split_overlap("short", size=800) == ["short"]


def test_split_overlap_chunks() -> None:
    text = "x" * 2000
    chunks = split_overlap(text, size=800, overlap=100)
    assert len(chunks) >= 3
    assert all(len(c) <= 800 for c in chunks)


def test_split_invalid_overlap() -> None:
    with pytest.raises(ValueError):
        split_overlap("abc", size=100, overlap=100)
