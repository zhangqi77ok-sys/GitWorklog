"""文件与知识库 ORM 模型（对应 dodo 的 agentx_file）。

记录上传文件元数据、存储路径、类型、大小、解析出的文本内容与摘要。
"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class KnowledgeBaseRecord(Base, TimestampMixin):
    """知识库分组模型（agentx_knowledge_base）。"""

    __tablename__ = "agentx_knowledge_base"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(512), default="")
    user_id: Mapped[int] = mapped_column(Integer, default=0)


class FileRecord(Base, TimestampMixin):
    __tablename__ = "agentx_file"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    stored_path: Mapped[str] = mapped_column(String(512), default="")
    kind: Mapped[str] = mapped_column(String(32), default="text")  # text / document / image
    text_content: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(String(512), default="")
    user_id: Mapped[int] = mapped_column(Integer, default=0)
    kb_id: Mapped[int] = mapped_column(Integer, default=0, index=True)

