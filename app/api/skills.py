from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    body: str = ""


class CreateSkillRequest(BaseModel):
    name: str
    description: str
    body: str = ""
    enabled: bool = True


class UpdateSkillRequest(BaseModel):
    description: str
    body: str = ""


class ToggleRequest(BaseModel):
    enabled: bool


def _brief(rec) -> SkillBrief:  # type: ignore[no-untyped-def]
    return SkillBrief(
        name=rec.name,
        description=rec.description,
        enabled=bool(rec.enabled),
        body=rec.body or "",
    )


@router.get("/list")
def list_skills(session: DbDep, _: CurrentUser) -> R[list[SkillBrief]]:
    # 首次若 DB 无记录，自动从 FS 同步一次
    recs = service.list_skills(session)
    if not recs:
        recs = service.sync_from_fs(session, _SKILLS_ROOT)
    return R.ok([_brief(r) for r in recs])


@router.post("/sync")
def sync_skills(session: DbDep, _: CurrentUser) -> R[list[SkillBrief]]:
    records = service.sync_from_fs(session, _SKILLS_ROOT)
    return R.ok([_brief(r) for r in records])


@router.post("/import")
async def import_skills(
    file: Annotated[UploadFile, File(...)],
    session: DbDep,
    _: CurrentUser,
) -> R[list[SkillBrief]]:
    """导入技能（支持 .zip 压缩包、.md 文件或 .json 配置文件）。"""

    filename = file.filename or "unknown"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传文件为空")

    try:
        recs = service.import_skills_from_archive_or_file(
            session,
            _SKILLS_ROOT,
            filename=filename,
            data=data,
        )
        return R.ok([_brief(r) for r in recs])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"导入失败: {exc}") from exc



@router.post("")
def create_skill(req: CreateSkillRequest, session: DbDep, _: CurrentUser) -> R[SkillBrief]:

    rec = service.create_skill(
        session,
        settings_skills_root(),
        name=req.name.strip(),
        description=req.description.strip(),
        body=req.body.strip(),
        enabled=req.enabled,
    )
    return R.ok(_brief(rec))


@router.put("/{name}")
def update_skill(
    name: str, req: UpdateSkillRequest, session: DbDep, _: CurrentUser
) -> R[SkillBrief]:
    rec = service.update_skill(
        session,
        settings_skills_root(),
        name=name.strip(),
        description=req.description.strip(),
        body=req.body.strip(),
    )
    return R.ok(_brief(rec))


@router.delete("/{name}")
def delete_skill(name: str, session: DbDep, _: CurrentUser) -> R[dict[str, str]]:
    service.delete_skill(session, settings_skills_root(), name.strip())
    return R.ok({"deleted": name})


@router.put("/{name}/toggle")
def toggle_skill(name: str, req: ToggleRequest, session: DbDep, _: CurrentUser) -> R[SkillBrief]:
    rec = service.toggle(session, name, req.enabled)
    return R.ok(_brief(rec))


def settings_skills_root() -> str:
    """skills 根目录（预留从 config 覆盖）。"""
    return getattr(settings.app, "skills_root", _SKILLS_ROOT) or _SKILLS_ROOT
