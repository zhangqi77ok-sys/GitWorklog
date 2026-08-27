"""API 集成测试：登录 → 带 token 访问 /auth/me。用 SQLite 覆盖 DB 依赖。"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import db_session
from app.core.db import Base
from app.main import app
from app.platform.auth.security import hash_password
from app.platform.user.models import SysUser

# bcrypt 单次约 0.33s（故意慢）。夹具只需要一个合法哈希，整模块算一次即可，
# 每个测试重算会让 setup 白烧大量时间。
_PW_HASH = hash_password("pw")


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)

    seed = factory()
    seed.add(SysUser(id=1, username="alice", password=_PW_HASH, status=1))
    seed.commit()
    seed.close()

    def _override() -> Iterator[Session]:
        s = factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[db_session] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


def test_login_and_me(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"username": "alice", "password": "pw"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    token = body["data"]["token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["username"] == "alice"


def test_login_bad_password(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"username": "alice", "password": "bad"})
    # BizError 处理器返回 200 + code!=0
    assert resp.json()["code"] == 40100


def test_me_without_token(client: TestClient) -> None:
    resp = client.get("/auth/me")
    assert resp.json()["code"] == 40100
