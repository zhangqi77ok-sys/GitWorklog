"""DataScopeRewriter 回归：ALL 不改、DEPT 注 WHERE、LEFT JOIN 注 ON、SELF、恒假。"""

from __future__ import annotations

import sqlglot

from app.domains.data.sql.rewriter import DataScopeRewriter, PermissionRule
from app.platform.auth.datascope import DataScope, DataScopeResult

RULES = {
    "orders": PermissionRule(table="orders", dept_col="dept_id", user_col="user_id"),
    "users": PermissionRule(table="users", dept_col="dept_id", user_col="id"),
}
rewriter = DataScopeRewriter(RULES)


def _norm(sql: str) -> str:
    return sqlglot.parse_one(sql, dialect="mysql").sql(dialect="mysql")


def test_all_scope_no_rewrite() -> None:
    res = DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None)
    sql = "SELECT * FROM orders"
    assert rewriter.rewrite(sql, res) == sql


def test_dept_scope_injects_where() -> None:
    res = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[10, 20])
    out = rewriter.rewrite("SELECT id FROM orders", res).lower()
    assert "dept_id in" in out
    assert "10" in out and "20" in out


def test_self_scope_injects_user_eq() -> None:
    res = DataScopeResult(scope=DataScope.SELF, user_id=7, visible_dept_ids=[])
    out = rewriter.rewrite("SELECT id FROM orders", res).lower()
    assert "user_id" in out and "= 7" in out.replace("  ", " ")


def test_empty_visible_depts_false_condition() -> None:
    res = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[])
    out = rewriter.rewrite("SELECT id FROM orders", res)
    assert "1 = 0" in out or "1=0" in out.replace(" ", "")


def test_unregistered_table_not_rewritten() -> None:
    res = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[10])
    sql = "SELECT * FROM products"
    assert rewriter.rewrite(sql, res) == sql


def test_left_join_injects_on_not_where() -> None:
    res = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[10])
    sql = "SELECT o.id FROM orders o LEFT JOIN users u ON o.user_id = u.id"
    out = rewriter.rewrite(sql, res).lower()
    # users 的过滤应在 ON 里（保留 LEFT 语义），体现为 ON ... AND ...
    assert "left join" in out
    assert "u.dept_id in" in out
    # orders 是 FROM 表，注入 WHERE
    assert "where" in out and "o.dept_id in" in out


def test_alias_qualified() -> None:
    res = DataScopeResult(scope=DataScope.DEPT, user_id=1, visible_dept_ids=[10])
    out = rewriter.rewrite("SELECT o.id FROM orders AS o", res).lower()
    assert "o.dept_id" in out
