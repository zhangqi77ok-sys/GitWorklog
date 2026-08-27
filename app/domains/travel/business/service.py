"""差旅业务 service：差旅单生命周期 + 政策查询（SQLAlchemy，可 SQLite 测）。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.travel.business.models import ApprovalRecord, TravelOrder, TravelPolicyRule
from app.domains.travel.business.policy import PolicyKey, PolicyLimit, TravelPolicyEngine


def create_order(
    session: Session,
    *,
    user_id: int,
    dept_id: int,
    origin: str,
    destination: str,
    start_date: str,
    end_date: str,
) -> TravelOrder:
    order = TravelOrder(
        user_id=user_id,
        dept_id=dept_id,
        origin=origin,
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        status="submitted",
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def get_order(session: Session, order_id: int) -> TravelOrder | None:
    """按 id 取单（不限归属，供审批等跨用户场景使用——调用方自行把权限）。"""
    return session.execute(
        select(TravelOrder).where(TravelOrder.id == order_id)
    ).scalar_one_or_none()


def list_pending_orders(session: Session) -> list[TravelOrder]:
    """待审批的单（跨用户，供管理员审批列表）。"""
    stmt = (
        select(TravelOrder).where(TravelOrder.status == "submitted").order_by(TravelOrder.id.desc())
    )
    return list(session.execute(stmt).scalars())


def list_orders(session: Session, user_id: int) -> list[TravelOrder]:
    stmt = select(TravelOrder).where(TravelOrder.user_id == user_id).order_by(TravelOrder.id.desc())
    return list(session.execute(stmt).scalars())


def approve_order(
    session: Session, order_id: int, approver_id: int, *, approved: bool, comment: str = ""
) -> TravelOrder:
    order = session.get(TravelOrder, order_id)
    if order is None:
        raise ValueError(f"差旅单 {order_id} 不存在")
    decision = "approved" if approved else "rejected"
    order.status = decision
    session.add(
        ApprovalRecord(
            order_id=order_id, approver_id=approver_id, decision=decision, comment=comment
        )
    )
    session.commit()
    session.refresh(order)
    return order


def cancel_order(session: Session, order_id: int) -> TravelOrder:
    order = session.get(TravelOrder, order_id)
    if order is None:
        raise ValueError(f"差旅单 {order_id} 不存在")
    if order.status in {"approved", "cancelled"}:
        raise ValueError(f"状态 {order.status} 的差旅单不可取消")
    order.status = "cancelled"
    session.commit()
    session.refresh(order)
    return order


def has_time_conflict(session: Session, user_id: int, start_date: str, end_date: str) -> bool:
    """检测该用户是否已有时间重叠的差旅单（简化：字符串日期比较，ISO 格式可比）。"""
    for o in list_orders(session, user_id):
        if o.status in {"cancelled", "rejected"}:
            continue
        if start_date <= o.end_date and o.start_date <= end_date:
            return True
    return False


def load_policy_engine(session: Session) -> TravelPolicyEngine:
    """把 travel_policy_rule 表的规则装进政策引擎。

    引擎本身是纯逻辑、规则靠外部注入（policy.py），这是它唯一的 DB 加载入口。
    表为空时返回空规则引擎——check() 会如实报「无政策规则」而非放行，fail-closed。
    """
    rules: dict[PolicyKey, PolicyLimit] = {}
    for r in session.execute(select(TravelPolicyRule)).scalars():
        rules[PolicyKey(r.job_level, r.city_tier)] = PolicyLimit(
            hotel_budget=r.hotel_budget,
            flight_class=r.flight_class,
        )
    return TravelPolicyEngine(rules)
