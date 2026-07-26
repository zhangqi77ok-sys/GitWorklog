"""差旅业务 ORM 模型（源自 gogo 的 business 域）。

差旅单 / 审批 / 预订记录 / 政策规则。均属 travel 域，与平台库共用引擎但表隔离。
"""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class TravelOrder(Base, TimestampMixin):
    """差旅单。"""

    __tablename__ = "travel_order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    dept_id: Mapped[int] = mapped_column(default=0)
    origin: Mapped[str] = mapped_column(String(64))
    destination: Mapped[str] = mapped_column(String(64))
    start_date: Mapped[str] = mapped_column(String(32))
    end_date: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    # draft / submitted / approved / rejected / cancelled


class ApprovalRecord(Base, TimestampMixin):
    __tablename__ = "approval_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(index=True)
    approver_id: Mapped[int] = mapped_column()
    decision: Mapped[str] = mapped_column(String(32))  # approved / rejected
    comment: Mapped[str] = mapped_column(String(255), default="")


class BookingRecord(Base, TimestampMixin):
    __tablename__ = "booking_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    booking_type: Mapped[str] = mapped_column(String(32))  # flight/hotel/train/...
    status: Mapped[str] = mapped_column(String(32), default="pending")
    amount: Mapped[int] = mapped_column(default=0)  # 分


class TravelPolicyRule(Base, TimestampMixin):
    """差旅政策规则（职级 × 城市等级 → 预算上限）。"""

    __tablename__ = "travel_policy_rule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_level: Mapped[str] = mapped_column(String(32))
    city_tier: Mapped[int] = mapped_column()  # 1/2/3
    hotel_budget: Mapped[int] = mapped_column(default=0)  # 每晚上限（分）
    flight_class: Mapped[str] = mapped_column(String(32), default="economy")
