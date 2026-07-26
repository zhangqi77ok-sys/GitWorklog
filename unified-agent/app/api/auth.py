"""认证接口：登录、当前用户信息。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.auth.service import login as login_service

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
