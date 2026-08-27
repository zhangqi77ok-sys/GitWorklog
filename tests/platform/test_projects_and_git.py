"""项目与 Git 分支管理单元测试。"""

from __future__ import annotations

import os

from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token
from app.platform.projects.service import (
    get_git_info,
    get_project_file_tree,
    list_projects,
    read_project_file,
    save_project_file,
)


def test_project_service():
    projects = list_projects()
    assert len(projects) >= 1

    curr_path = os.getcwd()
    git_info = get_git_info(curr_path)
    assert git_info["is_git"] is True
    assert "current_branch" in git_info
    assert len(git_info["branches"]) >= 1

    # 测试文件树
    tree = get_project_file_tree(curr_path, max_depth=2)
    assert len(tree) >= 1

    # 测试文件读写
    save_project_file(curr_path, "data/test_temp.txt", "Hello Project File")
    content = read_project_file(curr_path, "data/test_temp.txt")
    assert content == "Hello Project File"

    # 清理
    if os.path.exists(os.path.join(curr_path, "data/test_temp.txt")):
        os.remove(os.path.join(curr_path, "data/test_temp.txt"))


def test_projects_api():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 获取项目列表
    resp = client.get("/api/projects/list", headers=headers)
    assert resp.status_code == 200
    projs = resp.json()["data"]
    assert len(projs) >= 1

    proj_path = projs[0]["path"]

    # 2. 获取 Git 信息
    git_resp = client.get(f"/api/projects/git?project_path={proj_path}", headers=headers)
    assert git_resp.status_code == 200
    assert "branches" in git_resp.json()["data"]

    # 3. 获取文件树
    tree_resp = client.get(f"/api/projects/tree?project_path={proj_path}", headers=headers)
    assert tree_resp.status_code == 200
    assert isinstance(tree_resp.json()["data"], list)
