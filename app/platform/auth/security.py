"""密码哈希与 JWT（纯逻辑，无 infra 依赖）。

替代原 Java 项目的 Sa-Token：密码用 bcrypt，令牌用 JWT。
活跃会话/踢人下线由 app/platform/auth/session_store 基于 Redis 实现。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    """bcrypt 哈希，返回可存库的字符串。"""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def create_token(user_id: int, *, extra: dict[str, Any] | None = None) -> str:
    """签发 JWT。sub=user_id，jti 唯一标识本次会话，exp 按配置。

    jti 是踢人下线的抓手：JWT 无状态、签出去收不回，只有配合
    session_store 里的 jti 记录才能在过期前吊销（见 auth/session_store.py）。
    """
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(minutes=settings.auth.jwt_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.auth.jwt_secret, algorithm=settings.auth.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """校验并解码 JWT。过期/非法抛 jwt 异常，由上层转 AuthError。"""
    return jwt.decode(
        token,
        settings.auth.jwt_secret,
        algorithms=[settings.auth.jwt_algorithm],
    )
