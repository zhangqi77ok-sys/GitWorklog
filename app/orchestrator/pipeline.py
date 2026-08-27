"""编排 pipeline（对应 gogo 的 AgentPipelineService）。

流程：查询改写(可选) → 三层意图识别(L1规则→L2向量→L3 LLM) → 路由决策。
决策：单意图高置信 → 直跳目标；否则 → 交 Supervisor 兜底。

L2/L3 依赖 live（embedding/LLM），通过接口注入，纯决策逻辑可离线测试。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.orchestrator.intent.matchers import RuleMatcher, VectorMatcher
from app.orchestrator.intent.models import IntentCategory, IntentResult, IntentSource
from app.orchestrator.rewriter import QueryRewriter

DIRECT_DISPATCH_THRESHOLD = 0.9


class LLMIntentClassifier(Protocol):
    """L3 兜底分类器。live 由模型实现，测试可 mock/省略。"""

    def classify(self, query: str) -> IntentResult: ...


@dataclass
class RouteDecision:
    intent: IntentResult
    direct_dispatch: bool  # True 直跳目标 Agent；False 交 Supervisor
    target: IntentCategory
    query: str = ""  # 实际用于识别的查询（可能已被改写）


class IntentPipeline:
    def __init__(
        self,
        rule_matcher: RuleMatcher,
        vector_matcher: VectorMatcher | None = None,
        llm_classifier: LLMIntentClassifier | None = None,
        query_rewriter: QueryRewriter | None = None,
    ) -> None:
        self.rule_matcher = rule_matcher
        self.vector_matcher = vector_matcher
        self.llm_classifier = llm_classifier
        self.query_rewriter = query_rewriter

    def recognize(self, query: str) -> IntentResult:
        """三层短路：L1 命中即返回，否则 L2，再否则 L3，最后 NONE。"""
        r = self.rule_matcher.match(query)
        if r is not None:
            return r
        if self.vector_matcher is not None:
            r = self.vector_matcher.match(query)
            if r is not None:
                return r
        if self.llm_classifier is not None:
            return self.llm_classifier.classify(query)
        return IntentResult.none()

    def rewrite(self, query: str, history: list[dict[str, str]] | None = None) -> str:
        """O-5：借上文把指代/省略补全。未配改写器或无历史时原样返回。"""
        if self.query_rewriter is None or not history:
            return query
        try:
            return self.query_rewriter.rewrite(query, history)
        except Exception:  # 宽捕获是刻意的：改写是增强，失败退回原句
            return query

    def route(self, query: str, history: list[dict[str, str]] | None = None) -> RouteDecision:
        effective = self.rewrite(query, history)
        intent = self.recognize(effective)
        direct = (
            intent.source != IntentSource.NONE
            and intent.confidence >= DIRECT_DISPATCH_THRESHOLD
            and intent.category != IntentCategory.GENERAL_CHAT
        )
        return RouteDecision(
            intent=intent,
            direct_dispatch=direct,
            target=intent.category,
            query=effective,
        )
