"""T-4 预订 service / T-11 报销校验 测试。"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.domains.travel.business import service
from app.domains.travel.business.booking import (
    STATUS_CANCELLED,
    STATUS_CONFIRMED,
    STATUS_PENDING,
    BookingError,
    cancel_booking,
    confirm_booking,
    create_booking,
    list_bookings,
    summarize,
)
from app.domains.travel.business.reimburse import Invoice, validate_invoices


def _approved_order(session: Session) -> int:
    order = service.create_order(
        session,
        user_id=1,
        dept_id=10,
        origin="北京",
        destination="上海",
        start_date="2026-10-01",
        end_date="2026-10-03",
    )
    service.approve_order(session, order.id, approver_id=2, approved=True)
    return order.id


# ---------- T-4 预订 ----------


def test_create_booking_on_approved_order(db_session: Session) -> None:
    oid = _approved_order(db_session)
    rec = create_booking(db_session, order_id=oid, user_id=1, booking_type="flight", amount=120000)
    assert rec.status == STATUS_PENDING
    assert rec.amount == 120000


def test_cannot_book_unapproved_order(db_session: Session) -> None:
    """草稿/待审单不能出票——这是花钱的动作。"""
    order = service.create_order(
        db_session,
        user_id=1,
        dept_id=10,
        origin="北京",
        destination="上海",
        start_date="2026-10-01",
        end_date="2026-10-03",
    )
    with pytest.raises(BookingError) as e:
        create_booking(db_session, order_id=order.id, user_id=1, booking_type="flight", amount=1000)
    assert "审批通过" in str(e.value)


def test_rejects_unknown_type_and_bad_amount(db_session: Session) -> None:
    oid = _approved_order(db_session)
    with pytest.raises(BookingError) as e1:
        create_booking(db_session, order_id=oid, user_id=1, booking_type="yacht", amount=100)
    assert "不支持的预订类型" in str(e1.value)

    with pytest.raises(BookingError):
        create_booking(db_session, order_id=oid, user_id=1, booking_type="hotel", amount=0)


def test_missing_order_reports_clearly(db_session: Session) -> None:
    with pytest.raises(BookingError) as e:
        create_booking(db_session, order_id=999, user_id=1, booking_type="hotel", amount=100)
    assert "不存在" in str(e.value)


def test_confirm_and_cancel_flow(db_session: Session) -> None:
    oid = _approved_order(db_session)
    rec = create_booking(db_session, order_id=oid, user_id=1, booking_type="hotel", amount=50000)

    assert confirm_booking(db_session, rec.id).status == STATUS_CONFIRMED
    assert cancel_booking(db_session, rec.id).status == STATUS_CANCELLED


def test_cancelled_booking_cannot_be_confirmed(db_session: Session) -> None:
    oid = _approved_order(db_session)
    rec = create_booking(db_session, order_id=oid, user_id=1, booking_type="hotel", amount=50000)
    cancel_booking(db_session, rec.id)
    with pytest.raises(BookingError) as e:
        confirm_booking(db_session, rec.id)
    assert "已取消" in str(e.value)


def test_summarize_excludes_cancelled_by_default(db_session: Session) -> None:
    oid = _approved_order(db_session)
    create_booking(db_session, order_id=oid, user_id=1, booking_type="flight", amount=120000)
    create_booking(db_session, order_id=oid, user_id=1, booking_type="hotel", amount=80000)
    doomed = create_booking(db_session, order_id=oid, user_id=1, booking_type="train", amount=30000)
    cancel_booking(db_session, doomed.id)

    s = summarize(db_session, oid)
    assert s.total_amount == 200000
    assert s.count == 2
    assert s.by_type == {"flight": 120000, "hotel": 80000}

    s_all = summarize(db_session, oid, include_cancelled=True)
    assert s_all.total_amount == 230000


def test_list_bookings_scoped_to_order(db_session: Session) -> None:
    oid = _approved_order(db_session)
    other = _approved_order(db_session)
    create_booking(db_session, order_id=oid, user_id=1, booking_type="flight", amount=100)
    create_booking(db_session, order_id=other, user_id=1, booking_type="hotel", amount=200)
    assert len(list_bookings(db_session, oid)) == 1


# ---------- T-11 报销 ----------


def _inv(number: str, amount: int = 10000, day: str = "2026-10-02") -> Invoice:
    return Invoice(number=number, amount=amount, issue_date=day, category="hotel")


def test_valid_invoices_accepted() -> None:
    r = validate_invoices([_inv("A1"), _inv("A2")], trip_start="2026-10-01", trip_end="2026-10-03")
    assert r.ok
    assert r.total_amount == 20000
    assert len(r.accepted) == 2


def test_duplicate_invoice_rejected() -> None:
    r = validate_invoices([_inv("A1"), _inv("A1")])
    assert not r.ok
    assert r.issues[0].code == "duplicate"
    assert r.total_amount == 10000  # 只算一次


def test_previously_submitted_number_rejected() -> None:
    """跨次提交的查重靠 known_numbers。"""
    r = validate_invoices([_inv("A1")], known_numbers={"A1"})
    assert not r.ok
    assert r.issues[0].code == "duplicate"


def test_invoice_outside_trip_window_rejected() -> None:
    r = validate_invoices(
        [_inv("A1", day="2026-09-20")], trip_start="2026-10-01", trip_end="2026-10-03"
    )
    assert not r.ok
    assert r.issues[0].code == "out_of_range"


def test_bad_number_amount_date_each_reported() -> None:
    r = validate_invoices(
        [
            Invoice(number="", amount=100, issue_date="2026-10-02"),
            Invoice(number="B1", amount=0, issue_date="2026-10-02"),
            Invoice(number="B2", amount=100, issue_date="不是日期"),
        ]
    )
    codes = {i.code for i in r.issues}
    assert codes == {"missing_number", "bad_amount", "bad_date"}


def test_exceeding_booked_total_flagged() -> None:
    r = validate_invoices([_inv("A1", amount=500000)], booked_total=100000)
    assert not r.ok
    assert any(i.code == "exceeds_booking" for i in r.issues)


def test_all_issues_reported_together() -> None:
    """一次性报全部问题，别让用户改一条提交一次。"""
    r = validate_invoices(
        [_inv("A1"), _inv("A1"), Invoice(number="", amount=1, issue_date="2026-10-02")]
    )
    assert len(r.issues) == 2


def test_no_window_means_no_date_check() -> None:
    r = validate_invoices([_inv("A1", day="1999-01-01")])
    assert r.ok
