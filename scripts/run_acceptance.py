"""Tcode full-loop real acceptance runner (Iron Rule 1.5 closed loop).

Usage:
    .venv/Scripts/python.exe scripts/run_acceptance.py
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PY = ROOT / ".venv" / "Scripts" / "python.exe"
UV_PY = "C:/Users/13605/AppData/Roaming/uv/python/cpython-3.12.14-windows-x86_64-none/python.exe"
INSTALLER = ROOT / "dist" / "Tcode-Setup.exe"
SMOKE_DIR = ROOT / "smoke-acceptance"
HOST = "http://127.0.0.1:8010"

passed = 0
failed = 0


def check(name, fn):
    global passed, failed
    t0 = time.time()
    try:
        msg = fn()
        passed += 1
        print("  [PASS] " + name + " (" + str(int((time.time() - t0) * 1000)) + "ms): " + msg)
    except Exception as e:
        failed += 1
        print("  [FAIL] " + name + ": " + str(e))


def run(cmd, cwd=None, timeout=900):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                          encoding="utf-8", errors="replace")


def npm(args, cwd):
    node = shutil.which("node")
    if not node:
        raise RuntimeError("node not found on PATH")
    npm_cli = Path(node).resolve().parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
    if not npm_cli.is_file():
        raise RuntimeError("npm-cli.js not found at " + str(npm_cli))
    return run([node, str(npm_cli)] + args, cwd=cwd)


def http_get(path, headers=None, timeout=20):
    req = urllib.request.Request(HOST + path, method="GET")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def http_post(path, body, headers=None, timeout=30):
    req = urllib.request.Request(HOST + path, method="POST",
                                 data=json.dumps(body).encode("utf-8"))
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def http_get_allow(path, headers=None, timeout=20):
    try:
        return http_get(path, headers, timeout)
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def http_post_allow(path, body, headers=None, timeout=30):
    try:
        return http_post(path, body, headers, timeout)
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def stop_tcode():
    subprocess.run(["taskkill", "/F", "/IM", "Tcode.exe", "/T"], capture_output=True)
    time.sleep(2)


def fetch_token():
    _, body = http_get("/")
    marker = b"__TCODE_HOST_TOKEN__ = "
    i = body.find(marker)
    if i < 0:
        raise RuntimeError("token not injected in index.html")
    start = i + len(marker) + 1
    end = body.find(b'"', start)
    if end < 0:
        raise RuntimeError("token malformed")
    return body[start:end].decode("ascii")


def expect_ok(name, result):
    if result.returncode != 0:
        tail = (result.stdout or "")[-400:] + (result.stderr or "")[-400:]
        raise RuntimeError(name + " exited " + str(result.returncode) + ": " + tail)
    return name + " ok"


def main():
    print("=" * 80)
    print("Tcode full-loop acceptance (Iron Rule 1.5)")
    print("=" * 80)

    check("frontend unit tests (Vitest)", lambda: expect_ok("vitest", npm(["test"], ROOT / "prototype")))
    check("ESLint (0 errors)", lambda: expect_ok("lint", npm(["run", "lint"], ROOT / "prototype")))
    check("Python tests (pytest)", lambda: expect_ok("pytest", run([str(VENV_PY), "-m", "pytest", "tests", "-q"], cwd=ROOT)))
    check("incremental build", lambda: expect_ok("build", run([UV_PY, "build_installer.py"], cwd=ROOT)))

    def _install():
        stop_tcode()
        if SMOKE_DIR.exists():
            shutil.rmtree(SMOKE_DIR, ignore_errors=True)
        r = run([str(INSTALLER), "--silent-install-dir", str(SMOKE_DIR)], timeout=300)
        exe = SMOKE_DIR / "Tcode.exe"
        if r.returncode != 0:
            raise RuntimeError("installer exit " + str(r.returncode) + ": " + (r.stderr or "")[-500:])
        if not exe.is_file():
            raise RuntimeError("Tcode.exe not installed")
        build_time = (ROOT / "release" / "Tcode-Setup-v1.5.0.exe").stat().st_mtime
        if exe.stat().st_mtime < build_time - 5:
            raise RuntimeError("installed Tcode.exe is stale (install did not refresh)")
        return "installed: " + str(exe.stat().st_size) + " bytes"
    check("silent install + timestamp check", _install)

    def _launch():
        subprocess.Popen([str(SMOKE_DIR / "Tcode.exe")],
                         creationflags=0x08000000,
                         startupinfo=subprocess.STARTUPINFO())
        time.sleep(8)
        return "launched"
    check("launch Tcode.exe", _launch)

    def _health():
        st, body = http_get_allow("/health")
        assert st == 200 and b"tcode" in body, "health " + str(st)
        return "health " + str(st)
    check("/health -> 200", _health)

    def _index_token():
        st, body = http_get_allow("/")
        assert st == 200, "index " + str(st)
        assert b"__TCODE_HOST_TOKEN__" in body, "token not injected"
        assert fetch_token(), "token empty"
        return "index 200 + token"
    check("/ -> 200 with token", _index_token)

    def _no_token():
        st, _ = http_get_allow("/api/fs/tree")
        assert st == 401, "expected 401 got " + str(st)
        return "401"
    check("no token -> 401", _no_token)

    def _with_token():
        st, _ = http_get_allow("/api/fs/tree", {"X-Tcode-Token": fetch_token()})
        assert st != 401, "auth failed"
        return "auth passed (" + str(st) + ")"
    check("with token -> not 401", _with_token)

    def _models():
        st, body = http_get_allow("/api/proxy", {
            "X-Tcode-Token": fetch_token(),
            "x-target-url": "https://opencode.ai/zen/v1/models"
        }, timeout=40)
        assert st == 200 and b"mimo-v2.5-free" in body, "models " + str(st)
        return "200 (real upstream)"
    check("proxy allowlist -> opencode /models", _models)

    def _deny():
        st, _ = http_get_allow("/api/proxy", {
            "X-Tcode-Token": fetch_token(),
            "x-target-url": "http://192.168.1.1/x"
        })
        assert st == 403, "expected 403 got " + str(st)
        return "403"
    check("proxy malicious target -> 403", _deny)

    def _airgap():
        storage_dir = Path(os.environ.get("LOCALAPPDATA", "")) / "Tcode" / "storage"
        storage_dir.mkdir(parents=True, exist_ok=True)
        settings = storage_dir / "tcode_settings.json"
        had = settings.read_text(encoding="utf-8") if settings.exists() else None
        try:
            settings.write_text('{"isAirGapped": true}', encoding="utf-8")
            tok = fetch_token()
            st, body = http_post_allow("/api/terminal/exec", {"command": "curl https://example.com"},
                                       {"X-Tcode-Token": tok})
            payload = json.loads(body)
            assert st == 200 and payload.get("blocked") is True, "curl not blocked: " + str(body[:200])
            st, body = http_post_allow("/api/terminal/exec", {"command": "echo hi"}, {"X-Tcode-Token": tok})
            payload = json.loads(body)
            assert st == 200 and payload.get("exitCode") == 0, "echo blocked: " + str(body[:200])
            return "curl blocked / echo allowed"
        finally:
            if had is None:
                settings.unlink(missing_ok=True)
            else:
                settings.write_text(had, encoding="utf-8")
    check("Air-Gapped host enforcement", _airgap)

    stop_tcode()
    shutil.rmtree(SMOKE_DIR, ignore_errors=True)

    print("=" * 80)
    print("acceptance result: " + str(passed) + " passed, " + str(failed) + " failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
