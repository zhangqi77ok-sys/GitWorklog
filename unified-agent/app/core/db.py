"""数据库基建：声明式基类 + 引擎 + session 工厂。

采用同步 SQLAlchemy 2.0；异步端点通过 fastapi.concurrency.run_in_threadpool
调用 DB 操作（见 CODING_STANDARDS §7）。测试用 SQLite 内存库（见 tests/conftest）。

平台主库（sys/travel/会话/记忆）用 engine；data 域被查询业务库用独立只读连接，
不在此定义（见 app/domains/data）。
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime

from sqlalchemy import DateTime, String, create_engine, func
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

from app.core.config import settings


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


class TimestampMixin:
    """通用审计字段：创建/更新时间。"""

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    """逻辑删除标记（对应原 MyBatis-Plus 逻辑删除）。"""

    deleted: Mapped[int] = mapped_column(default=0)


# 常用列类型别名
Str64 = String(64)
Str255 = String(255)


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """懒加载主库引擎：首次调用时才创建（避免导入即依赖 DB 驱动）。"""
    global _engine
    if _engine is None:
        _engine = create_engine(settings.db.url, pool_pre_ping=True, future=True)
    return _engine


def _factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), expire_on_commit=False, future=True)
    return _session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    """事务性 session 上下文：自动 commit/rollback/close。"""
    session = _factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI 依赖：请求级 session（只读或调用方自行 commit）。"""
    session = _factory()()
    try:
        yield session
    finally:
        session.close()
