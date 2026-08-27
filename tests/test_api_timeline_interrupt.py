from __future__ import annotations

import json
from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import db_session
from app.core.db import Base
from app.main import app
from app.platform.auth.security import create_token
from app.platform.session.models import ChatConversation, ChatMessage
from app.platform.session.registry import (
    RedisSessionRegistry,
    SessionRegistry,
    set_session_registry,
)
from app.platform.user.models import SysUser

ALICE, BOB = 1, 2


@pytest.fixture
def client_fixture() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True
    )
    Base.metadata.create_all(engine)
    f = sessionmaker(bind=engine, expire_on_commit=False, future=True)

    s = f()
    for uid, name in ((ALICE, "alice"), (BOB, "bob")):
        s.add(SysUser(id=uid, username=name, password="x", status=1))
    s.commit()
    s.close()

    def _override() -> Iterator[Session]:
        sess = f()
        try:
            yield sess
        finally:
            sess.close()

    app.dependency_overrides[db_session] = _override
    try:
        yield TestClient(app), f
    finally:
        app.dependency_overrides.pop(db_session, None)


def test_session_interrupt_api(client_fixture):
    client, factory = client_fixture
    with factory() as s:
        conv = ChatConversation(conversation_id="conv_test_interrupt", user_id=ALICE, title="Test")
        s.add(conv)
        s.commit()

    token_alice = create_token(ALICE)
    token_bob = create_token(BOB)

    registry = SessionRegistry()
    registry.register("conv_test_interrupt")
    set_session_registry(registry)

    # Bob cannot interrupt Alice's session
    resp_bob = client.post(
        "/session/conv_test_interrupt/interrupt",
        headers={"Authorization": f"Bearer {token_bob}"},
    )
    assert resp_bob.status_code == 200
    assert resp_bob.json()["code"] != 0

    # Alice interrupts her session
    resp_alice = client.post(
        "/session/conv_test_interrupt/interrupt",
        headers={"Authorization": f"Bearer {token_alice}"},
    )
    assert resp_alice.status_code == 200
    data = resp_alice.json()["data"]
    assert data["interrupted"] is True
    assert registry.is_interrupted("conv_test_interrupt") is True


def test_session_timeline_api(client_fixture):
    client, factory = client_fixture
    with factory() as s:
        conv = ChatConversation(
            conversation_id="conv_timeline_1", user_id=ALICE, title="Timeline Test"
        )
        s.add(conv)
        s.flush()

        m1 = ChatMessage(
            conversation_id="conv_timeline_1",
            role="user",
            content="帮我查上海机票",
            extra="",
        )
        m2 = ChatMessage(
            conversation_id="conv_timeline_1",
            role="assistant",
            content="正在查询...",
            extra=json.dumps({"domain": "travel", "intent": "travel_booking"}),
        )
        s.add_all([m1, m2])
        s.commit()

    token_alice = create_token(ALICE)

    resp = client.get(
        "/session/conv_timeline_1/timeline",
        headers={"Authorization": f"Bearer {token_alice}"},
    )
    assert resp.status_code == 200
    timeline = resp.json()["data"]
    assert len(timeline) == 2
    assert timeline[0]["event_type"] == "message"
    assert timeline[1]["event_type"] == "intent_routing"
    assert "travel" in timeline[1]["summary"]


def test_redis_session_registry_broadcast():
    mock_redis = MagicMock()
    reg = RedisSessionRegistry(redis_client=mock_redis)
    reg.register("conv_dist_1")

    # Local interrupt publishes to channel
    reg.interrupt("conv_dist_1")
    assert reg.is_interrupted("conv_dist_1") is True
    mock_redis.publish.assert_called_once_with(RedisSessionRegistry.CHANNEL, "conv_dist_1")

    # Receiving broadcast
    reg2 = RedisSessionRegistry(redis_client=mock_redis)
    reg2.register("conv_dist_2")
    reg2.handle_broadcast_message("conv_dist_2")
    assert reg2.is_interrupted("conv_dist_2") is True
