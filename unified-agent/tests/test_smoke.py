"""冒烟测试：应用能装配、health 可用、SSE chat 有流。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["status"] == "up"


def test_chat_sse_stream() -> None:
    resp = client.post("/api/chat", json={"query": "统计销售额"})
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    # 先路由（agent_switch），未配置模型时降级，最终 done
    assert "agent_switch" in resp.text
    assert "done" in resp.text
