"""默认意图规则（L1）。

规则正本已外置到 intent-seed.yml（见 seed.py），改覆盖不必改代码。
本模块保留一份**最小内置兜底**：种子文件缺失/损坏时仍能识别核心意图，
不至于整条链路退化成 general。
"""

from __future__ import annotations

from app.core.logging import get_logger
from app.orchestrator.intent.matchers import RuleEntry, RuleMatcher
from app.orchestrator.intent.models import IntentCategory
from app.orchestrator.intent.seed import load_rules

logger = get_logger(__name__)

# 兜底规则：只保核心动宾，正式覆盖见 intent-seed.yml
FALLBACK_RULES: list[RuleEntry] = [
    RuleEntry(
        category=IntentCategory.DATA_ANALYSIS,
        keywords=["统计", "报表", "销售额", "占比", "环比", "同比", "排名", "趋势"],
        patterns=[r"查.{0,8}数据", r"分析.{0,8}数据"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_BOOKING,
        keywords=["订票", "订机票", "订酒店", "预订", "出票", "订火车"],
        patterns=[r"(订|定|预订|预定).{0,12}(机票|车票|火车票|高铁|酒店)"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_MANAGE,
        keywords=["差旅单", "出差申请", "我的差旅", "取消差旅"],
        patterns=[r"申请.{0,6}出差", r"出差.{0,6}申请"],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_PLAN,
        keywords=["行程", "规划路线", "怎么安排"],
        patterns=[],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_INFO,
        keywords=["差旅政策", "报销标准", "签证", "景点", "城市指南"],
        patterns=[
            r"(出差|差旅).{0,8}(规定|政策|标准)",
            r"(出差|差旅|去|到).{0,6}(天气|气象|气温)",
            r"(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆).{0,4}(天气|气象|气温)",
        ],
    ),
    RuleEntry(
        category=IntentCategory.TRAVEL_REIMBURSE,
        keywords=["报销", "发票", "报销单"],
        patterns=[],
    ),
]

# 兼容旧引用
DEFAULT_RULES = FALLBACK_RULES


def default_rule_matcher() -> RuleMatcher:
    """构建 L1 匹配器：优先用外置种子，缺失时退回内置兜底。"""
    rules = load_rules()
    if not rules:
        logger.error("intent_seed_empty_use_fallback")
        rules = FALLBACK_RULES
    return RuleMatcher(rules)
