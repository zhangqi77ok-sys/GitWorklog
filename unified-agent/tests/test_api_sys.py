"""sys API 测试：admin 守卫、角色/部门只读。SQLite 依赖覆盖。"""

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
from app.platform.auth.datascope import DataScope
from app.platform.auth.security import hash_password
from app.platform.user.models import SysDept, SysRole, SysUser, SysUserRole


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

    s = factory()
    s.add(SysUser(id=1, username="admin", password=hash_password("pw"), status=1))
    s.add(SysUser(id=2, username="bob", password=hash_password("pw"), status=1))
    s.add(SysRole(id=1, code="admin", name="管理员", data_scope=int(DataScope.ALL)))
    s.add(SysRole(id=2, code="user", name="员工", data_scope=int(DataScope.DEPT)))
    s.add(SysUserRole(user_id=1, role_id=1))
    s.add(SysUserRole(user_id=2, role_id=2))
    s.add(SysDept(id=1, name="总部", parent_id=0))
    s.add(SysDept(id=2, name="研发", parent_id=1))
    s.commit()
    s.close()

    def _override() -> Iterator[Session]:
        sess = factory()
        try:
            yield sess
        finally:
            sess.close()

    app.dependency_overrides[db_session] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


def _token(client: TestClient, username: str) -> str:
    return client.post("/auth/login", json={"username": username, "password": "pw"}).json()["data"][
        "token"
    ]


def test_admin_can_list_users(client: TestClient) -> None:
    token = _token(client, "admin")
    resp = client.get("/sys/user/list", headers={"Authorization": f"Bearer {token}"})
    body = resp.json()
    assert body["code"] == 0
    assert len(body["data"]) == 2


def test_non_admin_forbidden(client: TestClient) -> None:
    token = _token(client, "bob")
    resp = client.get("/sys/user/list", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["code"] == 40300  # NoPermissionError


def test_role_list_any_user(client: TestClient) -> None:
    token = _token(client, "bob")
    resp = client.get("/sys/role/list", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["code"] == 0
    assert len(resp.json()["data"]) == 2


def test_dept_tree(client: TestClient) -> None:
    token = _token(client, "admin")
    resp = client.get("/sys/dept/tree", headers={"Authorization": f"Bearer {token}"})
    data = resp.json()["data"]
    assert len(data["nodes"]) == 2
    assert sorted(data["subtree"]["1"]) == [1, 2]


def test_session_list_empty(client: TestClient) -> None:
    token = _token(client, "bob")
    resp = client.get("/session/list", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["data"] == []
