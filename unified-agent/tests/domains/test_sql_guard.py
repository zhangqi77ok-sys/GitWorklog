"""SqlSafetyGuard 回归：正常放行 + 各类攻击/危险 SQL 拦截 + 强制 LIMIT。"""

from __future__ import annotations

import pytest

from app.domains.data.sql.guard import GuardConfig, SqlSafetyError, SqlSafetyGuard

guard = SqlSafetyGuard()


# ---------- 正常查询放行 ----------
def test_simple_select_passes() -> None:
    out = guard.check_and_fix("SELECT id, name FROM users WHERE id = 1")
    assert "LIMIT 200" in out.upper()


def test_select_with_existing_small_limit_kept() -> None:
    out = guard.check_and_fix("SELECT * FROM users LIMIT 10")
    assert "LIMIT 10" in out.upper()


def test_cte_with_select_passes() -> None:
    out = guard.check_and_fix("WITH t AS (SELECT id FROM users) SELECT * FROM t")
    assert "LIMIT" in out.upper()


def test_join_within_limit_passes() -> None:
    sql = "SELECT a.id FROM a JOIN b ON a.id=b.id JOIN c ON b.id=c.id"
    out = guard.check_and_fix(sql)
    assert "LIMIT" in out.upper()


# ---------- 强制 LIMIT ----------
def test_limit_downgraded_when_too_large() -> None:
    out = guard.check_and_fix("SELECT * FROM users LIMIT 100000")
    assert "LIMIT 200" in out.upper()
    assert "100000" not in out


# ---------- 写操作拦截 ----------
@pytest.mark.parametrize(
    "sql",
    [
        "UPDATE users SET name='x' WHERE id=1",
        "DELETE FROM users WHERE id=1",
        "INSERT INTO users(name) VALUES('x')",
        "DROP TABLE users",
        "TRUNCATE TABLE users",
        "CREATE TABLE t(id int)",
    ],
)
def test_write_statements_rejected(sql: str) -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix(sql)


# ---------- 多语句 / 注入 ----------
def test_multiple_statements_rejected() -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix("SELECT 1; DROP TABLE users")


def test_stacked_injection_rejected() -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix("SELECT * FROM users WHERE id=1; DELETE FROM users")


# ---------- 危险函数 ----------
@pytest.mark.parametrize(
    "sql",
    [
        "SELECT sleep(5)",
        "SELECT benchmark(1000000, md5('x'))",
        "SELECT load_file('/etc/passwd')",
        "SELECT get_lock('x', 10)",
    ],
)
def test_dangerous_functions_rejected(sql: str) -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix(sql)


# ---------- 写文件 / 锁 ----------
def test_into_outfile_rejected() -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix("SELECT * FROM users INTO OUTFILE '/tmp/x'")


def test_for_update_rejected() -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix("SELECT * FROM users WHERE id=1 FOR UPDATE")


# ---------- JOIN 超限 ----------
def test_too_many_joins_rejected() -> None:
    g = SqlSafetyGuard(GuardConfig(max_joins=2))
    sql = "SELECT * FROM a JOIN b ON a.id=b.id JOIN c ON b.id=c.id JOIN d ON c.id=d.id"
    with pytest.raises(SqlSafetyError):
        g.check_and_fix(sql)


# ---------- 无法解析 ----------
def test_garbage_rejected() -> None:
    with pytest.raises(SqlSafetyError):
        guard.check_and_fix("this is not sql !!!")
