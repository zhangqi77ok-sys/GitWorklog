"""Skills 加载：SKILL.md frontmatter 解析 + 文件系统扫描（对应 gogo/dodo 的 Skills）。

一个 skill = 一个目录，含 SKILL.md（YAML frontmatter + 正文）。frontmatter
至少有 name/description。FS 为权威源，DB 注册表记录启停状态（见 registry）。
含防路径穿越校验。纯逻辑（读文件），可离线测试。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)


class SkillFormatError(Exception):
    pass


@dataclass
class SkillManifest:
    name: str
    description: str
    dir: str
    body: str = ""
    metadata: dict = field(default_factory=dict)


def parse_skill_md(text: str, *, skill_dir: str = "") -> SkillManifest:
    """解析 SKILL.md：YAML frontmatter + 正文。name/description 必填。"""
    m = _FRONTMATTER_RE.match(text.strip())
    if not m:
        raise SkillFormatError("SKILL.md 缺少 YAML frontmatter（--- 包裹）")
    meta = yaml.safe_load(m.group(1)) or {}
    body = m.group(2).strip()
    if "name" not in meta or "description" not in meta:
        raise SkillFormatError("frontmatter 必须含 name 和 description")
    return SkillManifest(
        name=str(meta["name"]),
        description=str(meta["description"]),
        dir=skill_dir,
        body=body,
        metadata={k: v for k, v in meta.items() if k not in {"name", "description"}},
    )


def load_skill_dir(skill_dir: Path) -> SkillManifest:
    md = skill_dir / "SKILL.md"
    if not md.is_file():
        raise SkillFormatError(f"{skill_dir} 下无 SKILL.md")
    return parse_skill_md(md.read_text(encoding="utf-8"), skill_dir=str(skill_dir))


def scan_skills(root: str | Path) -> list[SkillManifest]:
    """扫描 root 下每个子目录的 SKILL.md。忽略无 SKILL.md 的目录。"""
    root_path = Path(root)
    if not root_path.is_dir():
        return []
    manifests: list[SkillManifest] = []
    for child in sorted(root_path.iterdir()):
        if child.is_dir() and (child / "SKILL.md").is_file():
            manifests.append(load_skill_dir(child))
    return manifests


def safe_join(root: str | Path, relative: str) -> Path:
    """防路径穿越：确保 relative 解析后仍在 root 内。"""
    root_path = Path(root).resolve()
    target = (root_path / relative).resolve()
    if root_path != target and root_path not in target.parents:
        raise SkillFormatError(f"非法路径（越出 skills 根目录）: {relative}")
    return target
