"""差旅政策规则引擎（对应 gogo 的 TravelPolicyService，纯逻辑）。

按职级 × 城市等级判定预算/舱位是否合规。规则可来自 DB(TravelPolicyRule)，
此处对已加载的规则集做纯计算，便于测试。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PolicyKey:
    job_level: str
    city_tier: int


@dataclass
class PolicyLimit:
    hotel_budget: int  # 每晚上限（分）
    flight_class: str  # economy / business / first


@dataclass
class PolicyCheckResult:
    compliant: bool
    reasons: list[str]


class TravelPolicyEngine:
    def __init__(self, rules: dict[PolicyKey, PolicyLimit]) -> None:
        self.rules = rules

    def limit_for(self, job_level: str, city_tier: int) -> PolicyLimit | None:
        return self.rules.get(PolicyKey(job_level, city_tier))

    def check(
        self,
        job_level: str,
        city_tier: int,
        hotel_price: int,
        flight_class: str,
    ) -> PolicyCheckResult:
        limit = self.limit_for(job_level, city_tier)
        reasons: list[str] = []
        if limit is None:
            return PolicyCheckResult(False, [f"无 {job_level}/{city_tier}级城市 的政策规则"])
        if hotel_price > limit.hotel_budget:
            reasons.append(f"酒店 {hotel_price} 超过预算上限 {limit.hotel_budget}")
        if _class_rank(flight_class) > _class_rank(limit.flight_class):
            reasons.append(f"舱位 {flight_class} 超过允许的 {limit.flight_class}")
        return PolicyCheckResult(len(reasons) == 0, reasons)


def _class_rank(flight_class: str) -> int:
    return {"economy": 1, "business": 2, "first": 3}.get(flight_class.lower(), 1)
