"""P1-A2 活跃会话 / 踢人下线测试。

JWT 是无状态的，签出去收不回——这组测试的重点就是验证「令牌密码学有效
但会话已被吊销」时确实拒绝访问。
"""

from __future__ import annotations

from collections.abc import Iterator

import fakeredis
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import db_session
from app.core.db import Base
from app.main import app
from app.platform.auth import session_store
from app.platform.auth.datascope import DataScope
from app.platform.auth.security import create_token, decode_token, hash_password
from app.platform.auth.service import kick_user, logout
from app.platform.auth.session_store import (
    InMemoryActiveSessionStore,
    RedisActiveSessionStore,
    check_active,
    register_session,
    reset_store,
    set_store,
)
from app.platform.user.models import SysRole, SysUser, SysUserRole

# bcrypt 单次约 0.33s（故意慢）。夹具只需要一个合法哈希，整模块算一次即可，
# 每个测试重算会让 setup 白烧大量时间。
_PW_HASH = hash_password("pw")


@pytest.fixture
def store() -> Iterator[InMemoryActiveSessionStore]:
    s = InMemoryActiveSessionStore()
    set_store(s)
    try:
        yield s
    finally:
        reset_store()


# ---------- 存储实现 ----------


def test_inmemory_register_and_revoke(store: InMemoryActiveSessionStore) -> None:
    store.register(1, "j1", 60)
    assert store.is_active(1, "j1")
    assert store.revoke(1, "j1")
    assert not store.is_active(1, "j1")
    assert not store.revoke(1, "j1")  # 重复吊销返回 False


def test_inmemory_revoke_user_kills_all(store: InMemoryActiveSessionStore) -> None:
    store.register(1, "j1", 60)
    store.register(1, "j2", 60)
    store.register(2, "other", 60)
    assert store.revoke_user(1) == 2
    assert store.list_sessions(1) == []
    assert store.is_active(2, "other")  # 别人不受影响


def test_redis_store_roundtrip() -> None:
    client = fakeredis.FakeStrictRedis(decode_responses=True)
    s = RedisActiveSessionStore(client)
    s.register(7, "abc", 60)
    assert s.is_active(7, "abc")
    assert s.list_sessions(7) == ["abc"]
    assert s.revoke(7, "abc")
    assert not s.is_active(7, "abc")


def test_redis_revoke_user_scans_by_prefix() -> None:
    client = fakeredis.FakeStrictRedis(decode_responses=True)
    s = RedisActiveSessionStore(client)
    s.register(7, "a", 60)
    s.register(7, "b", 60)
    s.register(8, "c", 60)
    assert s.revoke_user(7) == 2
    assert s.is_active(8, "c")


def test_redis_ttl_is_applied() -> None:
    client = fakeredis.FakeStrictRedis(decode_responses=True)
    RedisActiveSessionStore(client).register(1, "j", 120)
    assert client.ttl("session:1:j") > 0  # TTL 到期自动清理，不需定时任务


# ---------- 令牌与校验 ----------


def test_token_carries_unique_jti() -> None:
    a, b = decode_token(create_token(1)), decode_token(create_token(1))
    assert a["jti"] and b["jti"]
    assert a["jti"] != b["jti"]


def test_check_active_allows_legacy_token_without_jti(
    store: InMemoryActiveSessionStore,
) -> None:
    """升级前签发的旧令牌没有 jti——放行，否则上线瞬间踢掉所有在线用户。"""
    assert check_active(1, None)


def test_check_active_denies_unregistered(store: InMemoryActiveSessionStore) -> None:
    assert not check_active(1, "never-registered")


def test_disabled_store_skips_check() -> None:
    """关掉活跃会话时退化为纯无状态 JWT。"""
    set_store(None)
    try:
        assert check_active(1, "anything")
    finally:
        reset_store()


class BoomStore:
    def is_active(self, user_id: int, jti: str) -> bool:
        raise RuntimeError("redis 挂了")


