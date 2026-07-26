"""文件解析：按类型抽取文本（对应 dodo 的 FileParserService）。

- PDF：pymupdf 逐页抽取
- 纯文本 / Markdown / 代码：直接解码
- 图片：不抽文本，标记为需多模态识别（走 MultimodalService，需 live）
其它类型走兜底文本解码，失败则报错。纯逻辑（PDF 用内存字节），可离线测。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

_TEXT_EXT = {".txt", ".md", ".markdown", ".csv", ".json", ".log", ".py", ".java", ".sql"}
_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


class ParseKind(StrEnum):
    TEXT = "text"  # 已抽出文本
    IMAGE = "image"  # 需多模态识别（本层不抽文本）
    UNSUPPORTED = "unsupported"


class FileParseError(Exception):
    pass


@dataclass
class ParseResult:
    kind: ParseKind
    text: str = ""


def _ext(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx >= 0 else ""


def parse_pdf(data: bytes) -> str:
    """用 pymupdf 逐页抽取文本。"""
    import fitz  # pymupdf

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise FileParseError(f"PDF 解析失败: {e}") from e
    try:
        return "\n".join(page.get_text() for page in doc).strip()
    finally:
        doc.close()


def parse_file(filename: str, data: bytes) -> ParseResult:
    """按扩展名分派解析。"""
    ext = _ext(filename)
    if ext == ".pdf":
        return ParseResult(kind=ParseKind.TEXT, text=parse_pdf(data))
    if ext in _IMAGE_EXT:
        return ParseResult(kind=ParseKind.IMAGE)
    if ext in _TEXT_EXT or ext == "":
        try:
            return ParseResult(kind=ParseKind.TEXT, text=data.decode("utf-8").strip())
        except UnicodeDecodeError as e:
            raise FileParseError(f"文本解码失败: {e}") from e
    # 兜底：尝试文本解码
    try:
        return ParseResult(kind=ParseKind.TEXT, text=data.decode("utf-8").strip())
    except UnicodeDecodeError:
        return ParseResult(kind=ParseKind.UNSUPPORTED)
