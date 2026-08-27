"""T-5 跨城衔接 / T-6 往返规划 / T-9 六维审核 测试（纯逻辑，无 DB）。"""

from __future__ import annotations

import pytest

from app.domains.travel.business.planner import plan_roundtrip, suggest_return_day
from app.domains.travel.business.policy import PolicyKey, PolicyLimit, TravelPolicyEngine
from app.domains.travel.business.review import Dimension, TripDraft, review_trip
from app.domains.travel.business.transit import (
    CityTransit,
    Segment,
    check_transit,
    earliest_feasible_start,
    find_transit_conflicts,
)


def _policy() -> TravelPolicyEngine:
    return TravelPolicyEngine(
        {PolicyKey("P7", 1): PolicyLimit(hotel_budget=80000, flight_class="economy")}
    )


def _transit() -> CityTransit:
    t = CityTransit()
    t.put("北京", "广州", 6.0)
    t.put("北京", "上海", 5.0)
    return t


# ---------- T-5 跨城衔接 ----------


def test_same_city_back_to_back_is_fine() -> None:
    t = _transit()
    prev = Segment("北京", "2026-10-01", "2026-10-02")
    nxt = Segment("北京", "2026-10-03", "2026-10-04")
    assert check_transit(prev, nxt, t).feasible


def test_cross_city_next_day_is_infeasible() -> None:
    """日期不重叠但赶不上——这正是 has_time_conflict 漏掉的情况。"""
    t = _transit()
    prev = Segment("北京", "2026-10-01", "2026-10-02")
    nxt = Segment("广州", "2026-10-02", "2026-10-03")  # 同日衔接，0 小时可用
    r = check_transit(prev, nxt, t)
    assert not r.feasible
    assert r.required_hours == 6.0
    assert r.available_hours == 0.0
    assert "北京" in r.reason and "广州" in r.reason


def test_cross_city_with_a_full_day_gap_is_fine() -> None:
    t = _transit()
    prev = Segment("北京", "2026-10-01", "2026-10-02")
    nxt = Segment("广州", "2026-10-03", "2026-10-04")  # 隔一天 = 24h
    assert check_transit(prev, nxt, t).feasible


def test_unknown_city_pair_uses_cross_city_default() -> None:
    """查不到的城市对不能静默放行。"""
    t = CityTransit(cross_city_hours=30.0)
    prev = Segment("拉萨", "2026-10-01", "2026-10-02")
    nxt = Segment("三亚", "2026-10-03", "2026-10-04")  # 24h < 30h
    assert not check_transit(prev, nxt, t).feasible


def test_out_of_order_segments_flagged() -> None:
    t = _transit()
    prev = Segment("北京", "2026-10-05", "2026-10-06")
    nxt = Segment("广州", "2026-10-01", "2026-10-02")
    assert not check_transit(prev, nxt, t).feasible


def test_unparseable_date_skips_check() -> None:
    """日期解析不了就跳过，不能因此误报冲突。"""
    t = _transit()
    r = check_transit(Segment("北京", "x", "y"), Segment("广州", "2026-10-01", "2026-10-02"), t)
    assert r.feasible


def test_find_conflicts_sorts_before_pairing() -> None:
    t = _transit()
    segs = [
        Segment("广州", "2026-10-02", "2026-10-02"),  # 与北京同日衔接，走不完
        Segment("北京", "2026-10-01", "2026-10-02"),  # 乱序输入
    ]
    conflicts = find_transit_conflicts(segs, t)
    assert len(conflicts) == 1
    prev, nxt, _ = conflicts[0]
    assert prev.city == "北京" and nxt.city == "广州"  # 已按时间排序


def test_no_conflicts_returns_empty() -> None:
    t = _transit()
    segs = [
        Segment("北京", "2026-10-01", "2026-10-02"),
        Segment("北京", "2026-10-03", "2026-10-04"),
    ]
    assert find_transit_conflicts(segs, t) == []


def test_earliest_feasible_start_suggestion() -> None:
    t = _transit()
    prev = Segment("北京", "2026-10-01", "2026-10-02")
    assert earliest_feasible_start(prev, "广州", t) == "2026-10-03"


# ---------- T-6 往返规划 ----------


def test_plan_computes_nights_and_budget() -> None:
    p = plan_roundtrip(
        origin="北京",
        destination="上海",
        depart_day="2026-10-01",
        return_day="2026-10-04",
        job_level="P7",
        city_tier=1,
        policy=_policy(),
        transit=_transit(),
    )
    assert p.nights == 3
    assert p.hotel_budget_per_night == 80000
    assert p.hotel_budget_total == 240000  # 3 晚
    assert p.flight_class == "economy"
    assert p.feasible
    assert p.outbound is not None and p.outbound.destination == "上海"
    assert p.inbound is not None and p.inbound.destination == "北京"
    assert p.inbound.day == "2026-10-04"


def test_plan_rejects_return_before_depart() -> None:
    p = plan_roundtrip(
        origin="北京",
        destination="上海",
        depart_day="2026-10-05",
        return_day="2026-10-01",
        job_level="P7",
        city_tier=1,
        policy=_policy(),
    )
    assert not p.feasible
    assert any("早于出发" in w for w in p.warnings)


