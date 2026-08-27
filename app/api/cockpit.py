from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.cockpit.registry import get_cockpit_registry
from app.platform.token_meter.service import get_token_meter

router = APIRouter(prefix="/cockpit", tags=["cockpit"])

class ToggleToolRequest(BaseModel):
    tool_id: str
    enabled: bool

class InvokeToolRequest(BaseModel):
    tool_id: str
    params: dict[str, Any] = {}

class PingProviderRequest(BaseModel):
    provider: str

class SwitchAccountRequest(BaseModel):
    provider: str
    account_id: str

@router.get("/tools")
def list_tools() -> R[list[dict[str, Any]]]:
    reg = get_cockpit_registry()
    return R.ok(reg.list_tools())

@router.post("/tools/toggle")
def toggle_tool(req: ToggleToolRequest) -> R[bool]:
    reg = get_cockpit_registry()
    res = reg.toggle_tool(req.tool_id, req.enabled)
    return R.ok(res)

@router.post("/tools/invoke")
def invoke_tool(req: InvokeToolRequest) -> R[dict[str, Any]]:
    reg = get_cockpit_registry()
    res = reg.invoke_tool(req.tool_id, req.params)
    return R.ok(res)

@router.get("/providers")
def list_providers() -> R[dict[str, Any]]:
    reg = get_cockpit_registry()
    return R.ok(reg.list_providers())

@router.post("/providers/ping")
def ping_provider(req: PingProviderRequest) -> R[dict[str, Any]]:
    reg = get_cockpit_registry()
    res = reg.ping_provider(req.provider)
    return R.ok(res)

@router.post("/providers/switch_account")
def switch_account(req: SwitchAccountRequest) -> R[bool]:
    reg = get_cockpit_registry()
    res = reg.switch_account(req.provider, req.account_id)
    return R.ok(res)

@router.get("/token/summary")
def get_token_summary(conversation_id: str | None = None) -> R[dict[str, Any]]:
    meter = get_token_meter()
    res = meter.get_summary(conversation_id)
    return R.ok(res)
