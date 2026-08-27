"""MinIO 对象存储适配器（实现 FileStorage）。

live 由 minio 客户端连接；构造时注入 client 便于测试（mock）。
桶不存在时自动创建。真实连接需 MinIO 实例（见 .env MINIO_*）。
"""

from __future__ import annotations

import io
from typing import Any

from app.core.config import settings
from app.platform.files.service import FileStorage


class MinioStorage(FileStorage):
    def __init__(self, client: Any = None, bucket: str | None = None) -> None:
        self._client = client
        self.bucket = bucket or settings.minio.bucket

    def _get_client(self) -> Any:
        if self._client is None:
            from minio import Minio

            self._client = Minio(
                settings.minio.endpoint,
                access_key=settings.minio.access_key,
                secret_key=settings.minio.secret_key,
                secure=settings.minio.secure,
            )
        return self._client

    def _ensure_bucket(self, client: Any) -> None:
        if not client.bucket_exists(self.bucket):
            client.make_bucket(self.bucket)

    def put(self, key: str, data: bytes, content_type: str) -> str:
        client = self._get_client()
        self._ensure_bucket(client)
        client.put_object(
            self.bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type or "application/octet-stream",
        )
        return key

    def get(self, key: str) -> bytes:
        client = self._get_client()
        resp = client.get_object(self.bucket, key)
        try:
            data: bytes = resp.read()
            return data
        finally:
            resp.close()
            resp.release_conn()

    def delete(self, key: str) -> None:
        client = self._get_client()
        client.remove_object(self.bucket, key)
