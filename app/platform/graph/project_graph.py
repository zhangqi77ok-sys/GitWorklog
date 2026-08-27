"""ViteCoding Studio - 工程代码知识图谱生成器 (类似 Obsidian 图谱)。

基于静态 AST 解析与语义抽取，构建项目全景拓扑图谱：
- 节点：文件 (File)、模块 (Module)、类 (Class)、函数 (Function)、API 路由 (API Route)、文档 (Doc)
- 关系：IMPORTS, CONTAINS, DEFINES, CALLS, EXPOSES, DOCUMENTS, REFERENCES
"""

from __future__ import annotations

import ast
import os
import re
from pathlib import Path
from typing import Any

IGNORED_DIRS = {
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
    "dist",
    "build",
    "temp_edge_profile",
}


def build_project_knowledge_graph(
    project_path: str,
    max_files: int = 150,
) -> dict[str, Any]:
    """遍历并解析项目工程，构建类 Obsidian 的力导向知识图谱数据结构。"""
    root = Path(project_path).resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"工程目录不存在: {project_path}")

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    node_ids: set[str] = set()

    def add_node(
        node_id: str,
        label: str,
        node_type: str,
        group: str,
        size: int = 10,
        file_path: str = "",
        line: int = 1,
        meta: dict[str, Any] | None = None,
    ) -> None:
        if node_id not in node_ids:
            node_ids.add(node_id)
            nodes.append(
                {
                    "id": node_id,
                    "label": label,
                    "type": node_type,
                    "group": group,
                    "size": size,
                    "path": file_path,
                    "line": line,
                    "meta": meta or {},
                }
            )

    def add_edge(
        source: str,
        target: str,
        relation: str,
        label: str = "",
        weight: float = 1.0,
    ) -> None:
        if source in node_ids and target in node_ids and source != target:
            edges.append(
                {
                    "source": source,
                    "target": target,
                    "relation": relation,
                    "label": label or relation.lower(),
                    "weight": weight,
                }
            )

    scanned_count = 0

    for current_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        for file_name in files:
            if scanned_count >= max_files:
                break
            if file_name.startswith(".") or file_name.endswith((".pyc", ".png", ".jpg", ".svg", ".lock", ".log")):
                continue

            full_file = Path(current_dir) / file_name
            try:
                rel_path = str(full_file.relative_to(root)).replace("\\", "/")
            except Exception:
                continue

            scanned_count += 1
            ext = full_file.suffix.lower()

            group = "other"
            size = 12
            if "api" in rel_path:
                group = "api"
                size = 14
            elif "domain" in rel_path or "core" in rel_path:
                group = "core"
                size = 14
            elif "platform" in rel_path:
                group = "platform"
                size = 13
            elif "test" in rel_path:
                group = "test"
                size = 10
            elif "static" in rel_path or "ui" in rel_path or ext in (".js", ".ts", ".html", ".css", ".vue", ".jsx", ".tsx"):
                group = "frontend"
                size = 11
            elif ext in (".md", ".txt", ".rst"):
                group = "doc"
                size = 9

            file_node_id = f"file:{rel_path}"
            add_node(
                file_node_id,
                file_name,
                "file",
                group,
                size=size,
                file_path=rel_path,
                line=1,
            )

            if ext == ".py":
                _parse_python_ast(full_file, rel_path, file_node_id, add_node, add_edge)
            elif ext in (".js", ".ts", ".jsx", ".tsx"):
                _parse_js_ts_file(full_file, rel_path, file_node_id, add_node, add_edge)
            elif ext in (".md", ".markdown"):
                _parse_markdown_file(full_file, rel_path, file_node_id, add_node, add_edge)

    type_counts: dict[str, int] = {}
    for n in nodes:
        t = n.get("type", "other")
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "files": type_counts.get("file", 0),
            "classes": type_counts.get("class", 0),
            "functions": type_counts.get("function", 0),
            "apis": type_counts.get("api", 0),
            "docs": type_counts.get("doc", 0),
        },
    }


