"""认证 service：登录校验、签发令牌。

活跃会话（踢人下线/单点）由 session_store 基于 Redis 记录 token 有效性，
此处只做「校验凭据 + 签发」。
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.platform.auth.security import create_token, verify_password
from app.platform.user.models import SysUser
from app.platform.user.service import get_user_by_username


def login(session: Session, username: str, password: str) -> tuple[SysUser, str]:
    """校验用户名密码，返回 (用户, JWT)。失败抛 AuthError。"""
    user = get_user_by_username(session, username)
    if user is None or not verify_password(password, user.password):
        raise AuthError("用户名或密码错误")
    if user.status != 1:
        raise AuthError("账号已停用")
    token = create_token(user.id)
    return user, token
