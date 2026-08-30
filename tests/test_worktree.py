# -*- coding: utf-8 -*-
"""WP-E 模块六：git worktree 影子工作区端点集成测试（真实 git 仓库）。"""
import http.client
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import host_auth
import path_sandbox

spec = importlib.util.spec_from_file_location("desktop_app_worktree_test", SRC / "desktop_app.py")
desktop = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(desktop)

TOKEN = "worktree-test-token"


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


def _make_git_repo(tmp):
    repo = Path(tmp) / "proj"
    repo.mkdir()
    subprocess.run(["git", "init", "-b", "main"], cwd=repo, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@t.com"], cwd=repo, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=repo, capture_output=True)
    (repo / "a.txt").write_text("hello", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=repo, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=repo, capture_output=True)
    return repo


def test_worktree_create_list_remove_roundtrip():
    tmp = tempfile.mkdtemp()
    try:
        repo = _make_git_repo(tmp)
        path_sandbox.clear_roots()
        path_sandbox.register_roots([str(repo)])

        status, data, _ = _request("POST", "/api/git/worktree/create", {"projectPath": str(repo), "id": "shadow-fe"})
        assert status == 200, data
        payload = json.loads(data)
        assert payload["success"] is True
        shadow = Path(payload["shadowPath"])
        assert shadow.exists()
        assert (shadow / "a.txt").read_text(encoding="utf-8") == "hello"
        # Shadow dir must be registered into the sandbox so file ops on it are allowed.
        assert path_sandbox.is_within_roots(str(shadow))

        q = urllib.parse.quote(str(repo))
        status, data, _ = _request("GET", f"/api/git/worktree/list?projectPath={q}")
        assert status == 200, data
        payload = json.loads(data)
        paths = [w["path"].replace("\\", "/") for w in payload["worktrees"]]
        assert str(shadow).replace("\\", "/") in paths

        status, data, _ = _request("POST", "/api/git/worktree/remove", {"projectPath": str(repo), "id": "shadow-fe"})
        assert status == 200, data
        assert not shadow.exists()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        path_sandbox.clear_roots()


def test_worktree_create_outside_sandbox_denied():
    tmp = tempfile.mkdtemp()
    try:
        repo = _make_git_repo(tmp)
        path_sandbox.clear_roots()
        path_sandbox.register_roots([str(repo)])
        evil = Path(tmp) / "evil"
        evil.mkdir()
        status, data, _ = _request("POST", "/api/git/worktree/create", {"projectPath": str(evil), "id": "shadow-x"})
        assert status == 403, data
        assert b"PATH_OUTSIDE_WORKSPACE" in data
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        path_sandbox.clear_roots()


def test_worktree_create_non_git_rejected():
    tmp = tempfile.mkdtemp()
    try:
        repo = Path(tmp) / "proj"
        repo.mkdir()
        path_sandbox.clear_roots()
        path_sandbox.register_roots([str(repo)])
        status, data, _ = _request("POST", "/api/git/worktree/create", {"projectPath": str(repo), "id": "shadow-x"})
        assert status == 400, data
        assert b"NOT_A_GIT_REPOSITORY" in data
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        path_sandbox.clear_roots()


def test_worktree_without_token_rejected():
    status, data, _ = _request("GET", "/api/git/worktree/list", token=None)
    assert status == 401
    assert b"UNAUTHORIZED" in data
