"""SQL 安全护栏（sqlglot AST，替代 dodo 的 jsqlparser 实现）。

铁律（见 CODING_STANDARDS §8）：用户可触达的查询只读。
校验项：
  1. 可解析、单语句
  2. 顶层只允许 SELECT / WITH(...SELECT)
  3. 拦危险函数（sleep/benchmark/load_file/... ）
  4. 拦写文件/锁（INTO OUTFILE/DUMPFILE、FOR UPDATE）
  5. 拦 JOIN 数超阈值
  6. 强制注入 / 下调 LIMIT

validateSql 与 executeSql 共享本护栏（双保险）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import sqlglot
from sqlglot import exp

DEFAULT_MAX_LIMIT = 200
DEFAULT_MAX_JOINS = 3

# 危险函数（小写）
_DANGEROUS_FUNCS = {
    "sleep",
    "benchmark",
    "load_file",
    "get_lock",
    "release_lock",
    "sys_exec",
    "sys_eval",
    "master_pos_wait",
    "pg_sleep",
}


class SqlSafetyError(Exception):
    """SQL 未通过安全校验。"""


@dataclass
class GuardConfig:
    max_limit: int = DEFAULT_MAX_LIMIT
    max_joins: int = DEFAULT_MAX_JOINS
    dialect: str = "mysql"


class SqlSafetyGuard:
    def __init__(self, config: GuardConfig | None = None) -> None:
        self.cfg = config or GuardConfig()

    def check_and_fix(self, sql: str) -> str:
        """校验并返回可安全执行的 SQL（已强制 LIMIT）。不通过则抛 SqlSafetyError。"""
        statements = self._parse(sql)
        if len(statements) != 1:
            raise SqlSafetyError("只允许单条语句")
        root = statements[0]
        self._check_readonly(root)
        self._check_dangerous_functions(root)
        self._check_locks_and_outfile(root, sql)
        self._check_joins(root)
        fixed = self._enforce_limit(root)
        return fixed.sql(dialect=self.cfg.dialect)

    # ---------- 内部 ----------
    def _parse(self, sql: str) -> list[exp.Expression]:
        try:
            parsed = sqlglot.parse(sql, dialect=self.cfg.dialect)
        except Exception as e:
            raise SqlSafetyError(f"SQL 无法解析: {e}") from e
        stmts = [s for s in parsed if s is not None]
        if not stmts:
            raise SqlSafetyError("空 SQL")
        return cast("list[exp.Expression]", stmts)

    def _check_readonly(self, root: exp.Expression) -> None:
        # 顶层必须是 SELECT 或 WITH（CTE 包裹 SELECT）
        if isinstance(root, exp.Select):
            return
        if isinstance(root, exp.With) or (
            isinstance(root, exp.Subquery) and isinstance(root.this, exp.Select)
        ):
            return
        # WITH 在 sqlglot 中通常挂在 Select.args['with']；若根是别的 DML/DDL 直接拒
        if root.find(exp.Select) is not None and not _has_write_node(root):
            return
        raise SqlSafetyError(f"仅允许只读查询（SELECT/WITH），拒绝: {type(root).__name__}")

    def _check_dangerous_functions(self, root: exp.Expression) -> None:
        for anon in root.find_all(exp.Anonymous):
            name = (anon.name or "").lower()
            if name in _DANGEROUS_FUNCS:
                raise SqlSafetyError(f"禁止使用危险函数: {name}")
        for func in root.find_all(exp.Func):
            fname = (func.sql_name() or "").lower() if hasattr(func, "sql_name") else ""
            if fname in _DANGEROUS_FUNCS:
                raise SqlSafetyError(f"禁止使用危险函数: {fname}")

    def _check_locks_and_outfile(self, root: exp.Expression, raw: str) -> None:
        if root.find(exp.Lock) is not None:
            raise SqlSafetyError("禁止 FOR UPDATE / 锁")
        lowered = raw.lower()
        if "into outfile" in lowered or "into dumpfile" in lowered:
            raise SqlSafetyError("禁止写文件 (INTO OUTFILE/DUMPFILE)")

    def _check_joins(self, root: exp.Expression) -> None:
        joins = list(root.find_all(exp.Join))
        if len(joins) > self.cfg.max_joins:
            raise SqlSafetyError(f"JOIN 数 {len(joins)} 超过上限 {self.cfg.max_joins}")

    def _enforce_limit(self, root: exp.Expression) -> exp.Expression:
        """对最外层 SELECT 强制 LIMIT：无则加，超上限则下调。"""
        select = root if isinstance(root, exp.Select) else root.find(exp.Select)
        if select is None:
            return root
        limit = select.args.get("limit")
        if limit is None:
            return select.limit(self.cfg.max_limit)
        try:
            current = int(limit.expression.name)
        except (AttributeError, ValueError):
            return select.limit(self.cfg.max_limit)
        if current > self.cfg.max_limit:
            return select.limit(self.cfg.max_limit)
        return root


def _has_write_node(root: exp.Expression) -> bool:
    write_types = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Create,
        exp.Alter,
        exp.TruncateTable,
        exp.Command,
    )
    return any(root.find(t) is not None for t in write_types)
