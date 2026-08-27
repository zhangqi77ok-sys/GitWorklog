from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.api.deps import DbDep
from app.core.response import R
from app.platform.session import service

router = APIRouter(prefix="/session", tags=["session"])

class ConversationBrief(BaseModel):
    conversation_id: str
    title: str
    tags: list[str] = []
    status: str = "idle"

class MessageBrief(BaseModel):
    role: str
    content: str
    extra: str = ""

class RenameRequest(BaseModel):
    title: str = "新会话"
    tags: str = ""

class TagsRequest(BaseModel):
    tags: list[str]

class StatusRequest(BaseModel):
    status: str

@router.get("")
@router.get("/")
@router.get("/list")
def list_sessions(session: DbDep) -> R[list[ConversationBrief]]:
    convs = service.list_conversations(session)
    if not convs:
        init_conv = service.get_or_create_conversation(session, "conv-cabinet-main", "RunCabinet 暖色多Agent协同工程", "feat,coding,review")
        convs = [init_conv]
    return R.ok([
        ConversationBrief(
            conversation_id=c.conversation_id,
            title=c.title,
            tags=[t for t in (c.tags or "").split(",") if t],
            status=c.status or "idle"
        )
        for c in convs
    ])

@router.get("/search")
def search_sessions(session: DbDep, q: str = "") -> R[list[ConversationBrief]]:
    convs = service.search_conversations(session, q)
    return R.ok([
        ConversationBrief(
            conversation_id=c.conversation_id,
            title=c.title,
            tags=[t for t in (c.tags or "").split(",") if t],
            status=c.status or "idle"
        )
        for c in convs
    ])

@router.post("/{conversation_id}/rename")
@router.put("/{conversation_id}/title")
def rename_session(conversation_id: str, req: RenameRequest, session: DbDep) -> R[dict[str, Any]]:
    service.get_or_create_conversation(session, conversation_id, req.title, req.tags)
    service.rename_conversation(session, conversation_id, req.title)
    if req.tags:
        service.update_conversation_tags(session, conversation_id, [t.strip() for t in req.tags.split(",") if t.strip()])
    return R.ok({"conversation_id": conversation_id, "title": req.title, "tags": req.tags})

@router.post("/{conversation_id}/tags")
def set_tags(conversation_id: str, req: TagsRequest, session: DbDep) -> R[dict[str, Any]]:
    service.update_conversation_tags(session, conversation_id, req.tags)
    return R.ok({"conversation_id": conversation_id, "tags": req.tags})

@router.post("/{conversation_id}/status")
def set_status(conversation_id: str, req: StatusRequest, session: DbDep) -> R[dict[str, Any]]:
    service.update_conversation_status(session, conversation_id, req.status)
    return R.ok({"conversation_id": conversation_id, "status": req.status})

@router.delete("/{conversation_id}")
def delete_session(conversation_id: str, session: DbDep) -> R[None]:
    service.delete_conversation(session, conversation_id)
    return R.ok(None)

@router.get("/{conversation_id}/messages")
def get_messages(conversation_id: str, session: DbDep) -> R[list[MessageBrief]]:
    msgs = service.get_messages(session, conversation_id)
    return R.ok([MessageBrief(role=m.role, content=m.content, extra=m.extra) for m in msgs])
