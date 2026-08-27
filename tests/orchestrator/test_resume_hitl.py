"""P1-M4 中断续跑 / P1-M6 HITL 测试。

不打桩 LangGraph：用真实的 InMemorySaver + interrupt() 建一个会挂起的图，
跑通「挂起 → 发 USER_INTERACTION → 带 resume 恢复 → 跑完」整条链路。
只有真跑一遍才能确认我们对 checkpointer/interrupt 的用法是对的。
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import pytest

from app.orchestrator.resume import (
    PendingInterrupt,
    build_checkpointer,
    extract_interrupt,
    has_snapshot,
    resume_command,
    thread_config,
)
from app.orchestrator.runtime import resolve_stream, run_agent_stream
from app.platform.sse.events import SSEEventType


async def _collect(gen: AsyncGenerator) -> list:  # type: ignore[type-arg]
    return [e async for e in gen]


# ---------- 基础件 ----------


def test_build_memory_checkpointer() -> None:
    assert build_checkpointer("memory") is not None


def test_unknown_checkpointer_raises_not_silently_downgrades() -> None:
    """不能静默退回内存——否则生产上会以为自己有持久化其实没有。"""
    with pytest.raises(ValueError, match=r"postgres|不支持"):
        build_checkpointer("postgres")


def test_thread_config_shape() -> None:
    assert thread_config("c1") == {"configurable": {"thread_id": "c1"}}


def test_resume_command_wraps_value() -> None:
    cmd = resume_command("确认")
    assert getattr(cmd, "resume", None) == "确认"


# ---------- 中断信息解析 ----------


def test_extract_interrupt_from_dict_value() -> None:
    state = {"__interrupt__": [type("I", (), {"value": {"prompt": "确认下单？", "amount": 100}})()]}
    p = extract_interrupt(state, "t1")
    assert p is not None
    assert p.prompt == "确认下单？"
    assert p.payload == {"amount": 100}
    assert p.thread_id == "t1"


@pytest.mark.parametrize("key", ["prompt", "question", "message"])
def test_extract_interrupt_accepts_common_keys(key: str) -> None:
    state = {"__interrupt__": [type("I", (), {"value": {key: "要确认吗"}})()]}
    p = extract_interrupt(state, "t")
    assert p is not None and p.prompt == "要确认吗"


def test_extract_interrupt_from_plain_string() -> None:
    state = {"__interrupt__": [type("I", (), {"value": "请确认"})()]}
    p = extract_interrupt(state, "t")
    assert p is not None and p.prompt == "请确认"


def test_extract_interrupt_none_when_absent() -> None:
    assert extract_interrupt({"messages": []}, "t") is None
    assert extract_interrupt("not a dict", "t") is None


def test_pending_interrupt_event_shape() -> None:
    evt = PendingInterrupt("t1", "确认？", {"amount": 5}).to_event()
    assert evt.event == SSEEventType.USER_INTERACTION
    assert evt.data == {"thread_id": "t1", "prompt": "确认？", "amount": 5}


# ---------- 真实 LangGraph 图：挂起与恢复 ----------


def _hitl_graph() -> Any:
    """一个真会挂起的图：第一步问用户，拿到答复后写进结果。"""
    from langgraph.graph import END, START, StateGraph
    from langgraph.types import interrupt
    from typing_extensions import TypedDict

    class S(TypedDict, total=False):
        answer: str

    def ask(state: S) -> S:
        reply = interrupt({"prompt": "确认要下单吗？", "amount": 1200})
        return {"answer": f"用户回答：{reply}"}

    g = StateGraph(S)
    g.add_node("ask", ask)
    g.add_edge(START, "ask")
    g.add_edge("ask", END)
    return g.compile(checkpointer=build_checkpointer("memory"))


def test_graph_interrupts_then_resumes() -> None:
    """直接用 LangGraph API 验证我们对 interrupt/Command 的理解正确。"""
    graph = _hitl_graph()
    cfg = thread_config("t-direct")

    out = graph.invoke({}, config=cfg)
    assert "__interrupt__" in out  # 停在挂起点

    final = graph.invoke(resume_command("确认"), config=cfg)
    assert final["answer"] == "用户回答：确认"


def test_has_snapshot_reflects_state() -> None:
    graph = _hitl_graph()
    assert not has_snapshot(graph, "fresh-thread")
    graph.invoke({}, config=thread_config("used-thread"))
    assert has_snapshot(graph, "used-thread")


def test_has_snapshot_survives_probe_failure() -> None:
    class Boom:
        def get_state(self, cfg: Any) -> Any:
            raise RuntimeError("状态库不可用")

    assert not has_snapshot(Boom(), "t")


# ---------- 接进 runtime ----------


class _StreamingHitlGraph:
    """包一层，让 HITL 图具备 astream_events 与 get_state（runtime 需要）。"""

    def __init__(self) -> None:
        self._g = _hitl_graph()

    async def astream_events(self, inputs: Any, version: str = "v2", config: Any = None):  # type: ignore[no-untyped-def]
        async for e in self._g.astream_events(inputs, version=version, config=config):
            yield e

    def get_state(self, config: Any) -> Any:
        return self._g.get_state(config)


async def test_runtime_emits_user_interaction_on_hitl() -> None:
    """挂起时要发 USER_INTERACTION，并且照常收尾（DONE）——
    对前端来说这一轮结束了，只是结束在「等你回答」。"""
    agent = _StreamingHitlGraph()
    events = await _collect(run_agent_stream(agent, "帮我订票", thread_id="t-run"))

    kinds = [e.event for e in events]
    assert SSEEventType.USER_INTERACTION in kinds
    assert kinds[-1] == SSEEventType.DONE

    ask = next(e for e in events if e.event == SSEEventType.USER_INTERACTION)
    assert ask.data["prompt"] == "确认要下单吗？"
    assert ask.data["amount"] == 1200
    assert ask.data["thread_id"] == "t-run"


async def test_runtime_resumes_and_finishes() -> None:
    """带 resume 再来一轮，应跑完且不再挂起。"""
    agent = _StreamingHitlGraph()
    await _collect(run_agent_stream(agent, "帮我订票", thread_id="t-resume"))

    events = await _collect(run_agent_stream(agent, "", thread_id="t-resume", resume_value="确认"))
    kinds = [e.event for e in events]
    assert SSEEventType.USER_INTERACTION not in kinds  # 不再挂起
    assert kinds[-1] == SSEEventType.DONE

    state = agent.get_state(thread_config("t-resume"))
    assert state.values["answer"] == "用户回答：确认"


async def test_threads_are_isolated() -> None:
    """不同会话各自独立，A 的挂起不该影响 B。"""
    agent = _StreamingHitlGraph()
    await _collect(run_agent_stream(agent, "q", thread_id="A"))
    await _collect(run_agent_stream(agent, "q", thread_id="A", resume_value="确认"))

    events = await _collect(run_agent_stream(agent, "q", thread_id="B"))
    assert SSEEventType.USER_INTERACTION in [e.event for e in events]  # B 仍会挂起


async def test_no_thread_id_means_no_interrupt_probe() -> None:
    """不传 thread_id 时不查快照，行为与接 M4/M6 之前一致。"""

    class Plain:
        async def astream_events(self, inputs: Any, version: str = "v2"):  # type: ignore[no-untyped-def]
            yield {
                "event": "on_chat_model_stream",
                "data": {"chunk": type("C", (), {"content": "ok"})()},
            }

    events = await _collect(run_agent_stream(Plain(), "q"))
    kinds = [e.event for e in events]
    assert SSEEventType.USER_INTERACTION not in kinds
    assert kinds[-1] == SSEEventType.DONE


async def test_resolve_stream_passes_thread_through() -> None:
    agent = _StreamingHitlGraph()
    events = await _collect(resolve_stream("q", agent=agent, thread_id="t-resolve"))
    assert SSEEventType.USER_INTERACTION in [e.event for e in events]
