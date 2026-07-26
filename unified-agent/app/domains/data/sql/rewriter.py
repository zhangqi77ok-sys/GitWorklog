"""数据权限 SQL 改写（sqlglot AST，替代 dodo 的 DataScopeRewriter）。

按表注入行级过滤条件：
  - FROM 表 / INNER JOIN 表 → 注入到 WHERE（AND 组合）
  - LEFT/RIGHT JOIN 表 → 注入到该 JOIN 的 ON（保留外连接语义）
过滤依据 DataScopeResult：
  - ALL：不改写
  - DEPT / DEPT_AND_SUB：table.dept_col IN (visible_dept_ids)；空列表 → 恒假(1=0)
  - SELF：table.user_col = user_id

PermissionRule 描述某张表用哪列承载范围。未登记的表不改写。
"""

from __future__ import annotations

from dataclasses import dataclass

import sqlglot
from sqlglot import exp

from app.platform.auth.datascope import DataScope, DataScopeResult


@dataclass
class PermissionRule:
    """某张表的数据权限列。"""

    table: str
    dept_col: str | None = None  # 承载部门范围的列
    user_col: str | None = None  # 承载本人范围的列


class DataScopeRewriter:
    def __init__(self, rules: dict[str, PermissionRule], dialect: str = "mysql") -> None:
        # key 用小写表名
        self.rules = {k.lower(): v for k, v in rules.items()}
        self.dialect = dialect

    def rewrite(self, sql: str, scope: DataScopeResult) -> str:
        if scope.is_all:
            return sql
        root = sqlglot.parse_one(sql, dialect=self.dialect)
        select = root if isinstance(root, exp.Select) else root.find(exp.Select)
        if select is None:
            return sql

        where_predicates: list[exp.Expression] = []

        # FROM 表
        from_node = select.find(exp.From)
        if from_node is not None:
            for tbl in from_node.find_all(exp.Table):
                pred = self._predicate_for(tbl, scope)
                if pred is not None:
                    where_predicates.append(pred)

        # JOIN 表
        for join in select.args.get("joins", []) or []:
            tbl = join.this if isinstance(join.this, exp.Table) else join.find(exp.Table)
            if tbl is None:
                continue
            pred = self._predicate_for(tbl, scope)
            if pred is None:
                continue
            if _is_outer_join(join):
                _append_to_on(join, pred)
            else:
                where_predicates.append(pred)

        for pred in where_predicates:
            select = select.where(pred)

        return select.sql(dialect=self.dialect)

    def _predicate_for(self, tbl: exp.Table, scope: DataScopeResult) -> exp.Expression | None:
        rule = self.rules.get((tbl.name or "").lower())
        if rule is None:
            return None
        alias = tbl.alias_or_name  # 有别名用别名，否则用表名做限定

        if scope.scope == DataScope.SELF:
            if not rule.user_col:
                return _false_condition()
            col = exp.column(rule.user_col, table=alias)
            return exp.EQ(this=col, expression=exp.Literal.number(scope.user_id))

        # DEPT / DEPT_AND_SUB
        if not rule.dept_col:
            return None  # 该表无部门列，不限制
        dept_ids = scope.visible_dept_ids
        if dept_ids is None:
            return None
        if not dept_ids:
            return _false_condition()  # 无可见部门，恒假
        col = exp.column(rule.dept_col, table=alias)
        values = [exp.Literal.number(d) for d in dept_ids]
        return exp.In(this=col, expressions=values)


def _is_outer_join(join: exp.Join) -> bool:
    side = (join.args.get("side") or "").upper()
    return side in {"LEFT", "RIGHT", "FULL"}


def _append_to_on(join: exp.Join, pred: exp.Expression) -> None:
    on = join.args.get("on")
    join.set("on", exp.and_(on, pred) if on is not None else pred)


def _false_condition() -> exp.Expression:
    return exp.EQ(this=exp.Literal.number(1), expression=exp.Literal.number(0))
