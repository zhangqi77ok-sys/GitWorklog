"""Skills 管理接口（对应 dodo 的 /api/skills）：列表、启停、同步。管理操作需 admin。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep, require_role
from app.core.config import settings
from app.core.response import R
from app.platform.skills import service
from app.platform.user.models import SysUser

router = APIRouter(prefix="/api/skills", tags=["skills"])

AdminUser = Annotated[SysUser, Depends(require_role("admin"))]

# skills 文件系统根目录（默认项目内 skills/）
_SKILLS_ROOT = "skills"


class SkillBrief(BaseModel):
    name: str
    description: str
    enabled: bool


class ToggleRequest(BaseModel):
    enabled: bool


def _brief(rec) -> SkillBrief:  # type: ignore[no-untyped-def]
    return SkillBrief(name=rec.name, description=rec.description, enabled=bool(rec.enabled))


@router.get("/list")
def list_skills(session: DbDep, _: CurrentUser) -> R[list[SkillBrief]]:
    return R.ok([_brief(r) for r in service.list_skills(session)])


@router.post("/sync")
def sync_skills(session: DbDep, _: AdminUser) -> R[list[SkillBrief]]:
    records = service.sync_from_fs(session, settings_skills_root())
    return R.ok([_brief(r) for r in records])


@router.put("/{name}/toggle")
def toggle_skill(name: str, req: ToggleRequest, session: DbDep, _: AdminUser) -> R[SkillBrief]:
    rec = service.toggle(session, name, req.enabled)
    return R.ok(_brief(rec))


def settings_skills_root() -> str:
    """skills 根目录（预留从 config 覆盖）。"""
    return getattr(settings.app, "skills_root", _SKILLS_ROOT) or _SKILLS_ROOT