def _parse_python_ast(full_file: Path, rel_path: str, file_node_id: str, add_node: Any, add_edge: Any) -> None:
    try:
        content = full_file.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(content, filename=str(full_file))
    except Exception:
        return

    for stmt in ast.walk(tree):
        if isinstance(stmt, ast.Import):
            for alias in stmt.names:
                imp_name = alias.name
                if imp_name.startswith("app."):
                    target_file = f"file:{imp_name.replace('.', '/')}.py"
                    add_edge(file_node_id, target_file, "IMPORTS", "imports")
        elif isinstance(stmt, ast.ImportFrom) and stmt.module:
            mod = stmt.module
            if mod.startswith("app."):
                target_file = f"file:{mod.replace('.', '/')}.py"
                add_edge(file_node_id, target_file, "IMPORTS", "imports")

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            class_node_id = f"class:{rel_path}#{node.name}"
            add_node(
                class_node_id,
                f"class {node.name}",
                "class",
                "class",
                size=11,
                file_path=rel_path,
                line=node.lineno,
            )
            add_edge(file_node_id, class_node_id, "CONTAINS", "contains")

            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    method_node_id = f"method:{rel_path}#{node.name}.{item.name}"
                    add_node(
                        method_node_id,
                        f"{node.name}.{item.name}()",
                        "function",
                        "function",
                        size=8,
                        file_path=rel_path,
                        line=item.lineno,
                    )
                    add_edge(class_node_id, method_node_id, "DEFINES", "defines")

        elif isinstance(node, ast.FunctionDef):
            api_route = None
            http_method = None
            for deco in node.decorator_list:
                if isinstance(deco, ast.Call) and isinstance(deco.func, ast.Attribute):
                    attr_name = deco.func.attr
                    if attr_name in ("get", "post", "put", "delete", "patch"):
                        if deco.args and isinstance(deco.args[0], ast.Constant) and isinstance(deco.args[0].value, str):
                            api_route = deco.args[0].value
                            http_method = attr_name.upper()

            func_node_id = f"func:{rel_path}#{node.name}"
            add_node(
                func_node_id,
                f"{node.name}()",
                "function",
                "function",
                size=9,
                file_path=rel_path,
                line=node.lineno,
            )
            add_edge(file_node_id, func_node_id, "DEFINES", "defines")

            if api_route and http_method:
                api_node_id = f"api:{http_method} {api_route}"
                add_node(
                    api_node_id,
                    f"{http_method} {api_route}",
                    "api",
                    "api",
                    size=13,
                    file_path=rel_path,
                    line=node.lineno,
                )
                add_edge(file_node_id, api_node_id, "EXPOSES", "exposes")
                add_edge(api_node_id, func_node_id, "HANDLED_BY", "handled by")


def _parse_js_ts_file(full_file: Path, rel_path: str, file_node_id: str, add_node: Any, add_edge: Any) -> None:
    try:
        content = full_file.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    import_matches = re.findall(r"""import\s+.*?from\s+['"]([^'"]+)['"]""", content)
    for imp in import_matches:
        if imp.startswith("./") or imp.startswith("../"):
            clean_imp = imp.lstrip("./").lstrip("../")
            add_edge(file_node_id, f"file:{clean_imp}", "IMPORTS", "imports")

    func_matches = re.findall(r"""(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(""", content)
    for fn in func_matches[:8]:
        fn_id = f"js_func:{rel_path}#{fn}"
        add_node(fn_id, f"{fn}()", "function", "function", size=8, file_path=rel_path)
        add_edge(file_node_id, fn_id, "DEFINES", "defines")


def _parse_markdown_file(full_file: Path, rel_path: str, file_node_id: str, add_node: Any, add_edge: Any) -> None:
    try:
        content = full_file.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    links = re.findall(r"""\[([^\]]+)\]\(([^)]+)\)""", content)
    for title, link in links:
        if not link.startswith("http") and not link.startswith("#"):
            clean_link = link.replace("file:///", "").replace("\\", "/")
            if clean_link.endswith((".py", ".js", ".ts", ".html", ".css", ".md")):
                target_id = f"file:{clean_link}"
                add_edge(file_node_id, target_id, "REFERENCES", "references")
