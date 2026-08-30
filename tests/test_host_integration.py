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

TOKEN = "integration-test-token"


def setup_module():
    host_auth.set_token(TOKEN)
    desktop.SERVER_PORT = desktop.start_local_server(0)


def _request(method, path, body=None, headers=None, token=TOKEN):
    conn = http.client.HTTPConnection("127.0.0.1", desktop.SERVER_PORT)
    h = {}
    if token is not None:
        h["X-Tcode-Token"] = token
    if body is not None:
        h["Content-Type"] = "application/json"
        body = json.dumps(body)
    if headers:
        h.update(headers)
    conn.request(method, path, body=body, headers=h)
    res = conn.getresponse()
    data = res.read()
    conn.close()
    return res.status, data, dict(res.getheaders())


def test_health_open_without_token():
    status, data, _ = _request("GET", "/health", token=None)
    assert status == 200
    assert b"tcode" in data


def test_api_without_token_rejected():
    status, data, _ = _request("GET", "/api/fs/tree", token=None)
    assert status == 401
    assert b"UNAUTHORIZED" in data


def test_api_with_wrong_token_rejected():
    status, data, _ = _request("GET", "/api/fs/tree", token="wrong-token")
    assert status == 401
    assert b"UNAUTHORIZED" in data


def test_api_with_valid_token_passes_auth():
    # path sandbox is wired in Task 7; here we only assert auth is passed (400 from missing path, not 401)
    status, data, _ = _request("GET", "/api/fs/tree")
    assert status == 400
    assert b"UNAUTHORIZED" not in data


def test_index_html_contains_injected_token():
    status, data, _ = _request("GET", "/", token=None)
    assert status == 200
    assert b"__TCODE_HOST_TOKEN__" in data
    assert TOKEN.encode("ascii") in data


def test_evil_origin_preflight_denied():
    status, _, _ = _request("OPTIONS", "/api/fs/tree", token=None, headers={"Origin": "http://evil.example.com"})
    assert status == 403


def test_allowed_origin_preflight_ok():
    status, _, headers = _request(
        "OPTIONS", "/api/fs/tree", token=None, headers={"Origin": "http://localhost:5173"}
    )
    assert status == 200
    assert headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
