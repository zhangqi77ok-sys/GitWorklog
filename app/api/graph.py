"""Obsidian 风格代码与变更知识图谱 API。"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.core.response import R
from app.platform.graph.engine import get_graph_engine

router = APIRouter(prefix="/api/graph", tags=["Obsidian 知识图谱"])


@router.get("/project")
def get_project_graph(project_path: str | None = Query(None), _: CurrentUser = None) -> R[dict[str, Any]]:
    """获取当前工程的 AST 实体、代码依赖与 Git 变动知识图谱。"""
    engine = get_graph_engine()
    graph_data = engine.build_project_graph(project_path)
    return R.ok(graph_data)