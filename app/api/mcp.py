from typing import Any
from fastapi import APIRouter
from app.core.response import R
from app.platform.mcp.registry import get_mcp_registry

router = APIRouter(prefix="/mcp", tags=["mcp"])

@router.get("")
@router.get("/")
def list_mcp_tools() -> R[list[dict[str, Any]]]:
    reg = get_mcp_registry()
    return R.ok(reg.list_tools())
