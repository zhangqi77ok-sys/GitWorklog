"""D-8 EXPLAIN 预检：执行前拦掉会拖垮库的查询。

在数据权限改写之后、真正执行之前跑一次 EXPLAIN，读执行计划判断：
  - 全表扫描（type=ALL）且预估行数超阈值 → 拒绝
  - 预估扫描总行数超阈值 → 拒绝
  - 未用到任何索引（key 为空）且行数超阈值 → 拒绝

**fail-open 是刻意的**：EXPLAIN 本身失败（方言不支持、权限不足、SQL 特殊）
不应该阻断正常查询——预检是护栏不是闸门。但真正判定为危险时是 fail-closed，
明确抛错让 Agent 拿到理由去改写 SQL（同 SqlSafetyError 的回灌约定）。

ExplainRunner 抽象成协议：live 由 MySQL 只读连接实现，测试用 fake，纯离线可测。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger
from app.domains.data.sql.guard import SqlSafetyError

logger = get_logger(__name__)


class ExplainRunner(Protocol):
    """执行 EXPLAIN 并返回执行计划行（每行一个 dict，键同 MySQL EXPLAIN 列名）。"""

    def explain(self, sql: str) -> list[dict[str, Any]]: ...


@dataclass
class ExplainPolicy:
    max_scanned_rows: int = 1_000_000  # 预估扫描总行数上限
    full_scan_row_limit: int = 100_000  # 全表扫描允许的最大预估行数
    no_index_row_limit: int = 100_000  # 未命中索引允许的最大预估行数


def _rows_of(row: dict[str, Any]) -> int:
    """取预估行数。MySQL 列名为 rows，缺失或非数字按 0 处理。"""
    raw = row.get("rows", row.get("ROWS", 0))
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def _access_type(row: dict[str, Any]) -> str:
    return str(row.get("type", row.get("TYPE", "")) or "").lower()


def _key_used(row: dict[str, Any]) -> str:
    return str(row.get("key", row.get("KEY", "")) or "")


@dataclass
class ExplainPrecheckService:
    """跑 EXPLAIN 并按策略判定是否放行。"""

    runner: ExplainRunner
    policy: ExplainPolicy = field(default_factory=ExplainPolicy)

    def check(self, sql: str) -> None:
        """危险则抛 SqlSafetyError；EXPLAIN 自身失败则放行（fail-open）。"""
        try:
            plan = self.runner.explain(sql)
        except Exception as exc:  # 宽捕获是刻意的：预检不可用不该阻断正常查询
            logger.warning("explain_precheck_unavailable", error=str(exc))
            return

        if not plan:
            return

        total = sum(_rows_of(r) for r in plan)
        if total > self.policy.max_scanned_rows:
            raise SqlSafetyError(
                f"预估扫描 {total} 行，超过上限 {self.policy.max_scanned_rows}；"
                "请加 WHERE 过滤或缩小时间范围后重试。"
            )

        for r in plan:
            rows = _rows_of(r)
            table = r.get("table", r.get("TABLE", "?"))
            if _access_type(r) == "all" and rows > self.policy.full_scan_row_limit:
                raise SqlSafetyError(
                    f"表 {table} 触发全表扫描且预估 {rows} 行，"
                    f"超过上限 {self.policy.full_scan_row_limit}；请补充可走索引的过滤条件。"
                )
            if not _key_used(r) and rows > self.policy.no_index_row_limit:
                raise SqlSafetyError(
                    f"表 {table} 未命中索引且预估 {rows} 行，"
                    f"超过上限 {self.policy.no_index_row_limit}；请改用带索引的过滤字段。"
                )

        logger.info("explain_precheck_passed", estimated_rows=total)


class MySQLExplainRunner:
    """live 实现：在只读连接上跑 EXPLAIN。构造注入 engine 便于测试。"""

    def __init__(self, engine: Any = None) -> None:
        self._engine = engine

    def _get_engine(self) -> Any:
        if self._engine is None:
            from sqlalchemy import create_engine

            from app.core.config import settings

            self._engine = create_engine(settings.data_db.url, pool_pre_ping=True)
        return self._engine

    def explain(self, sql: str) -> list[dict[str, Any]]:
        from sqlalchemy import text

        with self._get_engine().connect() as conn:
            result = conn.execute(text(f"EXPLAIN {sql}"))
            return [dict(row._mapping) for row in result]
