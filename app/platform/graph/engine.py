"""Obsidian 风格项目代码与变更知识图谱引擎。

负责提取工程文件结构、代码实体（类、函数、路由）、依赖引用关系以及 Git 变动记录，输出力导向图格式。
"""

from __future__ import annotations

import ast
import os
import subprocess
from pathlib import Path
from typing import Any


class KnowledgeGraphEngine:
    """动态生成项目 AST 实体与变更关系知识图谱。"""

    def __init__(self, default_project_path: str = r"e:\pro\agent-learning") -> None:
        self.project_path = default_project_path

    def build_project_graph(self, project_path: str | None = None) -> dict[str, Any]:
        p = Path(project_path or self.project_path).resolve()
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        node_ids: set[str] = set()

        # 根节点
        root_id = f"proj:{p.name}"
        nodes.append({
            "id": root_id,
            "label": p.name,
            "type": "project",
            "val": 28,
            "color": "#6366f1",
            "details": f"项目根工作区: {p}"
        })
        node_ids.add(root_id)

        ignored = {".git", ".venv", "__pycache__", "node_modules", ".pytest_cache", "temp_edge_profile"}

        # 遍历文件与 AST
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in ignored and not d.startswith(".")]
            for file in files:
                if file.startswith(".") or file.endswith((".pyc", ".png", ".jpg", ".svg", ".lock")):
                    continue
                file_full = Path(root) / file
                rel_path = str(file_full.relative_to(p)).replace("\\", "/")
                file_id = f"file:{rel_path}"

                # 文件节点
                ext = file_full.suffix
                color = "#38bdf8" if ext == ".py" else ("#f59e0b" if ext in (".json", ".yaml", ".yml") else "#a855f7")
                nodes.append({
                    "id": file_id,
                    "label": file,
                    "type": "file",
                    "val": 14,
                    "color": color,
                    "path": rel_path,
                    "details": f"代码文件: {rel_path} ({file_full.stat().st_size} 字节)"
                })
                node_ids.add(file_id)

                # 连线: 项目 -> 文件
                edges.append({
                    "source": root_id,
                    "target": file_id,
                    "label": "contains",
                    "color": "rgba(255,255,255,0.15)"
                })

                # 若为 Python 文件，使用 AST 提取函数与类实体
                if ext == ".py":
                    try:
                        content = file_full.read_text(encoding="utf-8", errors="ignore")
                        tree = ast.parse(content)
                        for item in tree.body:
                            if isinstance(item, ast.FunctionDef):
                                func_id = f"func:{rel_path}#{item.name}"
                                nodes.append({
                                    "id": func_id,
                                    "label": f"{item.name}()",
                                    "type": "function",
                                    "val": 8,
                                    "color": "#10b981",
                                    "path": rel_path,
                                    "details": f"函数定义: {item.name}() in {rel_path}"
                                })
                                node_ids.add(func_id)
                                edges.append({
                                    "source": file_id,
                                    "target": func_id,
                                    "label": "defines",
                                    "color": "#10b981"
                                })
                            elif isinstance(item, ast.ClassDef):
                                class_id = f"class:{rel_path}#{item.name}"
                                nodes.append({
                                    "id": class_id,
                                    "label": f"class {item.name}",
                                    "type": "class",
                                    "val": 10,
                                    "color": "#ec4899",
                                    "path": rel_path,
                                    "details": f"类定义: {item.name} in {rel_path}"
                                })
                                node_ids.add(class_id)
                                edges.append({
                                    "source": file_id,
                                    "target": class_id,
                                    "label": "declares",
                                    "color": "#ec4899"
                                })
                    except Exception:
                        pass

        # 提取 Git 最近提交与变动节点
        git_dir = p / ".git"
        if git_dir.exists():
            try:
                git_log = subprocess.run(
                    ["git", "log", "-n", "3", "--format=%h||%s||%an"],
                    cwd=str(p),
                    capture_output=True,
                    text=True,
                    timeout=3
                )
                for line in git_log.stdout.splitlines():
                    if line and "||" in line:
                        commit_hash, msg, author = line.split("||", 2)
                        commit_id = f"commit:{commit_hash}"
                        nodes.append({
                            "id": commit_id,
                            "label": f"commit: {commit_hash}",
                            "type": "commit",
                            "val": 12,
                            "color": "#e11d48",
                            "details": f"Git 变更: {msg} (by {author})"
                        })
                        edges.append({
                            "source": root_id,
                            "target": commit_id,
                            "label": "version_change",
                            "color": "#e11d48"
                        })
            except Exception:
                pass

        return {
            "project_path": str(p),
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "nodes": nodes,
            "edges": edges
        }


_graph_engine = KnowledgeGraphEngine()

def get_graph_engine() -> KnowledgeGraphEngine:
    return _graph_engine