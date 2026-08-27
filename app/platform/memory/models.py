"""用户长期记忆与知识图谱 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class UserMemoryRecord(Base, TimestampMixin):
    """用户长期记忆与画像特征表。"""

    __tablename__ = "agentx_user_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id"), index=True)
    memory_type: Mapped[str] = mapped_column(
        String(32), default="preference"
    )  # preference, trait, topic, restriction
    key: Mapped[str] = mapped_column(String(64), index=True)
    value: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source_session_id: Mapped[str] = mapped_column(String(64), default="")


class UserGraphEdge(Base, TimestampMixin):
    """用户知识图谱三元组关系表：(User) -> Relation -> Entity。"""

    __tablename__ = "agentx_user_graph_edge"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id"), index=True)
    source_node: Mapped[str] = mapped_column(String(64), default="当前用户")
    relation: Mapped[str] = mapped_column(
        String(64), index=True
    )  # LIVES_IN, PREFERS_AIRLINE, PREFERS_HOTEL, FOCUSES_ON, HABIT
    target_node: Mapped[str] = mapped_column(String(128))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
