from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Table, create_engine, insert

from app.domains.data.schema.mschema import (
    CachedSchemaProvider,
    DatabaseSchemaProvider,
    MschemaFormatter,
)


def _setup_test_db():
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()

    users = Table(
        "users",
        meta,
        Column("id", Integer, primary_key=True, comment="用户主键"),
        Column("name", String(50), nullable=False, comment="用户姓名"),
        Column("city", String(50), nullable=True),
        comment="用户主表",
    )

    orders = Table(
        "orders",
        meta,
        Column("order_id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("amount", Integer, nullable=False),
        comment="订单明细表",
    )

    Table(
        "alembic_version",
        meta,
        Column("version_num", String(32), primary_key=True),
    )

    meta.create_all(engine)

    with engine.connect() as conn:
        conn.execute(
            insert(users),
            [
                {"id": 1, "name": "Alice", "city": "Beijing"},
                {"id": 2, "name": "Bob", "city": "Shanghai"},
                {"id": 3, "name": "Charlie", "city": "Beijing"},
            ],
        )
        conn.execute(
            insert(orders),
            [
                {"order_id": 101, "user_id": 1, "amount": 500},
                {"order_id": 102, "user_id": 2, "amount": 800},
            ],
        )
        conn.commit()

    return engine


def test_database_schema_provider_list_tables():
    engine = _setup_test_db()
    provider = DatabaseSchemaProvider(engine=engine, exclude_tables={"alembic_version"})

    tables = provider.list_tables()
    table_names = {t.name for t in tables}
    assert "users" in table_names
    assert "orders" in table_names
    assert "alembic_version" not in table_names


def test_database_schema_provider_describe_table():
    engine = _setup_test_db()
    provider = DatabaseSchemaProvider(engine=engine, sample_rows=3)

    user_meta = provider.describe_table("users")
    assert user_meta is not None
    assert user_meta.name == "users"

    col_map = {c.name: c for c in user_meta.columns}
    assert "id" in col_map
    assert col_map["id"].primary_key is True
    assert "name" in col_map
    assert col_map["name"].nullable is False
    assert set(col_map["name"].examples).issubset({"Alice", "Bob", "Charlie"})

    # Check orders and foreign key
    orders_meta = provider.describe_table("orders")
    assert orders_meta is not None
    assert any("user_id -> users.id" in fk for fk in orders_meta.foreign_keys)

    # Non-existent table
    assert provider.describe_table("non_existent") is None


def test_cached_schema_provider():
    engine = _setup_test_db()
    db_provider = DatabaseSchemaProvider(engine=engine)
    cached = CachedSchemaProvider(db_provider, ttl_seconds=1.0)

    # First call fills cache
    t1 = cached.list_tables()
    assert len(t1) == 2

    # Second call returns same object
    t2 = cached.list_tables()
    assert t1 is t2

    # Describe table caching
    d1 = cached.describe_table("users")
    d2 = cached.describe_table("users")
    assert d1 is d2

    # Manual refresh
    cached.refresh()
    t3 = cached.list_tables()
    assert t3 is not t1


def test_mschema_formatter_with_introspection():
    engine = _setup_test_db()
    provider = DatabaseSchemaProvider(engine=engine)
    user_meta = provider.describe_table("users")
    assert user_meta is not None

    formatted = MschemaFormatter.format_table(user_meta)
    assert "# Table: users" in formatted
    assert "(id:" in formatted
    assert "[PK" in formatted
    assert "(name:" in formatted
