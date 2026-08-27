from sqlalchemy import select, func
from app.core.db import session_scope
from app.platform.token_meter.models import TokenUsageRecord

class TokenMeterService:
    def record_usage(self, conversation_id: str, provider: str, model: str, prompt_tokens: int, completion_tokens: int, cost_duration: float = 0.0) -> TokenUsageRecord:
        with session_scope() as db:
            rec = TokenUsageRecord(
                conversation_id=conversation_id,
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                cost_duration=cost_duration,
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

    def get_summary(self, conversation_id: str | None = None) -> dict:
        with session_scope() as db:
            stmt = select(
                func.sum(TokenUsageRecord.prompt_tokens),
                func.sum(TokenUsageRecord.completion_tokens),
                func.sum(TokenUsageRecord.total_tokens),
                func.count(TokenUsageRecord.id),
            )
            if conversation_id:
                stmt = stmt.where(TokenUsageRecord.conversation_id == conversation_id)
            res = db.execute(stmt).first()
            p_sum = int(res[0] or 0)
            c_sum = int(res[1] or 0)
            t_sum = int(res[2] or 0)
            count = int(res[3] or 0)
            return {
                "prompt_tokens": p_sum,
                "completion_tokens": c_sum,
                "total_tokens": t_sum,
                "call_count": count,
            }

_meter_service = TokenMeterService()
def get_token_meter() -> TokenMeterService:
    return _meter_service
