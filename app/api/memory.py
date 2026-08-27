from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.memory.service import get_short_term_memory, get_long_term_memory

router = APIRouter(prefix="/memory", tags=["memory"])

class AddMemoryRequest(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: list[str] = []

@router.get("/short/{conversation_id}")
def get_short_memory(conversation_id: str, limit: int = 10) -> R[list[dict[str, Any]]]:
    st = get_short_term_memory()
    return R.ok(st.get_context(conversation_id, limit))

@router.get("/long")
def get_long_memories(query: str = "", limit: int = 10) -> R[list[dict[str, Any]]]:
    lt = get_long_term_memory()
    if query:
        return R.ok(lt.search_memories(query, limit))
    return R.ok(lt.list_all())

@router.post("/long")
def add_long_memory(req: AddMemoryRequest) -> R[dict[str, Any]]:
    lt = get_long_term_memory()
    res = lt.add_memory(req.title, req.content, req.category, req.tags)
    return R.ok(res)
