"""六个差旅子 Agent 各自的工具集。

每个类对应一个子 Agent 的能力边界——**工具即权限**：报销子 Agent 拿不到
预订工具，就不可能误下单。这比在 prompt 里叮嘱「不要下单」可靠得多。

所有方法返回 str、带中文 docstring（LangChain 据此生成 LLM 可见的 schema），
业务异常转成文本交还给 LLM，遵循本仓库既有约定。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.domains.travel.business import booking as booking_svc
from app.domains.travel.business import service
from app.domains.travel.business.planner import plan_roundtrip, suggest_return_day
from app.domains.travel.business.policy import TravelPolicyEngine
from app.domains.travel.business.reimburse import Invoice, validate_invoices
from app.domains.travel.business.review import TripDraft, review_trip
from app.domains.travel.business.transit import (
    CityTransit,
    Segment,
    check_transit,
    earliest_feasible_start,
)


@dataclass
class SubAgentContext:
    """子 Agent 共享的运行上下文。"""

    session: Session
    user_id: int
    dept_id: int
    policy: TravelPolicyEngine
    transit: CityTransit = field(default_factory=CityTransit)
    job_level: str = ""
    preferences: dict[str, str] = field(default_factory=dict)


def _yuan(cents: int) -> str:
    return f"{cents / 100:.2f} 元"


# ---------------- T-7 行程管理 ----------------


class ManageTools:
    """差旅单的申请、查询、取消。"""

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def create_travel_order(
        self, origin: str, destination: str, start_date: str, end_date: str
    ) -> str:
        """创建差旅单。日期格式 YYYY-MM-DD。会先检查是否与已有行程时间冲突。"""
        if service.has_time_conflict(self.ctx.session, self.ctx.user_id, start_date, end_date):
            return (
                f"该时间段（{start_date}~{end_date}）与你已有的差旅单冲突，请先调整或取消原行程。"
            )
        order = service.create_order(
            self.ctx.session,
            user_id=self.ctx.user_id,
            dept_id=self.ctx.dept_id,
            origin=origin,
            destination=destination,
            start_date=start_date,
            end_date=end_date,
        )
        return f"已创建差旅单 #{order.id}：{origin} → {destination}，{start_date} 至 {end_date}，状态 {order.status}。"

    def list_my_orders(self) -> str:
        """查询我的全部差旅单及其状态。"""
        orders = service.list_orders(self.ctx.session, self.ctx.user_id)
        if not orders:
            return "你还没有差旅单。"
        lines = [
            f"#{o.id} {o.origin}→{o.destination} {o.start_date}~{o.end_date} [{o.status}]"
            for o in orders
        ]
        return "你的差旅单：\n" + "\n".join(lines)

    def cancel_travel_order(self, order_id: int) -> str:
        """取消指定编号的差旅单。已审批通过或已取消的无法取消。"""
        try:
            order = service.cancel_order(self.ctx.session, order_id)
        except ValueError as e:
            return f"取消失败：{e}"
        return f"差旅单 #{order.id} 已取消。"


# ---------------- T-8 行程规划 ----------------


class PlanTools:
    """往返方案计算与跨城衔接可行性。"""

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def plan_trip(
        self, origin: str, destination: str, depart_day: str, return_day: str, city_tier: int
    ) -> str:
        """规划往返行程：算住宿夜数、按职级政策给出住宿预算上限与允许舱位。

        city_tier 为目的地城市等级（1/2/3）。日期格式 YYYY-MM-DD。
        """
        plan = plan_roundtrip(
            origin=origin,
            destination=destination,
            depart_day=depart_day,
            return_day=return_day,
            job_level=self.ctx.job_level,
            city_tier=city_tier,
            policy=self.ctx.policy,
            transit=self.ctx.transit,
        )
        lines = [
            f"{plan.origin} ⇄ {plan.destination}",
            f"去程 {plan.depart_day}，返程 {plan.return_day}，住 {plan.nights} 晚",
        ]
        if plan.policy_missing:
            lines.append("⚠ 未找到对应差旅政策，预算需人工确认")
        else:
            lines.append(
                f"住宿上限 {_yuan(plan.hotel_budget_per_night)}/晚，"
                f"合计 {_yuan(plan.hotel_budget_total)}；允许舱位 {plan.flight_class}"
            )
        lines.extend(plan.warnings)
        lines.append("方案可行" if plan.feasible else "方案不可行，请调整日期")
        return "\n".join(lines)

    def suggest_return_date(self, depart_day: str, nights: int) -> str:
        """用户只说了出发日和停留天数时，推算返程日期。"""
        return f"停留 {nights} 晚，建议返程日期为 {suggest_return_day(depart_day, nights)}。"

    def check_city_transit(
        self, from_city: str, leave_day: str, to_city: str, arrive_day: str
    ) -> str:
        """检查从一个城市到另一个城市的衔接时间是否够用。日期格式 YYYY-MM-DD。"""
        result = check_transit(
            Segment(from_city, leave_day, leave_day),
            Segment(to_city, arrive_day, arrive_day),
            self.ctx.transit,
        )
        if result.feasible:
            return f"{from_city} → {to_city} 衔接可行。"
        earliest = earliest_feasible_start(
            Segment(from_city, leave_day, leave_day), to_city, self.ctx.transit
        )
        return f"衔接不可行：{result.reason}。最早可行的到达日期是 {earliest}。"


# ---------------- T-9 行程审核 ----------------


class ReviewTools:
    """六维审核：完整性/政策/预算/时间冲突/跨城衔接/偏好。"""

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def review_travel_order(self, order_id: int, hotel_price: int, flight_class: str) -> str:
        """审核指定差旅单是否合规。hotel_price 为每晚房价（单位：分）。"""
        orders = [
            o for o in service.list_orders(self.ctx.session, self.ctx.user_id) if o.id == order_id
        ]
        if not orders:
            return f"未找到差旅单 #{order_id}。"
        order = orders[0]

        existing = [
            Segment(o.destination, o.start_date, o.end_date)
            for o in service.list_orders(self.ctx.session, self.ctx.user_id)
            if o.id != order_id and o.status not in {"cancelled", "rejected"}
        ]
        booked = booking_svc.summarize(self.ctx.session, order_id)
        draft = TripDraft(
            origin=order.origin,
            destination=order.destination,
            start_date=order.start_date,
            end_date=order.end_date,
            job_level=self.ctx.job_level,
            city_tier=1,
            hotel_price=hotel_price,
            flight_class=flight_class,
            total_amount=booked.total_amount,
            preferences=self.ctx.preferences,
        )
        result = review_trip(draft, self.ctx.policy, existing=existing, transit=self.ctx.transit)
        return f"差旅单 #{order_id} {result.summary()}"


# ---------------- T-10 预订执行 ----------------


class BookingTools:
    """出票/订房等花钱动作。仅对已审批通过的差旅单生效。"""

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def book(self, order_id: int, booking_type: str, amount: int) -> str:
        """为差旅单登记一笔预订。booking_type 取 flight/hotel/train/car/other，amount 单位为分。"""
        try:
            rec = booking_svc.create_booking(
                self.ctx.session,
                order_id=order_id,
                user_id=self.ctx.user_id,
                booking_type=booking_type,
                amount=amount,
            )
        except booking_svc.BookingError as e:
            return f"预订失败：{e}"
        return (
            f"已登记预订 #{rec.id}（{rec.booking_type}，{_yuan(rec.amount)}），状态 {rec.status}。"
        )

    def confirm(self, booking_id: int) -> str:
        """确认出票/入住，把预订从待处理变为已确认。"""
        try:
            rec = booking_svc.confirm_booking(self.ctx.session, booking_id)
        except booking_svc.BookingError as e:
            return f"确认失败：{e}"
        return f"预订 #{rec.id} 已确认。"

    def cancel(self, booking_id: int) -> str:
        """取消一笔预订。"""
        try:
            rec = booking_svc.cancel_booking(self.ctx.session, booking_id)
        except booking_svc.BookingError as e:
            return f"取消失败：{e}"
        return f"预订 #{rec.id} 已取消。"

    def list_order_bookings(self, order_id: int) -> str:
        """列出某差旅单下的所有预订及金额汇总。"""
        records = booking_svc.list_bookings(self.ctx.session, order_id)
        if not records:
            return f"差旅单 #{order_id} 暂无预订记录。"
        lines = [f"#{r.id} {r.booking_type} {_yuan(r.amount)} [{r.status}]" for r in records]
        s = booking_svc.summarize(self.ctx.session, order_id)
        lines.append(f"有效合计：{_yuan(s.total_amount)}（{s.count} 笔）")
        return "\n".join(lines)


# ---------------- T-11 报销 ----------------


class ReimburseTools:
    """发票校验与报销金额核对。"""

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def check_invoices(
        self, order_id: int, invoice_numbers: list[str], amounts: list[int], issue_dates: list[str]
    ) -> str:
        """校验一组发票能否报销。三个列表按顺序一一对应，amounts 单位为分，日期格式 YYYY-MM-DD。"""
        if not (len(invoice_numbers) == len(amounts) == len(issue_dates)):
            return "发票号、金额、开票日期三个列表长度必须一致。"

        orders = [
            o for o in service.list_orders(self.ctx.session, self.ctx.user_id) if o.id == order_id
        ]
        if not orders:
            return f"未找到差旅单 #{order_id}。"
        order = orders[0]
        booked = booking_svc.summarize(self.ctx.session, order_id)

        invoices = [
            Invoice(number=n, amount=a, issue_date=d)
            for n, a, d in zip(invoice_numbers, amounts, issue_dates, strict=False)
        ]
        result = validate_invoices(
            invoices,
            trip_start=order.start_date,
            trip_end=order.end_date,
            booked_total=booked.total_amount or None,
        )
        if result.ok:
            return f"{len(result.accepted)} 张发票校验通过，合计 {_yuan(result.total_amount)}。"
        lines = [f"发票校验未通过（{len(result.issues)} 个问题）："]
        lines.extend(f"  ✗ {i.message}" for i in result.issues)
        if result.accepted:
            lines.append(f"其余 {len(result.accepted)} 张可报，合计 {_yuan(result.total_amount)}。")
        return "\n".join(lines)


# ---------------- T-12 差旅信息 ----------------


class InfoTools:
    """差旅政策查询。

    诚实边界：景点/签证知识库需要 live RAG（见 NEEDS_LIVE.md），
    此处只提供已落库的政策规则查询，不假装能答签证问题。
    """

    def __init__(self, ctx: SubAgentContext) -> None:
        self.ctx = ctx

    def query_policy(self, job_level: str, city_tier: int) -> str:
        """查询某职级在某等级城市的住宿预算上限与允许舱位。city_tier 取 1/2/3。"""
        limit = self.ctx.policy.limit_for(job_level, city_tier)
        if limit is None:
            return f"未找到 {job_level} 在 {city_tier} 级城市的差旅政策，请联系管理员配置。"
        return (
            f"{job_level} 在 {city_tier} 级城市：住宿上限 {_yuan(limit.hotel_budget)}/晚，"
            f"允许舱位 {limit.flight_class}。"
        )

    def check_compliance(
        self, job_level: str, city_tier: int, hotel_price: int, flight_class: str
    ) -> str:
        """判断给定的房价与舱位是否符合政策。hotel_price 单位为分。"""
        result = self.ctx.policy.check(job_level, city_tier, hotel_price, flight_class)
        if result.compliant:
            return "符合差旅政策。"
        return "不符合差旅政策：\n" + "\n".join(f"  ✗ {r}" for r in result.reasons)
