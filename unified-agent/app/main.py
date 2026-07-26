"""FastAPI 应用入口。

装配顺序：日志 → 应用 → 异常处理器 → 路由。
启动：uvicorn app.main:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, chat, health, session, skills, sys
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger

configure_logging(debug=settings.app.debug)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("app_starting", env=settings.app.env)
    # 阶段 1 起：此处初始化 DB / Redis / MinIO / MCP 连接池
    yield
    logger.info("app_stopping")


app = FastAPI(
    title="统一智能体平台",
    description="融合 gogo 差旅多 Agent 与 dodo-agentx 数据分析",
    version="0.1.0",
    lifespan=lifespan,
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(sys.router)
app.include_router(session.router)
app.include_router(skills.router)

# 静态前端：/static/* 资源 + / 首页
_STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(str(_STATIC_DIR / "index.html"))
