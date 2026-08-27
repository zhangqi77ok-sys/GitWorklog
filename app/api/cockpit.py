"""Cockpit Tools 驾驶舱管理 API。"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.cockpit.registry import get_cockpit_registry
from app.platform.token_meter.service import get_token_usage_service

router = APIRouter(prefix="/api/cockpit", tags=["Cockpit Tools 驾驶舱"])


class ToggleToolRequest(BaseModel):
    tool_id: str
    enabled: bool


class InvokeToolRequest(BaseModel):
    tool_id: str
    parameters: dict[str, Any] = {}


@router.get("/tools")
def list_cockpit_tools(_: CurrentUser = None) -> R[list[dict[str, Any]]]:
    """获取驾驶舱全部工具清单与启用状态。"""
    reg = get_cockpit_registry()
    return R.ok(reg.list_tools())


@router.post("/tools/toggle")
def toggle_cockpit_tool(req: ToggleToolRequest, _: CurrentUser = None) -> R[dict[str, Any]]:
    """一键开启/禁用指定驾驶舱工具。"""
    reg = get_cockpit_registry()
    success = reg.toggle_tool(req.tool_id, req.enabled)
    return R.ok({"tool_id": req.tool_id, "enabled": req.enabled, "success": success})


@router.post("/tools/invoke")
async def invoke_cockpit_tool(req: InvokeToolRequest, _: CurrentUser = None) -> R[dict[str, Any]]:
    """驾驶舱在线调试测试调用工具。"""
    reg = get_cockpit_registry()
    res = await reg.invoke_tool(req.tool_id, req.parameters)
    return R.ok(res)


@router.get("/token/summary")
def get_token_summary(session: DbDep, _: CurrentUser = None) -> R[dict[str, Any]]:
    """获取全局 Token 消耗统计汇总与模型消耗分布。"""
    svc = get_token_usage_service()
    return R.ok(svc.get_global_summary(session))


@router.get("/token/session/{conversation_id}")
def get_session_token_usage(conversation_id: str, session: DbDep, _: CurrentUser = None) -> R[dict[str, Any]]:
    """获取指定会话的 Token 消耗统计。"""
    svc = get_token_usage_service()
    return R.ok(svc.get_session_tokens(session, conversation_id))