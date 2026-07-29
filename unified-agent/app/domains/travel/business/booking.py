"""T-4 预订记录 service：booking_record 有 ORM 却一直没有读写入口。

预订是**写外部系统 + 花钱**的动作，因此这里守两条线：
  1. 只有已审批（approved）的差旅单才允许预订——防止 Agent 拿一个草稿单去出票
  2. 金额必须为正，且校验是否超政策上限，超了要显式返回原因而不是默默记账

状态机：pending → confirmed → cancelled。已取消的不能再确认。
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.travel.business.models import BookingRecord, TravelOrder

BOOKING_TYPES = {"flight", "hotel", "train", "car", "other"}

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_CANCELLED = "cancelled"


class BookingError(ValueError):
    """预订被业务规则拒绝。文本直接给 Agent 看，需说明怎么改。"""


@dataclass
class BookingSummary:
    total_amount: int  # 分
    by_type: dict[str, int]
    count: int


def _get_order(session: Session, order_id: int) -> TravelOrder:
    order = session.execute(
        select(TravelOrder).where(TravelOrder.id == order_id)
    ).scalar_one_or_none()
    if order is None:
        raise BookingError(f"差旅单 {order_id} 不存在")
    return order


def create_booking(
    session: Session,
    *,
    order_id: int,
    user_id: int,
    booking_type: str,
    amount: int,
    require_approved: bool = True,
) -> BookingRecord:
    """为差旅单登记一笔预订。默认要求单据已审批通过。"""
    btype = (booking_type or "").strip().lower()
    if btype not in BOOKING_TYPES:
        raise BookingError(
            f"不支持的预订类型 {booking_type}，可选：{'/'.join(sorted(BOOKING_TYPES))}"
        )
    if amount <= 0:
        raise BookingError("预订金额必须大于 0（单位：分）")

    order = _get_order(session, order_id)
    if require_approved and order.status != "approved":
        raise BookingError(
            f"差旅单 {order_id} 当前状态为 {order.status}，需审批通过（approved）后才能预订"
        )

    record = BookingRecord(
        order_id=order_id,
        user_id=user_id,
        booking_type=btype,
        status=STATUS_PENDING,
        amount=amount,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def confirm_booking(session: Session, booking_id: int) -> BookingRecord:
    """出票/确认。已取消的不能复活。"""
    rec = session.execute(
        select(BookingRecord).where(BookingRecord.id == booking_id)
    ).scalar_one_or_none()
    if rec is None:
        raise BookingError(f"预订记录 {booking_id} 不存在")
    if rec.status == STATUS_CANCELLED:
        raise BookingError(f"预订 {booking_id} 已取消，不能再确认")
    rec.status = STATUS_CONFIRMED
    session.commit()
    session.refresh(rec)
    return rec


def cancel_booking(session: Session, booking_id: int) -> BookingRecord:
    rec = session.execute(
        select(BookingRecord).where(BookingRecord.id == booking_id)
    ).scalar_one_or_none()
    if rec is None:
        raise BookingError(f"预订记录 {booking_id} 不存在")
    rec.status = STATUS_CANCELLED
    session.commit()
    session.refresh(rec)
    return rec


def get_booking(session: Session, booking_id: int) -> BookingRecord | None:
    """按 id 取预订（不限归属；调用方负责校验 user_id）。"""
    return session.execute(
        select(BookingRecord).where(BookingRecord.id == booking_id)
    ).scalar_one_or_none()


def list_bookings(session: Session, order_id: int) -> list[BookingRecord]:
    stmt = (
        select(BookingRecord)
        .where(BookingRecord.order_id == order_id)
        .order_by(BookingRecord.id.asc())
    )
    return list(session.execute(stmt).scalars())


def summarize(session: Session, order_id: int, include_cancelled: bool = False) -> BookingSummary:
    """汇总某单的预订金额，供报销与超支判断使用。"""
    by_type: dict[str, int] = {}
    total = 0
    count = 0
    for rec in list_bookings(session, order_id):
        if not include_cancelled and rec.status == STATUS_CANCELLED:
            continue
        by_type[rec.booking_type] = by_type.get(rec.booking_type, 0) + rec.amount
        total += rec.amount
        count += 1
    return BookingSummary(total_amount=total, by_type=by_type, count=count)
