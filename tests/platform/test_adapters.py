"""live 适配器测试：MinIO(mock client)、PgVector(mock conn)、MySQL runner(SQLite)。

真实连接需实例；此处验证适配器与接口/SQL 的对接正确性。
"""

from __future__ import annotations

from sqlalchemy import create_engine, text

from app.domains.data.sql.runner import MySQLReadOnlyRunner
from app.platform.files.minio_storage import MinioStorage
from app.platform.files.pgvector_index import PgVectorIndex
from app.platform.files.service import FileChunk


# ---------- MinIO（mock client）----------
class FakeMinioClient:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.buckets: set[str] = set()

    def bucket_exists(self, b: str) -> bool:
        return b in self.buckets

    def make_bucket(self, b: str) -> None:
        self.buckets.add(b)

    def put_object(self, bucket, key, stream, length, content_type):  # type: ignore[no-untyped-def]
        self.objects[key] = stream.read()

    def get_object(self, bucket, key):  # type: ignore[no-untyped-def]
        data = self.objects[key]

        class _R:
            def read(self_inner) -> bytes:  # noqa: N805
                return data

            def close(self_inner) -> None: ...  # noqa: N805
            def release_conn(self_inner) -> None: ...  # noqa: N805

        return _R()

    def remove_object(self, bucket, key):  # type: ignore[no-untyped-def]
        self.objects.pop(key, None)


def test_minio_put_get_delete_autocreates_bucket() -> None:
    client = FakeMinioClient()
    storage = MinioStorage(client=client, bucket="test-bucket")
    key = storage.put("a/f.txt", b"hello", "text/plain")
    assert "test-bucket" in client.buckets  # 自动创建
    assert storage.get(key) == b"hello"
    storage.delete(key)
    assert key not in client.objects


# ---------- PgVector（mock conn）----------
class FakeCursor:
    def __init__(self, store: list) -> None:  # type: ignore[type-arg]
        self.store = store
        self._last_rows: list = []  # type: ignore[type-arg]

    def execute(self, sql: str, params=None):  # type: ignore[no-untyped-def]
        s = sql.strip().upper()
        if s.startswith("INSERT"):
            self.store.append(params)
        elif s.startswith("SELECT"):
            fid = params[0]
            self._last_rows = [(p[0], p[1], p[2]) for p in self.store if p[0] == fid]

    def fetchall(self):  # type: ignore[no-untyped-def]
        return self._last_rows

    def __enter__(self):  # type: ignore[no-untyped-def]
        return self

    def __exit__(self, *a):  # type: ignore[no-untyped-def]
        return False


class FakeConn:
    def __init__(self, store: list) -> None:  # type: ignore[type-arg]
        self.store = store

    def cursor(self):  # type: ignore[no-untyped-def]
        return FakeCursor(self.store)

    def commit(self) -> None: ...
    def __enter__(self):  # type: ignore[no-untyped-def]
        return self

    def __exit__(self, *a):  # type: ignore[no-untyped-def]
        return False


def test_pgvector_add_and_search() -> None:
    store: list = []  # type: ignore[type-arg]
    index = PgVectorIndex(conn_factory=lambda: FakeConn(store), dim=2)
    chunks = [
        FileChunk(file_id="f1", index=0, text="苹果营收"),
        FileChunk(file_id="f1", index=1, text="香蕉库存"),
        FileChunk(file_id="f2", index=0, text="别的文件"),
    ]
    index.add_chunks(chunks, [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]])
    hits = index.search("f1", [1.0, 0.0], top_k=5)
    assert len(hits) == 2  # 只返回 f1 的
    assert all(h.file_id == "f1" for h in hits)


# ---------- MySQL runner（SQLite 真实执行）----------
def test_mysql_runner_executes_and_maps() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE t (id int, name text)"))
        conn.execute(text("INSERT INTO t VALUES (1, '北京'), (2, '上海')"))
    runner = MySQLReadOnlyRunner(engine=engine)
    result = runner.run("SELECT id, name FROM t ORDER BY id")
    assert result.columns == ["id", "name"]
    assert result.rows[0] == {"id": 1, "name": "北京"}
    assert len(result.rows) == 2


def test_mysql_runner_truncates() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE t (id int)"))
        for i in range(10):
            conn.execute(text("INSERT INTO t VALUES (:i)"), {"i": i})
    runner = MySQLReadOnlyRunner(engine=engine, max_rows=3)
    result = runner.run("SELECT id FROM t")
    assert len(result.rows) == 3
