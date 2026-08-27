import ast
import os
from pathlib import Path
from typing import Any

class KnowledgeGraphService:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir)
        self._session_diff_nodes: list[dict[str, Any]] = []

    def record_change(self, conversation_id: str, file_path: str, action: str, summary: str):
        self._session_diff_nodes.append({
            "conversation_id": conversation_id,
            "file_path": file_path,
            "action": action,
            "summary": summary
        })

    def scan_project_ast(self) -> dict[str, Any]:
        nodes = []
        links = []
        node_ids = set()

        def add_node(nid: str, label: str, ntype: str, group: int, val: int = 10):
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append({"id": nid, "name": label, "type": ntype, "group": group, "val": val})

        def add_link(source: str, target: str, rel: str):
            if source in node_ids and target in node_ids:
                links.append({"source": source, "target": target, "rel": rel})

        target_dirs = ["app", "tests"]
        for td in target_dirs:
            p = self.root_dir / td
            if not p.exists():
                continue
            for root, _, files in os.walk(p):
                for f in files:
                    if f.endswith(".py"):
                        fpath = os.path.relpath(os.path.join(root, f), self.root_dir).replace("\\", "/")
                        add_node(fpath, f, "file", group=1, val=15)

                        full_path = os.path.join(root, f)
                        try:
                            with open(full_path, "r", encoding="utf-8", errors="ignore") as py_file:
                                tree = ast.parse(py_file.read(), filename=fpath)
                            for node in tree.body:
                                if isinstance(node, ast.ClassDef):
                                    cid = f"{fpath}::{node.name}"
                                    add_node(cid, f"class {node.name}", "class", group=2, val=8)
                                    add_link(fpath, cid, "contains")
                                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                                    fid = f"{fpath}::{node.name}"
                                    add_node(fid, f"def {node.name}()", "function", group=3, val=6)
                                    add_link(fpath, fid, "contains")
                        except Exception:
                            pass

        for change in self._session_diff_nodes:
            sid = f"session::{change['conversation_id']}"
            add_node(sid, f"会话变动 {change['conversation_id'][:8]}", "session", group=4, val=12)
            fpath = change["file_path"]
            if fpath in node_ids:
                add_link(sid, fpath, change["action"])

        return {"nodes": nodes, "links": links}

_graph_service = KnowledgeGraphService()
def get_graph_service() -> KnowledgeGraphService:
    return _graph_service
