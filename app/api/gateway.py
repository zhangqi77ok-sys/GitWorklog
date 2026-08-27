"""LLM 智能网关与 API 管理 API。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel


from app.api.deps import CurrentUser, DbDep
from app.core.response import R
from app.platform.gateway.defaults import PRESET_PROVIDERS
from app.platform.gateway.service import (
    list_providers,
    list_routes,
    test_provider_connectivity,
    update_provider,
    update_route,
)

router = APIRouter(prefix="/api/gateway", tags=["LLM 智能网关"])


class ProviderItem(BaseModel):
    id: int
    provider_code: str
    name: str
    base_url: str
    api_key_masked: str
    has_key: bool
    protocol: str
    enabled: int
    models: list[dict[str, str]] = []


class UpdateProviderRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    enabled: int | None = None


class RouteItem(BaseModel):
    id: int
    feature_key: str
    feature_name: str
    provider_code: str
    model_name: str
    temperature: float
    max_tokens: int


class UpdateRouteRequest(BaseModel):
    provider_code: str
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 2048


class TestConnectivityRequest(BaseModel):
    provider_code: str
    model_name: str | None = None


@router.get("/providers", response_model=R[list[ProviderItem]])
def get_providers(session: DbDep, _: CurrentUser) -> R[list[ProviderItem]]:
    """获取所有支持的 LLM 厂商配置列表及预置模型。"""
    recs = list_providers(session)
    preset_map = {p["provider_code"]: p.get("models", []) for p in PRESET_PROVIDERS}

    result = []
    for r in recs:
        masked_key = ""
        if r.api_key:
            masked_key = (
                r.api_key[:6] + "******" + r.api_key[-4:] if len(r.api_key) > 10 else "******"
            )

        result.append(
            ProviderItem(
                id=r.id,
                provider_code=r.provider_code,
                name=r.name,
                base_url=r.base_url,
                api_key_masked=masked_key,
                has_key=bool(r.api_key),
                protocol=r.protocol,
                enabled=r.enabled,
                models=preset_map.get(r.provider_code, []),
            )
        )
    return R.ok(result)


@router.put("/providers/{provider_code}")
def edit_provider(
    provider_code: str,
    req: UpdateProviderRequest,
    session: DbDep,
    _: CurrentUser,
) -> R[dict[str, str]]:
    """更新厂商配置（Base URL / API Key / 启用状态）。"""
    rec = update_provider(
        session,
        provider_code=provider_code,
        base_url=req.base_url,
        api_key=req.api_key,
        enabled=req.enabled,
    )
    if not rec:
        return R.fail(404, "厂商配置不存在")
    return R.ok({"provider_code": provider_code, "status": "updated"})


@router.get("/routes", response_model=R[list[RouteItem]])
def get_routes(session: DbDep, _: CurrentUser) -> R[list[RouteItem]]:
    """获取各功能槽位的模型路由映射配置。"""
    recs = list_routes(session)
    return R.ok(
        [
            RouteItem(
                id=r.id,
                feature_key=r.feature_key,
                feature_name=r.feature_name,
                provider_code=r.provider_code,
                model_name=r.model_name,
                temperature=r.temperature,
                max_tokens=r.max_tokens,
            )
            for r in recs
        ]
    )


@router.put("/routes/{feature_key}")
def edit_route(
    feature_key: str,
    req: UpdateRouteRequest,
    session: DbDep,
    _: CurrentUser,
) -> R[dict[str, str]]:
    """更新功能槽位的模型路由（指定调用哪个厂商的哪个模型）。"""
    rec = update_route(
        session,
        feature_key=feature_key,
        provider_code=req.provider_code,
        model_name=req.model_name,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )
    if not rec:
        return R.fail(404, "功能路由不存在")
    return R.ok({"feature_key": feature_key, "status": "updated"})


@router.post("/test")
def probe_model(req: TestConnectivityRequest, session: DbDep, _: CurrentUser) -> R[dict[str, Any]]:
    """测试指定厂商模型的连通性与网络延迟。"""
    success, msg, latency = test_provider_connectivity(session, req.provider_code, req.model_name)
    return R.ok(
        {
            "success": success,
            "message": msg,
            "latency_ms": latency,
        }
    )
