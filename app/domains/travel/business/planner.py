"""T-6 往返规划计算引擎：把「几号去哪、待几天」算成可执行的行程骨架。

产出的是**方案骨架**而非真实票务：住几晚、去程返程各在哪天、按政策能花多少。
真实航班/房源要接外部 API（见 NEEDS_LIVE.md），但骨架决定了后续检索的
参数与预算红线，且完全可以离线算准——这部分不该等 live 才做。

预算口径：住宿按「夜数 × 每晚上限」，夜数 = 返程日 - 去程日（当天往返为 0 晚）。
政策查不到规则时不静默给 0，而是明确标记 policy_missing 交上层决定。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from app.domains.travel.business.policy import TravelPolicyEngine
from app.domains.travel.business.transit import CityTransit


def _parse_day(value: str) -> date | None:
    text = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class TripLeg:
    """单程：哪天从哪到哪。"""

    day: str
    origin: str
    destination: str
    hours: float = 0.0


@dataclass
class RoundtripPlan:
    origin: str
    destination: str
    depart_day: str
    return_day: str
    nights: int
    outbound: TripLeg | None = None
    inbound: TripLeg | None = None
    hotel_budget_per_night: int = 0  # 分
    hotel_budget_total: int = 0  # 分
    flight_class: str = ""
    policy_missing: bool = False
    warnings: list[str] = field(default_factory=list)

    @property
    def feasible(self) -> bool:
        return not any(w.startswith("[阻断]") for w in self.warnings)


def plan_roundtrip(
    *,
    origin: str,
    destination: str,
    depart_day: str,
    return_day: str,
    job_level: str,
    city_tier: int,
    policy: TravelPolicyEngine,
    transit: CityTransit | None = None,
) -> RoundtripPlan:
    """算往返方案骨架：夜数、去返程、按政策的预算上限。

    日期非法或返程早于去程都记为 [阻断] 警告而非抛异常——
    这是给 Agent 看的规划结果，应当带着问题描述返回，让它去追问用户。
    """
    transit = transit or CityTransit()
    d1, d2 = _parse_day(depart_day), _parse_day(return_day)

    plan = RoundtripPlan(
        origin=origin,
        destination=destination,
        depart_day=depart_day,
        return_day=return_day,
        nights=0,
    )

    if d1 is None or d2 is None:
        plan.warnings.append("[阻断] 出发或返回日期无法解析（需 YYYY-MM-DD）")
        return plan
    if d2 < d1:
        plan.warnings.append(f"[阻断] 返程 {return_day} 早于出发 {depart_day}")
        return plan

    plan.nights = (d2 - d1).days
    hours = transit.hours_between(origin, destination)
    plan.outbound = TripLeg(day=d1.isoformat(), origin=origin, destination=destination, hours=hours)
    plan.inbound = TripLeg(day=d2.isoformat(), origin=destination, destination=origin, hours=hours)

    # 当天往返但路上时间超过一天可用时长 → 不现实
    if plan.nights == 0 and hours * 2 > 12:
        plan.warnings.append(f"[阻断] 当天往返不可行：单程约 {hours:g} 小时，往返超出单日可用时间")

    limit = policy.limit_for(job_level, city_tier)
    if limit is None:
        plan.policy_missing = True
        plan.warnings.append(f"未找到 {job_level}/{city_tier} 级城市的差旅政策，预算未知")
        return plan

    plan.hotel_budget_per_night = limit.hotel_budget
    plan.hotel_budget_total = limit.hotel_budget * plan.nights
    plan.flight_class = limit.flight_class
    if plan.nights == 0:
        plan.warnings.append("当天往返，无住宿预算")
    return plan


def suggest_return_day(depart_day: str, nights: int) -> str:
    """按停留夜数推荐返程日，供 Agent 在用户没说返程时补默认。"""
    d = _parse_day(depart_day)
    if d is None:
        return depart_day
    return (d + timedelta(days=max(nights, 0))).isoformat()
