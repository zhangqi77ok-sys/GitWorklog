"""P1-M4 中断/续跑 + P1-M6 HITL：基于 LangGraph checkpointer 的会话快照。

两个特性共用一套机制，因此放在一起：
- M4 中断续跑：Agent 跑到一半被中断（用户点停 / 进程重启），状态存在
  checkpointer 里，下次带同一个 thread_id 就能接着跑
- M6 HITL：Agent 需要用户拿主意时调 interrupt() 挂起，我们把问题作为
  USER_INTERACTION 事件推给前端；用户回答后用 Command(resume=...) 恢复

thread_id 用会话 id：同一个对话天然就是同一条执行线索。

checkpointer 的选择是有取舍的：InMemorySaver 进程重启即丢，只够单机开发；
生产要用 Postgres/Redis 版（需 live，见 NEEDS_LIVE.md）。这里抽象成工厂，
默认给内存实现，不假装已经能跨进程续跑。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.logging import get_logger
from app.platform.sse.events import SSEEvent, SSEEventType

logger = get_logger(__name__)


def build_checkpointer(kind: str = "memory") -> Any:
    """构建 checkpointer。

    memory：单机内存，进程重启即丢——够用于开发与单节点。
    其他值暂未实现，显式抛错而不是静默退回内存，
    否则生产上会以为自己有持久化其实没有。
    """
    if kind == "memory":
        from langgraph.checkpoint.memory import InMemorySaver

        return InMemorySaver()
    raise ValueError(
        f"暂不支持的 checkpointer 类型：{kind}（生产用 Postgres 版，见 NEEDS_LIVE.md）"
    )


def thread_config(thread_id: str) -> dict[str, Any]:
    """LangGraph 按 configurable.thread_id 定位快照。"""
    return {"configurable": {"thread_id": thread_id}}


@dataclass
class PendingInterrupt:
    """一次等待用户输入的挂起。"""

    thread_id: str
    prompt: str
    payload: dict[str, Any]

    def to_event(self) -> SSEEvent:
        return SSEEvent(
            event=SSEEventType.USER_INTERACTION,
            data={
                "thread_id": self.thread_id,
                "prompt": self.prompt,
                **self.payload,
            },
        )


def extract_interrupt(state: Any, thread_id: str) -> PendingInterrupt | None:
    """从 Agent 返回值里识别 HITL 挂起。

    LangGraph 把中断信息放在结果的 "__interrupt__" 键下。
    形状随版本有出入，因此解析写得宽松：取第一个中断的 value，
    是 dict 就找 prompt/question/message，否则整体转成文本。
    """
    if not isinstance(state, dict):
        return None
    interrupts = state.get("__interrupt__")
    if not interrupts:
        return None

    first = interrupts[0] if isinstance(interrupts, list | tuple) else interrupts
    value = getattr(first, "value", first)

    if isinstance(value, dict):
        prompt = str(
            value.get("prompt") or value.get("question") or value.get("message") or "需要你的确认"
        )
        payload = {k: v for k, v in value.items() if k not in {"prompt", "question", "message"}}
    else:
        prompt = str(value)
        payload = {}

    logger.info("hitl_interrupt", thread_id=thread_id, prompt=prompt[:80])
    return PendingInterrupt(thread_id=thread_id, prompt=prompt, payload=payload)


def resume_command(value: Any) -> Any:
    """把用户的答复包成 LangGraph 的恢复指令。"""
    from langgraph.types import Command

    return Command(resume=value)


def has_snapshot(agent: Any, thread_id: str) -> bool:
    """该 thread 是否已有快照（决定续跑还是新开一轮）。

    判据是 checkpoint 本身存在（created_at / checkpoint_id），**不能**看 values——
    图在第一个节点就挂起时 values 还是空的，但快照确实已经写下了，
    按 values 判会把「正等用户回答」误当成「没跑过」。
    """
    try:
        state = agent.get_state(thread_config(thread_id))
    except Exception as exc:  # 宽捕获是刻意的：探测失败按「无快照」处理
        logger.warning("snapshot_probe_failed", thread_id=thread_id, error=str(exc))
        return False
    if getattr(state, "created_at", None):
        return True
    config = getattr(state, "config", None) or {}
    return bool(config.get("configurable", {}).get("checkpoint_id"))
