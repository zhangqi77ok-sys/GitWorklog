"""前端托管测试：首页 + 静态资源可访问。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_index_served() -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Vite Coding" in resp.text
    assert "/static/app.js" in resp.text


def test_static_js_served() -> None:
    resp = client.get("/static/app.js")
    assert resp.status_code == 200
    assert "fetch" in resp.text or "state" in resp.text


def test_static_css_served() -> None:
    resp = client.get("/static/app.css")
    assert resp.status_code == 200
    assert "desktop" in resp.text or "theme" in resp.text

