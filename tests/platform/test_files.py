"""文件问答测试：解析(纯文本/PDF/图片)、上传编排(小/大文件)、检索。"""

from __future__ import annotations

import pytest

from app.platform.files.manager import (
    FileManager,
    InMemoryIndex,
    InMemoryStorage,
)
from app.platform.files.parser import FileParseError, ParseKind, parse_file, parse_pdf


# ---------- 解析 ----------
def test_parse_text() -> None:
    r = parse_file("note.txt", "你好世界".encode())
    assert r.kind == ParseKind.TEXT
    assert r.text == "你好世界"


def test_parse_markdown() -> None:
    r = parse_file("doc.md", b"# Title\ncontent")
    assert r.kind == ParseKind.TEXT
    assert "Title" in r.text


def test_parse_image_flagged() -> None:
    r = parse_file("photo.png", b"\x89PNG fake")
    assert r.kind == ParseKind.IMAGE
    assert "photo.png" in r.text


def test_parse_pdf_roundtrip() -> None:
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello PDF 内容")
    data = doc.tobytes()
    doc.close()

    text = parse_pdf(data)
    assert "Hello PDF" in text


def test_parse_bad_pdf_raises() -> None:
    with pytest.raises(FileParseError):
        parse_pdf(b"not a pdf")


# ---------- 上传编排 ----------
def _fake_embed(texts: list[str]) -> list[list[float]]:
    # 简单可复现的向量：按长度和首字符码点造 2 维
    return [[float(len(t)), float(ord(t[0]) if t else 0)] for t in texts]


def _manager() -> FileManager:
    return FileManager(storage=InMemoryStorage(), index=InMemoryIndex(), embed=_fake_embed)


def test_upload_small_text_no_embed() -> None:
    r = _manager().upload("small.txt", "短文本".encode())
    assert r.kind == "text"
    assert not r.embedded
    assert "短文本" in r.text_preview


def test_upload_large_text_embeds_and_retrieves() -> None:
    mgr = _manager()
    # 构造超阈值文本（> 10000 字）：多段可区分内容
    big = ("苹果营收增长。" * 900) + ("香蕉库存下降。" * 900)
    r = mgr.upload("report.txt", big.encode())
    assert r.embedded
    # 检索应返回 chunk（内存索引按点积排序）
    hits = mgr.retrieve(r.file_id, "苹果营收")
    assert len(hits) > 0
    assert all(h.file_id == r.file_id for h in hits)


def test_upload_image_not_embedded() -> None:
    r = _manager().upload("pic.jpg", b"\xff\xd8fake")
    assert r.kind == "image"
    assert not r.embedded
