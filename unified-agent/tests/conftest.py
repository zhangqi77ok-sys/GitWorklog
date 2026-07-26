"""pytest 全局夹具：SQLite 内存库 session、fake redis。

测试不依赖任何 live 基础设施；ORM 模型跨方言，用 SQLite 验证 CRUD/关系。
"""

from __future__ import annotations

from collections.abc import Iterator

import fakeredis
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# 触发所有模型注册到 Base.metadata（新增模型模块时在此 import）
import app.domains.data.models
import app.domains.travel.business.models
import app.platform.session.models
import app.platform.skills.models
import app.platform.user.models  # noqa: F401
from app.core.db import Base


@pytest.fixture
def db_session() -> Iterator[Session]:
    """每个测试独立的内存库 session。"""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def fake_redis() -> fakeredis.FakeStrictRedis:
    return fakeredis.FakeStrictRedis(decode_responses=True)
