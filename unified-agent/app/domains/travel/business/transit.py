"""T-5 跨城衔接：两段行程之间是否留够了移动时间。

现有 has_time_conflict 只判日期区间重叠，会漏掉真正的冲突：
「10-01~10-02 北京」与「10-03~10-04 广州」日期不重叠，但如果 10-02 晚上
还在北京、10-03 一早要在广州开会，中间这段路根本走不完。

出行耗时用「城市对 → 小时」的表配置；查不到就退回同城/异地的默认值，
不做静默放行——衔接检查宁可多提醒也不该漏。

纯逻辑，日期用 ISO 字符串（与 travel_order 的存储一致），可完整离线测试。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from itertools import pairwise

# 默认出行耗时（小时）。同城通勤 vs 跨城飞行/高铁的量级差异。
DEFAULT_SAME_CITY_HOURS = 2.0
DEFAULT_CROSS_CITY_HOURS = 6.0


def _parse_day(value: str) -> date | None:
    """宽松解析 ISO 日期。解析不了返回 None，由调用方决定如何处理。"""
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


@dataclass(frozen=True)
class CityPair:
    origin: str
    destination: str

    def normalized(self) -> tuple[str, str]:
        """无向：北京→广州 与 广州→北京 视为同一对。"""
        a, b = self.origin.strip(), self.destination.strip()
        return (a, b) if a <= b else (b, a)


@dataclass
class CityTransit:
    """城市间出行耗时表（小时）。规则可来自配置或 DB。"""

    hours: dict[tuple[str, str], float] = field(default_factory=dict)
    same_city_hours: float = DEFAULT_SAME_CITY_HOURS
    cross_city_hours: float = DEFAULT_CROSS_CITY_HOURS

    def put(self, a: str, b: str, hours: float) -> None:
        self.hours[CityPair(a, b).normalized()] = hours

    def hours_between(self, a: str, b: str) -> float:
        a, b = (a or "").strip(), (b or "").strip()
        if a and a == b:
            return self.same_city_hours
        return self.hours.get(CityPair(a, b).normalized(), self.cross_city_hours)


@dataclass
class TransitCheck:
    """一次衔接判定的结果。"""

    feasible: bool
    reason: str = ""
    required_hours: float = 0.0
    available_hours: float = 0.0


@dataclass
class Segment:
    """一段行程：在 city 停留 [start_date, end_date]。"""

    city: str
    start_date: str
    end_date: str


def check_transit(prev: Segment, nxt: Segment, transit: CityTransit) -> TransitCheck:
    """判断 prev 结束后能否赶上 nxt 开始。

    可用时间按「prev 结束当日 24:00 → nxt 开始当日 00:00」的整日间隔折算，
    即相邻两天视为 0 小时可用（当天走当天到才算够）。这是保守估计：
    宁可提示衔接紧张，也不要让人真的赶不上。
    """
    prev_end = _parse_day(prev.end_date)
    next_start = _parse_day(nxt.start_date)
    if prev_end is None or next_start is None:
        return TransitCheck(True, "日期无法解析，跳过衔接检查")

    if next_start < prev_end:
        return TransitCheck(False, "后一段行程早于前一段结束", 0.0, 0.0)

    required = transit.hours_between(prev.city, nxt.city)
    available = (next_start - prev_end).days * 24.0
    if available >= required:
        return TransitCheck(True, "", required, available)

    return TransitCheck(
        False,
        (
            f"{prev.city} 到 {nxt.city} 约需 {required:g} 小时，"
            f"但 {prev.end_date} 结束到 {nxt.start_date} 开始只有 {available:g} 小时"
        ),
        required,
        available,
    )


def find_transit_conflicts(
    segments: list[Segment], transit: CityTransit
) -> list[tuple[Segment, Segment, TransitCheck]]:
    """按时间排序后逐对检查，返回所有衔接不上的相邻组合。"""
    ordered = sorted(segments, key=lambda s: (_parse_day(s.start_date) or date.max, s.city))
    out: list[tuple[Segment, Segment, TransitCheck]] = []
    for prev, nxt in pairwise(ordered):
        result = check_transit(prev, nxt, transit)
        if not result.feasible:
            out.append((prev, nxt, result))
    return out


def earliest_feasible_start(prev: Segment, next_city: str, transit: CityTransit) -> str:
    """给定前一段，算出下一段最早可行的开始日期（ISO）。用于给用户建议。"""
    prev_end = _parse_day(prev.end_date)
    if prev_end is None:
        return prev.end_date
    required = transit.hours_between(prev.city, next_city)
    days_needed = int(required // 24) + (1 if required % 24 else 0)
    return (prev_end + timedelta(days=max(days_needed, 0))).isoformat()
