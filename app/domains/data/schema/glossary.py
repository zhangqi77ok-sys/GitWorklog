"""业务术语表（替代 dodo 的 lookupGlossary）。

术语口径必须唯一，故用**精确匹配**（非向量检索）。术语名全量拼进工具描述
让 LLM 直接可见（见 tools 层）。术语来自 YAML 配置。
"""

from __future__ import annotations

from dataclasses import dataclass

import yaml


@dataclass
class GlossaryTerm:
    name: str
    definition: str
    sql_snippet: str = ""
    synonyms: list[str] | None = None


class Glossary:
    def __init__(self, terms: list[GlossaryTerm]) -> None:
        self._by_key: dict[str, GlossaryTerm] = {}
        for t in terms:
            self._by_key[t.name.lower()] = t
            for syn in t.synonyms or []:
                self._by_key[syn.lower()] = t

    @classmethod
    def from_yaml(cls, path: str) -> Glossary:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        terms = [
            GlossaryTerm(
                name=item["name"],
                definition=item["definition"],
                sql_snippet=item.get("sql_snippet", ""),
                synonyms=item.get("synonyms"),
            )
            for item in data.get("glossary", [])
        ]
        return cls(terms)

    def lookup(self, term: str) -> GlossaryTerm | None:
        return self._by_key.get(term.strip().lower())

    def term_names(self) -> list[str]:
        """去重后的标准术语名，供拼入工具描述。"""
        seen: dict[str, None] = {}
        for t in self._by_key.values():
            seen[t.name] = None
        return list(seen.keys())
