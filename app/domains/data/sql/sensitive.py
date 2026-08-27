"""敏感字段脱敏（替代 dodo 的 SensitiveFilter）。

按「表.列」或「列名」匹配，命中列整列替换为掩码。作用于查询结果集，
在 executeSql 执行后、返回前调用。列匹配大小写不敏感。
"""

from __future__ import annotations

from dataclasses import dataclass, field

MASK = "********"

# 默认脱敏列（表.列 或 裸列名）
DEFAULT_SENSITIVE = {
    "sys_user.password",
    "user_profile.id_card",
    "password",
    "id_card",
}


@dataclass
class SensitiveFilter:
    sensitive_cols: set[str] = field(default_factory=lambda: set(DEFAULT_SENSITIVE))

    def is_sensitive(self, column: str, table: str | None = None) -> bool:
        col = column.lower()
        if col in self.sensitive_cols:
            return True
        return bool(table and f"{table.lower()}.{col}" in self.sensitive_cols)

    def mask_rows(
        self, columns: list[str], rows: list[dict[str, object]], table: str | None = None
    ) -> list[dict[str, object]]:
        """对命中的列整列掩码。rows 为 [{col: value}]。"""
        hit = {c for c in columns if self.is_sensitive(c, table)}
        if not hit:
            return rows
        return [
            {k: (MASK if k in hit and v is not None else v) for k, v in row.items()} for row in rows
        ]
