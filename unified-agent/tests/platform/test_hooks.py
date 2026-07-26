"""Hook 体系测试：链路编排、进度、熔断包装、上下文压缩、持久化、凭证注入。"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from app.platform.hooks.base import BaseHook, HookChain, HookContext
from app.platform.hooks.circuit_breaker import BreakerConfig, CircuitBreaker
from app.platform.hooks.context_compact import (
    ContextPolicy,
    TruncateSummarizer,
    compact,
    total_chars,
)
from app.platform.hooks.credentials import CredentialInjector, InMemoryCredentialProvider
from app.platform.hooks.persistence import InMemoryMessageSink, PersistenceHook
from app.platform.hooks.progress import ProgressHook
from app.platform.llm.toolkit_builder import build_tools
from app.platform.sse.events import SSEEvent, SSEEventType

# ---------- HookChain ----------


class _Marker(BaseHook):
    def __init__(self, tag: str) -> None:
        self.tag = tag

    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]:
        return (SSEEvent(event=SSEEventType.PROGRESS, data={"tag": self.tag}),)


class _Exploding(BaseHook):
    def on_start(self, ctx: HookContext) -> Iterable[SSEEvent]:
        raise RuntimeError("hook 内部炸了")


def test_chain_preserves_order() -> None:
    chain = HookChain(hooks=[_Marker("a"), _Marker("b")])
    out = chain.on_start(HookContext(query="q"))
    assert [e.data["tag"] for e in out] == ["a", "b"]


def test_chain_isolates_failing_hook() -> None:
    """单个 Hook 抛异常不得中断链路，其余 Hook 照常执行。"""
    chain = HookChain(hooks=[_Marker("a"), _Exploding(), _Marker("b")])
    out = chain.on_start(HookContext(query="q"))
    assert [e.data["tag"] for e in out] == ["a", "b"]


# ---------- H1 进度 ----------


def test_progress_emits_start_and_finish_with_steps() -> None:
    ticks = iter([100.0, 100.5])
    hook = ProgressHook(clock=lambda: next(ticks))
    ctx = HookContext(query="q", domain="travel")

    start = list(hook.on_start(ctx))
    assert start[0].data == {"phase": "start", "domain": "travel"}

    # 两次工具调用应被计入步数；非工具事件不计
    hook.on_event(ctx, {"event": "on_tool_start"}, None)
    hook.on_event(ctx, {"event": "on_tool_start"}, None)
    hook.on_event(ctx, {"event": "on_chat_model_stream"}, None)

    finish = next(iter(hook.on_finish(ctx)))
    assert finish.data["phase"] == "finish"
    assert finish.data["steps"] == 2
    assert finish.data["elapsed_ms"] == 500


# ---------- H2 熔断包装到工具 ----------


class _Flaky:
    def __init__(self) -> None:
        self.calls = 0

    def ok_tool(self, city: str, days: int) -> str:
        """查询城市行程。"""
        self.calls += 1
        return f"{city}-{days}"

    def bad_tool(self, x: str) -> str:
        """必然失败的工具。"""
        raise RuntimeError("下游挂了")


def _by_name(tools: list[Any]) -> dict[str, Any]:
    return {t.name: t for t in tools}


def test_build_tools_without_breaker_unchanged() -> None:
    """不传 breaker 时行为与包装前一致（向后兼容）。"""
    f = _Flaky()
    tools = _by_name(build_tools({"ok_tool": f.ok_tool}))
    assert tools["ok_tool"].invoke({"city": "上海", "days": 2}) == "上海-2"


def test_breaker_preserves_tool_schema() -> None:
    """functools.wraps 必须保住 docstring 与签名，否则 LLM 拿不到正确 schema。"""
    f = _Flaky()
    tools = _by_name(build_tools({"ok_tool": f.ok_tool}, breaker=CircuitBreaker()))
    tool = tools["ok_tool"]
    assert tool.description == "查询城市行程。"
    assert set(tool.args) == {"city", "days"}
    assert tool.args["days"]["type"] == "integer"


def test_breaker_opens_and_isolates_per_tool() -> None:
    now = [0.0]
    breaker = CircuitBreaker(config=BreakerConfig(failure_threshold=2, cooldown_seconds=10.0))
    f = _Flaky()
    tools = _by_name(
        build_tools(
            {"ok_tool": f.ok_tool, "bad_tool": f.bad_tool},
            breaker=breaker,
            clock=lambda: now[0],
        )
    )

    # 失败转成工具输出文本，不抛异常
    assert "执行失败" in tools["bad_tool"].invoke({"x": "a"})
    assert "执行失败" in tools["bad_tool"].invoke({"x": "a"})
    # 达阈值后熔断，快速失败且不再真正调用
    assert "熔断" in tools["bad_tool"].invoke({"x": "a"})
    # 另一个工具不受牵连
    assert tools["ok_tool"].invoke({"city": "北京", "days": 1}) == "北京-1"


def test_breaker_half_open_recovers_after_cooldown() -> None:
    now = [0.0]
    breaker = CircuitBreaker(config=BreakerConfig(failure_threshold=1, cooldown_seconds=10.0))
    f = _Flaky()
    tools = _by_name(
        build_tools(
            {"ok_tool": f.ok_tool, "bad_tool": f.bad_tool},
            breaker=breaker,
            clock=lambda: now[0],
        )
    )
    tools["bad_tool"].invoke({"x": "a"})  # 触发熔断
    assert not breaker.allow("bad_tool", 0.0)
    now[0] = 20.0  # 冷却期满
    assert breaker.allow("bad_tool", now[0])


# ---------- H3 上下文压缩 ----------


def test_compact_noop_under_threshold() -> None:
    msgs = [{"role": "user", "content": "短"}]
    assert compact(msgs, ContextPolicy(max_chars=100)) == msgs


def test_compact_keeps_system_head_and_recent_tail() -> None:
    msgs = [{"role": "system", "content": "你是助手"}]
    msgs += [{"role": "user", "content": "x" * 100} for _ in range(10)]
    out = compact(msgs, ContextPolicy(max_chars=200, keep_recent=3), TruncateSummarizer(limit=50))

    assert out[0]["content"] == "你是助手"  # system 头保留
    assert out[1]["content"].startswith("[历史摘要]")  # 中间段被摘要
    assert len(out) == 5  # system + 摘要 + 最近 3 条
    assert total_chars(out) < total_chars(msgs)


def test_compact_without_middle_does_not_discard() -> None:
    """近期消息本身就超阈值时，没有中间段可压，不做破坏性丢弃。"""
    msgs = [{"role": "user", "content": "x" * 100} for _ in range(2)]
    out = compact(msgs, ContextPolicy(max_chars=10, keep_recent=5))
    assert out == msgs


# ---------- H4 持久化 ----------


def test_persistence_saves_user_and_assistant() -> None:
    sink = InMemoryMessageSink()
    hook = PersistenceHook(sink=sink)
    ctx = HookContext(query="订机票", user_id=7, conversation_id="conv-1")

    hook.on_start(ctx)
    hook.on_event(ctx, {}, SSEEvent(event=SSEEventType.MESSAGE, data={"text": "好"}))
    hook.on_event(ctx, {}, SSEEvent(event=SSEEventType.MESSAGE, data={"text": "的"}))
    hook.on_event(ctx, {}, SSEEvent(event=SSEEventType.PROGRESS, data={"phase": "start"}))
    hook.on_finish(ctx)

    assert len(sink.saved) == 2
    user_msg, assistant_msg = sink.saved
    assert user_msg["role"] == "user" and user_msg["content"] == "订机票"
    # 流式增量应被拼回完整回答
    assert assistant_msg["role"] == "assistant" and assistant_msg["content"] == "好的"
    # 富事件进 extra
    assert json.loads(assistant_msg["extra"])["events"][0]["event"] == "progress"


def test_persistence_skips_anonymous() -> None:
    """匿名请求（无 user_id/conversation_id）不落库。"""
    sink = InMemoryMessageSink()
    hook = PersistenceHook(sink=sink)
    ctx = HookContext(query="你好")
    hook.on_start(ctx)
    hook.on_event(ctx, {}, SSEEvent(event=SSEEventType.MESSAGE, data={"text": "hi"}))
    hook.on_finish(ctx)
    assert sink.saved == []


# ---------- S4 凭证注入 ----------


def test_credentials_reports_missing_keys() -> None:
    provider = InMemoryCredentialProvider()
    provider.put(1, "TUNIU_TOKEN", "secret-1")
    injector = CredentialInjector(provider)

    env, missing = injector.env_for(1, ["TUNIU_TOKEN", "HOTEL_KEY"])
    assert env == {"TUNIU_TOKEN": "secret-1"}
    # 缺失的键必须显式报出，不能静默填空串
    assert missing == ["HOTEL_KEY"]


def test_credentials_isolated_per_user() -> None:
    provider = InMemoryCredentialProvider()
    provider.put(1, "TOKEN", "u1")
    provider.put(2, "TOKEN", "u2")
    injector = CredentialInjector(provider)

    assert injector.env_for(1, ["TOKEN"])[0]["TOKEN"] == "u1"
    assert injector.env_for(2, ["TOKEN"])[0]["TOKEN"] == "u2"
    assert injector.env_for(3, ["TOKEN"]) == ({}, ["TOKEN"])
