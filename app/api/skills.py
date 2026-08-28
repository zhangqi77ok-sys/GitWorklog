from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.skills.registry import get_skill_registry

router = APIRouter(prefix="/skills", tags=["skills"])

class ToggleSkillRequest(BaseModel):
    skill_id: str
    enabled: bool

@router.get("")
@router.get("/")
def list_skills() -> R[list[dict[str, Any]]]:
    reg = get_skill_registry()
    return R.ok(reg.list_skills())

@router.post("/toggle")
def toggle_skill(req: ToggleSkillRequest) -> R[bool]:
    reg = get_skill_registry()
    res = reg.toggle_skill(req.skill_id, req.enabled)
    return R.ok(res)
