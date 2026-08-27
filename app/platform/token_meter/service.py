"""Token 计量与消费统计服务。"""

from __future__ import annotations

from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.platform.token_meter.models import AgentxTokenUsage


class TokenUsageService:
    """负责记录和统计 Token 消耗数据。"""

    def record_usage(
        self,
        session: Session,
        conversation_id: str,
        provider_code: str,
        model_name: str,
        agent_role: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int = 0,
    ) -> AgentxTokenUsage:
        total = prompt_tokens + completion_tokens
        rec = AgentxTokenUsage(
            conversation_id=conversation_id,
            provider_code=provider_code,
            model_name=model_name,
            agent_role=agent_role,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total,
            latency_ms=latency_ms,
        )
        session.add(rec)
        session.commit()
        session.refresh(rec)
        return rec

    def get_session_tokens(self, session: Session, conversation_id: str) -> dict[str, Any]:
        stmt = (
            select(
                func.coalesce(func.sum(AgentxTokenUsage.prompt_tokens), 0),
                func.coalesce(func.sum(AgentxTokenUsage.completion_tokens), 0),
                func.coalesce(func.sum(AgentxTokenUsage.total_tokens), 0),
                func.count(AgentxTokenUsage.id),
            )
            .where(AgentxTokenUsage.conversation_id == conversation_id)
        )
        p, c, t, count = session.execute(stmt).one()
        return {
            "conversation_id": conversation_id,
            "prompt_tokens": int(p),
            "completion_tokens": int(c),
            "total_tokens": int(t),
            "call_count": int(count),
        }

    def get_global_summary(self, session: Session) -> dict[str, Any]:
        stmt = select(
            func.coalesce(func.sum(AgentxTokenUsage.prompt_tokens), 0),
            func.coalesce(func.sum(AgentxTokenUsage.completion_tokens), 0),
            func.coalesce(func.sum(AgentxTokenUsage.total_tokens), 0),
            func.count(AgentxTokenUsage.id),
            func.coalesce(func.avg(AgentxTokenUsage.latency_ms), 0),
        )
        p, c, t, count, avg_lat = session.execute(stmt).one()

        # 按模型分组聚合
        model_stmt = (
            select(
                AgentxTokenUsage.model_name,
                func.sum(AgentxTokenUsage.total_tokens),
                func.count(AgentxTokenUsage.id),
            )
            .group_by(AgentxTokenUsage.model_name)
        )
        by_model = [
            {"model": m, "total_tokens": int(tot or 0), "calls": int(calls)}
            for m, tot, calls in session.execute(model_stmt).all()
        ]

        return {
            "total_prompt_tokens": int(p),
            "total_completion_tokens": int(c),
            "total_tokens": int(t),
            "total_calls": int(count),
            "avg_latency_ms": round(float(avg_lat), 1),
            "by_model": by_model or [{"model": "qwen3.7-flash", "total_tokens": int(t), "calls": int(count)}],
        }


_token_service = TokenUsageService()

def get_token_usage_service() -> TokenUsageService:
    return _token_service