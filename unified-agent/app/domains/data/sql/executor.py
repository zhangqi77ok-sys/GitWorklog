"""executeSql 执行编排（对应 dodo 的 ExecuteSqlTool 全链路）。

编排顺序（安全铁律）：
  guard 校验+强制LIMIT → 数据权限改写 → EXPLAIN 预检 → 只读执行
  → 脱敏 → 审计 → 结果格式化

审计覆盖成功与被拦两条路径：被 guard / 预检拒绝的尝试才是最该留痕的。

EXPLAIN 预检对权限改写**之后**的 SQL 执行，因为改写会加 WHERE，
对着改写前的 SQL 预检会高估扫描量、误拦本来安全的查询。
未注入 precheck 时跳过该步（保持无 live 环境可用）。

QueryRunner 抽象只读执行，live 由 MySQL 只读连接实现，测试用 fake。
纯编排逻辑可离线测试（用 fake runner）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.core.logging import get_logger
from app.domains.data.sql.audit import SqlAuditor
from app.domains.data.sql.explain import ExplainPrecheckService
from app.domains.data.sql.guard import SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter
from app.domains.data.sql.sensitive import SensitiveFilter
from app.platform.auth.datascope import DataScopeResult

logger = get_logger(__name__)


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[dict[str, object]]
    executed_sql: str = ""


class QueryRunner(Protocol):
    """只读查询执行接口。live 由只读连接实现。"""

    def run(self, sql: str) -> QueryResult: ...


@dataclass
class ExecuteSqlPipeline:
    guard: SqlSafetyGuard
    rewriter: DataScopeRewriter
    runner: QueryRunner
    sensitive: SensitiveFilter = field(default_factory=SensitiveFilter)
    precheck: ExplainPrecheckService | None = None
    auditor: SqlAuditor | None = None

    def execute(self, sql: str, scope: DataScopeResult) -> QueryResult:
        """执行用户 SQL，全程安全管控。任一步失败向上抛，由 Agent 回灌重写。

        无论成功还是被安全策略拦截都写审计——被拦的尝试恰恰是最该留痕的。
        """
        started = self.auditor.now() if self.auditor is not None else None
        scoped_sql = ""
        try:
            # 1. 安全校验 + 强制 LIMIT
            safe_sql = self.guard.check_and_fix(sql)
            # 2. 数据权限改写
            scoped_sql = self.rewriter.rewrite(safe_sql, scope)
            # 3. EXPLAIN 预检（对改写后的 SQL；未注入则跳过）
            if self.precheck is not None:
                self.precheck.check(scoped_sql)
            # 4. 只读执行
            logger.info("execute_sql", user_id=scope.user_id, scope=str(scope.scope))
            result = self.runner.run(scoped_sql)
        except Exception as exc:
            self._audit(sql, scoped_sql, scope, False, 0, str(exc), started)
            raise
        # 5. 脱敏
        masked = self.sensitive.mask_rows(result.columns, result.rows)
        self._audit(sql, scoped_sql, scope, True, len(masked), "", started)
        return QueryResult(columns=result.columns, rows=masked, executed_sql=scoped_sql)

    def _audit(
        self,
        raw_sql: str,
        scoped_sql: str,
        scope: DataScopeResult,
        success: bool,
        row_count: int,
        error: str,
        started: float | None,
    ) -> None:
        if self.auditor is None:
            return
        self.auditor.record(
            user_id=scope.user_id,
            scope=str(scope.scope),
            raw_sql=raw_sql,
            executed_sql=scoped_sql,
            success=success,
            row_count=row_count,
            error=error,
            started_at=started,
        )
