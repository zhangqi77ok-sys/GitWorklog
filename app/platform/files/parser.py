"""文件与多模态解析：支持 PDF 图文、Word(DOCX)、纯文本、Markdown 与图像元数据抽取。"""

from __future__ import annotations

import io
from dataclasses import dataclass
from enum import StrEnum

_TEXT_EXT = {
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
    ".log",
    ".py",
    ".java",
    ".sql",
    ".yaml",
    ".yml",
}
_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}
_DOCX_EXT = {".docx", ".doc"}


class ParseKind(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    UNSUPPORTED = "unsupported"


class FileParseError(Exception):
    pass


@dataclass
class ParseResult:
    kind: ParseKind
    text: str = ""
    image_count: int = 0


def _ext(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx >= 0 else ""


def parse_pdf(data: bytes) -> str:
    """用 pymupdf 逐页抽取文本并检测嵌入图片/图表。"""
    import fitz  # pymupdf

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise FileParseError(f"PDF 解析失败: {e}") from e

    page_texts: list[str] = []

    try:
        for page_idx, page in enumerate(doc):
            text = page.get_text().strip()
            images = page.get_images(full=True)

            parts = []
            if text:
                parts.append(text)
            for img_idx, img_info in enumerate(images):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                w, h = base_image.get("width", 0), base_image.get("height", 0)
                parts.append(
                    f"[🖼️ 插图/图表 #{img_idx + 1} · 第 {page_idx + 1} 页, 分辨率: {w}x{h}]"
                )

            if parts:
                page_texts.append(f"--- 第 {page_idx + 1} 页 ---\n" + "\n".join(parts))
        return "\n\n".join(page_texts).strip()
    finally:
        doc.close()


def parse_docx(data: bytes) -> tuple[str, int]:
    """抽取 DOCX 段落、表格与图片信息。"""
    import xml.etree.ElementTree as ET
    import zipfile

    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            # 统计图片文件
            image_files = [n for n in zf.namelist() if n.startswith("word/media/")]
            image_count = len(image_files)

            if "word/document.xml" not in zf.namelist():
                return "（空 Word 文档）", image_count

            xml_content = zf.read("word/document.xml")
            tree = ET.fromstring(xml_content)

            # 命名空间处理
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            paragraphs = []
            for p in tree.iter(f"{{{ns['w']}}}p"):
                texts = [node.text for node in p.iter(f"{{{ns['w']}}}t") if node.text]
                if texts:
                    paragraphs.append("".join(texts))

            # 表格处理
            for tbl in tree.iter(f"{{{ns['w']}}}tbl"):
                rows = []
                for tr in tbl.iter(f"{{{ns['w']}}}tr"):
                    row_cells = []
                    for tc in tr.iter(f"{{{ns['w']}}}tc"):
                        cell_texts = [node.text for node in tc.iter(f"{{{ns['w']}}}t") if node.text]
                        row_cells.append("".join(cell_texts))
                    if row_cells:
                        rows.append(" | ".join(row_cells))
                if rows:
                    paragraphs.append("【表格数据】\n" + "\n".join(rows))

            if image_count > 0:
                paragraphs.append(f"[🖼️ 本文档包含 {image_count} 张嵌入图表与插图]")

            return "\n\n".join(paragraphs).strip(), image_count
    except Exception as e:
        raise FileParseError(f"DOCX 解析失败: {e}") from e


def parse_image(filename: str, data: bytes) -> tuple[str, int]:
    """解析图像文件元数据与结构化文本描述。"""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        w, h = img.size
        fmt = img.format or "IMAGE"
        mode = img.mode

        desc = (
            f"【图像文件说明 · {filename}】\n"
            f"图像格式：{fmt}\n"
            f"图像尺寸：{w} × {h} 像素\n"
            f"颜色模式：{mode}\n"
            f"文件大小：{len(data)} 字节\n"
            f"内容标记：企业业务图片/单据/凭证"
        )
        return desc, 1
    except Exception:
        return f"【图像文件：{filename}（{len(data)} 字节）】", 1


def parse_file(filename: str, data: bytes) -> ParseResult:
    """按扩展名分派解析，支持图文多模态抽取。"""
    ext = _ext(filename)
    if ext == ".pdf":
        text, img_count = parse_pdf(data)
        return ParseResult(kind=ParseKind.TEXT, text=text, image_count=img_count)

    if ext in _DOCX_EXT:
        text, img_count = parse_docx(data)
        return ParseResult(kind=ParseKind.TEXT, text=text, image_count=img_count)

    if ext in _IMAGE_EXT:
        text, img_count = parse_image(filename, data)
        return ParseResult(kind=ParseKind.IMAGE, text=text, image_count=img_count)

    if ext in _TEXT_EXT or ext == "":
        try:
            return ParseResult(kind=ParseKind.TEXT, text=data.decode("utf-8").strip())
        except UnicodeDecodeError as e:
            raise FileParseError(f"文本解码失败: {e}") from e

    # 兜底
    try:
        return ParseResult(kind=ParseKind.TEXT, text=data.decode("utf-8").strip())
    except UnicodeDecodeError:
        return ParseResult(kind=ParseKind.UNSUPPORTED)
