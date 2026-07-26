"""FastAPI 依赖：DB session、当前用户、角色守卫。

鉴权从 Authorization 头取 JWT（对应原 Sa-Token 的 token 校验）。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.exceptions import AuthError, NoPermissionError
from app.platform.auth.security import decode_token
from app.platform.auth.session_store import check_active
from app.platform.user.models import SysUser
from app.platform.user.service import get_user, has_role


def db_session() -> Iterator[Session]:
    yield from get_session()


DbDep = Annotated[Session, Depends(db_session)]


def current_user(
    session: DbDep,
    authorization: Annotated[str | None, Header()] = None,
) -> SysUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("缺少 Authorization 头")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_token(token)
    except jwt.InvalidTokenError as e:
        raise AuthError("令牌无效或已过期") from e
    user_id = int(payload["sub"])
    # 令牌密码学有效 ≠ 会话仍有效：可能已被踢下线（P1-A2）
    if not check_active(user_id, payload.get("jti")):
        raise AuthError("会话已失效，请重新登录")
    user = get_user(session, user_id)
    if user is None:
        raise AuthError("用户不存在")
    if user.status != 1:
        raise AuthError("账号已停用")
    return user


CurrentUser = Annotated[SysUser, Depends(current_user)]


def require_role(role_code: str):  # type: ignore[no-untyped-def]
    """生成角色守卫依赖，如 require_role('admin')。"""

    def _guard(session: DbDep, user: CurrentUser) -> SysUser:
        if not has_role(session, user.id, role_code):
            raise NoPermissionError(f"需要角色: {role_code}")
        return user

    return _guard
