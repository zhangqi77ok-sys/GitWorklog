"""意图种子语料加载（O-4）：从 intent-seed.yml 读规则与向量种子。

规则外置的意义：调意图覆盖是最频繁的运维动作（漏判会让请求根本到不了领域
Agent），不该每次都改代码发版。默认读包内的 intent-seed.yml，
可用 INTENT_SEED_PATH 环境变量指向自定义文件。

加载失败一律回退到包内默认文件并记 error 日志——意图识别是主链路，
不能因为运维改坏一个 YAML 就整体不可用。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from app.core.logging import get_logger
from app.orchestrator.intent.matchers import RuleEntry, RuleMatcher, SeedExample
from app.orchestrator.intent.models import IntentCategory

logger = get_logger(__name__)

DEFAULT_SEED_PATH = Path(__file__).with_name("intent-seed.yml")
ENV_KEY = "INTENT_SEED_PATH"


def seed_path() -> Path:
    """当前生效的种子文件路径（环境变量优先）。"""
    override = os.getenv(ENV_KEY)
    return Path(override) if override else DEFAULT_SEED_PATH


def _read(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"种子文件格式错误（顶层应为映射）：{path}")
    return data


def load_raw(path: Path | None = None) -> dict[str, Any]:
    """读种子文件；失败回退到包内默认，再失败则返回空表。"""
    target = path or seed_path()
    try:
        return _read(target)
    except Exception as exc:
        logger.error("intent_seed_load_failed", path=str(target), error=str(exc))
        if target != DEFAULT_SEED_PATH:
            try:
                return _read(DEFAULT_SEED_PATH)
            except Exception as exc2:
                logger.error("intent_seed_default_failed", error=str(exc2))
        return {}


def _category(name: str) -> IntentCategory | None:
    try:
        return IntentCategory(name)
    except ValueError:
        logger.error("intent_seed_unknown_category", category=name)
        return None


def load_rules(path: Path | None = None) -> list[RuleEntry]:
    """把 YAML 的 rules 段转成 RuleEntry 列表。未知类别跳过并记日志。"""
    raw = load_raw(path)
    entries: list[RuleEntry] = []
    for item in raw.get("rules", []) or []:
        cat = _category(str(item.get("category", "")))
        if cat is None:
            continue
        entries.append(
            RuleEntry(
                category=cat,
                keywords=[str(k) for k in (item.get("keywords") or [])],
                patterns=[str(p) for p in (item.get("patterns") or [])],
            )
        )
    return entries


def load_seed_examples(path: Path | None = None) -> list[SeedExample]:
    """把 YAML 的 seeds 段转成 L2 向量种子（向量留空，由 VectorMatcher 懒算）。"""
    raw = load_raw(path)
    out: list[SeedExample] = []
    for name, texts in (raw.get("seeds") or {}).items():
        cat = _category(str(name))
        if cat is None:
            continue
        out.extend(SeedExample(category=cat, text=str(t)) for t in (texts or []))
    return out


def build_rule_matcher(path: Path | None = None) -> RuleMatcher:
    return RuleMatcher(load_rules(path))
