"""文件问答/RAG 抽象（源自 dodo 的 FileManageService + EmbeddingService）。

流程：上传→MinIO+DB 元数据→解析(pymupdf/tika)→切分→PgVector 向量化→检索。
图片走多模态识别。本文件定义接口 + 纯逻辑的切分器；存储/向量/多模态需 live。

需 live 验证：MinIO 上传、PgVector 检索质量、多模态识别。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

# 大文件阈值：超过则切分+向量化，否则直接全文加载（对应 dodo 的 10000 字符）
LARGE_FILE_THRESHOLD = 10000


@dataclass
class FileChunk:
    file_id: str
    index: int
    text: str


class FileStorage(Protocol):
    """对象存储接口（MinIO 适配器实现）。"""

    def put(self, key: str, data: bytes, content_type: str) -> str: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class VectorIndex(Protocol):
    """向量索引接口（PgVector 适配器实现）。"""

    def add_chunks(self, chunks: list[FileChunk], vectors: list[list[float]]) -> None: ...
    def search(self, file_id: str, query_vec: list[float], top_k: int) -> list[FileChunk]: ...


def split_overlap(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    """重叠段落切分（对应 dodo 的 OverlapParagraphTextSplitter）。纯逻辑，可测。"""
    if size <= 0:
        raise ValueError("size 必须为正")
    if overlap >= size:
        raise ValueError("overlap 必须小于 size")
    if len(text) <= size:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    step = size - overlap
    while start < len(text):
        chunks.append(text[start : start + size])
        start += step
    return chunks
