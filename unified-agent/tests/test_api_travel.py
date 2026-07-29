"""差旅接口测试（T-1/T-2）+ /session 越权修复回归。

重点在**权限边界**：差旅单涉及审批与花钱，越权读写的后果比读错列表严重得多，
所以每个「拿别人的 id 去操作」的路径都要有用例。
"""

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
from app.platform.auth.security import create_token, hash_password
from app.platform.session import service as session_svc
from app.platform.user.models import SysRole, SysUser, SysUserRole

CODE_OK = 0
CODE_BIZ = 40000
CODE_NO_PERM = 40300

ALICE, BOB, ADMIN = 1, 2, 3


# bcrypt 单次约 0.33s（故意慢）。本文件不测密码校验，只需要一个合法哈希占位，
# 所以整个模块只算一次——每个测试重算 3 个用户会让 setup 白烧 26 秒。
_PW_HASH = hash_password("pw")


@pytest.fixture
def factory() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True
    )
    Base.metadata.create_all(engine)
    f = sessionmaker(bind=engine, expire_on_commit=False, future=True)

    s = f()
    for uid, name in ((ALICE, "alice"), (BOB, "bob"), (ADMIN, "admin")):
        s.add(SysUser(id=uid, username=name, password=_PW_HASH, status=1))
    s.add(SysRole(id=1, code="admin", name="管理员", data_scope=int(DataScope.ALL)))
    s.add(SysUserRole(user_id=ADMIN, role_id=1))
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
        yield f
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def client(factory: sessionmaker[Session]) -> TestClient:
    return TestClient(app)


def _h(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token(user_id)}"}


def _code(resp: object) -> int:
    return int(resp.json()["code"])  # type: ignore[attr-defined]


def _data(resp: object) -> object:
    return resp.json()["data"]  # type: ignore[attr-defined]


def _make_order(client: TestClient, user_id: int = ALICE, **kw: object) -> int:
    body = {
        "origin": "北京",
        "destination": "上海",
        "start_date": "2026-10-01",
        "end_date": "2026-10-03",
    }
    body.update(kw)
    r = client.post("/travel/order", json=body, headers=_h(user_id))
    assert _code(r) == CODE_OK, r.json()
    return int(_data(r)["id"])  # type: ignore[index]


# ---------------- T-1 差旅单 ----------------


def test_create_and_list_order(client: TestClient) -> None:
    oid = _make_order(client)
    r = client.get("/travel/order/list", headers=_h(ALICE))
    orders = _data(r)
    assert isinstance(orders, list) and len(orders) == 1
    assert orders[0]["id"] == oid
    assert orders[0]["status"] == "submitted"


def test_create_rejects_time_conflict(client: TestClient) -> None:
    _make_order(client)
    r = client.post(
        "/travel/order",
        json={
            "origin": "北京",
            "destination": "广州",
            "start_date": "2026-10-02",
            "end_date": "2026-10-04",
        },
        headers=_h(ALICE),
    )
    assert _code(r) == CODE_BIZ
    assert "冲突" in r.json()["message"]


def test_validation_rejects_empty_city(client: TestClient) -> None:
    r = client.post(
        "/travel/order",
        json={
            "origin": "",
            "destination": "上海",
            "start_date": "2026-10-01",
            "end_date": "2026-10-03",
        },
        headers=_h(ALICE),
    )
    assert r.status_code == 422  # pydantic 拦在进业务之前


def test_list_is_scoped_per_user(client: TestClient) -> None:
    _make_order(client, ALICE)
    assert len(_data(client.get("/travel/order/list", headers=_h(BOB)))) == 0  # type: ignore[arg-type]


def test_get_own_order(client: TestClient) -> None:
    oid = _make_order(client)
    r = client.get(f"/travel/order/{oid}", headers=_h(ALICE))
    assert _data(r)["destination"] == "上海"  # type: ignore[index]


def test_cannot_read_others_order(client: TestClient) -> None:
    """越权读：bob 拿 alice 的单号。"""
    oid = _make_order(client, ALICE)
    assert _code(client.get(f"/travel/order/{oid}", headers=_h(BOB))) == CODE_NO_PERM


def test_cannot_cancel_others_order(client: TestClient) -> None:
    """越权写：这个比越权读严重得多。"""
    oid = _make_order(client, ALICE)
    assert _code(client.post(f"/travel/order/{oid}/cancel", headers=_h(BOB))) == CODE_NO_PERM


def test_cancel_own_order(client: TestClient) -> None:
    oid = _make_order(client)
    r = client.post(f"/travel/order/{oid}/cancel", headers=_h(ALICE))
    assert _data(r)["status"] == "cancelled"  # type: ignore[index]


def test_cancel_approved_order_rejected(client: TestClient) -> None:
    oid = _make_order(client)
    client.post(f"/travel/order/{oid}/approve", json={"approved": True}, headers=_h(ADMIN))
    assert _code(client.post(f"/travel/order/{oid}/cancel", headers=_h(ALICE))) == CODE_BIZ


def test_nonexistent_order_is_indistinguishable(client: TestClient) -> None:
    """不存在与无权返回同一结果，不给探测存在性的机会。"""
    assert _code(client.get("/travel/order/9999", headers=_h(ALICE))) == CODE_NO_PERM


# ---------------- T-2 审批 ----------------


def test_admin_approves(client: TestClient) -> None:
    oid = _make_order(client, ALICE)
    r = client.post(
        f"/travel/order/{oid}/approve",
        json={"approved": True, "comment": "同意"},
        headers=_h(ADMIN),
    )
    assert _data(r)["status"] == "approved"  # type: ignore[index]


