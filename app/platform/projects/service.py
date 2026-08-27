"""项目工作区、Git 分支管理与代码文件服务。"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

DEFAULT_PROJECTS = [
    {
        "id": "agent-learning",
        "name": "agent-learning (当前智能体工程)",
        "path": "e:\\pro\\agent-learning",
    },
    {"id": "pro-root", "name": "pro (代码主工作区根目录)", "path": "e:\\pro"},
]


def list_projects() -> list[dict[str, Any]]:
    """列出可用工程项目列表。"""
    valid = []
    for p in DEFAULT_PROJECTS:
        if os.path.exists(p["path"]):
            git_info = get_git_info(p["path"])
            valid.append({**p, "git": git_info})
    return valid


def get_git_info(project_path: str) -> dict[str, Any]:
    """获取项目的 Git 分支与仓库状态。"""
    git_dir = os.path.join(project_path, ".git")
    if not os.path.exists(git_dir):
        return {"is_git": False, "current_branch": "None", "branches": []}

    try:
        # 获取当前分支
        branch_res = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=3,
        )
        curr_branch = branch_res.stdout.strip() or "main"

        # 获取所有分支
        branches_res = subprocess.run(
            ["git", "branch", "--format=%(refname:short)"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=3,
        )
        branches = [b.strip() for b in branches_res.stdout.splitlines() if b.strip()]
        if curr_branch not in branches:
            branches.append(curr_branch)

        return {
            "is_git": True,
            "current_branch": curr_branch,
            "branches": branches,
        }
    except Exception:
        return {"is_git": True, "current_branch": "main", "branches": ["main", "dev"]}


def checkout_branch(project_path: str, branch_name: str) -> tuple[bool, str]:
    """切换 Git 分支。"""
    try:
        res = subprocess.run(
            ["git", "checkout", branch_name],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if res.returncode == 0:
            return True, f"成功切换到分支 {branch_name}"
        return False, res.stderr or res.stdout or "切换分支失败"
    except Exception as e:
        return False, f"Git 执行异常: {e}"


def get_project_file_tree(project_path: str, max_depth: int = 3) -> list[dict[str, Any]]:
    """递归读取项目工程文件目录树（忽略 .git, __pycache__, .venv, node_modules 等）。"""
    ignored = {
        ".git",
        ".venv",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".cache",
        ".idea",
        ".vscode",
        "temp_edge_profile",
    }

    def _build_tree(curr_path: Path, depth: int) -> list[dict[str, Any]]:
        if depth > max_depth:
            return []
        items = []
        try:
            entries = sorted(curr_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            for entry in entries:
                if entry.name in ignored or entry.name.startswith(".") or entry.name.startswith("~"):
                    continue
                rel_path = str(entry.relative_to(Path(project_path))).replace("\\", "/")

                if entry.is_dir():
                    items.append(
                        {
                            "name": entry.name,
                            "path": rel_path,
                            "type": "directory",
                            "children": _build_tree(entry, depth + 1),
                        }
                    )
                else:
                    items.append(
                        {
                            "name": entry.name,
                            "path": rel_path,
                            "type": "file",
                            "size": entry.stat().st_size,
                        }
                    )
        except Exception:
            pass
        return items

    return _build_tree(Path(project_path), 1)


def read_project_file(project_path: str, rel_path: str) -> str:
    """读取指定代码文件内容。"""
    full_path = Path(project_path) / rel_path
    if not full_path.exists() or not full_path.is_file():
        raise FileNotFoundError(f"文件不存在: {rel_path}")

    # 防止目录遍历安全穿透
    if not str(full_path.resolve()).startswith(str(Path(project_path).resolve())):
        raise PermissionError("禁止跨目录越权访问")

    return full_path.read_text(encoding="utf-8", errors="replace")


def save_project_file(project_path: str, rel_path: str, content: str) -> bool:
    """写入并保存代码文件。"""
    full_path = Path(project_path) / rel_path
    if not str(full_path.resolve()).startswith(str(Path(project_path).resolve())):
        raise PermissionError("禁止跨目录越权访问")

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")
    return True


def create_project_file(
    project_path: str, rel_path: str, initial_content: str = "", overwrite: bool = True
) -> dict[str, Any]:
    """在指定工程路径下创建新文件（自动创建父目录）。"""
    full_path = Path(project_path) / rel_path
    if not str(full_path.resolve()).startswith(str(Path(project_path).resolve())):
        raise PermissionError("禁止跨目录越权访问")

    if full_path.exists() and not overwrite:
        raise FileExistsError(f"文件已存在: {rel_path}")

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(initial_content, encoding="utf-8")
    return {"file_path": rel_path, "size": len(initial_content), "status": "created"}


def delete_project_file(project_path: str, rel_path: str) -> dict[str, Any]:
    """删除工程内的指定文件。"""
    full_path = Path(project_path) / rel_path
    if not str(full_path.resolve()).startswith(str(Path(project_path).resolve())):
        raise PermissionError("禁止跨目录越权访问")

    if not full_path.exists():
        raise FileNotFoundError(f"文件不存在: {rel_path}")
    if full_path.is_file():
        full_path.unlink()
    elif full_path.is_dir():
        import shutil

        shutil.rmtree(full_path)
    return {"file_path": rel_path, "status": "deleted"}


def run_workspace_command(project_path: str, command: str, timeout_seconds: int = 30) -> dict[str, Any]:
    """在工程根目录下执行终端命令（如 pytest, python, git, uv 等）。"""
    p = Path(project_path).resolve()
    if not p.exists() or not p.is_dir():
        raise ValueError(f"工程路径无效: {project_path}")

    import os
    import sys
    import time

    start_time = time.time()
    env = os.environ.copy()
    py_dir = os.path.dirname(sys.executable)
    py_scripts = os.path.join(py_dir, "Scripts")
    path_additions = [py_dir, py_scripts]
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        uv_path = os.path.join(local_app_data, "Programs", "uv")
        if os.path.exists(uv_path):
            path_additions.append(uv_path)
    env["Path"] = ";".join(path_additions) + ";" + env.get("Path", "")

    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=str(p),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=env,
        )
        elapsed = round(time.time() - start_time, 2)
        return {
            "command": command,
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "elapsed_seconds": elapsed,
            "success": proc.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {
            "command": command,
            "returncode": -1,
            "stdout": "",
            "stderr": f"执行超时 ({timeout_seconds}s)",
            "elapsed_seconds": timeout_seconds,
            "success": False,
        }
    except Exception as exc:
        return {
            "command": command,
            "returncode": -1,
            "stdout": "",
            "stderr": str(exc),
            "elapsed_seconds": 0,
            "success": False,
        }


def add_custom_project(name: str, path: str) -> dict[str, Any]:
    """添加或直接载入任意自定义本地工程目录。"""
    p = Path(path).resolve()
    if not p.exists() or not p.is_dir():
        raise ValueError(f"指定的目录不存在或不是有效文件夹: {path}")

    proj_name = name.strip() if name and name.strip() else p.name
    proj_id = p.name.lower().replace(" ", "-") or "custom-proj"
    for existing in DEFAULT_PROJECTS:
        if str(Path(existing["path"]).resolve()) == str(p):
            return {**existing, "git": get_git_info(str(p))}

    entry = {"id": proj_id, "name": f"{proj_name} ({p.name})", "path": str(p)}
    DEFAULT_PROJECTS.append(entry)
    return {**entry, "git": get_git_info(str(p))}



