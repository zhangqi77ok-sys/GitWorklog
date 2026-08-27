"""Supervisor 编排：意图路由 → 选择领域 Agent（对应 gogo 的 MasterAgent）。

只做「分发」，不含业务。用 IntentPipeline 的路由决策把请求导向 data / travel 域，
再由 runtime 运行对应 Agent 并流式回传。

Agent 构建是「按会话惰性装配」：接入层根据登录用户 + DB session 组装领域 context，
传入 AgentFactory。未配置模型时 factory 返回 None → runtime 降级。
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any, Protocol

from app.core.logging import get_logger
from app.orchestrator.intent.models import IntentCategory
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.runtime import resolve_stream
from app.platform.hooks.base import HookChain, HookContext
from app.platform.sse.events import SSEEvent, SSEEventType

logger = get_logger(__name__)

# 意图类别 → 领域 key
_TRAVEL_INTENTS = {
    IntentCategory.TRAVEL_MANAGE,
    IntentCategory.TRAVEL_PLAN,
    IntentCategory.TRAVEL_BOOKING,
    IntentCategory.TRAVEL_REIMBURSE,
    IntentCategory.TRAVEL_INFO,
}


def domain_of(category: IntentCategory) -> str:
    if category == IntentCategory.DATA_ANALYSIS:
        return "data"
    if category in _TRAVEL_INTENTS:
        return "travel"
    return "general"


# 意图 → 给用户看的中文说法（低置信时用于澄清建议）
_INTENT_LABELS = {
    IntentCategory.DATA_ANALYSIS: "查询/分析数据",
    IntentCategory.TRAVEL_MANAGE: "管理差旅单",
    IntentCategory.TRAVEL_PLAN: "规划行程",
    IntentCategory.TRAVEL_BOOKING: "预订机票/酒店",
    IntentCategory.TRAVEL_REIMBURSE: "差旅报销",
    IntentCategory.TRAVEL_INFO: "查询差旅政策",
}


class AgentFactory(Protocol):
    """按领域 key 惰性构建 Agent。无模型/不支持返回 None（触发降级）。"""

    def build(self, domain: str) -> Any | None: ...


class Supervisor:
    def __init__(
        self,
        pipeline: IntentPipeline,
        factory: AgentFactory,
        hooks: HookChain | None = None,
    ) -> None:
        self.pipeline = pipeline
        self.factory = factory
        self.hooks = hooks

    async def handle(
        self,
        query: str,
        ctx: HookContext | None = None,
        history: list[dict[str, str]] | None = None,
        thread_id: str | None = None,
        resume_value: Any = None,
        skills: list[Any] | None = None,
        doc_context: str | None = None,
    ) -> AsyncGenerator[SSEEvent, None]:
        # 1. 发送命中技能事件通知前端
        if skills:
            for s in skills:
                yield SSEEvent(
                    event=SSEEventType.PROGRESS,
                    data={
                        "phase": "skill_match",
                        "skill": getattr(s, "name", str(s)),
                        "description": getattr(s, "description", ""),
                    },
                )

        # 2. 发送文档关联事件
        if doc_context:
            yield SSEEvent(
                event=SSEEventType.PROGRESS,
                data={"phase": "doc_attach", "length": len(doc_context)},
            )

        decision = self.pipeline.route(query, history=history)
        # 改写后的查询才是后续识别与执行的依据（O-5）
        effective_query = decision.query or query
        domain = domain_of(decision.target)
        logger.info(
            "supervisor_route",
            intent=decision.intent.category,
            source=decision.intent.source,
            confidence=decision.intent.confidence,
            domain=domain,
            direct=decision.direct_dispatch,
        )
        # O-7：置信度不足时不拿弱猜测去驱动领域 Agent。
        # 差旅工具能创建真实订单（create_travel_order），照着一个五五开的猜测
        # 去写库风险太高；此时改发澄清建议并走 general 降级，让用户确认一次。
        clarify = not decision.direct_dispatch and domain != "general"
        if clarify:
            logger.info(
                "supervisor_low_confidence_clarify",
                guess=decision.target.value,
                confidence=decision.intent.confidence,
            )
            domain = "general"

        # 告知前端路由到哪个领域，并带上路由依据便于 trace/回放
        switch_data: dict[str, Any] = {
            "domain": domain,
            "intent": decision.target.value,
            "direct": decision.direct_dispatch,
            "confidence": decision.intent.confidence,
            "source": decision.intent.source.value,
        }
        if effective_query != query:
            # 改写过就如实告知，否则用户看不懂为什么答的是另一个问题
            switch_data["rewritten_query"] = effective_query
        yield SSEEvent(event=SSEEventType.AGENT_SWITCH, data=switch_data)
        if clarify:
            label = _INTENT_LABELS.get(decision.target)
            yield SSEEvent(
                event=SSEEventType.SUGGESTIONS,
                data={
                    "reason": "意图置信度不足，请确认你的需求",
                    "items": [label] if label else [],
                },
            )

        # 组装技能与文档上下文，注入增强提示
        extra_parts: list[str] = []
        if skills:
            for s in skills:
                body = getattr(s, "body", "")
                name = getattr(s, "name", "")
                desc = getattr(s, "description", "")
                if body:
                    extra_parts.append(
                        f"【已激活领域技能规范 · {name}】\n描述：{desc}\n指导要求：\n{body}"
                    )
        if doc_context:
            extra_parts.append(
                f"【用户提供的关联参考文档内容如下，请严格结合文档内容回答】\n{doc_context}"
            )

        if extra_parts:
            prompt_query = "\n\n".join(extra_parts) + "\n\n【用户问题】: " + effective_query
        else:
            prompt_query = effective_query

        # 路由结果回填进 Hook 上下文，供进度/持久化 Hook 记录实际领域
        hctx = ctx or HookContext(query=query)
        hctx.domain = domain
        agent = self.factory.build(domain)
        async for e in resolve_stream(
            prompt_query,
            agent=agent,
            hooks=self.hooks,
            ctx=hctx,
            thread_id=thread_id,
            resume_value=resume_value,
        ):
            yield e
