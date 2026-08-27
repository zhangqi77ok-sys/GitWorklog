"""项目工程与 Git 分支操作 API。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.core.response import R
from app.platform.projects.service import (
    checkout_branch,
    get_git_info,
    get_project_file_tree,
    list_projects,
    read_project_file,
    save_project_file,
)

router = APIRouter(prefix="/api/projects", tags=["项目与 Git 分支管理"])


class CheckoutRequest(BaseModel):
    project_path: str
    branch_name: str


class SaveFileRequest(BaseModel):
    project_path: str
    file_path: str
    content: str


@router.get("/list")
def get_projects(_: CurrentUser) -> R[list[dict[str, Any]]]:
    """获取所有可用工程项目及 Git 状态。"""
    return R.ok(list_projects())


@router.get("/git")
def get_git(project_path: str = Query(...), _: CurrentUser = None) -> R[dict[str, Any]]:
    """获取指定工程的 Git 分支与状态。"""
    return R.ok(get_git_info(project_path))


@router.post("/checkout")
def switch_branch(req: CheckoutRequest, _: CurrentUser) -> R[dict[str, str]]:
    """切换指定工程的 Git 分支。"""
    success, msg = checkout_branch(req.project_path, req.branch_name)
    if not success:
        return R.fail(400, msg)
    return R.ok({"message": msg, "branch": req.branch_name})


@router.get("/tree")
def get_tree(project_path: str = Query(...), _: CurrentUser = None) -> R[list[dict[str, Any]]]:
    """获取项目代码文件目录树。"""
    return R.ok(get_project_file_tree(project_path))


@router.get("/file")
def get_file(
    project_path: str = Query(...),
    file_path: str = Query(...),
    _: CurrentUser = None,
) -> R[dict[str, str]]:
    """读取指定代码文件内容。"""
    try:
        content = read_project_file(project_path, file_path)
        return R.ok({"file_path": file_path, "content": content})
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/file")
def update_file(req: SaveFileRequest, _: CurrentUser) -> R[dict[str, str]]:
    """保存修改的代码文件。"""
    try:
        save_project_file(req.project_path, req.file_path, req.content)
        return R.ok({"file_path": req.file_path, "status": "saved"})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class AddProjectRequest(BaseModel):
    name: str
    path: str


@router.post("/add")
def add_project(req: AddProjectRequest, _: CurrentUser) -> R[dict[str, Any]]:
    """添加并绑定新的本地工程目录。"""
    from app.platform.projects.service import add_custom_project

    try:
        res = add_custom_project(req.name, req.path)
        return R.ok(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

