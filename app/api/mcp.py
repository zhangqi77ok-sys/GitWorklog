from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.mcp.registry import get_mcp_registry

router = APIRouter(prefix="/mcp", tags=["mcp"])

class ToggleMCPToolRequest(BaseModel):
    tool_id: str
    enabled: bool

@router.get("")
@router.get("/")
def list_mcp_tools() -> R[list[dict[str, Any]]]:
    reg = get_mcp_registry()
    return R.ok(reg.list_tools())

@router.post("/toggle")
def toggle_tool(req: ToggleMCPToolRequest) -> R[bool]:
    reg = get_mcp_registry()
    res = reg.toggle_tool(req.tool_id, req.enabled)
    return R.ok(res)
