"""列出所有 API 路由，供人工核对。"""

from fastapi.routing import APIRoute

from app.main import app

for r in app.routes:
    if isinstance(r, APIRoute):
        methods = ",".join(sorted(r.methods - {"HEAD", "OPTIONS"}))
        print(f"{methods:10} {r.path}")
