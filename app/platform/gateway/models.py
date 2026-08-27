"""LLM 智能网关 ORM 模型。"""

from __future__ import annotations

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class LLMProviderRecord(Base, TimestampMixin):
    """LLM 厂商配置表。"""

    __tablename__ = "agentx_llm_provider"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    base_url: Mapped[str] = mapped_column(String(255))
    api_key: Mapped[str] = mapped_column(Text, default="")
    protocol: Mapped[str] = mapped_column(String(32), default="openai")  # openai, anthropic, ollama
    enabled: Mapped[int] = mapped_column(default=1)  # 1 启用 0 停用
    models_json: Mapped[str] = mapped_column(Text, default="[]")  # 自定义与官方同步的模型列表 JSON


class LLMRouteRecord(Base, TimestampMixin):
    """功能槽位与模型路由映射表。"""

    __tablename__ = "agentx_llm_route"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feature_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # 如: chat_default, data_analysis, intent_classify, memory_extract, coding_agent
    feature_name: Mapped[str] = mapped_column(String(64))
    provider_code: Mapped[str] = mapped_column(String(64))
    model_name: Mapped[str] = mapped_column(String(128))
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048)