def test_admin_rejects(client: TestClient) -> None:
    oid = _make_order(client, ALICE)
    r = client.post(f"/travel/order/{oid}/approve", json={"approved": False}, headers=_h(ADMIN))
    assert _data(r)["status"] == "rejected"  # type: ignore[index]


def test_non_admin_cannot_approve(client: TestClient) -> None:
    oid = _make_order(client, ALICE)
    r = client.post(f"/travel/order/{oid}/approve", json={"approved": True}, headers=_h(BOB))
    assert _code(r) == CODE_NO_PERM


def test_cannot_self_approve(client: TestClient) -> None:
    """admin 也不能批自己的单——否则审批形同虚设。"""
    oid = _make_order(client, ADMIN)
    r = client.post(f"/travel/order/{oid}/approve", json={"approved": True}, headers=_h(ADMIN))
    assert _code(r) == CODE_NO_PERM
    assert "自己" in r.json()["message"]


def test_pending_list_admin_only(client: TestClient) -> None:
    _make_order(client, ALICE)
    _make_order(client, BOB)
    assert len(_data(client.get("/travel/order/pending", headers=_h(ADMIN)))) == 2  # type: ignore[arg-type]
    assert _code(client.get("/travel/order/pending", headers=_h(ALICE))) == CODE_NO_PERM


def test_pending_excludes_decided(client: TestClient) -> None:
    oid = _make_order(client, ALICE)
    client.post(f"/travel/order/{oid}/approve", json={"approved": True}, headers=_h(ADMIN))
    assert len(_data(client.get("/travel/order/pending", headers=_h(ADMIN)))) == 0  # type: ignore[arg-type]


def test_approve_missing_order(client: TestClient) -> None:
    r = client.post("/travel/order/9999/approve", json={"approved": True}, headers=_h(ADMIN))
    assert _code(r) == CODE_BIZ


# ---------------- 预订 ----------------


def _approved_order(client: TestClient) -> int:
    oid = _make_order(client, ALICE)
    client.post(f"/travel/order/{oid}/approve", json={"approved": True}, headers=_h(ADMIN))
    return oid


def test_booking_requires_approved_order(client: TestClient) -> None:
    oid = _make_order(client, ALICE)  # 未审批
    r = client.post(
        f"/travel/order/{oid}/booking",
        json={"booking_type": "flight", "amount": 120000},
        headers=_h(ALICE),
    )
    assert _code(r) == CODE_BIZ
    assert "审批通过" in r.json()["message"]


def test_booking_on_approved_order(client: TestClient) -> None:
    oid = _approved_order(client)
    r = client.post(
        f"/travel/order/{oid}/booking",
        json={"booking_type": "flight", "amount": 120000},
        headers=_h(ALICE),
    )
    assert _code(r) == CODE_OK
    assert _data(r)["status"] == "pending"  # type: ignore[index]

    s = _data(client.get(f"/travel/order/{oid}/booking/list", headers=_h(ALICE)))
    assert s["total_amount"] == 120000 and s["count"] == 1  # type: ignore[index]


def test_booking_rejects_nonpositive_amount(client: TestClient) -> None:
    oid = _approved_order(client)
    r = client.post(
        f"/travel/order/{oid}/booking",
        json={"booking_type": "flight", "amount": 0},
        headers=_h(ALICE),
    )
    assert r.status_code == 422


def test_cannot_book_on_others_order(client: TestClient) -> None:
    """越权花钱。"""
    oid = _approved_order(client)
    r = client.post(
        f"/travel/order/{oid}/booking",
        json={"booking_type": "flight", "amount": 1000},
        headers=_h(BOB),
    )
    assert _code(r) == CODE_NO_PERM


def test_cannot_cancel_others_booking(client: TestClient) -> None:
    oid = _approved_order(client)
    r = client.post(
        f"/travel/order/{oid}/booking",
        json={"booking_type": "hotel", "amount": 50000},
        headers=_h(ALICE),
    )
    bid = _data(r)["id"]  # type: ignore[index]
    assert _code(client.post(f"/travel/booking/{bid}/cancel", headers=_h(BOB))) == CODE_NO_PERM
    assert _code(client.post(f"/travel/booking/{bid}/cancel", headers=_h(ALICE))) == CODE_OK


def test_auth_required(client: TestClient) -> None:
    assert _code(client.get("/travel/order/list")) == 40100


# ---------------- /session 越权修复回归 ----------------


def test_cannot_read_others_conversation(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """修复前：任何登录用户凭 conversation_id 就能读他人聊天记录。"""
    with factory() as s:
        session_svc.get_or_create_conversation(s, ALICE, "alice-conv")
        session_svc.append_message(s, "alice-conv", "user", "我的隐私内容")

    r_own = client.get("/session/alice-conv/messages", headers=_h(ALICE))
    assert _code(r_own) == CODE_OK
    assert len(_data(r_own)) == 1  # type: ignore[arg-type]

    r_other = client.get("/session/alice-conv/messages", headers=_h(BOB))
    assert _code(r_other) == CODE_NO_PERM


def test_cannot_rename_others_conversation(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    with factory() as s:
        session_svc.get_or_create_conversation(s, ALICE, "alice-conv2")

    r = client.put("/session/alice-conv2/title", json={"title": "被改了"}, headers=_h(BOB))
    assert _code(r) == CODE_NO_PERM

    r_own = client.put("/session/alice-conv2/title", json={"title": "我自己改"}, headers=_h(ALICE))
    assert _code(r_own) == CODE_OK


def test_missing_conversation_also_denied(client: TestClient) -> None:
    assert _code(client.get("/session/nope/messages", headers=_h(ALICE))) == CODE_NO_PERM
