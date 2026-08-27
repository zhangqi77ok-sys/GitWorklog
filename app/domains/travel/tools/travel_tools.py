"""差旅域工具的可调用实现（对应 gogo 的差旅工具）。

绑定 DB session + 当前用户 + 政策引擎，装配时用 FunctionTool 包装注册到
travel ToolGroup。业务逻辑走已测的 travel service / policy engine。
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domains.travel.business import service
from app.domains.travel.business.policy import TravelPolicyEngine


@dataclass
class TravelAgentContext:
    session: Session
    user_id: int
    dept_id: int
    policy: TravelPolicyEngine


class TravelTools:
    def __init__(self, ctx: TravelAgentContext) -> None:
        self.ctx = ctx

    def create_travel_order(
        self, origin: str, destination: str, start_date: str, end_date: str
    ) -> str:
        """创建差旅单。日期用 ISO 格式 YYYY-MM-DD。创建前会自动检测时间冲突。"""
        if service.has_time_conflict(self.ctx.session, self.ctx.user_id, start_date, end_date):
            return f"该时间段（{start_date}~{end_date}）与已有差旅单冲突，请调整。"
        order = service.create_order(
            self.ctx.session,
            user_id=self.ctx.user_id,
            dept_id=self.ctx.dept_id,
            origin=origin,
            destination=destination,
            start_date=start_date,
            end_date=end_date,
        )
        return f"差旅单已创建，单号 {order.id}，{origin}→{destination}，状态 {order.status}。"

    def list_my_orders(self) -> str:
        """查询我的差旅单列表。"""
        orders = service.list_orders(self.ctx.session, self.ctx.user_id)
        if not orders:
            return "你还没有差旅单。"
        return "\n".join(
            f"#{o.id} {o.origin}→{o.destination} {o.start_date}~{o.end_date} [{o.status}]"
            for o in orders
        )

    def cancel_travel_order(self, order_id: int) -> str:
        """取消指定差旅单。"""
        try:
            order = service.cancel_order(self.ctx.session, order_id)
        except ValueError as e:
            return str(e)
        return f"差旅单 #{order.id} 已取消。"

    def check_policy(
        self, job_level: str, city_tier: int, hotel_price: int, flight_class: str
    ) -> str:
        """校验差旅预算/舱位是否符合公司政策。hotel_price 单位为分。"""
        result = self.ctx.policy.check(job_level, city_tier, hotel_price, flight_class)
        if result.compliant:
            return "符合差旅政策。"
        return "不符合政策：" + "；".join(result.reasons)

    def query_weather(self, city: str) -> str:
        """查询差旅目的地的实时天气与穿衣/携带雨具建议。"""
        from app.domains.travel.tools.external_tools import query_weather

        return query_weather(city)

    def query_city_info(self, city: str) -> str:
        """查询差旅目的地的机场、高铁主站、主要商圈与出行建议。"""
        from app.domains.travel.tools.external_tools import query_city_info

        return query_city_info(city)
