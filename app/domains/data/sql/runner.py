"""MySQL 只读查询执行器（实现 QueryRunner）。

连 data 域的被查询业务库（独立只读连接，与平台库隔离，见 config.data_db）。
SQL 已由 ExecuteSqlPipeline 前置校验+改写，这里只负责执行 + 结果转 dict + 截断。
构造注入 engine 便于测试（SQLite）。真实连接需 MySQL 实例。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import create_engine, text

from app.core.config import settings
from app.domains.data.sql.executor import QueryResult, QueryRunner

MAX_ROWS = 500


class MySQLReadOnlyRunner(QueryRunner):
    def __init__(self, engine: Any = None, max_rows: int = MAX_ROWS) -> None:
        self._engine = engine
        self.max_rows = max_rows

    def _get_engine(self) -> Any:
        if self._engine is None:
            # 独立只读连接（隔离于平台库）
            self._engine = create_engine(settings.data_db.url, pool_pre_ping=True)
        return self._engine

    def run(self, sql: str) -> QueryResult:
        engine = self._get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [dict(row._mapping) for row in result.fetchmany(self.max_rows)]
        return QueryResult(columns=columns, rows=rows, executed_sql=sql)
