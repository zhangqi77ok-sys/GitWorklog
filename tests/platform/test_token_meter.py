"""Token 计量与消费统计单元测试。"""

from app.core.db import session_scope
from app.platform.token_meter.service import TokenUsageService


def test_token_usage_recording_and_summary():
    svc = TokenUsageService()
    conv_id = "test-token-conv-1"

    with session_scope() as session:
        # 记录两次调用流水
        rec1 = svc.record_usage(
            session=session,
            conversation_id=conv_id,
            provider_code="bailian",
            model_name="qwen3.7-flash",
            agent_role="coder",
            prompt_tokens=120,
            completion_tokens=350,
            latency_ms=450
        )
        assert rec1.total_tokens == 470

        rec2 = svc.record_usage(
            session=session,
            conversation_id=conv_id,
            provider_code="bailian",
            model_name="qwen3.7-flash",
            agent_role="reviewer",
            prompt_tokens=300,
            completion_tokens=150,
            latency_ms=320
        )
        assert rec2.total_tokens == 450

        # 查询会话 Token 统计
        session_stats = svc.get_session_tokens(session, conv_id)
        assert session_stats["total_tokens"] >= 920
        assert session_stats["call_count"] >= 2

        # 查询全局汇总
        summary = svc.get_global_summary(session)
        assert summary["total_tokens"] >= 920
        assert len(summary["by_model"]) >= 1