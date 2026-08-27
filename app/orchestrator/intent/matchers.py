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
    """L1：关键词/正则匹配，最快（<50ms 级）。命中即高置信。

    按「特异度」择优而非按列表顺序取首个命中：命中越长的关键词说明越具体。
    先前的首个命中即返回会误判——DATA_ANALYSIS 排在前且含泛词「多少」，
    于是「订机票多少钱」会被判成数据分析，请求根本到不了差旅域。
    """

    def __init__(self, entries: list[RuleEntry]) -> None:
        self.entries = entries
        self._compiled = [(e, [re.compile(p, re.IGNORECASE) for p in e.patterns]) for e in entries]

    def match(self, query: str) -> IntentResult | None:
        q = query.lower()
        best: tuple[int, float, IntentCategory] | None = None  # (特异度, 置信度, 类别)

        for entry, regexes in self._compiled:
            hits = [kw for kw in entry.keywords if kw.lower() in q]
            if hits:
                # 最长命中关键词的长度作为特异度：「订机票」(3) 胜过「多少」(2)
                score = max(len(kw) for kw in hits)
                if best is None or score > best[0]:
                    best = (score, 0.95, entry.category)
                continue
            matched = [rx for rx in regexes if rx.search(query)]
            if matched:
                # 正则通常比裸关键词更具体，特异度用实际匹配到的文本长度
                score = max(len(m.group(0)) for m in (rx.search(query) for rx in matched) if m)
                if best is None or score > best[0]:
                    best = (score, 0.9, entry.category)

        if best is None:
            return None
        return IntentResult(category=best[2], source=IntentSource.RULE, confidence=best[1])


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
