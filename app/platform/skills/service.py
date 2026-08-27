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


def get_skill(session: Session, name: str) -> SkillRecord | None:
    return session.execute(select(SkillRecord).where(SkillRecord.name == name)).scalar_one_or_none()


_SKILL_KEYWORDS: dict[str, list[str]] = {
    "data-analysis": [
        "统计",
        "报表",
        "销售额",
        "分析",
        "sql",
        "占比",
        "明细",
        "数据",
        "趋势",
        "环比",
        "同比",
    ],
    "flight-booking": [
        "机票",
        "航班",
        "飞机票",
        "改签",
        "退票",
        "航司",
        "订票",
        "预订机票",
        "买票",
    ],
    "hotel-booking": ["酒店", "订房", "住宿", "宾馆", "房型", "房费", "协议价", "预订酒店", "入住"],
    "tuniu-travel-guide": [
        "天气",
        "攻略",
        "交通指南",
        "气温",
        "景点",
        "出行指南",
        "机场大巴",
        "商圈",
        "温度",
        "下雨",
    ],
    "itinerary-planner": [
        "行程",
        "规划路线",
        "行程安排",
        "日程",
        "差旅计划",
        "路线",
        "几号出发",
        "安排行程",
    ],
    "travel-reimbursement": [
        "报销",
        "发票",
        "补贴",
        "报销单",
        "贴票",
        "验真",
        "发票核验",
        "报销标准",
        "差旅标准",
    ],
}


def match_skills(session: Session, query: str) -> list[SkillRecord]:
    """根据用户查询自动匹配已启用的技能包。"""
    enabled_skills = list_enabled(session)
    if not enabled_skills:
        return []

    q_lower = query.lower()
    matched: list[SkillRecord] = []

    for skill in enabled_skills:
        kws = _SKILL_KEYWORDS.get(skill.name, [])
        # 1. 显式名称匹配
        if skill.name.lower() in q_lower or skill.description in q_lower:
            matched.append(skill)
            continue
        # 2. 关键词匹配
        if any(kw in q_lower for kw in kws):
            matched.append(skill)
            continue
        # 3. 描述中的专有词拆分匹配
        desc_terms = [
            t
            for t in skill.description.replace("、", " ").replace("，", " ").split()
            if len(t) >= 2
        ]
        if any(term in q_lower for term in desc_terms):
            matched.append(skill)

    return matched


def create_skill(
    session: Session,
    root: str,
    name: str,
    description: str,
    body: str,
    enabled: bool = True,
) -> SkillRecord:
    """创建或更新 Skill（落盘 SKILL.md 并写入数据库）。"""
    import os
    import re

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise ValueError("技能标识只能包含字母、数字、下划线和短横线")

    skill_dir = os.path.join(root, name)
    os.makedirs(skill_dir, exist_ok=True)
    skill_md_path = os.path.join(skill_dir, "SKILL.md")

    content = f"---\nname: {name}\ndescription: {description}\n---\n\n{body.strip()}\n"
    with open(skill_md_path, "w", encoding="utf-8") as f:
        f.write(content)

    rec = session.execute(select(SkillRecord).where(SkillRecord.name == name)).scalar_one_or_none()
    if rec is None:
        rec = SkillRecord(
            name=name,
            description=description,
            skill_dir=skill_dir,
            body=body,
            enabled=1 if enabled else 0,
        )
        session.add(rec)
    else:
        rec.description = description
        rec.skill_dir = skill_dir
        rec.body = body
        rec.enabled = 1 if enabled else 0

    session.commit()
    session.refresh(rec)
    return rec


def update_skill(
    session: Session,
    root: str,
    name: str,
    description: str,
    body: str,
) -> SkillRecord:
    return create_skill(session, root, name, description, body)


def delete_skill(session: Session, root: str, name: str) -> None:
    """删除指定技能（删除本地文件夹与数据库记录）。"""
    import os
    import shutil

    skill_dir = os.path.join(root, name)
    if os.path.exists(skill_dir):
        shutil.rmtree(skill_dir)

    rec = session.execute(select(SkillRecord).where(SkillRecord.name == name)).scalar_one_or_none()
    if rec is not None:
        session.delete(rec)
        session.commit()


def import_skills_from_archive_or_file(
    session: Session,
    root: str,
    filename: str,
    data: bytes,
) -> list[SkillRecord]:
    """从 ZIP 压缩包、Markdown 文件 (.md) 或 JSON 文件导入技能。"""
    import io
    import json
    import os
    import zipfile

    from app.platform.skills.loader import parse_skill_md

    imported: list[SkillRecord] = []
    fname_lower = filename.lower()

    if fname_lower.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            md_entries = [
                name
                for name in zf.namelist()
                if name.endswith("SKILL.md") and not name.startswith("__MACOSX")
            ]
            if not md_entries:
                raise ValueError("压缩包内未找到任何包含 frontmatter 的 SKILL.md 文件")

            for entry in md_entries:
                content = zf.read(entry).decode("utf-8")
                manifest = parse_skill_md(content)
                target_dir = os.path.join(root, manifest.name)
                os.makedirs(target_dir, exist_ok=True)

                # 提取同目录下的所有文件
                entry_prefix = entry[: -len("SKILL.md")]
                for member in zf.namelist():
                    if member.startswith(entry_prefix) and not member.endswith("/"):
                        rel_path = member[len(entry_prefix) :]
                        dest_path = os.path.join(target_dir, rel_path)
                        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                        with open(dest_path, "wb") as f:
                            f.write(zf.read(member))

                rec = create_skill(
                    session,
                    root,
                    name=manifest.name,
                    description=manifest.description,
                    body=manifest.body,
                    enabled=True,
                )
                imported.append(rec)

    elif fname_lower.endswith(".md"):
        content = data.decode("utf-8")
        manifest = parse_skill_md(content)
        rec = create_skill(
            session,
            root,
            name=manifest.name,
            description=manifest.description,
            body=manifest.body,
            enabled=True,
        )
        imported.append(rec)

    elif fname_lower.endswith(".json"):
        payload = json.loads(data.decode("utf-8"))
        items = payload if isinstance(payload, list) else [payload]
        for it in items:
            name = it.get("name")
            description = it.get("description", "")
            body = it.get("body", "")
            if not name:
                raise ValueError("JSON 中每个技能必须包含 name 字段")
            rec = create_skill(
                session,
                root,
                name=name,
                description=description,
                body=body,
                enabled=bool(it.get("enabled", True)),
            )
            imported.append(rec)
    else:
        raise ValueError("不支持的文件格式，仅支持 .zip 压缩包、.md 文件或 .json 格式")

    return imported
