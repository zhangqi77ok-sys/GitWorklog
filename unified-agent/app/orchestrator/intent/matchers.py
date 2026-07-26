"""意图匹配器：L1 规则、L2 向量（embedding provider 抽象，可 mock 测试）。

L3 LLM 兜底需 live 模型，作为接口在 pipeline 注入。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.orchestrator.intent.models import (
    IntentCategory,
    IntentResult,
    IntentSource,
)


@dataclass
class RuleEntry:
    category: IntentCategory
    keywords: list[str]  # 命中任一关键词
    patterns: list[str]  # 命中任一正则


class RuleMatcher:
    """L1：关键词/正则匹配，最快（<50ms 级）。命中即高置信。"""

    def __init__(self, entries: list[RuleEntry]) -> None:
        self.entries = entries
        self._compiled = [(e, [re.compile(p, re.IGNORECASE) for p in e.patterns]) for e in entries]

    def match(self, query: str) -> IntentResult | None:
        q = query.lower()
        for entry, regexes in self._compiled:
            if any(kw.lower() in q for kw in entry.keywords):
                return IntentResult(
                    category=entry.category,
                    source=IntentSource.RULE,
                    confidence=0.95,
                )
            if any(rx.search(query) for rx in regexes):
                return IntentResult(
                    category=entry.category,
                    source=IntentSource.RULE,
                    confidence=0.9,
                )
        return None


class EmbeddingProvider(Protocol):
    """向量化接口。live 由 DashScope 适配器实现，测试用 mock。"""

    def embed(self, text: str) -> list[float]: ...


@dataclass
class SeedExample:
    category: IntentCategory
    text: str
    vector: list[float] | None = None  # 预计算或懒计算


class VectorMatcher:
    """L2：与种子语料求余弦相似度取 Top-1。"""

    def __init__(
        self,
        provider: EmbeddingProvider,
        seeds: list[SeedExample],
        threshold: float = 0.82,
    ) -> None:
        self.provider = provider
        self.threshold = threshold
        self.seeds = seeds
        for s in self.seeds:
            if s.vector is None:
                s.vector = provider.embed(s.text)

    def match(self, query: str) -> IntentResult | None:
        qv = self.provider.embed(query)
        best: tuple[float, IntentCategory] | None = None
        for s in self.seeds:
            assert s.vector is not None
            score = _cosine(qv, s.vector)
            if best is None or score > best[0]:
                best = (score, s.category)
        if best is None or best[0] < self.threshold:
            return None
        return IntentResult(
            category=best[1],
            source=IntentSource.VECTOR,
            confidence=round(best[0], 4),
        )


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))