def test_plan_rejects_unparseable_dates() -> None:
    p = plan_roundtrip(
        origin="北京",
        destination="上海",
        depart_day="下周一",
        return_day="下周五",
        job_level="P7",
        city_tier=1,
        policy=_policy(),
    )
    assert not p.feasible


def test_same_day_roundtrip_too_far_is_blocked() -> None:
    t = CityTransit()
    t.put("北京", "乌鲁木齐", 8.0)  # 往返 16h > 12h
    p = plan_roundtrip(
        origin="北京",
        destination="乌鲁木齐",
        depart_day="2026-10-01",
        return_day="2026-10-01",
        job_level="P7",
        city_tier=1,
        policy=_policy(),
        transit=t,
    )
    assert not p.feasible
    assert any("当天往返不可行" in w for w in p.warnings)


def test_same_day_roundtrip_nearby_allowed_without_hotel() -> None:
    p = plan_roundtrip(
        origin="北京",
        destination="上海",
        depart_day="2026-10-01",
        return_day="2026-10-01",
        job_level="P7",
        city_tier=1,
        policy=_policy(),
        transit=_transit(),
    )
    assert p.feasible
    assert p.nights == 0
    assert p.hotel_budget_total == 0
    assert any("无住宿预算" in w for w in p.warnings)


def test_missing_policy_is_flagged_not_zeroed() -> None:
    """查不到政策不能静默按 0 预算处理。"""
    p = plan_roundtrip(
        origin="北京",
        destination="上海",
        depart_day="2026-10-01",
        return_day="2026-10-02",
        job_level="P99",
        city_tier=1,
        policy=_policy(),
    )
    assert p.policy_missing
    assert any("未找到" in w for w in p.warnings)


def test_suggest_return_day() -> None:
    assert suggest_return_day("2026-10-01", 3) == "2026-10-04"
    assert suggest_return_day("bad", 3) == "bad"


# ---------- T-9 六维审核 ----------


def _draft(**kw: object) -> TripDraft:
    base = {
        "origin": "北京",
        "destination": "上海",
        "start_date": "2026-10-01",
        "end_date": "2026-10-03",
        "job_level": "P7",
        "city_tier": 1,
        "hotel_price": 70000,
        "flight_class": "economy",
        "total_amount": 200000,
    }
    base.update(kw)
    return TripDraft(**base)  # type: ignore[arg-type]


def test_clean_draft_passes_all_hard_dimensions() -> None:
    r = review_trip(_draft(), _policy(), transit=_transit())
    assert r.approved
    assert r.blocking_reasons == []
    assert len(r.dimensions) == 6


def test_missing_fields_flagged() -> None:
    r = review_trip(_draft(destination="", job_level=""), _policy())
    assert not r.approved
    d = next(x for x in r.dimensions if x.dimension == Dimension.COMPLETENESS)
    assert not d.passed
    assert "目的地" in d.reasons[0] and "职级" in d.reasons[0]


def test_over_policy_hotel_blocked() -> None:
    r = review_trip(_draft(hotel_price=99999), _policy(), transit=_transit())
    assert not r.approved
    assert any("酒店" in x for x in r.blocking_reasons)


def test_over_budget_blocked() -> None:
    r = review_trip(_draft(total_amount=500000, budget_limit=300000), _policy(), transit=_transit())
    assert not r.approved
    assert any("超过预算上限" in x for x in r.blocking_reasons)


def test_time_conflict_with_existing_trip() -> None:
    existing = [Segment("上海", "2026-10-02", "2026-10-05")]
    r = review_trip(_draft(), _policy(), existing=existing, transit=_transit())
    assert not r.approved
    assert any("时间重叠" in x for x in r.blocking_reasons)


def test_transit_conflict_with_existing_trip() -> None:
    """时间不重叠，但从广州赶不到上海。"""
    existing = [Segment("广州", "2026-09-29", "2026-09-30")]
    t = CityTransit()
    t.put("广州", "上海", 30.0)  # 需要 30h，实际只有 24h
    r = review_trip(_draft(), _policy(), existing=existing, transit=t)
    assert not r.approved
    d = next(x for x in r.dimensions if x.dimension == Dimension.TRANSIT)
    assert not d.passed


def test_preference_mismatch_is_advisory_only() -> None:
    """偏好不满足只提示，不拦。"""
    r = review_trip(_draft(preferences={"flight_class": "business"}), _policy(), transit=_transit())
    assert r.approved  # 仍然通过
    assert r.advisories
    assert any("偏好" in a for a in r.advisories)


def test_all_problems_reported_at_once() -> None:
    """不在第一个失败处短路——一次说清所有问题。"""
    r = review_trip(
        _draft(destination="", hotel_price=99999, total_amount=999999, budget_limit=1),
        _policy(),
    )
    assert not r.approved
    assert len(r.blocking_reasons) >= 3


def test_summary_renders_markers() -> None:
    r = review_trip(_draft(hotel_price=99999), _policy(), transit=_transit())
    text = r.summary()
    assert "审核未通过" in text
    assert "✗" in text


@pytest.mark.parametrize("tier", [0, -1])
def test_invalid_city_tier_blocks_policy(tier: int) -> None:
    r = review_trip(_draft(city_tier=tier), _policy(), transit=_transit())
    assert not r.approved
