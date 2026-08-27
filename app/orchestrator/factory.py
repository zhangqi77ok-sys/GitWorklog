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
        checkpointer: Any = None,
    ) -> None:
        self.ctx = ctx
        self._model_builder = model_builder
        # 传入才支持中断续跑 / HITL（P1-M4、P1-M6）
        self.checkpointer = checkpointer

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
        model = self._build_model()
        if model is None:
            return None
        if domain == "data":
            from app.domains.data.agent import build_data_agent

            return build_data_agent(self.ctx.data_tools(), model, self.checkpointer)
        if domain in ("coding", "codex", "travel"):
            from langgraph.prebuilt import create_react_agent

            return create_react_agent(
                model=model,
                tools=[],
                prompt="你是 Vite Coding 平台的高级全自主研发架构师。请针对用户的开发需求输出清晰、结构化、模块化的高质量代码及工程设计。",
                checkpointer=self.checkpointer,
            )

        if domain == "general":
            from langgraph.prebuilt import create_react_agent

            return create_react_agent(
                model=model,
                tools=[],
                prompt="你是 Vite Coding 平台的智能助手。请用清晰、结构化且友好的中文回答用户问题，支持全自主代码开发、多智能体协同、知识图谱与工程管理。",
                checkpointer=self.checkpointer,
            )
        return None
