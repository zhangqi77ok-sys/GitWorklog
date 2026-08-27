"""Multi-Agent Mesh 协同测试。"""

import pytest
from app.platform.agent_mesh.mesh import MultiAgentOrchestrator
from app.platform.eventbus import AgentEvent, AgentEventType


@pytest.mark.asyncio
async def test_mesh_code_pipeline():
    mesh = MultiAgentOrchestrator()
    roles = mesh.list_roles()
    assert len(roles) >= 4

    # 触发代码生成事件 -> 自动触发 Reviewer 审查通过 -> 触发 Tester 完成单测
    await mesh.bus.publish(AgentEvent(
        event_type=AgentEventType.CODE_GENERATED,
        sender_agent="coder",
        conversation_id="conv-mesh-1",
        payload={"file_path": "app/demo.py", "code": "def run(): return 42"}
    ))

    history = mesh.bus.get_history("conv-mesh-1")
    assert len(history) >= 2
    types = [h.event_type for h in history]
    assert AgentEventType.CODE_REVIEW_COMPLETED in types
    assert AgentEventType.TEST_EXECUTION_COMPLETED in types