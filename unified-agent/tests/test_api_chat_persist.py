"""chat 接入层集成测试：真实接线后会话是否落库、匿名是否跳过。

针对性回归：此前 chat.py 的工厂恒返回 None、conversation_id 收了不用，
聊天记录实际从不落库。这里用 SQLite 顶掉全局 session 工厂，
走完整的 POST /api/chat → Hook 链 → DbMessageSink → chat_message 表链路。

注意不能只覆盖 db_session 依赖：chat 走的是 session_scope()（流式响应下
不能依赖 FastAPI 的 yield 依赖），所以要替换 app.core.db 的全局工厂。
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.db as core_db
from app.api.deps import db_session
from app.core.db import Base
from app.main import app
from app.platform.auth.security import create_token, hash_password
from app.platform.session.service import get_messages
from app.platform.user.models import SysUser


@pytest.fixture
def factory() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    f = sessionmaker(bind=engine, expire_on_commit=False, future=True)

    s = f()
    s.add(SysUser(id=1, username="alice", password=hash_password("pw"), status=1))
    s.commit()
    s.close()

    # chat.py / sink.py 走 session_scope()，它取的是模块级全局工厂
    original = core_db._session_factory
    core_db._session_factory = f

    def _override() -> Iterator[Session]:
        sess = f()
        try:
            yield sess
        finally:
            sess.close()

    app.dependency_overrides[db_session] = _override
    try:
        yield f
    finally:
        core_db._session_factory = original
        app.dependency_overrides.clear()


def _drain(client: TestClient, payload: dict, headers: dict | None = None) -> str:
    with client.stream("POST", "/api/chat", json=payload, headers=headers or {}) as r:
        assert r.status_code == 200
        return "".join(r.iter_text())


def test_chat_persists_for_logged_in_user(factory: sessionmaker[Session]) -> None:
    client = TestClient(app)
    token = create_token(1)
    body = _drain(
        client,
        {"query": "我要订机票", "conversation_id": "conv-persist"},
        {"Authorization": f"Bearer {token}"},
    )

    # Hook 的阶段事件确实进了流
    assert '"phase": "start"' in body
    assert '"phase": "finish"' in body

    with factory() as session:
        msgs = get_messages(session, "conv-persist")

    assert [m.role for m in msgs] == ["user", "assistant"]
    assert msgs[0].content == "我要订机票"
    assert msgs[1].content  # 助手回答非空（降级态是占位文本）
    assert '"event": "progress"' in msgs[1].extra  # 富事件序列化进 extra


def test_chat_anonymous_does_not_persist(factory: sessionmaker[Session]) -> None:
    """无 token 仍可用，但不落库——匿名会话没有归属。"""
    client = TestClient(app)
    body = _drain(client, {"query": "我要订机票", "conversation_id": "conv-anon"})

    assert '"phase": "start"' in body  # 进度 Hook 对匿名同样生效
    with factory() as session:
        assert get_messages(session, "conv-anon") == []


def test_chat_invalid_token_degrades_to_anonymous(factory: sessionmaker[Session]) -> None:
    """伪造 token 不该 500，按匿名处理。"""
    client = TestClient(app)
    body = _drain(
        client,
        {"query": "你好", "conversation_id": "conv-bad"},
        {"Authorization": "Bearer not-a-real-token"},
    )

    assert '"event": "done"' in body or "done" in body
    with factory() as session:
        assert get_messages(session, "conv-bad") == []
