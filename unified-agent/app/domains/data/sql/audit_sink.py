"""AuditSink 的 DB 实现：落 sql_audit_log 表。

与 platform/session/sink.py 同样的理由自开短事务——审计可能发生在流式响应
过程中，此时请求级 session 未必还活着。
"""

from __future__ import annotations

from app.core.db import session_scope
from app.domains.data.models import SqlAuditLog
from app.domains.data.sql.audit import AuditRecord


class DbAuditSink:
    """结构上满足 AuditSink 协议。异常由上层 SqlAuditor 兜住。"""

    def save(self, record: AuditRecord) -> None:
        with session_scope() as session:
            session.add(
                SqlAuditLog(
                    user_id=record.user_id,
                    scope=record.scope,
                    raw_sql=record.raw_sql,
                    executed_sql=record.executed_sql,
                    success=1 if record.success else 0,
                    row_count=record.row_count,
                    error=record.error,
                    duration_ms=record.duration_ms,
                )
            )
