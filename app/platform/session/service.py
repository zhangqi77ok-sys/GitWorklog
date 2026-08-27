"""会话持久化 service：创建会话、追加消息、列表、回放（SQLAlchemy，SQLite 可测）。"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.platform.session.models import ChatConversation, ChatMessage


def owns_conversation(session: Session, user_id: int, conversation_id: str) -> bool:
    """会话是否属于该用户。

    读/改会话必须先过这道校验：conversation_id 是可猜的标识，
    只验「已登录」不验「是本人的」等于任何登录用户都能翻别人的聊天记录。
    不存在的会话同样返回 False，避免用响应差异探测 id 是否存在。
    """
    conv = session.execute(
        select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
    ).scalar_one_or_none()
    return conv is not None and conv.user_id == user_id


def get_or_create_conversation(
    session: Session, user_id: int, conversation_id: str | None = None
) -> ChatConversation:
    """按 conversation_id 取会话；无则新建（归属 user_id）。"""
    if conversation_id:
        stmt = select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
        conv = session.execute(stmt).scalar_one_or_none()
        if conv is not None:
            return conv
    conv = ChatConversation(
        conversation_id=conversation_id or uuid.uuid4().hex,
        user_id=user_id,
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


def append_message(
    session: Session,
    conversation_id: str,
    role: str,
    content: str,
    extra: str = "",
) -> ChatMessage:
    msg = ChatMessage(conversation_id=conversation_id, role=role, content=content, extra=extra)
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def list_conversations(session: Session, user_id: int) -> list[ChatConversation]:
    stmt = (
        select(ChatConversation)
        .where(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.id.desc())
    )
    return list(session.execute(stmt).scalars())


def get_messages(session: Session, conversation_id: str) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.id.asc())
    )
    return list(session.execute(stmt).scalars())


def rename_conversation(session: Session, conversation_id: str, title: str) -> None:
    conv = session.execute(
        select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
    ).scalar_one_or_none()
    if conv is not None:
        conv.title = title
        session.commit()


def update_conversation_tags(session: Session, conversation_id: str, tags: list[str]) -> None:
    conv = session.execute(
        select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
    ).scalar_one_or_none()
    if conv is not None:
        conv.tags = ",".join(tags)
        session.commit()


def update_conversation_status(session: Session, conversation_id: str, status: str) -> None:
    conv = session.execute(
        select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
    ).scalar_one_or_none()
    if conv is not None:
        conv.status = status
        session.commit()


def search_conversations(session: Session, user_id: int, query: str) -> list[ChatConversation]:
    query_str = f"%{query}%"
    stmt = (
        select(ChatConversation)
        .where(
            ChatConversation.user_id == user_id,
            (ChatConversation.title.like(query_str) | ChatConversation.tags.like(query_str)),
        )
        .order_by(ChatConversation.id.desc())
    )
    return list(session.execute(stmt).scalars())


def delete_conversation(session: Session, conversation_id: str) -> None:
    """删除会话及其所有关联消息。"""
    from sqlalchemy import delete

    session.execute(delete(ChatMessage).where(ChatMessage.conversation_id == conversation_id))
    session.execute(
        delete(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
    )
    session.commit()
