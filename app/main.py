"""FastAPI 应用入口 - Vite Coding Platform Micro-Kernel。"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.cockpit import router as cockpit_router
from app.api.deps import get_session
from app.api.files import router as files_router
from app.api.gateway import router as gateway_router
from app.api.graph import router as graph_router
from app.api.health import router as health_router
from app.api.mcp import router as mcp_router
from app.api.memory import router as memory_router
from app.api.mesh import router as mesh_router
from app.api.projects import router as projects_router
from app.api.session import router as session_router
from app.api.skills import router as skills_router
from app.api.sys import router as sys_router
from app.core.config import get_settings
from app.core.db import init_db
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(True)
    logger.info("Vite Coding 平台微内核启动中...")
    init_db()
    yield
    logger.info("Vite Coding 平台微内核正常关闭。")


app = FastAPI(
    title="Vite Coding Platform",
    description="面向桌面端的高性能积木式多智能体全自主编程平台",
    version="3.0.0",
    lifespan=lifespan,
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册微内核积木式路由
app.include_router(auth_router)
app.include_router(session_router)
app.include_router(chat_router)
app.include_router(projects_router)
app.include_router(graph_router)
app.include_router(mesh_router)
app.include_router(memory_router)
app.include_router(skills_router)
app.include_router(mcp_router)
app.include_router(cockpit_router)
app.include_router(files_router)
app.include_router(gateway_router)
app.include_router(sys_router)
app.include_router(health_router)

# 托管静态资源
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="root")