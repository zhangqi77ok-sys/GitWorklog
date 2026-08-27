"""意图种子加载(O-4) + 规则覆盖与优先级(O-1) 回归测试。

针对性回归：此前 RuleMatcher 按列表顺序取首个命中，DATA_ANALYSIS 排在前
且含泛词「多少」，导致「订机票多少钱」被判成数据分析；而「订去上海的机票」
因为关键词是子串匹配的「订机票」而完全漏判 → 请求根本到不了差旅域。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.orchestrator.intent.defaults import FALLBACK_RULES, default_rule_matcher
from app.orchestrator.intent.matchers import RuleEntry, RuleMatcher
from app.orchestrator.intent.models import IntentCategory
from app.orchestrator.intent.seed import (
    DEFAULT_SEED_PATH,
    build_rule_matcher,
    load_raw,
    load_rules,
    load_seed_examples,
    seed_path,
)

# ---------- O-4 种子加载 ----------


def test_default_seed_file_exists_and_parses() -> None:
    raw = load_raw(DEFAULT_SEED_PATH)
    assert raw.get("rules"), "种子文件必须含 rules 段"
    assert raw.get("seeds"), "种子文件必须含 seeds 段"


def test_load_rules_covers_all_business_categories() -> None:
    cats = {r.category for r in load_rules()}
    # 6 个业务意图都要有规则，否则该意图永远走不到
    assert cats == {
        IntentCategory.DATA_ANALYSIS,
        IntentCategory.TRAVEL_BOOKING,
        IntentCategory.TRAVEL_MANAGE,
        IntentCategory.TRAVEL_PLAN,
        IntentCategory.TRAVEL_INFO,
        IntentCategory.TRAVEL_REIMBURSE,
    }


def test_load_seed_examples_are_categorised() -> None:
    seeds = load_seed_examples()
    assert len(seeds) >= 6
    assert all(s.text and s.vector is None for s in seeds)  # 向量交给 VectorMatcher 懒算


def test_env_override_seed_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    custom = tmp_path / "custom.yml"
    custom.write_text(
        "rules:\n  - category: data_analysis\n    keywords: ['独有词']\n    patterns: []\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("INTENT_SEED_PATH", str(custom))

    assert seed_path() == custom
    rules = load_rules()
    assert len(rules) == 1
    assert rules[0].keywords == ["独有词"]


def test_broken_seed_falls_back_to_default(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """运维改坏 YAML 不能让意图识别整体失效。"""
    broken = tmp_path / "broken.yml"
    broken.write_text("rules: [[[", encoding="utf-8")
    monkeypatch.setenv("INTENT_SEED_PATH", str(broken))

    rules = load_rules()
    assert len(rules) > 1  # 回退到了包内默认表


def test_unknown_category_skipped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    f = tmp_path / "x.yml"
    f.write_text(
        "rules:\n"
        "  - category: not_a_real_intent\n    keywords: ['x']\n    patterns: []\n"
        "  - category: data_analysis\n    keywords: ['统计']\n    patterns: []\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("INTENT_SEED_PATH", str(f))
    rules = load_rules()
    assert [r.category for r in rules] == [IntentCategory.DATA_ANALYSIS]


def test_missing_file_returns_empty_and_defaults_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTENT_SEED_PATH", "/nonexistent/nope.yml")
    # 回退到包内默认；default_rule_matcher 因此仍可用
    assert default_rule_matcher().match("统计销售额") is not None


# ---------- O-1 优先级与覆盖 ----------


def test_specific_keyword_beats_generic_one() -> None:
    """回归：泛词「多少」不得盖过具体词「订机票」。"""
    m = default_rule_matcher()
    r = m.match("订机票多少钱")
    assert r is not None
    assert r.category == IntentCategory.TRAVEL_BOOKING


def test_ordering_independent_of_rule_list_position() -> None:
    """同样的查询，规则顺序颠倒也应得到同一结果。"""
    a = RuleEntry(IntentCategory.DATA_ANALYSIS, ["多少"], [])
    b = RuleEntry(IntentCategory.TRAVEL_BOOKING, ["订机票"], [])
    assert RuleMatcher([a, b]).match("订机票多少钱") == RuleMatcher([b, a]).match("订机票多少钱")


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        # 动宾被修饰语拆开——纯关键词必漏，靠正则兜住
        ("帮我订去上海的机票", IntentCategory.TRAVEL_BOOKING),
        ("帮我买一张去北京的高铁票", IntentCategory.TRAVEL_BOOKING),
        ("预定明天的酒店", IntentCategory.TRAVEL_BOOKING),
        ("申请下周去上海出差", IntentCategory.TRAVEL_MANAGE),
        ("取消我的差旅单", IntentCategory.TRAVEL_MANAGE),
        ("我要提交这次出差的报销", IntentCategory.TRAVEL_REIMBURSE),
        ("出差能住什么标准的酒店", IntentCategory.TRAVEL_INFO),
        ("帮我安排一下这次出差的行程", IntentCategory.TRAVEL_PLAN),
        ("统计各部门销售额", IntentCategory.DATA_ANALYSIS),
        ("一共有多少条订单", IntentCategory.DATA_ANALYSIS),
        ("分析一下订单数据", IntentCategory.DATA_ANALYSIS),
    ],
)
def test_rule_coverage(query: str, expected: IntentCategory) -> None:
    r = default_rule_matcher().match(query)
    assert r is not None, f"漏判：{query}"
    assert r.category == expected, f"{query} 判成了 {r.category}"


def test_unrelated_query_still_misses() -> None:
    """扩大覆盖不能把无关问题也吸进来。"""
    for q in ["今天天气怎么样", "讲个笑话", "你是谁"]:
        assert default_rule_matcher().match(q) is None, f"误命中：{q}"


def test_fallback_rules_usable_standalone() -> None:
    """种子文件不可用时的兜底表本身要能识别核心意图。"""
    m = RuleMatcher(FALLBACK_RULES)
    assert m.match("统计销售额") is not None
    assert m.match("帮我订去上海的机票") is not None


def test_build_rule_matcher_helper() -> None:
    assert build_rule_matcher().match("帮我订酒店") is not None
