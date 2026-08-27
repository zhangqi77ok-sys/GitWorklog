"""企业级高阶知识库 RAG 检索引擎：支持父子分片（Parent-Child Chunking）与向量/倒排混合精确定位。

父子分片设计：
- 父分片（Parent Chunk，1000~1500字符）：承载宏观业务逻辑、上下文与完整规则；
- 子分片（Child Chunk，250~350字符）：用于微观高精度相似度与关键词检索匹配；
- 命中子分片后，自动回溯并聚合父分片完整内容提供给 LLM，既保证召回精度，又避免上下文断章取义。
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.platform.files.models import FileRecord
from app.platform.files.service import split_overlap


@dataclass
class RAGChunk:
    """标准/子分片实体。"""

    file_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


@dataclass
class RAGParentChunk:
    """父分片实体：聚合子分片命中信息，提供完整上下文。"""

    parent_id: str
    file_id: str
    filename: str
    parent_index: int
    content: str
    best_score: float
    matched_children: list[str] = field(default_factory=list)


def _tokenize(text: str) -> list[str]:
    """提取中英文单词与双字/三字 n-gram 片段以支持高精度分词与检索。"""
    cleaned = text.lower().strip()
    en_words = re.findall(r"[a-z0-9_]{2,}", cleaned)
    cn_chars = re.findall(r"[\u4e00-\u9fa5]", cleaned)

    tokens = list(en_words)
    tokens.extend(cn_chars)

    cn_text = "".join(cn_chars)
    for n in (2, 3):
        if len(cn_text) >= n:
            for i in range(len(cn_text) - n + 1):
                tokens.append(cn_text[i : i + n])

    return [t for t in tokens if t.strip()]


def calculate_relevance(query_tokens: list[str], chunk_text: str, query_raw: str) -> float:
    """计算查询与文本切片的混合相关度得分 (0.0 ~ 1.0)。"""
    if not query_tokens or not chunk_text:
        return 0.0

    chunk_lower = chunk_text.lower()
    total_score = 0.0

    # 1. 完整查询子串精确命中强加分
    if len(query_raw) >= 3 and query_raw.lower() in chunk_lower:
        total_score += 0.5

    # 2. Token 命中率与频次加权 (TF)
    matched_tokens = 0
    for tok in set(query_tokens):
        count = chunk_lower.count(tok)
        if count > 0:
            matched_tokens += 1
            weight = math.log1p(len(tok))
            total_score += weight * min(count, 3) * 0.1

    token_coverage = matched_tokens / max(len(set(query_tokens)), 1)
    final_score = (token_coverage * 0.4) + min(total_score, 0.6)
    return min(final_score, 1.0)


def split_parent_child(
    text: str,
    parent_size: int = 1200,
    parent_overlap: int = 150,
    child_size: int = 300,
    child_overlap: int = 50,
) -> list[tuple[int, str, int, str]]:
    """生成父子分片元组列表：(parent_idx, parent_text, child_idx, child_text)。"""
    parents = split_overlap(text, size=parent_size, overlap=parent_overlap)
    if not parents:
        return []

    results: list[tuple[int, str, int, str]] = []
    for p_idx, p_text in enumerate(parents):
        children = split_overlap(p_text, size=child_size, overlap=child_overlap)
        for c_idx, c_text in enumerate(children):
            results.append((p_idx, p_text, c_idx, c_text))
    return results


def search_knowledge_base(
    session: Session,
    query: str,
    file_ids: list[str] | None = None,
    top_k: int = 4,
    min_score: float = 0.05,
    use_parent_child: bool = True,
) -> list[RAGParentChunk]:
    """使用父子分片（Parent-Child）混合检索知识库，命中子块回溯聚合完整父块。"""
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    stmt = select(FileRecord)
    if file_ids:
        stmt = stmt.where(FileRecord.file_id.in_(file_ids))

    records = session.execute(stmt).scalars().all()
    parent_map: dict[str, RAGParentChunk] = {}

    for rec in records:
        if not rec.text_content:
            continue

        if use_parent_child:
            pc_tuples = split_parent_child(rec.text_content)
            for p_idx, p_text, _c_idx, c_text in pc_tuples:
                score = calculate_relevance(query_tokens, c_text, query)
                if score >= min_score:
                    pid = f"{rec.file_id}_p{p_idx}"
                    if pid not in parent_map:
                        parent_map[pid] = RAGParentChunk(
                            parent_id=pid,
                            file_id=rec.file_id,
                            filename=rec.filename,
                            parent_index=p_idx,
                            content=p_text.strip(),
                            best_score=round(score, 3),
                            matched_children=[c_text.strip()[:100] + "..."],
                        )
                    else:
                        parent_chunk = parent_map[pid]
                        if score > parent_chunk.best_score:
                            parent_chunk.best_score = round(score, 3)
                        if len(parent_chunk.matched_children) < 3:
                            parent_chunk.matched_children.append(c_text.strip()[:100] + "...")
        else:
            pieces = split_overlap(rec.text_content, size=500, overlap=80)
            for idx, piece in enumerate(pieces):
                score = calculate_relevance(query_tokens, piece, query)
                if score >= min_score:
                    pid = f"{rec.file_id}_c{idx}"
                    parent_map[pid] = RAGParentChunk(
                        parent_id=pid,
                        file_id=rec.file_id,
                        filename=rec.filename,
                        parent_index=idx,
                        content=piece.strip(),
                        best_score=round(score, 3),
                        matched_children=[],
                    )

    sorted_parents = sorted(parent_map.values(), key=lambda p: p.best_score, reverse=True)
    return sorted_parents[:top_k]
