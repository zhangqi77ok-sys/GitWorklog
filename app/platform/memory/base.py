"""记忆抽象（融合 gogo AutoContext + dodo SemanticMemory）。

统一后端为语义记忆(PgVector)，此处定义 Protocol + 内存实现（测试用）。
生产实现 PgVectorMemoryStore 在 store.py（需 live，标注）。
短期上下文压缩由 hooks/context_compact 处理。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class MemoryItem:
    user_id: int
    content: str
    score: float = 0.0  # 检索相关度


class MemoryStore(Protocol):
    """跨会话语义记忆存取。按 userId 隔离。"""

    def add(self, user_id: int, content: str) -> None: ...
    def search(self, user_id: int, query: str, top_k: int = 5) -> list[MemoryItem]: ...


@dataclass
class InMemoryMemoryStore:
    """测试用内存实现：子串命中计分，不做真实向量检索。"""

    _data: dict[int, list[str]] = field(default_factory=dict)

    def add(self, user_id: int, content: str) -> None:
        self._data.setdefault(user_id, []).append(content)

    def search(self, user_id: int, query: str, top_k: int = 5) -> list[MemoryItem]:
        items = self._data.get(user_id, [])
        scored = [MemoryItem(user_id=user_id, content=c, score=_overlap(query, c)) for c in items]
        scored = [s for s in scored if s.score > 0]
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]


def _overlap(query: str, content: str) -> float:
    qs = set(query)
    cs = set(content)
    if not qs:
        return 0.0
    return len(qs & cs) / len(qs)
