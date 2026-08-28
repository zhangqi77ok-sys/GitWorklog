import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.db import engine, Base

from app.api.session import router as session_router
from app.api.chat import router as chat_router
from app.api.cockpit import router as cockpit_router
from app.api.harness import router as harness_router
from app.api.graph import router as graph_router
from app.api.memory import router as memory_router
from app.api.mesh import router as mesh_router
from app.api.skills import router as skills_router
from app.api.mcp import router as mcp_router
from app.api.projects import router as projects_router
from app.api.health import router as health_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

routers = [
    session_router,
    chat_router,
    cockpit_router,
    harness_router,
    graph_router,
    memory_router,
    mesh_router,
    skills_router,
    mcp_router,
    projects_router,
    health_router,
]

for r in routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")

# 动态自适应解析静态资源路径 (兼容 PyInstaller 打包与源码直跑)
def get_static_dir() -> str:
    candidates = []
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", "")
        exe_dir = os.path.dirname(sys.executable)
        if meipass:
            candidates.extend([
                os.path.join(meipass, "app", "static"),
                os.path.join(meipass, "static"),
            ])
        candidates.extend([
            os.path.join(exe_dir, "_internal", "app", "static"),
            os.path.join(exe_dir, "_internal", "static"),
            os.path.join(exe_dir, "app", "static"),
            os.path.join(exe_dir, "static"),
        ])
    
    # 源码模式候选项 (优先挂载最新 React 19 构建产物 dist)
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    candidates.extend([
        os.path.join(root_dir, "dist"),
        os.path.join(curr_dir, "static"),
        os.path.join(curr_dir, "..", "app", "static"),
        os.path.join(os.getcwd(), "dist"),
        os.path.join(os.getcwd(), "app", "static"),
    ])

    for c in candidates:
        if c and os.path.isdir(c) and os.path.exists(os.path.join(c, "index.html")):
            return os.path.abspath(c)
    
    # 兜底：自动创建
    fallback = os.path.join(curr_dir, "static")
    os.makedirs(fallback, exist_ok=True)
    return fallback

static_dir_path = get_static_dir()
print(f"[Static] Assets mounted from: {static_dir_path}")
app.mount("/", StaticFiles(directory=static_dir_path, html=True), name="static")
