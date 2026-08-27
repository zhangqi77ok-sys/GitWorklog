from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from app.core.db import Base

class TokenUsageRecord(Base):
    __tablename__ = "token_usage_records"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), index=True, nullable=False)
    provider = Column(String(64), default="antigravity")
    model = Column(String(64), default="antigravity-core")
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_duration = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
