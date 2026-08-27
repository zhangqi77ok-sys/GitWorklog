"""用户体系 service：用户/角色/部门查询、部门子树、DataScope 解析。

纯 SQLAlchemy 查询，测试用 SQLite。跨会话缓存（部门树）由调用方接 Redis，
此处返回可缓存的纯数据结构。
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.platform.auth.datascope import DataScope, DataScopeResult, resolve_visible_depts
from app.platform.user.models import (
    SysDept,
    SysRole,
    SysUser,
    SysUserDept,
    SysUserRole,
)


def get_user_by_username(session: Session, username: str) -> SysUser | None:
    stmt = select(SysUser).where(SysUser.username == username, SysUser.deleted == 0)
    return session.execute(stmt).scalar_one_or_none()


def get_user(session: Session, user_id: int) -> SysUser | None:
    stmt = select(SysUser).where(SysUser.id == user_id, SysUser.deleted == 0)
    return session.execute(stmt).scalar_one_or_none()


def get_user_roles(session: Session, user_id: int) -> list[SysRole]:
    stmt = (
        select(SysRole)
        .join(SysUserRole, SysUserRole.role_id == SysRole.id)
        .where(SysUserRole.user_id == user_id)
    )
    return list(session.execute(stmt).scalars())


def get_user_dept_ids(session: Session, user_id: int) -> list[int]:
    stmt = select(SysUserDept.dept_id).where(SysUserDept.user_id == user_id)
    return list(session.execute(stmt).scalars())


def has_role(session: Session, user_id: int, role_code: str) -> bool:
    return any(r.code == role_code for r in get_user_roles(session, user_id))


def build_dept_subtree(session: Session) -> dict[int, list[int]]:
    """构建 {dept_id: [该部门及所有子孙 id]}。用于 DEPT_AND_SUB 展开。"""
    depts = list(session.execute(select(SysDept.id, SysDept.parent_id)).all())
    children: dict[int, list[int]] = {}
    for did, pid in depts:
        children.setdefault(pid, []).append(did)

    def descendants(root: int) -> list[int]:
        acc = [root]
        stack = list(children.get(root, []))
        while stack:
            cur = stack.pop()
            acc.append(cur)
            stack.extend(children.get(cur, []))
        return acc

    return {did: descendants(did) for did, _ in depts}


def resolve_data_scope(session: Session, user_id: int) -> DataScopeResult:
    """解析用户数据范围：多角色取最大范围，算可见部门。"""
    roles = get_user_roles(session, user_id)
    scope = DataScope.max_of([DataScope(r.data_scope) for r in roles])
    user_dept_ids = get_user_dept_ids(session, user_id)
    subtree = build_dept_subtree(session)
    visible = resolve_visible_depts(scope, user_dept_ids, subtree)
    return DataScopeResult(scope=scope, user_id=user_id, visible_dept_ids=visible)
