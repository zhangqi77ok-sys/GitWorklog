"""M-Schema 感知（替代 dodo 的 Mschema 体系）。

数据结构 + 格式化器 + provider 抽象：
  - SchemaProvider 接口：list_tables / describe_table
  - YamlSchemaProvider：从静态 YAML 字典读（无需连库，可测）
  - MschemaProvider（需 live DB）：实时自省，本轮只留接口占位
MschemaFormatter：输出 M-Schema 括号元组格式，供 LLM 阅读。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import yaml


@dataclass
class ColumnMeta:
    name: str
    type: str
    comment: str = ""
    nullable: bool = True
    primary_key: bool = False
    examples: list[str] = field(default_factory=list)


@dataclass
class TableMeta:
    name: str
    comment: str = ""
    columns: list[ColumnMeta] = field(default_factory=list)
    foreign_keys: list[str] = field(default_factory=list)  # "col -> other_table.col"


class SchemaProvider(Protocol):
    def list_tables(self) -> list[TableMeta]: ...
    def describe_table(self, name: str) -> TableMeta | None: ...


class YamlSchemaProvider:
    """从 YAML 静态字典读 Schema（可离线测试）。"""

    def __init__(self, tables: list[TableMeta]) -> None:
        self._tables = {t.name.lower(): t for t in tables}

    @classmethod
    def from_yaml(cls, path: str) -> YamlSchemaProvider:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        tables = []
        for t in data.get("tables", []):
            cols = [
                ColumnMeta(
                    name=c["name"],
                    type=c["type"],
                    comment=c.get("comment", ""),
                    nullable=c.get("nullable", True),
                    primary_key=c.get("primary_key", False),
                    examples=[str(x) for x in c.get("examples", [])],
                )
                for c in t.get("columns", [])
            ]
            tables.append(
                TableMeta(
                    name=t["name"],
                    comment=t.get("comment", ""),
                    columns=cols,
                    foreign_keys=t.get("foreign_keys", []),
                )
            )
        return cls(tables)

    def list_tables(self) -> list[TableMeta]:
        return list(self._tables.values())

    def describe_table(self, name: str) -> TableMeta | None:
        return self._tables.get(name.lower())


class MschemaFormatter:
    """输出 M-Schema 括号元组格式。"""

    @staticmethod
    def format_table(t: TableMeta) -> str:
        lines = [f"# Table: {t.name}" + (f"  -- {t.comment}" if t.comment else "")]
        for c in t.columns:
            flags = []
            if c.primary_key:
                flags.append("PK")
            if not c.nullable:
                flags.append("NOT NULL")
            flag_s = f" [{','.join(flags)}]" if flags else ""
            ex = f" 示例: {', '.join(c.examples[:3])}" if c.examples else ""
            cm = f" -- {c.comment}" if c.comment else ""
            lines.append(f"  ({c.name}: {c.type}{flag_s}){cm}{ex}")
        for fk in t.foreign_keys:
            lines.append(f"  FK: {fk}")
        return "\n".join(lines)

    @staticmethod
    def format_table_list(tables: list[TableMeta]) -> str:
        return "\n".join(f"- {t.name}" + (f": {t.comment}" if t.comment else "") for t in tables)
