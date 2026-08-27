"""Skills 测试：frontmatter 解析、防穿越、FS→DB 同步、启停。"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.platform.skills import service
from app.platform.skills.loader import (
    SkillFormatError,
    parse_skill_md,
    safe_join,
    scan_skills,
)

# 项目内置 skills 目录
SKILLS_ROOT = str(Path(__file__).parent.parent.parent / "skills")


# ---------- 解析 ----------
def test_parse_skill_md_ok() -> None:
    text = "---\nname: demo\ndescription: 演示\n---\n正文内容"
    m = parse_skill_md(text)
    assert m.name == "demo"
    assert m.description == "演示"
    assert "正文" in m.body


def test_parse_missing_frontmatter() -> None:
    with pytest.raises(SkillFormatError):
        parse_skill_md("没有 frontmatter 的纯文本")


def test_parse_missing_required_field() -> None:
    with pytest.raises(SkillFormatError):
        parse_skill_md("---\nname: x\n---\n body")


# ---------- 防路径穿越 ----------
def test_safe_join_ok() -> None:
    p = safe_join("/tmp/skills", "demo/SKILL.md")
    assert "demo" in str(p)


def test_safe_join_traversal_blocked() -> None:
    with pytest.raises(SkillFormatError):
        safe_join("/tmp/skills", "../../etc/passwd")


# ---------- 扫描内置 skills ----------
def test_scan_builtin_skills() -> None:
    manifests = scan_skills(SKILLS_ROOT)
    names = {m.name for m in manifests}
    assert "data-analysis" in names


# ---------- FS→DB 同步 + 启停 ----------
def test_sync_and_toggle(db_session: Session) -> None:
    records = service.sync_from_fs(db_session, SKILLS_ROOT)
    assert any(r.name == "data-analysis" for r in records)
    # 默认启用
    assert all(r.enabled == 1 for r in records)
    # 停用后 list_enabled 不含它
    service.toggle(db_session, "data-analysis", enabled=False)
    assert not any(r.name == "data-analysis" for r in service.list_enabled(db_session))
    # 再同步保留 enabled 状态
    service.sync_from_fs(db_session, SKILLS_ROOT)
    rec = next(r for r in service.list_skills(db_session) if r.name == "data-analysis")
    assert rec.enabled == 0


def test_toggle_unknown_raises(db_session: Session) -> None:
    with pytest.raises(ValueError):
        service.toggle(db_session, "nonexistent", enabled=True)
