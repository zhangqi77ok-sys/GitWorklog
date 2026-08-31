"""Task H1: /api/share/save_image 宿主保存 PNG 卡片图片路由测试 (SDD+TDD 红灯先行)."""
import base64
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

TOKEN = "share-save-test-token"

# 1x1 红色 PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


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


def test_save_image_valid_png_returns_200(monkeypatch, tmp_path):
    saved = {}
    monkeypatch.setattr(desktop, "get_share_dir", lambda: tmp_path)
    status, data = _request("POST", "/api/share/save_image", body={
        "filename": "Tcode-Share-Card-123.png",
        "dataBase64": base64.b64encode(PNG_BYTES).decode("ascii"),
    })
    assert status == 200
    payload = json.loads(data)
    assert payload.get("success") is True
    saved_path = Path(payload["path"])
    assert saved_path.name == "Tcode-Share-Card-123.png"
    assert saved_path.exists()
    assert saved_path.read_bytes().startswith(b"\x89PNG")


def test_save_image_missing_fields_returns_400(monkeypatch):
    monkeypatch.setattr(desktop, "get_share_dir", lambda: Path("."))
    status, _ = _request("POST", "/api/share/save_image", body={"filename": "x.png"})
    assert status == 400


def test_save_image_path_traversal_filename_returns_400(monkeypatch):
    monkeypatch.setattr(desktop, "get_share_dir", lambda: Path("."))
    status, _ = _request("POST", "/api/share/save_image", body={
        "filename": "../../evil.png",
        "dataBase64": base64.b64encode(PNG_BYTES).decode("ascii"),
    })
    assert status == 400


def test_save_image_invalid_base64_returns_400(monkeypatch):
    monkeypatch.setattr(desktop, "get_share_dir", lambda: Path("."))
    status, _ = _request("POST", "/api/share/save_image", body={
        "filename": "x.png",
        "dataBase64": "not-valid-base64!!!",
    })
    assert status == 400


def test_save_image_requires_token():
    status, _ = _request("POST", "/api/share/save_image", body={
        "filename": "x.png",
        "dataBase64": "aGVsbG8=",
    }, token=None)
    assert status == 401
