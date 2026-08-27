"""D-14 SQL 审计：谁在什么时候跑了什么 SQL、是否被拦、拿到多少行。

安全铁律的最后一环。**被拦截的请求比成功的更值得记录**——
guard 拒绝、EXPLAIN 预检拒绝都意味着有人（或 LLM）尝试了越界查询，
这正是事后追责与调参的依据，因此审计要覆盖成功与失败两条路径。

AuditSink 抽象成协议：默认内存实现供测试，DbAuditSink 落 sql_audit_log 表。
写审计失败只记日志、绝不打断用户查询——审计是旁路，不该成为新的故障点。
时间通过 clock 注入，与 circuit_breaker / progress 的约定一致。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger

logger = get_logger(__name__)

# 原始 SQL 可能很长，落库前截断，避免审计表被单条巨型语句撑爆
MAX_SQL_CHARS = 4000


@dataclass
class AuditRecord:
    """一次 executeSql 的审计快照。"""

    user_id: int
    scope: str
    raw_sql: str  # 用户/LLM 原始输入
    executed_sql: str  # 实际执行的（已加 LIMIT + 权限改写）；被拦时为空
    success: bool
    row_count: int = 0
    error: str = ""  # 被拦或执行失败的原因
    duration_ms: int = 0


class AuditSink(Protocol):
    def save(self, record: AuditRecord) -> None: ...


@dataclass
class InMemoryAuditSink:
    """测试用：审计记录留在内存里。"""

    records: list[AuditRecord] = field(default_factory=list)

    def save(self, record: AuditRecord) -> None:
        self.records.append(record)


def _default_clock() -> float:
    import time

    return time.monotonic()


@dataclass
class SqlAuditor:
    """包装 sink，负责截断、计时与「审计失败不外抛」。"""

    sink: Any
    clock: Callable[[], float] = field(default=_default_clock)

    def now(self) -> float:
        return self.clock()

    def record(
        self,
        *,
        user_id: int,
        scope: str,
        raw_sql: str,
        executed_sql: str,
        success: bool,
        row_count: int = 0,
        error: str = "",
        started_at: float | None = None,
    ) -> None:
        duration = 0
        if started_at is not None:
            duration = max(0, int((self.clock() - started_at) * 1000))
        rec = AuditRecord(
            user_id=user_id,
            scope=scope,
            raw_sql=raw_sql[:MAX_SQL_CHARS],
            executed_sql=executed_sql[:MAX_SQL_CHARS],
            success=success,
            row_count=row_count,
            error=error[:500],
            duration_ms=duration,
        )
        try:
            self.sink.save(rec)
        except Exception as exc:  # 宽捕获是刻意的：审计是旁路，不该拖垮查询
            logger.error("sql_audit_save_failed", user_id=user_id, error=str(exc))
