"""Obsidian 知识图谱引擎测试。"""

import os
from app.platform.graph.engine import KnowledgeGraphEngine


def test_graph_engine():
    engine = KnowledgeGraphEngine(os.getcwd())
    data = engine.build_project_graph()

    assert "nodes" in data
    assert "edges" in data
    assert data["total_nodes"] > 0
    assert any(n["type"] == "project" for n in data["nodes"])
    assert any(n["type"] == "file" for n in data["nodes"])