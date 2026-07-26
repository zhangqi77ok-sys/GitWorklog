"""认证与用户体系测试：密码、JWT、DataScope、登录、部门子树。"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.platform.auth.datascope import DataScope, resolve_visible_depts
from app.platform.auth.security import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.platform.auth.service import login
from app.platform.user.models import (
    SysDept,
    SysRole,
    SysUser,
    SysUserDept,
    SysUserRole,
    UserProfile,
)
from app.platform.user.service import (
    build_dept_subtree,
    has_role,
    resolve_data_scope,
)


# ---------- 密码 ----------
def test_password_hash_and_verify() -> None:
    h = hash_password("s3cret")
    assert h != "s3cret"
    assert verify_password("s3cret", h)
    assert not verify_password("wrong", h)


def test_verify_password_malformed_hash() -> None:
    assert not verify_password("x", "not-a-bcrypt-hash")


# ---------- JWT ----------
def test_jwt_roundtrip() -> None:
    token = create_token(42, extra={"username": "alice"})
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["username"] == "alice"


def test_jwt_tampered() -> None:
    import jwt

    token = create_token(1)
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token + "tamper")


# ---------- DataScope 纯逻辑 ----------
def test_datascope_max_of() -> None:
    assert DataScope.max_of([DataScope.SELF, DataScope.ALL]) == DataScope.ALL
    assert DataScope.max_of([]) == DataScope.SELF  # fail-closed


def test_resolve_visible_depts_all() -> None:
    assert resolve_visible_depts(DataScope.ALL, [1], {}) is None


def test_resolve_visible_depts_self() -> None:
    assert resolve_visible_depts(DataScope.SELF, [1], {}) == []


def test_resolve_visible_depts_dept_and_sub() -> None:
    subtree = {1: [1, 2, 3], 2: [2], 3: [3]}
    assert resolve_visible_depts(DataScope.DEPT_AND_SUB, [1], subtree) == [1, 2, 3]


def test_resolve_visible_depts_dept_only() -> None:
    assert resolve_visible_depts(DataScope.DEPT, [5, 5, 7], {}) == [5, 7]


# ---------- 部门子树 ----------
def _seed_depts(session: Session) -> None:
    # 1 root; 2,3 子; 4 是 2 的子
    session.add_all(
        [
            SysDept(id=1, name="总部", parent_id=0),
            SysDept(id=2, name="研发", parent_id=1),
            SysDept(id=3, name="销售", parent_id=1),
            SysDept(id=4, name="后端组", parent_id=2),
        ]
    )
    session.commit()


def test_build_dept_subtree(db_session: Session) -> None:
    _seed_depts(db_session)
    tree = build_dept_subtree(db_session)
    assert sorted(tree[1]) == [1, 2, 3, 4]
    assert sorted(tree[2]) == [2, 4]
    assert tree[4] == [4]


# ---------- 登录 + 角色 + 数据范围（DB） ----------
def _seed_user(session: Session) -> None:
    session.add(SysUser(id=1, username="alice", password=hash_password("pw"), status=1))
    session.add(SysRole(id=1, code="admin", name="管理员", data_scope=int(DataScope.ALL)))
    session.add(SysRole(id=2, code="user", name="员工", data_scope=int(DataScope.DEPT)))
    session.add(SysUserRole(user_id=1, role_id=1))
    session.add(SysUserRole(user_id=1, role_id=2))
    session.add(SysUserDept(user_id=1, dept_id=2))
    session.add(UserProfile(user_id=1, home_city="北京", job_level="P7"))
    session.commit()


def test_login_success(db_session: Session) -> None:
    _seed_user(db_session)
    user, token = login(db_session, "alice", "pw")
    assert user.id == 1
    assert decode_token(token)["sub"] == "1"


def test_login_wrong_password(db_session: Session) -> None:
    _seed_user(db_session)
    with pytest.raises(AuthError):
        login(db_session, "alice", "bad")


def test_login_unknown_user(db_session: Session) -> None:
    with pytest.raises(AuthError):
        login(db_session, "ghost", "pw")


def test_has_role(db_session: Session) -> None:
    _seed_user(db_session)
    assert has_role(db_session, 1, "admin")
    assert not has_role(db_session, 1, "superadmin")


def test_resolve_data_scope_takes_max(db_session: Session) -> None:
    _seed_user(db_session)  # admin(ALL) + user(DEPT) -> ALL
    result = resolve_data_scope(db_session, 1)
    assert result.scope == DataScope.ALL
    assert result.is_all
    assert result.visible_dept_ids is None
