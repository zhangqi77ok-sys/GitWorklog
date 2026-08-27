"""系统管理接口：用户/角色/部门（只读为主，管理操作需 admin 角色）。

对应 dodo 的 /sys/*。写操作用 require_role('admin') 守卫。
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_role
from app.core.response import R
from app.platform.user.models import SysDept, SysRole, SysUser
from app.platform.user.service import build_dept_subtree, get_user_roles

router = APIRouter(prefix="/sys", tags=["sys"])

AdminUser = Annotated[SysUser, Depends(require_role("admin"))]


class UserBrief(BaseModel):
    id: int
    username: str
    nickname: str
    status: int
    roles: list[str]


class RoleBrief(BaseModel):
    id: int
    code: str
    name: str
    data_scope: int


class DeptNode(BaseModel):
    id: int
    name: str
    parent_id: int


@router.get("/user/list")
def list_users(session: DbDep, _: AdminUser) -> R[list[UserBrief]]:
    users = list(session.execute(select(SysUser).where(SysUser.deleted == 0)).scalars())
    result = [
        UserBrief(
            id=u.id,
            username=u.username,
            nickname=u.nickname,
            status=u.status,
            roles=[r.code for r in get_user_roles(session, u.id)],
        )
        for u in users
    ]
    return R.ok(result)


@router.get("/role/list")
def list_roles(session: DbDep, _: CurrentUser) -> R[list[RoleBrief]]:
    roles = list(session.execute(select(SysRole)).scalars())
    return R.ok(
        [RoleBrief(id=r.id, code=r.code, name=r.name, data_scope=r.data_scope) for r in roles]
    )


@router.get("/dept/tree")
def dept_tree(session: DbDep, _: CurrentUser) -> R[dict]:
    depts = list(session.execute(select(SysDept)).scalars())
    nodes = [DeptNode(id=d.id, name=d.name, parent_id=d.parent_id).model_dump() for d in depts]
    subtree = build_dept_subtree(session)
    return R.ok({"nodes": nodes, "subtree": subtree})
