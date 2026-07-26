"""Supervisor 测试：意图路由到正确领域 + 降级/真实 agent 分发。"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any

from app.orchestrator.intent.defaults import default_rule_matcher
from app.orchestrator.intent.models import IntentCategory
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.supervisor import Supervisor, domain_of
from app.platform.sse.events import SSEEventType


@dataclass
class FakeChunk:
    content: str


class FakeAgent:
    """模拟 LangGraph compiled graph 的 astream_events。"""

    async def astream_events(self, inputs, version="v2", **kw):  # type: ignore[no-untyped-def]
        yield {"event": "on_chat_model_stream", "data": {"chunk": FakeChunk("ok")}}


class FakeFactory:
    def __init__(self, agent: Any | None) -> None:
        self.agent = agent
        self.built_domain: str | None = None

    def build(self, domain: str) -> Any | None:
        self.built_domain = domain
        return self.agent


async def _collect(gen: AsyncGenerator) -> list:  # type: ignore[type-arg]
    return [e async for e in gen]


def test_domain_mapping() -> None:
    assert domain_of(IntentCategory.DATA_ANALYSIS) == "data"
    assert domain_of(IntentCategory.TRAVEL_BOOKING) == "travel"
    assert domain_of(IntentCategory.GENERAL_CHAT) == "general"


async def test_supervisor_routes_data() -> None:
    factory = FakeFactory(FakeAgent())
    sup = Supervisor(IntentPipeline(default_rule_matcher()), factory)
    events = await _collect(sup.handle("统计各部门销售额"))
    assert factory.built_domain == "data"
    assert events[0].event == SSEEventType.AGENT_SWITCH
    assert events[0].data["domain"] == "data"


async def test_supervisor_routes_travel() -> None:
    factory = FakeFactory(FakeAgent())
    sup = Supervisor(IntentPipeline(default_rule_matcher()), factory)
    await _collect(sup.handle("帮我订机票"))
    assert factory.built_domain == "travel"


async def test_supervisor_degrades_without_agent() -> None:
    factory = FakeFactory(None)
    sup = Supervisor(IntentPipeline(default_rule_matcher()), factory)
    events = await _collect(sup.handle("订酒店"))
    # 无 agent → 降级流，仍以 DONE 收尾
    assert events[-1].event == SSEEventType.DONE
