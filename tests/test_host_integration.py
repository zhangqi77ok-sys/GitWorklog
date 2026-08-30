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

import os
import shutil
import tempfile
import time
from urllib.parse import quote

import path_sandbox


def test_workspace_register_and_fs_boundary():
    path_sandbox.clear_roots()
    root = tempfile.mkdtemp(prefix="tcode_ws_")
    try:
        status, data, _ = _request("POST", "/api/workspace/register", {"paths": [root]})
        assert status == 200
        assert b'"registered"' in data

        status, data, _ = _request("GET", f"/api/fs/tree?path={quote(root)}")
        assert status == 200
        assert b"success" in data

        outside = tempfile.mkdtemp(prefix="tcode_outside_")
        try:
            status, data, _ = _request("GET", f"/api/fs/tree?path={quote(outside)}")
            assert status == 403
            assert b"PATH_OUTSIDE_WORKSPACE" in data
        finally:
            shutil.rmtree(outside, ignore_errors=True)
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_fs_write_boundary():
    path_sandbox.clear_roots()
    root = tempfile.mkdtemp(prefix="tcode_ws_")
    try:
        _request("POST", "/api/workspace/register", {"paths": [root]})
        inside = os.path.join(root, "a.txt")
        status, data, _ = _request("POST", "/api/fs/write", {"path": inside, "content": "hello"})
        assert status == 200
        assert os.path.isfile(inside)

        outside = os.path.join(tempfile.gettempdir(), f"tcode_escape_{int(time.time()*1000)}.txt")
        status, data, _ = _request("POST", "/api/fs/write", {"path": outside, "content": "evil"})
        assert status == 403
        assert not os.path.exists(outside)
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_terminal_cwd_boundary():
    path_sandbox.clear_roots()
    root = tempfile.mkdtemp(prefix="tcode_ws_")
    try:
        _request("POST", "/api/workspace/register", {"paths": [root]})
        status, data, _ = _request("POST", "/api/terminal/exec", {"command": "echo hi", "cwd": root})
        assert status == 200
        assert b"hi" in data

        outside = tempfile.gettempdir()
        status, data, _ = _request("POST", "/api/terminal/exec", {"command": "echo hi", "cwd": outside})
        assert status == 403
        assert b"PATH_OUTSIDE_WORKSPACE" in data
    finally:
        shutil.rmtree(root, ignore_errors=True)
