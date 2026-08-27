import os
from pathlib import Path
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R

router = APIRouter(prefix="/projects", tags=["projects"])

class SaveFileRequest(BaseModel):
    file_path: str
    content: str

@router.get("/tree")
def get_project_tree() -> R[list[dict[str, Any]]]:
    tree = []
    root_dir = Path(".")
    target_dirs = ["app", "tests"]
    for td in target_dirs:
        p = root_dir / td
        if p.exists():
            for root, dirs, files in os.walk(p):
                for f in files:
                    if f.endswith((".py", ".json", ".md", ".css", ".html", ".js")):
                        rel = os.path.relpath(os.path.join(root, f), ".").replace("\\", "/")
                        tree.append({"path": rel, "name": f, "is_file": True})
    return R.ok(tree)

@router.get("/file")
def get_file_content(path: str) -> R[dict[str, str]]:
    p = Path(path)
    if not p.exists() or not p.is_file():
        return R.fail(message="File not found")
    try:
        content = p.read_text(encoding="utf-8")
        return R.ok({"path": path, "content": content})
    except Exception as e:
        return R.fail(message=str(e))

@router.post("/file/save")
def save_file(req: SaveFileRequest) -> R[bool]:
    p = Path(req.file_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(req.content, encoding="utf-8")
    return R.ok(True)
