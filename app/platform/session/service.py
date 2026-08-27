from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.platform.session.models import Conversation, ChatMessage
from app.core.eventbus import get_event_bus, PlatformEvent

def list_conversations(db: Session) -> list[Conversation]:
    stmt = select(Conversation).order_by(desc(Conversation.updated_at))
    return list(db.scalars(stmt).all())

def search_conversations(db: Session, q: str) -> list[Conversation]:
    convs = list_conversations(db)
    if not q:
        return convs
    q_lower = q.lower()
    return [c for c in convs if q_lower in (c.title or "").lower() or q_lower in (c.tags or "").lower()]

def get_or_create_conversation(db: Session, conversation_id: str, title: str = "新会话", tags: str = "feat,coding") -> Conversation:
    stmt = select(Conversation).where(Conversation.conversation_id == conversation_id)
    c = db.scalar(stmt)
    if not c:
        c = Conversation(conversation_id=conversation_id, title=title, tags=tags, status="idle")
        db.add(c)
        db.commit()
        db.refresh(c)
        get_event_bus().publish(PlatformEvent("session.created", {"conversation_id": conversation_id}))
    return c

def rename_conversation(db: Session, conversation_id: str, title: str) -> None:
    stmt = select(Conversation).where(Conversation.conversation_id == conversation_id)
    c = db.scalar(stmt)
    if c:
        c.title = title
        db.commit()

def update_conversation_tags(db: Session, conversation_id: str, tags: list[str]) -> None:
    stmt = select(Conversation).where(Conversation.conversation_id == conversation_id)
    c = db.scalar(stmt)
    if c:
        c.tags = ",".join(tags)
        db.commit()

def update_conversation_status(db: Session, conversation_id: str, status: str) -> None:
    stmt = select(Conversation).where(Conversation.conversation_id == conversation_id)
    c = db.scalar(stmt)
    if c:
        c.status = status
        db.commit()
        get_event_bus().publish(PlatformEvent("session.status_changed", {"conversation_id": conversation_id, "status": status}))

def delete_conversation(db: Session, conversation_id: str) -> None:
    db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation_id).delete()
    db.query(Conversation).filter(Conversation.conversation_id == conversation_id).delete()
    db.commit()
    get_event_bus().publish(PlatformEvent("session.deleted", {"conversation_id": conversation_id}))

def append_message(db: Session, conversation_id: str, role: str, content: str, extra: str = "") -> ChatMessage:
    msg = ChatMessage(conversation_id=conversation_id, role=role, content=content, extra=extra)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    get_event_bus().publish(PlatformEvent("session.message_appended", {"conversation_id": conversation_id, "role": role, "content": content}))
    return msg

def get_messages(db: Session, conversation_id: str) -> list[ChatMessage]:
    stmt = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id).order_by(ChatMessage.id.asc())
    return list(db.scalars(stmt).all())
