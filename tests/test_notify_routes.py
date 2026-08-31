"""Task A1: /api/notify/system 与 /api/window/restore 路由测试 (SDD+TDD 红灯先行)."""
import http.client
import importlib.util
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import host_auth

spec = importlib.util.spec_from_file_location("desktop_app_test", SRC / "desktop_app.py")
desktop = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(desktop)

TOKEN = "notify-route-test-token"


def setup_module():
    host_auth.set_token(TOKEN)
    desktop.SERVER_PORT = desktop.start_local_server(0)


def _request(method, path, body=None, token=TOKEN):
    conn = http.client.HTTPConnection("127.0.0.1", desktop.SERVER_PORT)
    headers = {}
    if token is not None:
        headers["X-Tcode-Token"] = token
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body)
    conn.request(method, path, body=body, headers=headers)
    res = conn.getresponse()
    data = res.read()
    conn.close()
    return res.status, data


def _notify_payload(**overrides):
    base = {
        "status": "success",
        "projectName": "agent-learning",
        "sessionTitle": "构建任务",
        "sessionId": "sess-1",
        "summary": "构建完成",
    }
    base.update(overrides)
    return base


def test_notify_system_valid_payload_returns_200(monkeypatch):
    captured = {}

    def fake_show(payload, port):
        captured["payload"] = payload
        captured["port"] = port

    monkeypatch.setattr(desktop.notifications, "show_system_notification", fake_show)
    status, data = _request("POST", "/api/notify/system", body=_notify_payload())
    assert status == 200
    assert b'"success": true' in data
    assert captured["payload"]["sessionId"] == "sess-1"
    assert captured["port"] == desktop.SERVER_PORT


def test_notify_system_missing_session_id_returns_400(monkeypatch):
    def fake_show(payload, port):
        raise AssertionError("should not be called")

    monkeypatch.setattr(desktop.notifications, "show_system_notification", fake_show)
    status, _ = _request("POST", "/api/notify/system", body=_notify_payload(sessionId=None))
    assert status == 400


def test_notify_system_invalid_status_returns_400(monkeypatch):
    monkeypatch.setattr(desktop.notifications, "show_system_notification", lambda p, port: None)
    status, _ = _request("POST", "/api/notify/system", body=_notify_payload(status="unknown"))
    assert status == 400


def test_notify_system_invalid_json_returns_400(monkeypatch):
    conn = http.client.HTTPConnection("127.0.0.1", desktop.SERVER_PORT)
    conn.request("POST", "/api/notify/system", body="{not-json", headers={
        "Content-Type": "application/json", "X-Tcode-Token": TOKEN})
    res = conn.getresponse()
    data = res.read()
    conn.close()
    assert res.status == 400


def test_notify_system_failure_returns_500(monkeypatch):
    def boom(payload, port):
        raise RuntimeError("toast failed")

    monkeypatch.setattr(desktop.notifications, "show_system_notification", boom)
    status, data = _request("POST", "/api/notify/system", body=_notify_payload())
    assert status == 500
    assert b"NOTIFY_FAILED" in data


def test_notify_system_requires_token():
    status, _ = _request("POST", "/api/notify/system", body=_notify_payload(), token=None)
    assert status == 401


class FakeWindow:
    def __init__(self):
        self.restore_calls = 0
        self.show_calls = 0
        self.evaluated = []

    def restore(self):
        self.restore_calls += 1

    def show(self):
        self.show_calls += 1

    def evaluate_js(self, js):
        self.evaluated.append(js)


def test_window_restore_calls_window_and_dispatches_session(monkeypatch):
    win = FakeWindow()
    monkeypatch.setattr(desktop, "global_window", win)
    status, data = _request("GET", "/api/window/restore?sessionId=sess-9")
    assert status == 200
    assert win.restore_calls == 1
    assert win.show_calls == 1
    assert len(win.evaluated) == 1
    assert "tcode_activate_session" in win.evaluated[0]
    assert "sess-9" in win.evaluated[0]


def test_window_restore_without_window_returns_200(monkeypatch):
    monkeypatch.setattr(desktop, "global_window", None)
    status, _ = _request("GET", "/api/window/restore?sessionId=sess-9")
    assert status == 200


def test_window_restore_requires_token():
    status, _ = _request("GET", "/api/window/restore?sessionId=sess-9", token=None)
    assert status == 401
