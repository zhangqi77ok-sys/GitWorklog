"""会话标签、三色状态灯与跨会话搜索测试。"""

from fastapi.testclient import TestClient
from app.main import app
from app.platform.auth.security import create_token
from app.core.db import session_scope
from app.platform.session.service import get_or_create_conversation


def test_session_tags_and_status():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    conv_id = "test-session-tags-1"
    with session_scope() as s:
        get_or_create_conversation(s, 1, conv_id)

    # 1. 更新标签
    tag_resp = client.post(
        f"/session/{conv_id}/tags",
        headers=headers,
        json={"tags": ["feature", "vite", "coding"]}
    )
    assert tag_resp.status_code == 200

    # 2. 更新状态为 running (蓝色)
    status_resp = client.post(
        f"/session/{conv_id}/status",
        headers=headers,
        json={"status": "running"}
    )
    assert status_resp.status_code == 200

    # 3. 搜索会话
    search_resp = client.get("/session/search?q=vite", headers=headers)
    assert search_resp.status_code == 200
    assert any(c["conversation_id"] == conv_id for c in search_resp.json()["data"])