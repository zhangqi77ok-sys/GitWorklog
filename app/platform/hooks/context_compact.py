"""H3 上下文压缩（platform/memory/base.py 的模块说明点名要这个）。

超过阈值时保留「首条 system + 最近 keep_recent 条」，中间段交给 Summarizer 压成一条
system 摘要。Summarizer 是 Protocol：live 用模型做真摘要，缺模型时用截断实现兜底，
保证无 Key 也能工作。

纯逻辑，不碰 IO，可完整离线测试。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

# 会话消息的最小结构：{"role": "user"|"assistant"|"system", "content": "..."}
Message = dict[str, str]


@dataclass
class ContextPolicy:
    max_chars: int = 8000  # 全部消息内容总长超过此值才压缩
    keep_recent: int = 6  # 末尾保留的原文条数


class Summarizer(Protocol):
    """把若干条消息压成一段摘要文本。live 实现调模型。"""

    def summarize(self, messages: list[Message]) -> str: ...


@dataclass
class TruncateSummarizer:
    """无模型时的兜底：拼接后按 limit 截断，保留可读的角色前缀。"""

    limit: int = 500

    def summarize(self, messages: list[Message]) -> str:
        joined = " / ".join(f"{m.get('role', '?')}:{m.get('content', '')}" for m in messages)
        if len(joined) <= self.limit:
            return joined
        return joined[: self.limit] + "…（已截断）"


def total_chars(messages: list[Message]) -> int:
    return sum(len(m.get("content", "")) for m in messages)


def compact(
    messages: list[Message],
    policy: ContextPolicy | None = None,
    summarizer: Summarizer | None = None,
) -> list[Message]:
    """按策略压缩消息列表。未超阈值时原样返回（同一个 list 对象不保证）。

    结构：[首条 system(若有)] + [摘要 system] + [最近 keep_recent 条]
    """
    policy = policy or ContextPolicy()
    summarizer = summarizer or TruncateSummarizer()

    if total_chars(messages) <= policy.max_chars:
        return list(messages)

    head: list[Message] = []
    body = list(messages)
    if body and body[0].get("role") == "system":
        head = [body[0]]
        body = body[1:]

    if policy.keep_recent <= 0:
        recent: list[Message] = []
        middle = body
    else:
        recent = body[-policy.keep_recent :]
        middle = body[: -policy.keep_recent]

    if not middle:
        # 近期消息自身就超了阈值，无中间段可压——保持原样，不做破坏性丢弃
        return head + recent

    summary = summarizer.summarize(middle)
    return [*head, {"role": "system", "content": f"[历史摘要] {summary}"}, *recent]
