"""M-Schema 感知（替代 dodo 的 Mschema 体系）。

数据结构 + 格式化器 + provider 抽象：
  - SchemaProvider 接口：list_tables / describe_table
  - YamlSchemaProvider：从静态 YAML 字典读（无需连库，可测）
  - MschemaProvider（需 live DB）：实时自省，本轮只留接口占位
MschemaFormatter：输出 M-Schema 括号元组格式，供 LLM 阅读。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

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


class DatabaseSchemaProvider:
    """基于 SQLAlchemy inspect 实时自省数据库 Schema（D-1）。"""

    def __init__(
        self,
        engine: Any,
        exclude_tables: set[str] | None = None,
        sample_rows: int = 3,
    ) -> None:
        self.engine = engine
        self.exclude_tables = {t.lower() for t in (exclude_tables or {"alembic_version"})}
        self.sample_rows = sample_rows

    def list_tables(self) -> list[TableMeta]:
        try:
            from sqlalchemy import inspect

            inspector = inspect(self.engine)
            table_names = inspector.get_table_names()
            results: list[TableMeta] = []

            for name in table_names:
                if name.lower() in self.exclude_tables or name.startswith("sqlite_"):
                    continue
                comment = ""
                try:
                    c_info = inspector.get_table_comment(name)
                    comment = c_info.get("text") or ""
                except Exception:
                    pass
                results.append(TableMeta(name=name, comment=comment))
            return results
        except Exception:
            return []

    def describe_table(self, name: str) -> TableMeta | None:
        try:
            from sqlalchemy import inspect, text

            inspector = inspect(self.engine)
            table_names = {t.lower(): t for t in inspector.get_table_names()}
            real_name = table_names.get(name.lower())
            if not real_name:
                return None

            # 表注释
            table_comment = ""
            try:
                c_info = inspector.get_table_comment(real_name)
                table_comment = c_info.get("text") or ""
            except Exception:
                pass

            # 主键列名
            pk_cols = set()
            try:
                pk_info = inspector.get_pk_constraint(real_name)
                pk_cols = set(pk_info.get("constrained_columns") or [])
            except Exception:
                pass

            # 列信息
            raw_cols = inspector.get_columns(real_name)
            columns: list[ColumnMeta] = []
            for col in raw_cols:
                c_name = col["name"]
                c_type = str(col["type"])
                c_comment = col.get("comment") or ""
                c_nullable = bool(col.get("nullable", True))
                c_pk = c_name in pk_cols

                # 获取样本示例值
                examples: list[str] = []
                if self.sample_rows > 0:
                    try:
                        with self.engine.connect() as conn:
                            query = text(
                                f'SELECT DISTINCT "{c_name}" FROM "{real_name}" '
                                f'WHERE "{c_name}" IS NOT NULL LIMIT {self.sample_rows}'
                            )
                            rows = conn.execute(query).fetchall()
                            examples = [str(r[0]) for r in rows if r[0] is not None]
                    except Exception:
                        examples = []

                columns.append(
                    ColumnMeta(
                        name=c_name,
                        type=c_type,
                        comment=c_comment,
                        nullable=c_nullable,
                        primary_key=c_pk,
                        examples=examples,
                    )
                )

            # 外键
            fks: list[str] = []
            try:
                for fk in inspector.get_foreign_keys(real_name):
                    c_cols = fk.get("constrained_columns") or []
                    ref_tbl = fk.get("referred_table")
                    ref_cols = fk.get("referred_columns") or []
                    for c_col, r_col in zip(c_cols, ref_cols, strict=False):
                        fks.append(f"{c_col} -> {ref_tbl}.{r_col}")
            except Exception:
                pass

            return TableMeta(
                name=real_name,
                comment=table_comment,
                columns=columns,
                foreign_keys=fks,
            )
        except Exception:
            return None


class CachedSchemaProvider:
    """支持 TTL 与手动刷新的 SchemaProvider 缓存装饰器（D-3）。"""

    def __init__(self, inner: SchemaProvider, ttl_seconds: float = 300.0) -> None:

        self._inner = inner
        self._ttl = ttl_seconds
        self._tables_cache: list[TableMeta] | None = None
        self._tables_time: float = 0.0
        self._describe_cache: dict[str, tuple[TableMeta | None, float]] = {}

    def refresh(self) -> None:
        """清空全部缓存。"""
        self._tables_cache = None
        self._tables_time = 0.0
        self._describe_cache.clear()

    def list_tables(self) -> list[TableMeta]:
        import time

        now = time.time()
        if self._tables_cache is not None and (now - self._tables_time) < self._ttl:
            return self._tables_cache

        tables = self._inner.list_tables()
        self._tables_cache = tables
        self._tables_time = now
        return tables

    def describe_table(self, name: str) -> TableMeta | None:
        import time

        now = time.time()
        key = name.lower()
        if key in self._describe_cache:
            meta, ts = self._describe_cache[key]
            if (now - ts) < self._ttl:
                return meta

        meta = self._inner.describe_table(name)
        self._describe_cache[key] = (meta, now)
        return meta


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
