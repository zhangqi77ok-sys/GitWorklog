"""会话持久化 ORM（对应 gogo/dodo 的 chat_conversation / chat_message）。

会话按 userId 隔离。消息支持富事件字段（thinking/progress/travel_data 等）
以 JSON 存 extra，前端回放时还原。
"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class ChatConversation(Base, TimestampMixin):
    __tablename__ = "chat_conversation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(255), default="新对话")


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user / assistant
    content: Mapped[str] = mapped_column(Text, default="")
    # 富事件（thinking/progress/travel_data/plan/timeline 等）JSON 字符串
    extra: Mapped[str] = mapped_column(Text, default="")
