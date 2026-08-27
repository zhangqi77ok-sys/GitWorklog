"""脱敏、计算、术语表、M-Schema 测试。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.domains.data.schema.glossary import Glossary, GlossaryTerm
from app.domains.data.schema.mschema import (
    ColumnMeta,
    MschemaFormatter,
    TableMeta,
    YamlSchemaProvider,
)
from app.domains.data.sql.sensitive import MASK, SensitiveFilter
from app.domains.data.tools.calculate import CalculateError, calculate


# ---------- 脱敏 ----------
def test_sensitive_masks_password_column() -> None:
    f = SensitiveFilter()
    rows = [{"id": 1, "password": "secret"}, {"id": 2, "password": "x"}]
    out = f.mask_rows(["id", "password"], rows)
    assert out[0]["password"] == MASK
    assert out[0]["id"] == 1


def test_sensitive_non_hit_unchanged() -> None:
    f = SensitiveFilter()
    rows = [{"id": 1, "name": "alice"}]
    assert f.mask_rows(["id", "name"], rows) == rows


def test_sensitive_table_qualified() -> None:
    f = SensitiveFilter()
    assert f.is_sensitive("id_card", table="user_profile")


# ---------- 计算 ----------
def test_calculate_basic() -> None:
    assert calculate("1 + 2 * 3") == 7.0
    assert calculate("(10 - 4) / 2") == 3.0


def test_calculate_growth_rate() -> None:
    # 同比增长率
    assert calculate("round((120 - 100) / 100 * 100, 2)") == 20.0


def test_calculate_functions() -> None:
    assert calculate("max(1, 2, 3)") == 3.0
    assert calculate("sqrt(9)") == 3.0


def test_calculate_rejects_code() -> None:
    with pytest.raises(CalculateError):
        calculate("__import__('os').system('ls')")


def test_calculate_rejects_names() -> None:
    with pytest.raises(CalculateError):
        calculate("x + 1")


# ---------- 术语表 ----------
def test_glossary_exact_and_synonym() -> None:
    g = Glossary(
        [
            GlossaryTerm(
                name="活跃客户",
                definition="近30天有下单的客户",
                sql_snippet="last_order_date >= NOW() - INTERVAL 30 DAY",
                synonyms=["活跃用户"],
            )
        ]
    )
    assert g.lookup("活跃客户") is not None
    assert g.lookup("活跃用户").name == "活跃客户"
    assert g.lookup("不存在") is None
    assert g.term_names() == ["活跃客户"]


# ---------- M-Schema ----------
def test_mschema_format_table() -> None:
    t = TableMeta(
        name="users",
        comment="用户表",
        columns=[
            ColumnMeta(name="id", type="int", primary_key=True, nullable=False),
            ColumnMeta(name="name", type="varchar", comment="姓名", examples=["张三"]),
        ],
        foreign_keys=["dept_id -> dept.id"],
    )
    out = MschemaFormatter.format_table(t)
    assert "users" in out and "用户表" in out
    assert "PK" in out and "示例" in out
    assert "FK: dept_id -> dept.id" in out


def test_yaml_schema_provider_roundtrip() -> None:
    path = Path(__file__).parent.parent / "fixtures" / "schema_sample.yml"
    prov = YamlSchemaProvider.from_yaml(str(path))
    assert len(prov.list_tables()) == 1
    assert prov.describe_table("users").comment == "用户"
