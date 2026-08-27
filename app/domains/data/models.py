"""data 域 ORM 模型：SQL 审计日志。

被查询的业务库是只读且外部的（config.data_db），审计写的是**平台库**，
两者不能混——审计必须落在我们自己可控、只读账号碰不到的库里。
"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class SqlAuditLog(Base, TimestampMixin):
    """每次 executeSql 一条，含被安全策略拦截的尝试。"""

    __tablename__ = "sql_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(index=True)
    scope: Mapped[str] = mapped_column(String(32), default="")
    raw_sql: Mapped[str] = mapped_column(Text, default="")
    executed_sql: Mapped[str] = mapped_column(Text, default="")
    success: Mapped[int] = mapped_column(default=0, index=True)  # 0/1，便于筛被拦记录
    row_count: Mapped[int] = mapped_column(default=0)
    error: Mapped[str] = mapped_column(String(500), default="")
    duration_ms: Mapped[int] = mapped_column(default=0)
