"""Skills 注册表 ORM（对应 dodo 的 agentx_skill）。

FS 为权威源，DB 记录启停状态。同步时以 FS 为准更新元数据，保留 enabled 标记。
"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class SkillRecord(Base, TimestampMixin):
    __tablename__ = "agentx_skill"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(512), default="")
    skill_dir: Mapped[str] = mapped_column(String(512), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[int] = mapped_column(default=1)  # 1 启用 0 停用
