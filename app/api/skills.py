from typing import Any
from fastapi import APIRouter
from app.core.response import R
from app.platform.skills.registry import get_skill_registry

router = APIRouter(prefix="/skills", tags=["skills"])

@router.get("")
@router.get("/")
def list_skills() -> R[list[dict[str, Any]]]:
    reg = get_skill_registry()
    return R.ok(reg.list_skills())
