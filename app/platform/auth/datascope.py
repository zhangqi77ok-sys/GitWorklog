"""数据范围 DataScope（对应 dodo 的 4 级数据权限）。

用于 data 域的 SQL 权限改写：按用户角色算出「可见部门 id 列表」，
再由 DataScopeRewriter 注入 SQL。解析失败 fail-closed 到 SELF。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class DataScope(IntEnum):
    """数据范围，值越大范围越广。多角色取最大。"""

    SELF = 1  # 仅本人
    DEPT = 2  # 本部门
    DEPT_AND_SUB = 3  # 本部门及子部门
    ALL = 4  # 全部

    @classmethod
    def max_of(cls, scopes: list[DataScope]) -> DataScope:
        """多角色取最大范围；空则 fail-closed 到 SELF。"""
        return max(scopes) if scopes else cls.SELF


@dataclass
class DataScopeResult:
    """解析结果：范围 + 可见部门 id + 本人 id。

    visible_dept_ids 为 None 表示「全部」（ALL，不加部门过滤）。
    空列表表示「无可见部门」（fail-closed，改写为恒假条件）。
    """

    scope: DataScope
    user_id: int
    visible_dept_ids: list[int] | None = field(default=None)

    @property
    def is_all(self) -> bool:
        return self.scope == DataScope.ALL

    @property
    def is_self_only(self) -> bool:
        return self.scope == DataScope.SELF


def resolve_visible_depts(
    scope: DataScope,
    user_dept_ids: list[int],
    dept_subtree: dict[int, list[int]],
) -> list[int] | None:
    """按范围算可见部门 id。

    - ALL: 返回 None（不过滤）
    - DEPT: 用户直属部门
    - DEPT_AND_SUB: 直属部门 + 各自子树
    - SELF: 空列表（不按部门，按本人过滤）
    dept_subtree: {dept_id: [该部门及所有子孙 id]}
    """
    if scope == DataScope.ALL:
        return None
    if scope == DataScope.SELF:
        return []
    if scope == DataScope.DEPT:
        return sorted(set(user_dept_ids))
    # DEPT_AND_SUB
    result: set[int] = set()
    for d in user_dept_ids:
        result.update(dept_subtree.get(d, [d]))
    return sorted(result)
