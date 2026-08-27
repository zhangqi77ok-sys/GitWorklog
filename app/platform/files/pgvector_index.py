"""PgVector 向量索引适配器（实现 VectorIndex）。

表 vector_file_info(file_id, chunk_index, text, embedding vector(dim))，
HNSW + COSINE。live 由 psycopg 连接；构造注入 conn_factory 便于测试。
真实连接需 PgVector 实例（见 .env PGVECTOR_*）。
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.platform.files.service import FileChunk, VectorIndex

DEFAULT_DIM = 1024
TABLE = "vector_file_info"


class PgVectorIndex(VectorIndex):
    def __init__(self, conn_factory: Any = None, dim: int = DEFAULT_DIM) -> None:
        self._conn_factory = conn_factory
        self.dim = dim

    def _connect(self) -> Any:
        if self._conn_factory is not None:
            return self._conn_factory()
        import psycopg

        pg = settings.pgvector
        return psycopg.connect(
            host=pg.host,
            port=pg.port,
            dbname=pg.db,
            user=pg.user,
            password=pg.password,
        )

    def ensure_schema(self) -> None:
        """建表 + HNSW 索引（幂等）。需 pgvector 扩展已启用。"""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute(
                f"CREATE TABLE IF NOT EXISTS {TABLE} ("
                "id bigserial PRIMARY KEY, file_id text, chunk_index int, "
                f"text text, embedding vector({self.dim}))"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS {TABLE}_emb_idx ON {TABLE} "
                "USING hnsw (embedding vector_cosine_ops)"
            )
            conn.commit()

    def add_chunks(self, chunks: list[FileChunk], vectors: list[list[float]]) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            for c, v in zip(chunks, vectors, strict=True):
                cur.execute(
                    f"INSERT INTO {TABLE} (file_id, chunk_index, text, embedding) "
                    "VALUES (%s, %s, %s, %s)",
                    (c.file_id, c.index, c.text, _to_vec(v)),
                )
            conn.commit()

    def search(self, file_id: str, query_vec: list[float], top_k: int) -> list[FileChunk]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT file_id, chunk_index, text FROM {TABLE} "
                "WHERE file_id = %s ORDER BY embedding <=> %s LIMIT %s",
                (file_id, _to_vec(query_vec), top_k),
            )
            rows = cur.fetchall()
        return [FileChunk(file_id=r[0], index=r[1], text=r[2]) for r in rows]

    def delete(self, file_id: str) -> None:
        """删除指定文件的全部向量数据。"""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLE} WHERE file_id = %s", (file_id,))
            conn.commit()


def _to_vec(v: list[float]) -> str:
    """pgvector 字面量格式 '[1,2,3]'。"""
    return "[" + ",".join(str(x) for x in v) + "]"
