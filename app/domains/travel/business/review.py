"""T-9 行程审核六维引擎：把散落的校验汇成一份结构化审核结论。

六维：完整性 / 政策合规 / 预算 / 时间冲突 / 跨城衔接 / 个人偏好。
前五维是硬约束（不过就该拦），偏好是软提示（只降分不拦）。

设计取舍：每一维独立产出 DimensionResult，**不在第一个失败处短路**——
审核报告要一次说清所有问题，否则用户改一条提交一次，来回好几轮。

这层只做判定不碰 DB：所有输入由调用方备齐，因此可完整离线测试。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from app.domains.travel.business.policy import TravelPolicyEngine
from app.domains.travel.business.transit import CityTransit, Segment, find_transit_conflicts


class Dimension(StrEnum):
    COMPLETENESS = "completeness"  # 必填项是否齐全
    POLICY = "policy"  # 职级×城市的舱位/房价合规
    BUDGET = "budget"  # 总额是否超预算
    CONFLICT = "conflict"  # 与既有行程时间重叠
    TRANSIT = "transit"  # 跨城衔接是否来得及
    PREFERENCE = "preference"  # 个人偏好（软）


# 偏好是软维度：不满足只提示，不影响通过与否
_SOFT = {Dimension.PREFERENCE}


@dataclass
class DimensionResult:
    dimension: Dimension
    passed: bool
    reasons: list[str] = field(default_factory=list)


@dataclass
class ReviewResult:
    dimensions: list[DimensionResult] = field(default_factory=list)

    @property
    def approved(self) -> bool:
        """所有硬维度都通过才算过。"""
        return all(d.passed for d in self.dimensions if d.dimension not in _SOFT)

    @property
    def blocking_reasons(self) -> list[str]:
        out: list[str] = []
        for d in self.dimensions:
            if d.dimension not in _SOFT and not d.passed:
                out.extend(d.reasons)
        return out

    @property
    def advisories(self) -> list[str]:
        out: list[str] = []
        for d in self.dimensions:
            if d.dimension in _SOFT and not d.passed:
                out.extend(d.reasons)
        return out

    def summary(self) -> str:
        head = "审核通过" if self.approved else "审核未通过"
        lines = [head]
        for r in self.blocking_reasons:
            lines.append(f"  ✗ {r}")
        for a in self.advisories:
            lines.append(f"  · {a}")
        return "\n".join(lines)


@dataclass
class TripDraft:
    """待审行程。字段留空即视为缺失，由完整性维度报出。"""

    origin: str = ""
    destination: str = ""
    start_date: str = ""
    end_date: str = ""
    job_level: str = ""
    city_tier: int = 0
    hotel_price: int = 0  # 每晚，分
    flight_class: str = ""
    total_amount: int = 0  # 分
    budget_limit: int | None = None  # 分；None 表示不校验总额
    preferences: dict[str, str] = field(default_factory=dict)


def _check_completeness(draft: TripDraft) -> DimensionResult:
    missing = [
        label
        for label, value in (
            ("出发地", draft.origin),
            ("目的地", draft.destination),
            ("出发日期", draft.start_date),
            ("返回日期", draft.end_date),
            ("职级", draft.job_level),
        )
        if not str(value).strip()
    ]
    if draft.city_tier <= 0:
        missing.append("城市等级")
    if missing:
        return DimensionResult(Dimension.COMPLETENESS, False, [f"缺少必填项：{'、'.join(missing)}"])
    return DimensionResult(Dimension.COMPLETENESS, True)


def _check_policy(draft: TripDraft, policy: TravelPolicyEngine) -> DimensionResult:
    if not draft.job_level or draft.city_tier <= 0:
        return DimensionResult(Dimension.POLICY, False, ["职级或城市等级缺失，无法判定政策"])
    result = policy.check(
        draft.job_level, draft.city_tier, draft.hotel_price, draft.flight_class or "economy"
    )
    return DimensionResult(Dimension.POLICY, result.compliant, list(result.reasons))


def _check_budget(draft: TripDraft) -> DimensionResult:
    if draft.budget_limit is None:
        return DimensionResult(Dimension.BUDGET, True)
    if draft.total_amount > draft.budget_limit:
        return DimensionResult(
            Dimension.BUDGET,
            False,
            [f"预计总额 {draft.total_amount} 分超过预算上限 {draft.budget_limit} 分"],
        )
    return DimensionResult(Dimension.BUDGET, True)


def _check_conflict(draft: TripDraft, existing: list[Segment]) -> DimensionResult:
    reasons = [
        f"与已有行程（{seg.city} {seg.start_date}~{seg.end_date}）时间重叠"
        for seg in existing
        if draft.start_date <= seg.end_date and seg.start_date <= draft.end_date
    ]
    return DimensionResult(Dimension.CONFLICT, not reasons, reasons)


def _check_transit(
    draft: TripDraft, existing: list[Segment], transit: CityTransit
) -> DimensionResult:
    segments = [*existing, Segment(draft.destination, draft.start_date, draft.end_date)]
    conflicts = find_transit_conflicts(segments, transit)
    reasons = [check.reason for _, _, check in conflicts if check.reason]
    return DimensionResult(Dimension.TRANSIT, not conflicts, reasons)


def _check_preference(draft: TripDraft) -> DimensionResult:
    reasons: list[str] = []
    pref_class = draft.preferences.get("flight_class")
    if pref_class and draft.flight_class and pref_class != draft.flight_class:
        reasons.append(f"舱位 {draft.flight_class} 与偏好 {pref_class} 不符")
    pref_hotel = draft.preferences.get("hotel_brand")
    if pref_hotel:
        reasons.append(f"未确认是否为偏好酒店品牌：{pref_hotel}")
    return DimensionResult(Dimension.PREFERENCE, not reasons, reasons)


def review_trip(
    draft: TripDraft,
    policy: TravelPolicyEngine,
    existing: list[Segment] | None = None,
    transit: CityTransit | None = None,
) -> ReviewResult:
    """六维全跑一遍，返回完整结论。"""
    existing = existing or []
    transit = transit or CityTransit()
    return ReviewResult(
        dimensions=[
            _check_completeness(draft),
            _check_policy(draft, policy),
            _check_budget(draft),
            _check_conflict(draft, existing),
            _check_transit(draft, existing, transit),
            _check_preference(draft),
        ]
    )
