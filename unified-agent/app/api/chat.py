"""聊天接入层（SSE）：意图路由 → 领域 Agent → 统一 SSE 事件流。

Supervisor 用规则意图 + 降级工厂：配置了模型 Key 时构建真实领域 Agent，
否则返回 None 触发 runtime 降级流。领域 Agent 的完整 context（DB/用户/权限）
装配在阶段 F 已就绪，此处用最小工厂演示端到端链路。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.core.logging import get_logger
from app.orchestrator.intent.defaults import default_rule_matcher
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.supervisor import Supervisor

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    query: str
    conversation_id: str | None = None
    online: bool = False
    file_ids: list[str] = []


class _DegradingFactory:
    """默认工厂：恒返回 None（降级到 mock），不依赖 DB/用户上下文。

    接入 live 时改用 orchestrator.factory.DomainAgentFactory(ctx)：
    ctx 按请求提供 data_tools / travel_tools（DB session + 登录用户 + schema/权限），
    工厂在配置了模型 Key 时构建真实 LangGraph Agent，无 Key 仍返回 None 降级。
    """

    def build(self, domain: str) -> Any | None:
        return None


def _supervisor() -> Supervisor:
    pipeline = IntentPipeline(default_rule_matcher())
    return Supervisor(pipeline, _DegradingFactory())


@router.post("")
async def chat(req: ChatRequest) -> EventSourceResponse:
    supervisor = _supervisor()

    async def _gen():  # type: ignore[no-untyped-def]
        async for evt in supervisor.handle(req.query):
            yield evt.to_sse()

    return EventSourceResponse(_gen())