def test_fail_open_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Redis 故障默认放行：令牌本身仍有效且会过期，全站瘫痪代价更大。"""
    set_store(BoomStore())  # type: ignore[arg-type]
    try:
        from app.core.config import settings

        monkeypatch.setattr(settings.auth, "revocation_fail_closed", False)
        assert check_active(1, "j")
    finally:
        reset_store()


def test_fail_closed_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """对吊销敏感的部署可以反过来。"""
    set_store(BoomStore())  # type: ignore[arg-type]
    try:
        from app.core.config import settings

        monkeypatch.setattr(settings.auth, "revocation_fail_closed", True)
        assert not check_active(1, "j")
    finally:
        reset_store()


def test_register_failure_does_not_raise(store: InMemoryActiveSessionStore) -> None:
    class BadStore:
        def register(self, *a: object, **k: object) -> None:
            raise RuntimeError("写不进去")

    set_store(BadStore())  # type: ignore[arg-type]
    register_session(1, "j", 60)  # 登记失败不该让人登不上


# ---------- 接口级：登录 → 踢 → 401 ----------


@pytest.fixture
def client(store: InMemoryActiveSessionStore) -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)

    s = factory()
    s.add(SysUser(id=1, username="alice", password=_PW_HASH, status=1))
    s.add(SysUser(id=2, username="admin", password=_PW_HASH, status=1))
    s.add(SysRole(id=1, code="admin", name="管理员", data_scope=int(DataScope.ALL)))
    s.add(SysUserRole(user_id=2, role_id=1))
    s.commit()
    s.close()

    def _override() -> Iterator[Session]:
        sess = factory()
        try:
            yield sess
        finally:
            sess.close()

    app.dependency_overrides[db_session] = _override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


# 本项目约定：BizError 统一返回 HTTP 200 + 业务码（见 core/exceptions.py），
# 所以鉴权失败要断言 body 里的 code，不能断言 status_code。
CODE_OK = 0
CODE_AUTH = 40100
CODE_NO_PERM = 40300


def _code(resp: object) -> int:
    return int(resp.json()["code"])  # type: ignore[attr-defined]


def _login(client: TestClient, username: str = "alice") -> str:
    r = client.post("/auth/login", json={"username": username, "password": "pw"})
    assert _code(r) == CODE_OK
    return str(r.json()["data"]["token"])


def _me(client: TestClient, token: str) -> int:
    return _code(client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}))


def test_login_registers_session_and_me_works(client: TestClient) -> None:
    assert _me(client, _login(client)) == CODE_OK


def test_kicked_user_is_rejected_though_token_still_valid(
    client: TestClient, store: InMemoryActiveSessionStore
) -> None:
    """核心场景：令牌没过期、签名也对，但会话被吊销 → 拒绝。"""
    token = _login(client)
    assert _me(client, token) == CODE_OK

    assert kick_user(1) == 1
    decode_token(token)  # 令牌本身依然是密码学有效的，解码不报错
    assert _me(client, token) == CODE_AUTH


def test_logout_only_kills_current_session(client: TestClient) -> None:
    """登出不该把自己其他设备也踢下线。"""
    t1, t2 = _login(client), _login(client)
    logout(1, str(decode_token(t1)["jti"]))

    assert _me(client, t1) == CODE_AUTH
    assert _me(client, t2) == CODE_OK


def test_logout_endpoint(client: TestClient) -> None:
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert _code(client.post("/auth/logout", headers=headers)) == CODE_OK
    assert _me(client, token) == CODE_AUTH


def test_kick_endpoint_requires_admin(client: TestClient) -> None:
    alice = _login(client, "alice")
    r = client.post("/auth/kick/1", headers={"Authorization": f"Bearer {alice}"})
    assert _code(r) == CODE_NO_PERM  # 普通用户不能踢人

    admin = _login(client, "admin")
    r2 = client.post("/auth/kick/1", headers={"Authorization": f"Bearer {admin}"})
    assert _code(r2) == CODE_OK
    assert r2.json()["data"] == 1  # 吊销了 alice 的 1 个会话


def test_disabled_user_rejected_even_with_valid_session(client: TestClient) -> None:
    """停用账号后旧令牌也该失效。"""
    token = _login(client)
    assert _me(client, token) == CODE_OK

    from app.api.deps import db_session as dep

    gen = app.dependency_overrides[dep]()
    sess = next(gen)
    sess.query(SysUser).filter(SysUser.id == 1).update({"status": 0})
    sess.commit()

    assert _me(client, token) == CODE_AUTH


def test_store_probe_happens_once(monkeypatch: pytest.MonkeyPatch) -> None:
    """连接失败后不能每次请求都重连——否则 Redis 故障会放大成全站变慢。"""
    reset_store()
    calls = {"n": 0}

    def _boom() -> None:
        calls["n"] += 1
        return None

    monkeypatch.setattr(session_store, "_build_default", _boom)
    session_store.get_store()
    session_store.get_store()
    session_store.get_store()
    assert calls["n"] == 1
    reset_store()
