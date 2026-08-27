"""会话接口（对应 gogo/dodo 的 /session）：列表、回放、改名。

会话持久化见 platform/session（P1-M3）。均按当前用户隔离。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep
from app.core.exceptions import NoPermissionError
from app.core.response import R
from app.platform.session import service
from app.platform.user.models import SysUser

router = APIRouter(prefix="/session", tags=["session"])


class ConversationBrief(BaseModel):
    conversation_id: str
    title: str


class MessageBrief(BaseModel):
    role: str
    content: str
    extra: str


class RenameRequest(BaseModel):
    title: str


class TimelineEventBrief(BaseModel):
    id: int
    role: str
    content: str
    event_type: str
    summary: str
    extra: dict | list | str | None = None
    created_at: str | None = None


class InterruptResponse(BaseModel):
    interrupted: bool
    conversation_id: str


@router.get("/list")
def list_sessions(session: DbDep, user: CurrentUser) -> R[list[ConversationBrief]]:
    convs = service.list_conversations(session, user.id)
    return R.ok(
        [ConversationBrief(conversation_id=c.conversation_id, title=c.title) for c in convs]
    )


def _require_own(session: DbDep, user: SysUser, conversation_id: str) -> None:
    """校验会话归属。conversation_id 可猜，只验登录等于人人可读他人记录。"""
    if not service.owns_conversation(session, user.id, conversation_id):
        raise NoPermissionError("会话不存在或无权访问")


@router.get("/{conversation_id}")
@router.get("/{conversation_id}/messages")
def get_messages(conversation_id: str, session: DbDep, user: CurrentUser) -> R[list[MessageBrief]]:
    _require_own(session, user, conversation_id)
    msgs = service.get_messages(session, conversation_id)
    return R.ok([MessageBrief(role=m.role, content=m.content, extra=m.extra) for m in msgs])


@router.put("/{conversation_id}/title")
def rename(conversation_id: str, req: RenameRequest, session: DbDep, user: CurrentUser) -> R[None]:
    _require_own(session, user, conversation_id)
    service.rename_conversation(session, conversation_id, req.title)
    return R.ok(None)


@router.delete("/{conversation_id}")
def delete_session(conversation_id: str, session: DbDep, user: CurrentUser) -> R[None]:
    _require_own(session, user, conversation_id)
    service.delete_conversation(session, conversation_id)
    return R.ok(None)


@router.post("/{conversation_id}/interrupt")
def interrupt_session(
    conversation_id: str, session: DbDep, user: CurrentUser
) -> R[InterruptResponse]:
    """主动中断正在执行中的会话（P1-M5）。"""
    from app.platform.session.registry import get_session_registry

    _require_own(session, user, conversation_id)
    registry = get_session_registry()
    success = registry.interrupt(conversation_id)
    return R.ok(InterruptResponse(interrupted=success, conversation_id=conversation_id))


@router.get("/{conversation_id}/timeline")
def get_timeline(
    conversation_id: str, session: DbDep, user: CurrentUser
) -> R[list[TimelineEventBrief]]:
    """提取会话结构化 Trace / Timeline 时间线数据（F-2）。"""
    import json

    _require_own(session, user, conversation_id)
    msgs = service.get_messages(session, conversation_id)
    timeline: list[TimelineEventBrief] = []

    for idx, m in enumerate(msgs, start=1):
        parsed_extra: dict | list | str | None = None
        event_type = "message"
        summary = m.content[:40] + ("..." if len(m.content) > 40 else "")

        if m.extra:
            try:
                parsed_extra = json.loads(m.extra)
                if isinstance(parsed_extra, dict):
                    if "domain" in parsed_extra and "intent" in parsed_extra:
                        event_type = "intent_routing"
                        summary = f"路由至 {parsed_extra.get('domain')} (意图: {parsed_extra.get('intent')})"
                    elif "phase" in parsed_extra:
                        event_type = "phase"
                        summary = f"执行阶段: {parsed_extra.get('phase')}"
                    elif "tool_calls" in parsed_extra or "tools" in parsed_extra:
                        event_type = "tool_call"
                        summary = "调用工具执行"
                    elif "prompt" in parsed_extra and "options" in parsed_extra:
                        event_type = "human_interaction"
                        summary = f"等待用户交互: {parsed_extra.get('prompt')}"
            except Exception:
                parsed_extra = m.extra

        created_str = (
            m.created_at.isoformat() if hasattr(m, "created_at") and m.created_at else None
        )

        timeline.append(
            TimelineEventBrief(
                id=m.id or idx,
                role=m.role,
                content=m.content,
                event_type=event_type,
                summary=summary,
                extra=parsed_extra,
                created_at=created_str,
            )
        )
    return R.ok(timeline)
