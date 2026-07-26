"""Skills service：FS→DB 同步、启停、列出启用 skill。

同步逻辑：扫描 FS skills，以 name 为键 upsert 到 DB，更新元数据但保留 enabled。
FS 中已删除的 skill 从 DB 移除。运行时按 enabled 装配为 Agent skill。
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.platform.skills.loader import scan_skills
from app.platform.skills.models import SkillRecord


def sync_from_fs(session: Session, root: str) -> list[SkillRecord]:
    """以 FS 为权威源同步到 DB。返回同步后的全部记录。"""
    manifests = scan_skills(root)
    fs_names = {m.name for m in manifests}

    existing = {r.name: r for r in session.execute(select(SkillRecord)).scalars()}

    for m in manifests:
        rec = existing.get(m.name)
        if rec is None:
            session.add(
                SkillRecord(
                    name=m.name,
                    description=m.description,
                    skill_dir=m.dir,
                    body=m.body,
                    enabled=1,
                )
            )
        else:
            rec.description = m.description
            rec.skill_dir = m.dir
            rec.body = m.body  # 保留 enabled

    # FS 已删除的，从 DB 移除
    for name, rec in existing.items():
        if name not in fs_names:
            session.delete(rec)

    session.commit()
    return list(session.execute(select(SkillRecord)).scalars())


def list_skills(session: Session) -> list[SkillRecord]:
    return list(session.execute(select(SkillRecord)).scalars())


def list_enabled(session: Session) -> list[SkillRecord]:
    return list(session.execute(select(SkillRecord).where(SkillRecord.enabled == 1)).scalars())


def toggle(session: Session, name: str, enabled: bool) -> SkillRecord:
    rec = session.execute(select(SkillRecord).where(SkillRecord.name == name)).scalar_one_or_none()
    if rec is None:
        raise ValueError(f"skill {name} 不存在")
    rec.enabled = 1 if enabled else 0
    session.commit()
    session.refresh(rec)
    return rec
