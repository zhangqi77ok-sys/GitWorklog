"""会话接口（对应 gogo/dodo 的 /session）：列表、回放、改名。

会话持久化见 platform/session（P1-M3）。均按当前用户隔离。
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.session import service

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


@router.get("/list")
def list_sessions(session: DbDep, user: CurrentUser) -> R[list[ConversationBrief]]:
    convs = service.list_conversations(session, user.id)
    return R.ok(
        [ConversationBrief(conversation_id=c.conversation_id, title=c.title) for c in convs]
    )


@router.get("/{conversation_id}/messages")
def get_messages(conversation_id: str, session: DbDep, _: CurrentUser) -> R[list[MessageBrief]]:
    msgs = service.get_messages(session, conversation_id)
    return R.ok([MessageBrief(role=m.role, content=m.content, extra=m.extra) for m in msgs])


@router.put("/{conversation_id}/title")
def rename(conversation_id: str, req: RenameRequest, session: DbDep, _: CurrentUser) -> R[None]:
    service.rename_conversation(session, conversation_id, req.title)
    return R.ok(None)
