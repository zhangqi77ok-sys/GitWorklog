"""统一响应体 R（对应原 Java 项目的 R<T>）。

所有 REST 接口返回 R[T]，前端按 {code, message, data} 统一处理。
SSE 流式接口不走这里，用 app/platform/sse 的事件协议。
"""

from __future__ import annotations

from pydantic import BaseModel


class R[T](BaseModel):
    code: int = 0  # 0 成功，非 0 业务错误码
    message: str = "ok"
    data: T | None = None

    @classmethod
    def ok(cls, data: T | None = None, message: str = "ok") -> R[T]:
        return cls(code=0, message=message, data=data)

    @classmethod
    def fail(cls, code: int, message: str) -> R[T]:
        return cls(code=code, message=message, data=None)
