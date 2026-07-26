"""O-3 L3 LLM 兜底 + O-5 查询改写测试（均用 fake 模型，不需 live）。"""

from __future__ import annotations

import pytest

from app.orchestrator.intent.defaults import default_rule_matcher
from app.orchestrator.intent.llm_classifier import LLMIntentClassifierImpl, _parse
from app.orchestrator.intent.models import IntentCategory, IntentSource
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.rewriter import (
    MAX_REWRITE_CHARS,
    LLMQueryRewriter,
    needs_rewrite,
)


class FakeResp:
    def __init__(self, content: str) -> None:
        self.content = content


class FakeModel:
    def __init__(self, reply: str) -> None:
        self.reply = reply
        self.prompts: list[str] = []

    def invoke(self, prompt: str) -> FakeResp:
        self.prompts.append(prompt)
        return FakeResp(self.reply)


class BoomModel:
    def invoke(self, prompt: str) -> FakeResp:
        raise RuntimeError("模型超时")


# ---------- O-3 解析 ----------


@pytest.mark.parametrize(
    ("raw", "cat", "conf"),
    [
        ("travel_booking|0.85", IntentCategory.TRAVEL_BOOKING, 0.85),
        ("data_analysis|0.9", IntentCategory.DATA_ANALYSIS, 0.9),
        # 模型爱加解释/空格/换行，解析要宽松
        (
            "类别：travel_reimburse | 置信度 0.7\n因为提到了发票",
            IntentCategory.TRAVEL_REIMBURSE,
            0.7,
        ),
        ("travel_info (0.65)", IntentCategory.TRAVEL_INFO, 0.65),
        ("general_chat|0.3", IntentCategory.GENERAL_CHAT, 0.3),
    ],
)
def test_parse_tolerates_messy_output(raw: str, cat: IntentCategory, conf: float) -> None:
    assert _parse(raw) == (cat, conf)


def test_parse_clamps_out_of_range_confidence() -> None:
    assert _parse("travel_plan|5")[1] <= 1.0


def test_parse_unrecognisable_falls_back() -> None:
    assert _parse("我不知道") == (IntentCategory.GENERAL_CHAT, 0.0)


# ---------- O-3 分类器 ----------


def test_classifier_returns_llm_source() -> None:
    c = LLMIntentClassifierImpl(model=FakeModel("travel_booking|0.85"))
    r = c.classify("给我整个去三亚的座儿")
    assert r.category == IntentCategory.TRAVEL_BOOKING
    assert r.source == IntentSource.LLM
    assert r.confidence == 0.85


def test_classifier_degrades_without_model() -> None:
    """无模型 Key 时返回 NONE，而不是抛错。"""
    c = LLMIntentClassifierImpl()
    c.model = None
    c._resolved = True
    assert c.classify("随便问问").source == IntentSource.NONE


def test_classifier_swallows_model_error() -> None:
    """兜底层自己挂了应静默退化，不能让整条链路 500。"""
    c = LLMIntentClassifierImpl(model=BoomModel())
    assert c.classify("x").source == IntentSource.NONE


def test_classifier_unparseable_returns_none() -> None:
    c = LLMIntentClassifierImpl(model=FakeModel("嗯……说不好"))
    assert c.classify("x").source == IntentSource.NONE


# ---------- O-3 接进三层短路 ----------


def test_l3_only_runs_when_l1_misses() -> None:
    model = FakeModel("travel_booking|0.95")
    pipe = IntentPipeline(default_rule_matcher(), llm_classifier=LLMIntentClassifierImpl(model))

    r = pipe.recognize("帮我订机票")  # L1 命中
    assert r.source == IntentSource.RULE
    assert model.prompts == []  # 没白花模型调用

    r2 = pipe.recognize("给我整个去三亚的座儿")  # L1 漏，落 L3
    assert r2.source == IntentSource.LLM
    assert len(model.prompts) == 1


def test_confident_llm_result_can_direct_dispatch() -> None:
    """L3 高置信同样可直跳——直跳判定对三层来源用同一套标准。"""
    pipe = IntentPipeline(
        default_rule_matcher(),
        llm_classifier=LLMIntentClassifierImpl(FakeModel("travel_booking|0.95")),
    )
    assert pipe.route("给我整个去三亚的座儿").direct_dispatch


