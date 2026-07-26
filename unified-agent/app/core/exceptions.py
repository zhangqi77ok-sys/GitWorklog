"""统一异常体系 + FastAPI 异常处理器。

业务代码抛 BizError（或子类），处理器统一转成 R.fail 响应。
未捕获异常在 prod 下隐藏细节，dev 下返回堆栈提示。
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.core.response import R

logger = get_logger(__name__)


class BizError(Exception):
    """业务异常：可预期的错误，携带错误码与用户可读消息。"""

    def __init__(self, message: str, code: int = 40000) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class AuthError(BizError):
    def __init__(self, message: str = "未登录或登录已过期") -> None:
        super().__init__(message, code=40100)


class NoPermissionError(BizError):
    def __init__(self, message: str = "无权限") -> None:
        super().__init__(message, code=40300)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BizError)
    async def _biz(_: Request, exc: BizError) -> JSONResponse:
        return JSONResponse(
            status_code=200,
            content=R.fail(exc.code, exc.message).model_dump(),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", error=str(exc))
        msg = str(exc) if settings.app.debug else "服务器内部错误"
        return JSONResponse(status_code=500, content=R.fail(50000, msg).model_dump())
