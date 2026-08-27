"""认证 service：登录校验、签发令牌。

活跃会话（踢人下线/单点）由 session_store 基于 Redis 记录 token 有效性，
此处只做「校验凭据 + 签发」。
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AuthError
from app.platform.auth.security import create_token, decode_token, verify_password
from app.platform.auth.session_store import get_store, register_session
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
    # 登记活跃会话，令牌才具备可吊销性（P1-A2）
    payload = decode_token(token)
    register_session(user.id, str(payload["jti"]), settings.auth.jwt_expire_minutes * 60)
    return user, token


def logout(user_id: int, jti: str) -> bool:
    """主动登出：吊销当前这一个会话。"""
    store = get_store()
    return store.revoke(user_id, jti) if store else False


def kick_user(user_id: int) -> int:
    """踢人下线：吊销该用户全部会话，返回被吊销的数量。"""
    store = get_store()
    return store.revoke_user(user_id) if store else 0