def test_unsure_llm_result_does_not_direct_dispatch() -> None:
    pipe = IntentPipeline(
        default_rule_matcher(),
        llm_classifier=LLMIntentClassifierImpl(FakeModel("travel_booking|0.4")),
    )
    assert not pipe.route("给我整个去三亚的座儿").direct_dispatch


# ---------- O-5 needs_rewrite 门槛 ----------


def test_no_history_never_rewrites() -> None:
    assert not needs_rewrite("它多少钱", [])


def test_pronoun_with_history_triggers() -> None:
    hist = [{"role": "user", "content": "帮我订去上海的机票"}]
    assert needs_rewrite("它多少钱", hist)


def test_bare_followup_triggers() -> None:
    hist = [{"role": "user", "content": "帮我订去上海的机票"}]
    assert needs_rewrite("多少钱", hist)
    assert needs_rewrite("什么时候", hist)


def test_self_contained_query_skipped() -> None:
    """自足的长句不该白调模型。"""
    hist = [{"role": "user", "content": "上一句"}]
    assert not needs_rewrite("帮我订一张明天下午去上海虹桥的高铁票", hist)


def test_long_query_skipped() -> None:
    hist = [{"role": "user", "content": "上一句"}]
    assert not needs_rewrite("它" + "啊" * MAX_REWRITE_CHARS, hist)


# ---------- O-5 改写器 ----------


def test_rewriter_expands_reference() -> None:
    model = FakeModel("去上海的机票多少钱")
    hist = [{"role": "user", "content": "帮我订去上海的机票"}]
    assert LLMQueryRewriter(model=model).rewrite("它多少钱", hist) == "去上海的机票多少钱"
    assert "帮我订去上海的机票" in model.prompts[0]  # 历史确实进了 prompt


def test_rewriter_takes_first_nonempty_line() -> None:
    """模型爱回多行解释，只取第一行有效内容。"""
    model = FakeModel("\n去上海的机票多少钱\n（这里补全了指代）")
    hist = [{"role": "user", "content": "订机票"}]
    assert LLMQueryRewriter(model=model).rewrite("它多少钱", hist) == "去上海的机票多少钱"


def test_rewriter_skips_model_when_not_needed() -> None:
    model = FakeModel("不该被调用")
    out = LLMQueryRewriter(model=model).rewrite("统计各部门销售额", [{"role": "user", "c": "x"}])
    assert out == "统计各部门销售额"
    assert model.prompts == []


def test_rewriter_falls_back_on_error() -> None:
    hist = [{"role": "user", "content": "订机票"}]
    assert LLMQueryRewriter(model=BoomModel()).rewrite("它多少钱", hist) == "它多少钱"


def test_rewriter_limits_history_size() -> None:
    model = FakeModel("补全后的问题")
    hist = [{"role": "user", "content": f"第{i}轮"} for i in range(20)]
    LLMQueryRewriter(model=model, max_history=3).rewrite("它呢", hist)
    prompt = model.prompts[0]
    assert "第19轮" in prompt
    assert "第10轮" not in prompt  # 只带最近 3 轮


# ---------- O-5 接进 pipeline ----------


def test_pipeline_routes_on_rewritten_query() -> None:
    """改写后才有意图信号——这正是 O-5 的价值。"""
    hist = [{"role": "user", "content": "帮我订去上海的机票"}]
    plain = IntentPipeline(default_rule_matcher())
    assert plain.route("它多少钱", history=hist).target == IntentCategory.GENERAL_CHAT

    with_rewrite = IntentPipeline(
        default_rule_matcher(),
        query_rewriter=LLMQueryRewriter(model=FakeModel("去上海的机票多少钱")),
    )
    d = with_rewrite.route("它多少钱", history=hist)
    assert d.query == "去上海的机票多少钱"
    assert d.target == IntentCategory.TRAVEL_BOOKING


def test_pipeline_without_rewriter_unchanged() -> None:
    d = IntentPipeline(default_rule_matcher()).route("帮我订机票")
    assert d.query == "帮我订机票"
