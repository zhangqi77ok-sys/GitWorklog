"""文件与知识库 API 接口：上传、解析、检索、删除。"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc, select

from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.files.models import FileRecord
from app.platform.files.parser import parse_file

router = APIRouter(prefix="/api/files", tags=["files"])

_UPLOAD_DIR = Path("data/uploads")


class FileItem(BaseModel):
    file_id: str
    filename: str
    content_type: str
    size_bytes: int
    kind: str
    summary: str
    created_at: str
    kb_id: int = 0


class KnowledgeBaseItem(BaseModel):
    id: int
    name: str
    description: str
    doc_count: int
    total_size_bytes: int
    created_at: str
    files: list[FileItem] = []


class DeleteKBResult(BaseModel):
    deleted_kb_id: int
    deleted_files_count: int


class DeleteFileResult(BaseModel):
    deleted: str


class CreateKBRequest(BaseModel):
    name: str
    description: str = ""


class FilePreview(BaseModel):
    file_id: str
    filename: str
    kind: str
    size_bytes: int
    text_content: str
    summary: str
    kb_id: int = 0


@router.get("/kb/list")

def list_knowledge_bases(session: DbDep, _: CurrentUser) -> R[list[KnowledgeBaseItem]]:
    """获取所有知识库集合及其关联文档列表。"""
    from app.platform.files.models import KnowledgeBaseRecord

    kbs = list(session.execute(select(KnowledgeBaseRecord).order_by(desc(KnowledgeBaseRecord.created_at))).scalars().all())
    all_files = list(session.execute(select(FileRecord).order_by(desc(FileRecord.created_at))).scalars().all())

    # 默认创建默认知识库（若不存在）
    if not kbs:
        default_kb = KnowledgeBaseRecord(name="默认知识库", description="通用知识库与常用参考文档集合", user_id=0)
        session.add(default_kb)
        session.commit()
        session.refresh(default_kb)
        kbs = [default_kb]

    result = []
    for kb in kbs:
        kb_files = [
            FileItem(
                file_id=r.file_id,
                filename=r.filename,
                content_type=r.content_type,
                size_bytes=r.size_bytes,
                kind=r.kind,
                summary=r.summary,
                created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                kb_id=r.kb_id,
            )
            for r in all_files
            if r.kb_id == kb.id or (kb.id == kbs[0].id and (r.kb_id == 0 or r.kb_id is None))
        ]
        total_size = sum(f.size_bytes for f in kb_files)
        result.append(
            KnowledgeBaseItem(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                doc_count=len(kb_files),
                total_size_bytes=total_size,
                created_at=kb.created_at.strftime("%Y-%m-%d %H:%M:%S") if kb.created_at else "",
                files=kb_files,
            )
        )
    return R.ok(result)


@router.post("/kb")
def create_knowledge_base(req: CreateKBRequest, session: DbDep, user: CurrentUser) -> R[KnowledgeBaseItem]:

    """创建新的知识库集合。"""
    from app.platform.files.models import KnowledgeBaseRecord

    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="知识库名称不能为空")

    exist = session.execute(
        select(KnowledgeBaseRecord).where(KnowledgeBaseRecord.name == name)
    ).scalar_one_or_none()
    if exist:
        raise HTTPException(status_code=400, detail="同名知识库已存在")

    kb = KnowledgeBaseRecord(name=name, description=req.description.strip(), user_id=user.id if user else 0)
    session.add(kb)
    session.commit()
    session.refresh(kb)

    return R.ok(
        KnowledgeBaseItem(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            doc_count=0,
            total_size_bytes=0,
            created_at=kb.created_at.strftime("%Y-%m-%d %H:%M:%S") if kb.created_at else "",
            files=[],
        )
    )


@router.delete("/kb/{kb_id}")
def delete_knowledge_base(kb_id: int, session: DbDep, _: CurrentUser) -> R[DeleteKBResult]:
    """删除知识库集合，并级联删除所属文件及向量数据库索引。"""
    import contextlib
    from app.platform.files.models import KnowledgeBaseRecord
    from app.platform.files.pgvector_index import PgVectorIndex

    kb = session.execute(
        select(KnowledgeBaseRecord).where(KnowledgeBaseRecord.id == kb_id)
    ).scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 查出旗下所有文件并级联删除
    files = list(session.execute(select(FileRecord).where(FileRecord.kb_id == kb_id)).scalars().all())
    for f in files:
        if f.stored_path and os.path.exists(f.stored_path):
            with contextlib.suppress(OSError):
                os.remove(f.stored_path)
        with contextlib.suppress(Exception):
            PgVectorIndex().delete(f.file_id)
        session.delete(f)

    session.delete(kb)
    session.commit()
    return R.ok(DeleteKBResult(deleted_kb_id=kb_id, deleted_files_count=len(files)))



@router.post("/upload")
async def upload_file(
    file: Annotated[UploadFile, File(...)],
    session: DbDep,
    user: CurrentUser,
    kb_id: int = 0,
) -> R[FileItem]:
    """上传文件并归属到指定知识库，自动解析提取文本。支持 TXT/MD/PDF/DOCX/CSV/JSON/XLSX 等。"""
    filename = file.filename or "unknown"
    data = await file.read()
    size_bytes = len(data)

    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="上传文件内容为空")
    if size_bytes > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小超出 50MB 限制")

    file_id = uuid.uuid4().hex
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved_path = _UPLOAD_DIR / f"{file_id}_{filename}"
    saved_path.write_bytes(data)

    # 解析文件文本
    parsed = parse_file(filename, data)
    kind = parsed.kind.value if hasattr(parsed.kind, "value") else str(parsed.kind)
    text_content = parsed.text or ""
    summary = text_content[:200].strip().replace("\n", " ") if text_content else f"文件类型: {kind}"

    rec = FileRecord(
        file_id=file_id,
        filename=filename,
        content_type=file.content_type or "",
        size_bytes=size_bytes,
        stored_path=str(saved_path),
        kind=kind,
        text_content=text_content,
        summary=summary[:500],
        user_id=user.id if user else 0,
        kb_id=kb_id,
    )
    session.add(rec)
    session.commit()
    session.refresh(rec)

    return R.ok(
        FileItem(
            file_id=rec.file_id,
            filename=rec.filename,
            content_type=rec.content_type,
            size_bytes=rec.size_bytes,
            kind=rec.kind,
            summary=rec.summary,
            created_at=rec.created_at.strftime("%Y-%m-%d %H:%M:%S") if rec.created_at else "",
            kb_id=rec.kb_id,
        )
    )


@router.get("/list")
def list_files(session: DbDep, _: CurrentUser, kb_id: int | None = None) -> R[list[FileItem]]:
    """获取文件列表，支持按知识库 ID 筛选。"""
    query = select(FileRecord).order_by(desc(FileRecord.created_at))
    if kb_id is not None:
        query = query.where(FileRecord.kb_id == kb_id)
    recs = session.execute(query).scalars().all()
    return R.ok(
        [
            FileItem(
                file_id=r.file_id,
                filename=r.filename,
                content_type=r.content_type,
                size_bytes=r.size_bytes,
                kind=r.kind,
                summary=r.summary,
                created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                kb_id=r.kb_id,
            )
            for r in recs
        ]
    )


@router.get("/{file_id}/preview")
def preview_file(file_id: str, session: DbDep, _: CurrentUser) -> R[FilePreview]:
    """查看文件解析文本与详情。"""
    rec = session.execute(
        select(FileRecord).where(FileRecord.file_id == file_id)
    ).scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    return R.ok(
        FilePreview(
            file_id=rec.file_id,
            filename=rec.filename,
            kind=rec.kind,
            size_bytes=rec.size_bytes,
            text_content=rec.text_content,
            summary=rec.summary,
            kb_id=rec.kb_id,
        )
    )


@router.delete("/{file_id}")
def delete_file(file_id: str, session: DbDep, _: CurrentUser) -> R[DeleteFileResult]:
    """删除文件，并级联清理磁盘文件与向量数据库索引。"""
    rec = session.execute(
        select(FileRecord).where(FileRecord.file_id == file_id)
    ).scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=404, detail="文件不存在")

    import contextlib

    # 1. 删除磁盘物理文件
    if rec.stored_path and os.path.exists(rec.stored_path):
        with contextlib.suppress(OSError):
            os.remove(rec.stored_path)

    # 2. 级联清理 PgVector 向量数据库
    with contextlib.suppress(Exception):
        from app.platform.files.pgvector_index import PgVectorIndex

        PgVectorIndex().delete(file_id)

    # 3. 删除 MySQL 记录
    session.delete(rec)
    session.commit()
    return R.ok(DeleteFileResult(deleted=file_id))




class RAGSearchRequest(BaseModel):
    query: str
    file_ids: list[str] = []
    top_k: int = 4


class RAGChunkItem(BaseModel):
    parent_id: str
    file_id: str
    filename: str
    parent_index: int
    content: str
    score: float
    matched_children: list[str] = []


@router.post("/rag/search")
def search_rag(req: RAGSearchRequest, session: DbDep, _: CurrentUser) -> R[list[RAGChunkItem]]:
    """知识库高阶 RAG 父子分片检索接口。"""
    from app.platform.files.rag import search_knowledge_base

    chunks = search_knowledge_base(
        session,
        query=req.query.strip(),
        file_ids=req.file_ids if req.file_ids else None,
        top_k=req.top_k,
    )
    return R.ok(
        [
            RAGChunkItem(
                parent_id=c.parent_id,
                file_id=c.file_id,
                filename=c.filename,
                parent_index=c.parent_index,
                content=c.content,
                score=c.best_score,
                matched_children=c.matched_children,
            )
            for c in chunks
        ]
    )
