"""EventBus 单元测试。"""

import pytest
from app.platform.eventbus import AgentEvent, AgentEventType, EventBus


@pytest.mark.asyncio
async def test_event_bus_pub_sub():
    bus = EventBus()
    received = []

    async def handler(event: AgentEvent):
        received.append(event)

    bus.subscribe(AgentEventType.CODE_GENERATED, handler)

    evt = AgentEvent(
        event_type=AgentEventType.CODE_GENERATED,
        sender_agent="coder",
        payload={"file": "test.py", "code": "print('ok')"}
    )
    await bus.publish(evt)

    assert len(received) == 1
    assert received[0].sender_agent == "coder"
    assert received[0].payload["file"] == "test.py"

    # 测试退订
    bus.unsubscribe(AgentEventType.CODE_GENERATED, handler)
    await bus.publish(evt)
    assert len(received) == 1