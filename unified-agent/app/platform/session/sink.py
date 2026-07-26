"""MessageSink 的 DB 实现：把 Hook 收集到的一轮问答落进会话表。

为什么自己开 session 而不复用请求依赖的那个：SSE 是流式响应，
生成器在请求处理函数返回之后才真正执行，FastAPI 的 yield 依赖此时可能已经关闭
（官方文档明确不建议在流式响应里依赖 yield 依赖）。
因此每次落库用 session_scope() 开一个短生命周期事务，与请求生命周期解耦。

结构上满足 platform/hooks/persistence.py 的 MessageSink 协议（鸭子类型，无需 import）。
"""

from __future__ import annotations

from app.core.db import session_scope
from app.core.logging import get_logger
from app.platform.session.service import append_message

logger = get_logger(__name__)


class DbMessageSink:
    """落库到 chat_message 表。失败只记日志，不打断 SSE 流。"""

    def save(self, conversation_id: str, role: str, content: str, extra: str = "") -> None:
        try:
            with session_scope() as session:
                append_message(session, conversation_id, role, content, extra)
        except Exception as exc:  # 宽捕获是刻意的：落库失败不该让用户的回答中断
            logger.error(
                "persist_message_failed",
                conversation_id=conversation_id,
                role=role,
                error=str(exc),
            )
