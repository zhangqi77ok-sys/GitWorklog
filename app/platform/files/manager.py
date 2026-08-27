"""文件问答编排（对应 dodo 的 FileManageService + EmbeddingService）。

上传流程：存对象存储 → 解析抽文本 → 小文件直存文本 / 大文件切分+向量化入索引。
storage / index / embedding 都是注入接口（live 适配器在别处），故编排逻辑
可用 mock 完整测试。图片走多模态（需 live），本层标记后交上层。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from app.platform.files.parser import ParseKind, parse_file
from app.platform.files.service import (
    LARGE_FILE_THRESHOLD,
    FileChunk,
    FileStorage,
    VectorIndex,
    split_overlap,
)


@dataclass
class UploadResult:
    file_id: str
    kind: str  # text / image / unsupported
    stored_key: str
    embedded: bool  # 是否走了切分+向量化
    text_preview: str = ""


@dataclass
class FileManager:
    storage: FileStorage
    index: VectorIndex
    embed: Any  # Callable[[list[str]], list[list[float]]]
    threshold: int = LARGE_FILE_THRESHOLD

    def upload(self, filename: str, data: bytes, content_type: str = "") -> UploadResult:
        file_id = uuid.uuid4().hex
        key = f"{file_id}/{filename}"
        stored_key = self.storage.put(key, data, content_type)

        parsed = parse_file(filename, data)
        if parsed.kind == ParseKind.IMAGE:
            return UploadResult(file_id, "image", stored_key, embedded=False)
        if parsed.kind == ParseKind.UNSUPPORTED:
            return UploadResult(file_id, "unsupported", stored_key, embedded=False)

        text = parsed.text
        if len(text) <= self.threshold:
            # 小文件：直存文本，不向量化
            return UploadResult(
                file_id, "text", stored_key, embedded=False, text_preview=text[:200]
            )

        # 大文件：切分 + 向量化入索引
        pieces = split_overlap(text)
        chunks = [FileChunk(file_id=file_id, index=i, text=p) for i, p in enumerate(pieces)]
        vectors = self.embed([c.text for c in chunks])
        self.index.add_chunks(chunks, vectors)
        return UploadResult(file_id, "text", stored_key, embedded=True, text_preview=text[:200])

    def retrieve(self, file_id: str, query: str, top_k: int = 5) -> list[FileChunk]:
        """对已向量化的文件做检索。"""
        qv = self.embed([query])[0]
        return self.index.search(file_id, qv, top_k)


@dataclass
class InMemoryStorage(FileStorage):
    """测试用内存对象存储。"""

    _data: dict[str, bytes] = field(default_factory=dict)

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self._data[key] = data
        return key

    def get(self, key: str) -> bytes:
        return self._data[key]

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


@dataclass
class InMemoryIndex(VectorIndex):
    """测试用内存向量索引：按 file_id 存 chunk + 向量，检索用点积。"""

    _store: dict[str, list[tuple[FileChunk, list[float]]]] = field(default_factory=dict)

    def add_chunks(self, chunks: list[FileChunk], vectors: list[list[float]]) -> None:
        for c, v in zip(chunks, vectors, strict=True):
            self._store.setdefault(c.file_id, []).append((c, v))

    def search(self, file_id: str, query_vec: list[float], top_k: int) -> list[FileChunk]:
        items = self._store.get(file_id, [])
        scored = sorted(items, key=lambda cv: _dot(cv[1], query_vec), reverse=True)
        return [c for c, _ in scored[:top_k]]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=False))
