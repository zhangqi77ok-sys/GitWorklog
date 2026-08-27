"""MCP 服务管理与自定义工程添加 API 测试。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token


@pytest.fixture
def client_with_token() -> tuple[TestClient, str]:
    client = TestClient(app)
    token = create_token(1, extra={"role": "admin"})
    return client, token


def test_mcp_crud_and_ping(client_with_token: tuple[TestClient, str]) -> None:
    client, token = client_with_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 查询 MCP 列表
    resp = client.get("/api/mcp/list", headers=headers)
    assert resp.status_code == 200
    servers = resp.json()["data"]
    assert len(servers) >= 5
    filesystem_srv = next((s for s in servers if "filesystem" in s["id"]), None)
    assert filesystem_srv is not None
    assert "read_file" in filesystem_srv["tools"]

    # 2. 注册自定义 MCP 服务
    create_resp = client.post(
        "/api/mcp/create",
        json={
            "name": "Elasticsearch Search MCP",
            "description": "企业级全文检索与日志索引分析服务",
            "transport": "stdio",
            "command": "uvx",
            "args": ["mcp-server-elasticsearch", "--host", "http://localhost:9200"],
            "tools": ["es_search", "es_count", "es_mapping"],
            "icon": "🔎",
        },
        headers=headers,
    )
    assert create_resp.status_code == 200
    new_srv = create_resp.json()["data"]
    new_id = new_srv["id"]
    assert new_srv["name"] == "Elasticsearch Search MCP"

    # 3. Ping 探测
    ping_resp = client.post(f"/api/mcp/{new_id}/ping", headers=headers)
    assert ping_resp.status_code == 200
    assert ping_resp.json()["data"]["status"] == "connected"

    # 4. Toggle 开关
    toggle_resp = client.post(f"/api/mcp/{new_id}/toggle", headers=headers)
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["data"]["enabled"] is False

    # 5. 删除 MCP
    del_resp = client.delete(f"/api/mcp/{new_id}", headers=headers)
    assert del_resp.status_code == 200


def test_projects_add_custom_path(client_with_token: tuple[TestClient, str]) -> None:
    client, token = client_with_token
    headers = {"Authorization": f"Bearer {token}"}

    add_resp = client.post(
        "/api/projects/add",
        json={"name": "当前项目测试", "path": "e:\\pro\\agent-learning"},
        headers=headers,
    )
    assert add_resp.status_code == 200
    assert "git" in add_resp.json()["data"]