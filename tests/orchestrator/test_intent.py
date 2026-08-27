"""意图识别与路由测试：规则、向量(mock embedding)、三层短路、路由决策。"""

from __future__ import annotations

from app.orchestrator.intent.matchers import (
    RuleEntry,
    RuleMatcher,
    SeedExample,
    VectorMatcher,
)
from app.orchestrator.intent.models import (
    IntentCategory,
    IntentResult,
    IntentSource,
)
from app.orchestrator.pipeline import IntentPipeline

RULES = [
    RuleEntry(
        category=IntentCategory.DATA_ANALYSIS,
        keywords=["销售额", "统计", "报表", "多少"],
        patterns=[r"查.*数据"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_BOOKING,
        keywords=["订票", "订酒店", "预订"],
        patterns=[],
    ),
]


# ---------- L1 规则 ----------
def test_rule_keyword_hit() -> None:
    m = RuleMatcher(RULES)
    r = m.match("上月各部门销售额 Top5")
    assert r is not None
    assert r.category == IntentCategory.DATA_ANALYSIS
    assert r.source == IntentSource.RULE


def test_rule_pattern_hit() -> None:
    m = RuleMatcher(RULES)
    r = m.match("帮我查一下订单数据")
    assert r is not None
    assert r.category == IntentCategory.DATA_ANALYSIS


def test_rule_no_hit() -> None:
    assert RuleMatcher(RULES).match("今天天气怎么样") is None


# ---------- L2 向量（mock embedding） ----------
class FakeEmbedding:
    """把文本映射成简单向量：按关键词造正交向量，便于测相似度。"""

    def embed(self, text: str) -> list[float]:
        return [
            1.0 if "订" in text else 0.0,
            1.0 if ("数据" in text or "销售" in text) else 0.0,
        ]


def test_vector_match_hit() -> None:
    seeds = [
        SeedExample(category=IntentCategory.TRAVEL_BOOKING, text="订机票"),
        SeedExample(category=IntentCategory.DATA_ANALYSIS, text="销售数据"),
    ]
    vm = VectorMatcher(FakeEmbedding(), seeds, threshold=0.8)
    r = vm.match("我要订张票")
    assert r is not None
    assert r.category == IntentCategory.TRAVEL_BOOKING
    assert r.source == IntentSource.VECTOR


def test_vector_below_threshold() -> None:
    seeds = [SeedExample(category=IntentCategory.DATA_ANALYSIS, text="销售数据")]
    vm = VectorMatcher(FakeEmbedding(), seeds, threshold=0.9)
    # query 与种子正交 -> 相似度 0
    assert vm.match("订票") is None


# ---------- 三层短路 ----------
def test_pipeline_l1_shortcircuits() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES))
    r = pipe.recognize("统计销售额")
    assert r.source == IntentSource.RULE


def test_pipeline_falls_to_none_without_l2l3() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES))
    r = pipe.recognize("讲个笑话")
    assert r.source == IntentSource.NONE
    assert r.category == IntentCategory.GENERAL_CHAT


class FakeLLM:
    def classify(self, query: str) -> IntentResult:
        return IntentResult(
            category=IntentCategory.TRAVEL_INFO,
            source=IntentSource.LLM,
            confidence=0.7,
        )


def test_pipeline_l3_fallback() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES), llm_classifier=FakeLLM())
    r = pipe.recognize("出差有什么规定")
    assert r.source == IntentSource.LLM


# ---------- 路由决策 ----------
def test_route_direct_dispatch_on_high_confidence() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES))
    d = pipe.route("帮我订酒店")
    assert d.direct_dispatch
    assert d.target == IntentCategory.TRAVEL_BOOKING


def test_route_supervisor_on_low_confidence() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES), llm_classifier=FakeLLM())
    d = pipe.route("出差有什么规定")  # LLM 0.7 < 0.9
    assert not d.direct_dispatch


def test_route_general_chat_not_direct() -> None:
    pipe = IntentPipeline(RuleMatcher(RULES))
    d = pipe.route("讲个笑话")
    assert not d.direct_dispatch
