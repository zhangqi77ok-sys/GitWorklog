"""差旅接口（T-1/T-2）：差旅单增查改 + 审批 + 预订。

此前差旅 service 全部只能由 Agent 工具触达，没有对外 HTTP 接口——
前端做不了列表页，也没法在不经过对话的情况下审批。

权限分层（每个写操作都要问「这是谁的单」）：
- 差旅单：本人可建/查/取消自己的
- 审批：需 admin 角色，且不能自批自己的单
- 预订：本人对自己已审批的单操作

归属校验一律走 _own_order，不重复写——漏一处就是一个越权点。
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbDep, require_role
from app.core.exceptions import BizError, NoPermissionError
from app.core.response import R
from app.domains.travel.business import booking as booking_svc
from app.domains.travel.business import service
from app.domains.travel.business.models import TravelOrder
from app.platform.user.models import SysUser

router = APIRouter(prefix="/travel", tags=["travel"])

AdminUser = Annotated[SysUser, Depends(require_role("admin"))]


class CreateOrderRequest(BaseModel):
    origin: str = Field(min_length=1, max_length=64)
    destination: str = Field(min_length=1, max_length=64)
    start_date: str = Field(min_length=8, max_length=32)
    end_date: str = Field(min_length=8, max_length=32)
    dept_id: int = 0


class OrderBrief(BaseModel):
    id: int
    origin: str
    destination: str
    start_date: str
    end_date: str
    status: str


class ApproveRequest(BaseModel):
    approved: bool
    comment: str = Field(default="", max_length=255)


class BookingRequest(BaseModel):
    booking_type: str = Field(min_length=1, max_length=32)
    amount: int = Field(gt=0, description="金额，单位：分")


class BookingBrief(BaseModel):
    id: int
    booking_type: str
    status: str
    amount: int


class BookingSummaryOut(BaseModel):
    total_amount: int
    count: int
    by_type: dict[str, int]


def _brief(o: TravelOrder) -> OrderBrief:
    return OrderBrief(
        id=o.id,
        origin=o.origin,
        destination=o.destination,
        start_date=o.start_date,
        end_date=o.end_date,
        status=o.status,
    )


def _own_order(session: DbDep, user: SysUser, order_id: int) -> TravelOrder:
    """取本人的差旅单。不是本人的一律按「不存在或无权」处理，不泄漏存在性。"""
    for o in service.list_orders(session, user.id):
        if o.id == order_id:
            return o
    raise NoPermissionError("差旅单不存在或无权访问")


# ---------------- T-1 差旅单 ----------------


@router.post("/order")
def create_order(req: CreateOrderRequest, session: DbDep, user: CurrentUser) -> R[OrderBrief]:
    """申请差旅单。与既有行程时间冲突时拒绝。"""
    if service.has_time_conflict(session, user.id, req.start_date, req.end_date):
        raise BizError(f"与已有差旅单时间冲突（{req.start_date}~{req.end_date}）")
    order = service.create_order(
        session,
        user_id=user.id,
        dept_id=req.dept_id,
        origin=req.origin,
        destination=req.destination,
        start_date=req.start_date,
        end_date=req.end_date,
    )
    return R.ok(_brief(order))


@router.get("/order/list")
def list_orders(session: DbDep, user: CurrentUser) -> R[list[OrderBrief]]:
    """我的差旅单列表。"""
    return R.ok([_brief(o) for o in service.list_orders(session, user.id)])


@router.get("/order/pending")
def list_pending(session: DbDep, _: AdminUser) -> R[list[OrderBrief]]:
    """待审批列表（需 admin）。

    必须声明在 /order/{order_id} **之前**：FastAPI 按声明顺序匹配，
    否则 "pending" 会被当成 order_id 去解析成 int 而返回 422。
    """
    return R.ok([_brief(o) for o in service.list_pending_orders(session)])


@router.get("/order/{order_id}")
def get_order(order_id: int, session: DbDep, user: CurrentUser) -> R[OrderBrief]:
    """查看单个差旅单（仅本人）。"""
    return R.ok(_brief(_own_order(session, user, order_id)))


@router.post("/order/{order_id}/cancel")
def cancel_order(order_id: int, session: DbDep, user: CurrentUser) -> R[OrderBrief]:
    """取消差旅单（仅本人）。已审批通过或已取消的无法取消。"""
    _own_order(session, user, order_id)
    try:
        return R.ok(_brief(service.cancel_order(session, order_id)))
    except ValueError as e:
        raise BizError(str(e)) from e


# ---------------- T-2 审批 ----------------


@router.post("/order/{order_id}/approve")
def approve_order(
    order_id: int, req: ApproveRequest, session: DbDep, admin: AdminUser
) -> R[OrderBrief]:
    """审批差旅单（需 admin）。不允许自批自己的单。"""
    target = service.get_order(session, order_id)
    if target is None:
        raise BizError(f"差旅单 {order_id} 不存在")
    if target.user_id == admin.id:
        raise NoPermissionError("不能审批自己提交的差旅单")
    try:
        order = service.approve_order(
            session, order_id, approver_id=admin.id, approved=req.approved, comment=req.comment
        )
    except ValueError as e:
        raise BizError(str(e)) from e
    return R.ok(_brief(order))


# ---------------- T-4 预订 ----------------


@router.post("/order/{order_id}/booking")
def create_booking(
    order_id: int, req: BookingRequest, session: DbDep, user: CurrentUser
) -> R[BookingBrief]:
    """为自己已审批的差旅单登记预订。"""
    _own_order(session, user, order_id)
    try:
        rec = booking_svc.create_booking(
            session,
            order_id=order_id,
            user_id=user.id,
            booking_type=req.booking_type,
            amount=req.amount,
        )
    except booking_svc.BookingError as e:
        raise BizError(str(e)) from e
    return R.ok(
        BookingBrief(id=rec.id, booking_type=rec.booking_type, status=rec.status, amount=rec.amount)
    )


@router.get("/order/{order_id}/booking/list")
def list_order_bookings(order_id: int, session: DbDep, user: CurrentUser) -> R[BookingSummaryOut]:
    """某单的预订汇总（仅本人）。"""
    _own_order(session, user, order_id)
    s = booking_svc.summarize(session, order_id)
    return R.ok(BookingSummaryOut(total_amount=s.total_amount, count=s.count, by_type=s.by_type))


@router.post("/booking/{booking_id}/cancel")
def cancel_booking(booking_id: int, session: DbDep, user: CurrentUser) -> R[BookingBrief]:
    """取消预订（仅本人的预订）。"""
    rec = booking_svc.get_booking(session, booking_id)
    if rec is None or rec.user_id != user.id:
        raise NoPermissionError("预订不存在或无权访问")
    try:
        updated = booking_svc.cancel_booking(session, booking_id)
    except booking_svc.BookingError as e:
        raise BizError(str(e)) from e
    return R.ok(
        BookingBrief(
            id=updated.id,
            booking_type=updated.booking_type,
            status=updated.status,
            amount=updated.amount,
        )
    )
