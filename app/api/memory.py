"""用户长期记忆与知识图谱 API。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.memory.service import (
    add_user_memory,
    clear_user_memories_and_graph,
    delete_user_memory,
    list_user_graph_edges,
    list_user_memories,
)

router = APIRouter(prefix="/api/user/memory", tags=["用户记忆与图谱"])


class MemoryItem(BaseModel):
    id: int
    memory_type: str
    key: str
    value: str
    confidence: float
    updated_at: str | None = None


class GraphEdgeItem(BaseModel):
    id: int
    source: str
    relation: str
    target: str
    weight: float


class UserMemoryAndGraphResponse(BaseModel):
    memories: list[MemoryItem]
    graph_edges: list[GraphEdgeItem]


class AddMemoryRequest(BaseModel):
    memory_type: str = "preference"
    key: str
    value: str


@router.get("", response_model=R[UserMemoryAndGraphResponse])
def get_user_memory_and_graph(session: DbDep, user: CurrentUser) -> R[UserMemoryAndGraphResponse]:
    """获取当前用户的长期记忆列表与知识图谱关系网。"""
    memories = list_user_memories(session, user.id)
    edges = list_user_graph_edges(session, user.id)

    return R.ok(
        UserMemoryAndGraphResponse(
            memories=[
                MemoryItem(
                    id=m.id,
                    memory_type=m.memory_type,
                    key=m.key,
                    value=m.value,
                    confidence=m.confidence,
                    updated_at=str(m.updated_at)
                    if hasattr(m, "updated_at") and m.updated_at
                    else None,
                )
                for m in memories
            ],
            graph_edges=[
                GraphEdgeItem(
                    id=e.id,
                    source=e.source_node,
                    relation=e.relation,
                    target=e.target_node,
                    weight=e.weight,
                )
                for e in edges
            ],
        )
    )


@router.post("", response_model=R[MemoryItem])
def create_memory(req: AddMemoryRequest, session: DbDep, user: CurrentUser) -> R[MemoryItem]:
    """手动添加一条用户画像特征或长期记忆。"""
    rec = add_user_memory(
        session,
        user_id=user.id,
        memory_type=req.memory_type,
        key=req.key,
        value=req.value,
    )
    return R.ok(
        MemoryItem(
            id=rec.id,
            memory_type=rec.memory_type,
            key=rec.key,
            value=rec.value,
            confidence=rec.confidence,
        )
    )


@router.delete("/{memory_id}")
def delete_memory(memory_id: int, session: DbDep, user: CurrentUser) -> R[dict[str, int]]:
    """删除指定的单条记忆特征。"""
    success = delete_user_memory(session, user.id, memory_id)
    return R.ok({"deleted": memory_id if success else 0})


@router.delete("")
def clear_all_memory(session: DbDep, user: CurrentUser) -> R[dict[str, str]]:
    """清空当前用户的全部长期记忆与知识图谱。"""
    clear_user_memories_and_graph(session, user.id)
    return R.ok({"status": "cleared"})
