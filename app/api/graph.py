from typing import Any
from fastapi import APIRouter
from app.core.response import R
from app.platform.graph.service import get_graph_service

router = APIRouter(prefix="/graph", tags=["graph"])

@router.get("/ast")
def get_ast_graph() -> R[dict[str, Any]]:
    svc = get_graph_service()
    return R.ok(svc.scan_project_ast())
