"""前端托管测试：首页 + 静态资源可访问。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_index_served() -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert "统一智能体平台" in resp.text
    assert "/static/app.js" in resp.text


def test_static_js_served() -> None:
    resp = client.get("/static/app.js")
    assert resp.status_code == 200
    assert "SSE" in resp.text or "fetch" in resp.text


def test_static_css_served() -> None:
    resp = client.get("/static/app.css")
    assert resp.status_code == 200
    assert "sidebar-nav" in resp.text or "composer" in resp.text

