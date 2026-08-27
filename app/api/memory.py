"""分层记忆管理 API（短期工作记忆 + 长期语义向量记忆）。"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.core.response import R
from app.platform.memory.service import get_long_term_memory, get_short_term_memory

router = APIRouter(prefix="/api/memory", tags=["分层记忆引擎"])


class AddLongTermMemoryRequest(BaseModel):
    category: str
    title: str
    content: str
    tags: list[str] = []


@router.get("/long-term/list")
def list_long_term_memories(_: CurrentUser = None) -> R[list[dict[str, Any]]]:
    """列出所有长期语义记忆项。"""
    mem = get_long_term_memory()
    return R.ok(mem.list_all())


@router.post("/long-term/add")
def add_long_term_memory(req: AddLongTermMemoryRequest, _: CurrentUser = None) -> R[dict[str, Any]]:
    """新增一条长期记忆最佳实践或架构规则。"""
    mem = get_long_term_memory()
    item = mem.add_memory(req.category, req.title, req.content, req.tags)
    return R.ok(item)


@router.delete("/long-term/{mem_id}")
def delete_long_term_memory(mem_id: str, _: CurrentUser = None) -> R[dict[str, bool]]:
    """删除指定的长期记忆项。"""
    mem = get_long_term_memory()
    success = mem.delete_memory(mem_id)
    return R.ok({"deleted": success})


@router.get("/search")
def search_memory(q: str = Query(""), _: CurrentUser = None) -> R[list[dict[str, Any]]]:
    """语义搜索长期记忆与最佳实践。"""
    mem = get_long_term_memory()
    return R.ok(mem.search_memories(q, limit=10))


@router.get("/short-term/{conversation_id}")
def get_short_term_memory_context(conversation_id: str, _: CurrentUser = None) -> R[list[dict[str, Any]]]:
    """获取当前会话的短期工作记忆上下文。"""
    stm = get_short_term_memory()
    return R.ok(stm.get_context(conversation_id, limit=20))