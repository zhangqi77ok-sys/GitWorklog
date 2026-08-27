"""MCP (Model Context Protocol) 服务的 REST API。"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.core.response import R
from app.platform.mcp.service import (
    create_mcp_server,
    delete_mcp_server,
    get_mcp_server,
    list_mcp_servers,
    ping_mcp_server,
    toggle_mcp_server,
    update_mcp_server,
)

router = APIRouter(prefix="/api/mcp", tags=["Model Context Protocol 服务管理"])


class McpServerCreateRequest(BaseModel):
    name: str
    description: str = ""
    transport: str = "stdio"
    command: str = ""
    args: list[str] = []
    url: str = ""
    env: dict[str, str] = {}
    tools: list[str] = []
    icon: str = "🔌"


@router.get("/list")
def get_mcp_list(_: CurrentUser) -> R[list[dict[str, Any]]]:
    """获取所有已注册和预设的 MCP 协议服务列表。"""
    return R.ok(list_mcp_servers())


@router.post("/create")
def create_mcp(req: McpServerCreateRequest, _: CurrentUser) -> R[dict[str, Any]]:
    """注册新的 MCP 协议服务。"""
    res = create_mcp_server(req.model_dump())
    return R.ok(res)


@router.get("/{server_id}")
def get_mcp_detail(server_id: str, _: CurrentUser) -> R[dict[str, Any]]:
    """获取指定 MCP 服务详情。"""
    res = get_mcp_server(server_id)
    if not res:
        raise HTTPException(status_code=404, detail="MCP 服务不存在")
    return R.ok(res)


@router.put("/{server_id}")
def edit_mcp(server_id: str, req: McpServerCreateRequest, _: CurrentUser) -> R[dict[str, Any]]:
    """更新 MCP 服务配置。"""
    try:
        res = update_mcp_server(server_id, req.model_dump())
        return R.ok(res)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{server_id}")
def remove_mcp(server_id: str, _: CurrentUser) -> R[dict[str, str]]:
    """删除指定的 MCP 服务。"""
    if delete_mcp_server(server_id):
        return R.ok({"deleted": server_id})
    raise HTTPException(status_code=404, detail="MCP 服务不存在")


@router.post("/{server_id}/toggle")
def toggle_mcp(server_id: str, _: CurrentUser) -> R[dict[str, Any]]:
    """启用或禁用 MCP 服务。"""
    try:
        res = toggle_mcp_server(server_id)
        return R.ok(res)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{server_id}/ping")
def ping_mcp(server_id: str, _: CurrentUser) -> R[dict[str, Any]]:
    """探测并检测 MCP 服务连通性及可用工具列表。"""
    try:
        res = ping_mcp_server(server_id)
        return R.ok(res)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e