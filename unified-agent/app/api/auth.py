"""认证接口：登录、当前用户信息。"""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep, require_role
from app.core.response import R
from app.platform.auth.security import decode_token
from app.platform.auth.service import kick_user
from app.platform.auth.service import login as login_service
from app.platform.auth.service import logout as logout_service

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: int
    username: str


class UserInfo(BaseModel):
    user_id: int
    username: str
    nickname: str


@router.post("/login")
def login(req: LoginRequest, session: DbDep) -> R[LoginResponse]:
    user, token = login_service(session, req.username, req.password)
    return R.ok(LoginResponse(token=token, user_id=user.id, username=user.username))


@router.get("/me")
def me(user: CurrentUser) -> R[UserInfo]:
    return R.ok(UserInfo(user_id=user.id, username=user.username, nickname=user.nickname))


@router.post("/logout")
def logout(
    user: CurrentUser,
    authorization: Annotated[str | None, Header()] = None,
) -> R[None]:
    """主动登出：只吊销当前这一个会话，其他设备不受影响。"""
    jti = _jti_of(authorization)
    if jti:
        logout_service(user.id, jti)
    return R.ok(None)


@router.post("/kick/{user_id}", dependencies=[Depends(require_role("admin"))])
def kick(user_id: int) -> R[int]:
    """踢人下线（管理员）：吊销该用户全部会话，令牌即刻失效不必等过期。"""
    return R.ok(kick_user(user_id))


def _jti_of(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload = decode_token(authorization.removeprefix("Bearer ").strip())
    except jwt.InvalidTokenError:
        return None
    jti = payload.get("jti")
    return str(jti) if jti else None
