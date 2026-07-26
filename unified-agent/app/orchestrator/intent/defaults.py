"""默认意图规则（L1）。生产可从 intent-seed.yml 扩展；此处内置常用关键词。"""

from __future__ import annotations

from app.orchestrator.intent.matchers import RuleEntry, RuleMatcher
from app.orchestrator.intent.models import IntentCategory

DEFAULT_RULES: list[RuleEntry] = [
    RuleEntry(
        category=IntentCategory.DATA_ANALYSIS,
        keywords=["统计", "报表", "多少", "销售额", "占比", "环比", "同比", "排名", "趋势"],
        patterns=[r"查.*数据", r"分析.*数据", r"各.{0,6}(部门|地区|月).*(总|数|额)"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_BOOKING,
        keywords=["订票", "订机票", "订酒店", "预订", "出票", "订火车"],
        patterns=[],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_MANAGE,
        keywords=["差旅单", "出差申请", "我的差旅", "取消差旅"],
        patterns=[r"申请.*出差", r"出差.*申请"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_PLAN,
        keywords=["行程", "规划路线", "怎么安排"],
        patterns=[],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_INFO,
        keywords=["差旅政策", "报销标准", "签证", "景点"],
        patterns=[r"(出差|差旅).*(规定|政策|标准)"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_REIMBURSE,
        keywords=["报销", "发票", "报销单"],
        patterns=[],
    ),
]


def default_rule_matcher() -> RuleMatcher:
    return RuleMatcher(DEFAULT_RULES)
