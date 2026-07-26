"""领域 Agent 工厂：按 domain 构建真实 data/travel Agent（有模型 Key 才构建）。

设计：Supervisor 路由出 domain 后调 build(domain)。工厂惰性构建模型——
配置了 API Key 才组装 LangGraph Agent，否则返回 None → runtime 降级到 mock。
这样「填 Key 即生效，无 Key 仍可跑」，且工厂逻辑可用 mock 完整测试。

领域 context（DB session / 用户 / schema / glossary / 权限）由调用方注入的
provider 提供，工厂不直接持有会话，便于按请求装配。
"""

from __future__ import annotations

from typing import Any, Protocol

from app.core.logging import get_logger
from app.platform.llm.models import ModelNotConfiguredError

logger = get_logger(__name__)


class DomainContextProvider(Protocol):
    """按 domain 提供构建 Agent 所需的工具上下文。live 接入时实现。"""

    def data_tools(self) -> Any: ...  # 返回 Text2SqlTools
    def travel_tools(self) -> Any: ...  # 返回 TravelTools


class DomainAgentFactory:
    """按 domain 构建真实 Agent；模型未配置或 domain 不支持时返回 None（降级）。

    model_builder: 可注入（默认用 platform.llm.models.build_chat_model），
    便于测试传入 fake 模型或 raise 的桩。
    """

    def __init__(
        self,
        ctx: DomainContextProvider,
        model_builder: Any = None,
    ) -> None:
        self.ctx = ctx
        self._model_builder = model_builder

    def _build_model(self) -> Any | None:
        builder = self._model_builder
        if builder is None:
            from app.platform.llm.models import build_chat_model

            builder = build_chat_model
        try:
            return builder()
        except ModelNotConfiguredError:
            logger.info("model_not_configured_degrade")
            return None

    def build(self, domain: str) -> Any | None:
        if domain not in {"data", "travel"}:
            return None  # general / 未知 → 降级
        model = self._build_model()
        if model is None:
            return None
        if domain == "data":
            from app.domains.data.agent import build_data_agent

            return build_data_agent(self.ctx.data_tools(), model)
        # travel
        from app.domains.travel.agent import build_travel_agent

        return build_travel_agent(self.ctx.travel_tools(), model)
