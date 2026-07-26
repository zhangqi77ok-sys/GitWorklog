"""聊天接入层（SSE）：意图路由 → 领域 Agent → 统一 SSE 事件流。

真实接线（替代原先恒返回 None 的占位工厂）：
- 按请求装配领域 context（DB session + 登录用户 + 政策规则），交给 DomainAgentFactory；
  配了模型 Key 就构建真实 LangGraph Agent，没配则返回 None → runtime 降级流。
- 挂 Hook 链：进度推送 + 会话持久化（降级态同样生效）。

鉴权是**可选**的：带 Authorization 头则识别用户并持久化会话，
不带则匿名试用、不落库。这样未登录也能体验，登录后自动获得历史记录。

诚实边界：data 域需要 live MySQL 只读连接 + schema 自省（见 docs/NEEDS_LIVE.md），
本层不假装能装配，data 域一律返回 None 走降级；travel 域已可真实装配。
"""

from __future__ import annotations

import uuid
from contextlib import ExitStack
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Header
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.core.db import session_scope
from app.core.logging import get_logger
from app.orchestrator.factory import DomainAgentFactory
from app.orchestrator.intent.defaults import default_rule_matcher
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.supervisor import Supervisor
from app.platform.auth.security import decode_token
from app.platform.hooks.base import HookChain, HookContext
from app.platform.hooks.persistence import PersistenceHook
from app.platform.hooks.progress import ProgressHook
from app.platform.session.sink import DbMessageSink

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    query: str
    conversation_id: str | None = None
    online: bool = False
    file_ids: list[str] = []


class _RequestContext:
    """按请求提供领域工具上下文（满足 orchestrator.factory.DomainContextProvider）。

    工具持有的 session 必须活到流结束（Agent 在流式过程中才调用工具），
    但又不能用 FastAPI 的 yield 依赖（流式响应下它会被提前关闭）。
    因此自建 session 并用 ExitStack 托管，由调用方在流结束时 close()。
    """

    def __init__(self, user_id: int, dept_id: int = 0) -> None:
        self.user_id = user_id
        self.dept_id = dept_id
        self._stack = ExitStack()

    def data_tools(self) -> Any:
        # data 域需要 live 业务库只读连接 + M-Schema 自省，此处不具备，交由工厂降级。
        raise NotImplementedError("data 域需 live MySQL 只读连接，见 docs/NEEDS_LIVE.md")

    def travel_tools(self) -> Any:
        from app.domains.travel.business.service import load_policy_engine
        from app.domains.travel.tools.travel_tools import TravelAgentContext, TravelTools

        session = self._stack.enter_context(session_scope())
        engine = load_policy_engine(session)
        return TravelTools(
            TravelAgentContext(
                session=session,
                user_id=self.user_id,
                dept_id=self.dept_id,
                policy=engine,
            )
        )

    def close(self) -> None:
        """释放本次请求装配工具时开出的所有 session。"""
        self._stack.close()


class _ChatFactory:
    """包一层 DomainAgentFactory：data 域缺 live 依赖时安全降级而非 500。"""

    def __init__(self, ctx: _RequestContext) -> None:
        self._inner = DomainAgentFactory(ctx)

    def build(self, domain: str) -> Any | None:
        try:
            return self._inner.build(domain)
        except NotImplementedError as exc:
            logger.info("domain_not_wired_degrade", domain=domain, reason=str(exc))
            return None
        except Exception as exc:  # 宽捕获是刻意的：装配失败降级，不让聊天接口 500
            logger.exception("agent_build_failed", domain=domain, error=str(exc))
            return None


def _identify(authorization: str | None) -> int | None:
    """从可选的 Authorization 头解析 user_id。无效或缺失均返回 None（匿名）。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload = decode_token(authorization.removeprefix("Bearer ").strip())
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        logger.info("chat_anonymous_invalid_token")
        return None


def _build_hooks(persist: bool) -> HookChain:
    hooks: list[Any] = [ProgressHook()]
    if persist:
        hooks.append(PersistenceHook(sink=DbMessageSink()))
    return HookChain(hooks=hooks)


@router.post("")
async def chat(
    req: ChatRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> EventSourceResponse:
    user_id = _identify(authorization)
    conversation_id = req.conversation_id or uuid.uuid4().hex

    # 只有登录用户才落库：匿名会话没有归属，存了也无法回放
    persist = user_id is not None
    if persist:
        from fastapi.concurrency import run_in_threadpool

        from app.platform.session.service import get_or_create_conversation

        def _ensure() -> None:
            with session_scope() as session:
                get_or_create_conversation(session, user_id or 0, conversation_id)

        await run_in_threadpool(_ensure)

    ctx = HookContext(
        query=req.query,
        user_id=user_id,
        conversation_id=conversation_id if persist else None,
    )
    provider = _RequestContext(user_id or 0)
    supervisor = Supervisor(
        IntentPipeline(default_rule_matcher()),
        _ChatFactory(provider),
        hooks=_build_hooks(persist),
    )

    async def _gen():  # type: ignore[no-untyped-def]
        try:
            async for evt in supervisor.handle(req.query, ctx=ctx):
                yield evt.to_sse()
        finally:
            # 客户端提前断开时也要走到这里，避免 session 泄漏
            provider.close()

    return EventSourceResponse(_gen())
