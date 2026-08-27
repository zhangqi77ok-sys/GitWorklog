"""P1-A2 活跃会话与踢人下线（security.py 与 service.py 的 docstring 都指向这里）。

JWT 本身是无状态的——签出去就没法收回，这正是「踢人下线」要解决的问题。
做法：签发时带 jti，同时在 Redis 记一条活跃会话；校验时确认 jti 仍在册。
吊销就是删掉那条记录，令牌即刻失效，不必等 exp。

## 可用性 vs 可吊销性的取舍

Redis 挂掉时有两条路：
- fail-open（默认）：跳过吊销检查，只认 JWT 签名与 exp。系统继续可用，
  但已被踢的人会重新获得访问权，最长到令牌过期为止。
- fail-closed：拒绝一切请求。吊销绝对可靠，但 Redis 一挂全员登不上。

默认 fail-open，因为令牌本身仍是密码学有效且会过期的，而让整个系统
因缓存故障瘫痪的代价更大。对吊销敏感的部署可以把
`AUTH_REVOCATION_FAIL_CLOSED=true` 打开——这是个真实的取舍，所以给出开关
而不是替使用者做决定。注意默认 jwt_expire_minutes 是 30 天，
fail-open 的暴露窗口可能很长，介意的话应同时调短有效期。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger

logger = get_logger(__name__)

# Redis key 前缀：session:{user_id}:{jti}
KEY_PREFIX = "session"


def _key(user_id: int, jti: str) -> str:
    return f"{KEY_PREFIX}:{user_id}:{jti}"


class ActiveSessionStore(Protocol):
    def register(self, user_id: int, jti: str, ttl_seconds: int) -> None: ...
    def is_active(self, user_id: int, jti: str) -> bool: ...
    def revoke(self, user_id: int, jti: str) -> bool: ...
    def revoke_user(self, user_id: int) -> int: ...
    def list_sessions(self, user_id: int) -> list[str]: ...


@dataclass
class InMemoryActiveSessionStore:
    """测试与单机开发用。不做 TTL 过期——JWT 自身的 exp 已经兜住了。"""

    _data: dict[int, set[str]] = field(default_factory=dict)

    def register(self, user_id: int, jti: str, ttl_seconds: int) -> None:
        self._data.setdefault(user_id, set()).add(jti)

    def is_active(self, user_id: int, jti: str) -> bool:
        return jti in self._data.get(user_id, set())

    def revoke(self, user_id: int, jti: str) -> bool:
        sessions = self._data.get(user_id, set())
        if jti in sessions:
            sessions.discard(jti)
            return True
        return False

    def revoke_user(self, user_id: int) -> int:
        count = len(self._data.get(user_id, set()))
        self._data.pop(user_id, None)
        return count

    def list_sessions(self, user_id: int) -> list[str]:
        return sorted(self._data.get(user_id, set()))


@dataclass
class RedisActiveSessionStore:
    """生产实现。client 注入便于用 fakeredis 测试。"""

    client: Any

    def register(self, user_id: int, jti: str, ttl_seconds: int) -> None:
        # TTL 与令牌有效期对齐，过期会话自动清理，不用额外的定时任务
        self.client.setex(_key(user_id, jti), max(ttl_seconds, 1), "1")

    def is_active(self, user_id: int, jti: str) -> bool:
        return bool(self.client.exists(_key(user_id, jti)))

    def revoke(self, user_id: int, jti: str) -> bool:
        return bool(self.client.delete(_key(user_id, jti)))

    def revoke_user(self, user_id: int) -> int:
        keys = list(self.client.scan_iter(match=f"{KEY_PREFIX}:{user_id}:*"))
        if not keys:
            return 0
        return int(self.client.delete(*keys))

    def list_sessions(self, user_id: int) -> list[str]:
        keys = self.client.scan_iter(match=f"{KEY_PREFIX}:{user_id}:*")
        out: list[str] = []
        for k in keys:
            text = k.decode() if isinstance(k, bytes) else str(k)
            out.append(text.rsplit(":", 1)[-1])
        return sorted(out)


# 哨兵：区分「还没初始化」与「初始化过、结果就是不可用」。
# 用 None 兼作两者会导致连接失败后每次请求都重连并等超时——
# 既拖慢每个请求，也把 Redis 故障放大成全站变慢。
_UNSET = object()
_store: Any = _UNSET


def set_store(store: ActiveSessionStore | None) -> None:
    """注入实现（测试/启动时）。传 None 表示不启用吊销检查。"""
    global _store
    _store = store


def reset_store() -> None:
    """回到未初始化状态，下次访问重新探测。测试用。"""
    global _store
    _store = _UNSET


def get_store() -> ActiveSessionStore | None:
    """取当前实现。未显式注入时按配置惰性建 Redis 实现，只探测一次。"""
    global _store
    if _store is _UNSET:
        _store = _build_default()
    return _store  # type: ignore[no-any-return]


def _build_default() -> ActiveSessionStore | None:
    from app.core.config import settings

    if not settings.auth.session_store_enabled:
        return None
    try:
        import redis

        client = redis.Redis.from_url(settings.redis.url, decode_responses=True)
        client.ping()
        return RedisActiveSessionStore(client)
    except Exception as exc:  # 宽捕获是刻意的：见模块文档的取舍说明
        logger.error("session_store_unavailable", error=str(exc))
        return None


def register_session(user_id: int, jti: str, ttl_seconds: int) -> None:
    store = get_store()
    if store is None:
        return
    try:
        store.register(user_id, jti, ttl_seconds)
    except Exception as exc:  # 注册失败不该让人登不上
        logger.error("session_register_failed", user_id=user_id, error=str(exc))


def check_active(user_id: int, jti: str | None) -> bool:
    """校验会话是否仍有效。

    jti 为 None 表示这是启用本机制之前签发的旧令牌——放行，
    否则升级瞬间会把所有在线用户踢下线。
    """
    store = get_store()
    if store is None or jti is None:
        return True
    try:
        return store.is_active(user_id, jti)
    except Exception as exc:
        from app.core.config import settings

        fail_closed = settings.auth.revocation_fail_closed
        logger.error(
            "session_check_failed",
            user_id=user_id,
            error=str(exc),
            fail_closed=fail_closed,
        )
        return not fail_closed
