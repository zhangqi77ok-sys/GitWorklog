"""Token 消耗流水 ORM 模型。"""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class AgentxTokenUsage(Base, TimestampMixin):
    __tablename__ = "agentx_token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True, default="")
    provider_code: Mapped[str] = mapped_column(String(32), default="bailian")
    model_name: Mapped[str] = mapped_column(String(64), default="qwen3.7-flash")
    agent_role: Mapped[str] = mapped_column(String(32), default="coder")
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)