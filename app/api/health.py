"""健康检查与根路由。"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.response import R

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> R[dict[str, str]]:
    return R.ok({"status": "up"})
