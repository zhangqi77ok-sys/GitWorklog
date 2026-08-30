# WP1 · 桌面宿主安全加固实施计划 (Host Security Hardening)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除桌面宿主（127.0.0.1:8010）的四大安全缺陷——零鉴权+CORS `*`、凭据明文落盘、路径无边界、开放 SSRF 代理，使所有 `/api/*` 接口 fail-closed 鉴权，凭据 DPAPI 加密，文件/代理受策略约束。

**Architecture:** 新增 4 个纯逻辑 Python 模块（`host_auth` / `credential_crypto` / `path_sandbox` / `proxy_policy`），由 `desktop_app.py` 的 `QuietHandler` 统一接入；前端在 `main.tsx` 启动时安装全局 `window.fetch` 拦截器统一注入 Token（覆盖全部 30+ 处 `/api/*` 调用点），存储敏感项显式标记、工作区根启动时注册。全部为标准库实现（DPAPI 用 ctypes 直调 crypt32），零新增运行时依赖。

**Tech Stack:** Python 3.12（uv 管理）+ ctypes/DPAPI + http.server；TypeScript/React 19 + Vitest；pytest（测试 venv 依赖）。

## Global Constraints

- **构建/打包 Python（`$PY`）**：`C:\Users\13605\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe`（uv 托管，受 PEP 668 保护，**禁止向其 pip 安装包**；仅用于 `build_installer.py`）。
- **测试 Python（`$VPY`）**：`E:\pro\agent-learning\.venv\Scripts\python.exe`（`uv venv --python $PY --system-site-packages` 创建，已装 pytest；webview 从系统 site-packages 复用）。**所有 pytest 命令必须用 `$VPY`。**
- 前端测试命令：`node <npm-cli.js> test`（npm.ps1 被执行策略拦截，禁止裸 `npm`）。
- 版本：`build_installer.VERSION == "1.5.0"`，不得改动。
- 凭据纪律：源码/测试中不得出现 `sk-[A-Za-z0-9_-]{16,}` 字面量（credentialHygiene 扫描）；测试用假凭据统一写作 `fake-api-key-0123456789abcdef`。
- 禁止新增运行时依赖；pytest 仅装入测试 venv，不进 `build_installer.py` 打包。
- 每个任务完成必须跑绿对应测试并 `git commit`；全部任务完成后按铁律 1.5 打包+安装+真实桌面探活。
- 所有安全拦截返回结构化 JSON `{"error": "<CODE>", "code": <http>}`，CODE ∈ UNAUTHORIZED / ORIGIN_DENIED / HOST_DENIED / PATH_OUTSIDE_WORKSPACE / PROXY_TARGET_DENIED。
- `/health` 保持开放（不校验 Token），保证铁律 1.5 探活命令不变。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src-desktop/host_auth.py` | 新增 | Token 生成/校验、Origin 白名单、Host 头校验 |
| `src-desktop/credential_crypto.py` | 新增 | DPAPI 加解密 + 加密信封 |
| `src-desktop/path_sandbox.py` | 新增 | 工作区根注册表 + 路径边界校验 |
| `src-desktop/proxy_policy.py` | 新增 | 上游目标白名单 + 重定向校验 |
| `src-desktop/desktop_app.py` | 修改 | 接入上述模块；Token 注入 index.html；CORS 收紧；`/api/workspace/register` |
| `prototype/src/services/hostClient.ts` | 新增 | Token 作用域判定 + 全局 fetch 拦截器 + 显式 hostFetch |
| `prototype/src/main.tsx` | 修改 | 启动时安装全局 fetch 拦截器 |
| `prototype/src/types/contracts.ts` | 修改 | `saveToDiskStorageAsync` 支持 `sensitive`；`resolveApiEndpoint` 附 Token |
| `prototype/src/services/gateway/store.ts` | 修改 | `saveGatewayState` 标记 `sensitive: true` |
| `prototype/src/App.tsx` | 修改 | 挂载时注册已保存工程根 |
| `tests/test_credential_crypto.py` | 新增 | DPAPI 加解密/信封单测 |
| `tests/test_host_security.py` | 新增 | host_auth/path_sandbox/proxy_policy 纯逻辑单测 |
| `tests/test_host_integration.py` | 新增 | 起真实 HTTP 服务的集成测试（鉴权/路径/代理/存储） |
| `prototype/tests/hostSecurity.test.ts` | 新增 | 前端 Token 作用域/敏感标记断言 |
| `README.md` | 修改 | 补一节「本地宿主安全模型」说明 |

---

### Task 1: pytest 测试环境就绪

**Files:**
- Test: 无（环境准备；验证 `tests/` 既有 3 个测试文件可运行）

**Interfaces:**
- Consumes: 无
- Produces: `$VPY -m pytest` 可用；后续所有 Python 任务都用它跑测试

- [ ] **Step 1: 创建测试 venv 并安装 pytest**

uv 托管的 Python 受 PEP 668 保护，禁止直接 pip 写入；用 `--system-site-packages` 复用 webview 等既有包。

```powershell
$PY = "C:\Users\13605\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe"
$uv = "C:\Users\13605\AppData\Local\Programs\uv\uv.exe"
& $uv venv --python $PY --system-site-packages E:\pro\agent-learning\.venv
& $uv pip install --python E:\pro\agent-learning\.venv\Scripts\python.exe pytest
```

Expected: 创建 `.venv` 并安装 pytest（版本 9.x）。

- [ ] **Step 2: 验证测试 venv 可用（webview 复用 + pytest 可导入）**

```powershell
& E:\pro\agent-learning\.venv\Scripts\python.exe -c "import webview, pytest; print('webview ok; pytest', pytest.__version__)"
```

Expected: 输出 `webview ok; pytest 9.x`。

- [ ] **Step 3: 验证既有 Python 测试基线**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests -q
Pop-Location
```

Expected: `tests/` 下 `test_build_installer.py`、`test_setup_wizard.py`、`test_window_geometry.py` 全部通过（9 passed）。

- [ ] **Step 4: 提交环境基线（无代码变更时跳过本步）**

---

### Task 2: `credential_crypto.py`（DPAPI 加解密 + 信封）

**Files:**
- Create: `src-desktop/credential_crypto.py`
- Test: `tests/test_credential_crypto.py`

**Interfaces:**
- Consumes: 无
- Produces:
  - `protect_bytes(data: bytes) -> bytes`（DPAPI 加密，Windows 用户级）
  - `unprotect_bytes(blob: bytes) -> bytes`
  - `encrypt_text(plain: str) -> str`（base64 输出）
  - `decrypt_text(encoded: str) -> str`
  - `is_encrypted_envelope(value) -> bool`（`{"__tcode_enc__": true, ...}`）
  - `make_envelope(plain: str) -> dict` → `{"__tcode_enc__": True, "alg": "dpapi", "v": "<base64>"}`
  - `unwrap_envelope(envelope: dict) -> str`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_credential_crypto.py`：

```python
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import credential_crypto


def test_roundtrip_encrypt_decrypt():
    plain = "fake-api-key-0123456789abcdef"
    enc = credential_crypto.encrypt_text(plain)
    assert enc != plain
    assert plain not in enc
    assert credential_crypto.decrypt_text(enc) == plain


def test_protect_unprotect_bytes_roundtrip():
    blob = credential_crypto.protect_bytes(b"hello-dpapi")
    assert blob != b"hello-dpapi"
    assert credential_crypto.unprotect_bytes(blob) == b"hello-dpapi"


def test_envelope_make_unwrap():
    env = credential_crypto.make_envelope("secret-value")
    assert credential_crypto.is_encrypted_envelope(env)
    assert credential_crypto.unwrap_envelope(env) == "secret-value"


def test_plain_dict_is_not_envelope():
    assert not credential_crypto.is_encrypted_envelope({"apiKey": "fake-api-key-0123456789abcdef"})
    assert not credential_crypto.is_encrypted_envelope(None)
```

- [ ] **Step 2: 运行测试确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_credential_crypto.py -q
Pop-Location
```

Expected: `ModuleNotFoundError: No module named 'credential_crypto'`（或 collection error）。

- [ ] **Step 3: 最小实现**

创建 `src-desktop/credential_crypto.py`：

```python
"""Windows DPAPI credential encryption (ctypes, zero runtime deps)."""
import base64
import ctypes
import os
from ctypes import wintypes


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


CRYPTPROTECT_UI_FORBIDDEN = 0x1


def _blob(data: bytes) -> DATA_BLOB:
    buf = ctypes.create_string_buffer(data, len(data))
    return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))


def protect_bytes(data: bytes) -> bytes:
    if os.name != "nt":
        raise NotImplementedError("DPAPI is Windows-only")
    blob_in = _blob(data)
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(blob_in), None, None, None, None,
        CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(blob_out),
    ):
        raise OSError("CryptProtectData failed")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)


def unprotect_bytes(blob: bytes) -> bytes:
    if os.name != "nt":
        raise NotImplementedError("DPAPI is Windows-only")
    blob_in = _blob(blob)
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out),
    ):
        raise OSError("CryptUnprotectData failed")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)


def encrypt_text(plain: str) -> str:
    return base64.b64encode(protect_bytes(plain.encode("utf-8"))).decode("ascii")


def decrypt_text(encoded: str) -> str:
    return unprotect_bytes(base64.b64decode(encoded)).decode("utf-8")


def is_encrypted_envelope(value) -> bool:
    return isinstance(value, dict) and value.get("__tcode_enc__") is True


def make_envelope(plain: str) -> dict:
    return {"__tcode_enc__": True, "alg": "dpapi", "v": encrypt_text(plain)}


def unwrap_envelope(envelope: dict) -> str:
    return decrypt_text(envelope["v"])
```

- [ ] **Step 4: 运行测试确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_credential_crypto.py -q
Pop-Location
```

Expected: 4 passed。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/credential_crypto.py tests/test_credential_crypto.py
git commit -m "feat(security): DPAPI credential encryption module (A2)"
```

### Task 3: `host_auth.py`（Token 生成/校验、Origin 白名单、Host 校验）

**Files:**
- Create: `src-desktop/host_auth.py`
- Test: `tests/test_host_security.py`（本任务先加入 host_auth 用例组）

**Interfaces:**
- Consumes: 无
- Produces:
  - `init_token() -> str`（生成并保存 ≥32 字符随机 Token，返回之）
  - `set_token(token: str) -> None`（测试注入用）
  - `get_token() -> str`
  - `token_is_valid(header_value: str | None) -> bool`（恒定时间比较）
  - `origin_is_allowed(origin: str | None) -> bool`（None = 同源，放行）
  - `host_is_allowed(host_header: str | None, port: int) -> bool`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_host_security.py`（Task 4/5 会继续往里加用例组）：

```python
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import host_auth


def test_init_token_generates_and_roundtrips():
    tok = host_auth.init_token()
    assert tok and len(tok) >= 32
    assert host_auth.get_token() == tok
    assert host_auth.token_is_valid(tok)


def test_token_validation_fail_closed():
    host_auth.set_token("test-token-123")
    assert host_auth.token_is_valid("test-token-123")
    assert not host_auth.token_is_valid("wrong-token")
    assert not host_auth.token_is_valid(None)
    assert not host_auth.token_is_valid("")
    assert not host_auth.token_is_valid("test-token-1234")


def test_origin_whitelist():
    assert host_auth.origin_is_allowed("http://127.0.0.1:8010")
    assert host_auth.origin_is_allowed("http://localhost:8010")
    assert host_auth.origin_is_allowed("http://localhost:5173")
    assert host_auth.origin_is_allowed("http://127.0.0.1:5173")
    assert host_auth.origin_is_allowed(None)
    assert not host_auth.origin_is_allowed("http://evil.example.com")
    assert not host_auth.origin_is_allowed("https://api.openai.com")


def test_host_header_validation():
    assert host_auth.host_is_allowed("127.0.0.1:8010", 8010)
    assert host_auth.host_is_allowed("localhost:8010", 8010)
    assert not host_auth.host_is_allowed("evil.example.com:8010", 8010)
    assert not host_auth.host_is_allowed("127.0.0.1:9999", 8010)
    assert not host_auth.host_is_allowed(None, 8010)
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: `ModuleNotFoundError: No module named 'host_auth'`。

- [ ] **Step 3: 最小实现**

创建 `src-desktop/host_auth.py`：

```python
"""Host authentication & request policy for the local desktop HTTP server."""
import hmac
import secrets

HOST_TOKEN: str = ""

ALLOWED_ORIGINS = {
    "http://127.0.0.1:8010",
    "http://localhost:8010",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}

ALLOWED_HOST_NAMES = {"127.0.0.1", "localhost"}


def init_token() -> str:
    global HOST_TOKEN
    HOST_TOKEN = secrets.token_urlsafe(32)
    return HOST_TOKEN


def set_token(token: str) -> None:
    global HOST_TOKEN
    HOST_TOKEN = token


def get_token() -> str:
    return HOST_TOKEN


def token_is_valid(header_value: str | None) -> bool:
    if not header_value or not HOST_TOKEN:
        return False
    return hmac.compare_digest(header_value, HOST_TOKEN)


def origin_is_allowed(origin: str | None) -> bool:
    if origin is None:
        return True  # same-origin / non-browser request
    return origin in ALLOWED_ORIGINS


def host_is_allowed(host_header: str | None, port: int) -> bool:
    if not host_header:
        return False
    name, _, port_str = host_header.rpartition(":")
    if not name:
        return False
    if port_str != str(port):
        return False
    return name.lower() in ALLOWED_HOST_NAMES
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: 4 passed。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/host_auth.py tests/test_host_security.py
git commit -m "feat(security): host token auth, origin whitelist, host header check (A1)"
```

---

### Task 4: `path_sandbox.py`（工作区根注册表 + 路径边界）

**Files:**
- Create: `src-desktop/path_sandbox.py`
- Test: `tests/test_host_security.py`（追加 path_sandbox 用例组）

**Interfaces:**
- Consumes: 无
- Produces:
  - `register_roots(paths: list[str]) -> int`（规范化去重后追加，返回新增数）
  - `clear_roots() -> None`（测试用）
  - `is_within_roots(target: str) -> bool`
  - `assert_path_allowed(target: str) -> None`（越界抛 `PathSandboxError`）
  - `class PathSandboxError(Exception)`

- [ ] **Step 1: 追加失败测试**

在 `tests/test_host_security.py` 末尾追加：

```python
import os
import path_sandbox


def test_path_within_root_allowed():
    path_sandbox.clear_roots()
    path_sandbox.register_roots([r"C:\workspace\proj"])
    assert path_sandbox.is_within_roots(r"C:\workspace\proj")
    assert path_sandbox.is_within_roots(r"C:\workspace\proj\src\a.ts")
    assert path_sandbox.is_within_roots(r"C:\workspace\proj\sub\deep\b.ts")


def test_path_escape_rejected():
    path_sandbox.clear_roots()
    path_sandbox.register_roots([r"C:\workspace\proj"])
    assert not path_sandbox.is_within_roots(r"C:\workspace\proj2\secret.txt")
    assert not path_sandbox.is_within_roots(r"C:\workspace\other")
    assert not path_sandbox.is_within_roots(r"C:\Windows\system32\cmd.exe")
    assert not path_sandbox.is_within_roots("")
    assert not path_sandbox.is_within_roots(None)


def test_path_case_insensitive_on_windows():
    path_sandbox.clear_roots()
    path_sandbox.register_roots([r"c:\workspace\proj"])
    if os.name == "nt":
        assert path_sandbox.is_within_roots(r"C:\Workspace\Proj\file.txt")
    else:
        assert not path_sandbox.is_within_roots(r"C:\Workspace\Proj\file.txt")


def test_assert_path_allowed_raises():
    path_sandbox.clear_roots()
    path_sandbox.register_roots([r"C:\workspace\proj"])
    try:
        path_sandbox.assert_path_allowed(r"C:\Windows\system32")
        assert False, "should have raised"
    except path_sandbox.PathSandboxError:
        pass


def test_register_roots_dedupes():
    path_sandbox.clear_roots()
    n1 = path_sandbox.register_roots([r"C:\a", r"C:\a", r"C:\b"])
    assert n1 == 2
    assert path_sandbox.is_within_roots(r"C:\a\x.txt")
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: `ModuleNotFoundError: No module named 'path_sandbox'`。

- [ ] **Step 3: 最小实现**

创建 `src-desktop/path_sandbox.py`：

```python
"""Workspace root registry & path boundary enforcement."""
import os

_roots: list[str] = []


def _norm(path: str) -> str:
    return os.path.normcase(os.path.normpath(os.path.realpath(path)))


def register_roots(paths) -> int:
    added = 0
    for p in paths or []:
        if not p:
            continue
        real = _norm(str(p))
        if real and real not in _roots:
            _roots.append(real)
            added += 1
    return added


def clear_roots() -> None:
    _roots.clear()


def is_within_roots(target) -> bool:
    if not target:
        return False
    real = _norm(str(target))
    for root in _roots:
        if real == root or real.startswith(root + os.sep):
            return True
    return False


class PathSandboxError(Exception):
    pass


def assert_path_allowed(target: str) -> None:
    if not is_within_roots(target):
        raise PathSandboxError(f"Path outside registered workspaces: {target}")
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: 9 passed（4 host_auth + 5 path_sandbox）。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/path_sandbox.py tests/test_host_security.py
git commit -m "feat(security): workspace root registry and path boundary enforcement (A3)"
```

---

### Task 5: `proxy_policy.py`（上游目标白名单 + 重定向校验）

**Files:**
- Create: `src-desktop/proxy_policy.py`
- Test: `tests/test_host_security.py`（追加 proxy_policy 用例组）

**Interfaces:**
- Consumes: 无
- Produces:
  - `DEFAULT_ALLOWED_HOSTS: set[str]`
  - `is_allowed_target(url: str, extra_hosts: set[str] | None = None) -> tuple[bool, str]`（(放行, 拒绝原因)；原因为空串表示放行）
  - `extract_extra_hosts(providers_payload) -> set[str]`（从存储载荷提取 baseUrl 主机）

- [ ] **Step 1: 追加失败测试**

在 `tests/test_host_security.py` 末尾追加：

```python
import proxy_policy


def test_known_vendor_allowed():
    ok, reason = proxy_policy.is_allowed_target("https://api.openai.com/v1/models")
    assert ok, reason
    ok, reason = proxy_policy.is_allowed_target("https://opencode.ai/zen/v1/models")
    assert ok, reason
    ok, reason = proxy_policy.is_allowed_target("https://api.anthropic.com/v1/messages")
    assert ok, reason
    ok, reason = proxy_policy.is_allowed_target("https://api.deepseek.com/v1/chat/completions")
    assert ok, reason


def test_unknown_host_denied():
    ok, reason = proxy_policy.is_allowed_target("https://evil.example.com/x")
    assert not ok
    assert reason


def test_internal_ip_denied():
    ok, _ = proxy_policy.is_allowed_target("http://192.168.1.10:8080/x")
    assert not ok
    ok, _ = proxy_policy.is_allowed_target("http://10.0.0.1/x")
    assert not ok
    ok, _ = proxy_policy.is_allowed_target("http://169.254.169.254/latest/meta-data")
    assert not ok


def test_http_only_for_local_hosts():
    ok, _ = proxy_policy.is_allowed_target("http://127.0.0.1:11434/v1/models")
    assert ok
    ok, _ = proxy_policy.is_allowed_target("http://localhost:11434/v1/models")
    assert ok
    ok, reason = proxy_policy.is_allowed_target("http://api.openai.com/v1/models")
    assert not ok
    assert reason


def test_url_with_credentials_denied():
    ok, _ = proxy_policy.is_allowed_target("https://user:pass@api.openai.com/v1")
    assert not ok


def test_extra_hosts_custom_gateway():
    ok, _ = proxy_policy.is_allowed_target("https://my-gateway.example.com/v1", extra_hosts={"my-gateway.example.com"})
    assert ok
    ok, _ = proxy_policy.is_allowed_target("https://my-gateway.example.com/v1")
    assert not ok


def test_subdomain_allowed():
    ok, _ = proxy_policy.is_allowed_target("https://sub.opencode.ai/x")
    assert ok


def test_extract_extra_hosts():
    payload = [
        {"id": "p1", "baseUrl": "https://my-gateway.example.com/v1"},
        {"id": "p2", "baseUrl": "http://127.0.0.1:11434/v1"},
        {"id": "p3", "baseUrl": None},
    ]
    hosts = proxy_policy.extract_extra_hosts(payload)
    assert "my-gateway.example.com" in hosts
    assert "127.0.0.1" not in hosts  # local hosts already allowed
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: `ModuleNotFoundError: No module named 'proxy_policy'`。

- [ ] **Step 3: 最小实现**

创建 `src-desktop/proxy_policy.py`：

```python
"""SSRF guard: upstream target allowlist for the local /api/proxy relay."""
import ipaddress
from urllib.parse import urlparse

DEFAULT_ALLOWED_HOSTS = {
    "opencode.ai", "api.openai.com", "auth.openai.com", "chatgpt.com",
    "api.anthropic.com", "platform.claude.com", "claude.ai",
    "api.x.ai", "accounts.x.ai",
    "generativelanguage.googleapis.com",
    "api.deepseek.com", "api.moonshot.cn", "api.dashscope.aliyuncs.com",
    "api.siliconflow.cn", "api.z.ai",
}

LOCAL_HOSTS = {"127.0.0.1", "localhost", "0.0.0.0", "::1"}


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_allowed_target(url: str, extra_hosts=None) -> tuple:
    extra_hosts = extra_hosts or set()
    try:
        parsed = urlparse(url)
    except ValueError:
        return False, "MALFORMED_URL"
    if parsed.scheme not in ("https", "http"):
        return False, "SCHEME_NOT_ALLOWED"
    if parsed.username or parsed.password:
        return False, "URL_WITH_CREDENTIALS"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "EMPTY_HOST"
    if host in LOCAL_HOSTS:
        if parsed.scheme != "http":
            return False, "LOCAL_HOST_MUST_BE_HTTP"
        return True, ""
    if parsed.scheme != "https":
        return False, "NON_LOCAL_HTTP_DENIED"
    if _is_ip_literal(host):
        return False, "IP_LITERAL_DENIED"
    if host in DEFAULT_ALLOWED_HOSTS or host in extra_hosts:
        return True, ""
    for allowed in (DEFAULT_ALLOWED_HOSTS | extra_hosts):
        if host.endswith("." + allowed):
            return True, ""
    return False, "HOST_NOT_ALLOWLISTED"


def extract_extra_hosts(providers_payload) -> set:
    hosts = set()
    for p in providers_payload or []:
        base = (p or {}).get("baseUrl")
        if not base:
            continue
        try:
            parsed = urlparse(str(base))
        except ValueError:
            continue
        h = (parsed.hostname or "").lower()
        if h and h not in LOCAL_HOSTS:
            hosts.add(h)
    return hosts
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_security.py -q
Pop-Location
```

Expected: 17 passed（4 host_auth + 5 path_sandbox + 8 proxy_policy）。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/proxy_policy.py tests/test_host_security.py
git commit -m "feat(security): upstream proxy allowlist SSRF guard (A4)"
```

### Task 6: `desktop_app.py` 集成 A1（鉴权 + CORS 收紧 + Token 注入 index.html）

**Files:**
- Modify: `src-desktop/desktop_app.py`
- Test: `tests/test_host_integration.py`（新建；后续任务继续扩展）

**Interfaces:**
- Consumes: `host_auth.init_token / token_is_valid / origin_is_allowed / host_is_allowed / get_token`
- Produces:
  - `desktop_app.SERVER_PORT: int`（模块级全局，绑定后的真实端口）
  - `start_local_server(port=PORT) -> int`（改为返回真实绑定端口）
  - `QuietHandler._send_json(status, payload)`、`QuietHandler._apply_cors()`、`QuietHandler._guard() -> bool`、`QuietHandler._serve_index()`
  - 前端 `window.__TCODE_HOST_TOKEN__` 注入

- [ ] **Step 1: 写失败测试**

创建 `tests/test_host_integration.py`：

```python
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
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 多数用例失败（无 `SERVER_PORT`、无鉴权、CORS 仍为 `*`、无 Token 注入）。

- [ ] **Step 3: 最小实现（修改 `src-desktop/desktop_app.py`）**

3.1 在文件顶部 import 区之后加入：

```python
import host_auth
import credential_crypto
import path_sandbox
import proxy_policy

SERVER_PORT = PORT
```

3.2 在 `QuietHandler` 类内新增辅助方法（放在 `log_message` 之后）：

```python
    def _send_json(self, status: int, payload: dict) -> None:
        self.send_response(status)
        self._apply_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _apply_cors(self) -> None:
        origin = self.headers.get("Origin")
        if origin is not None and host_auth.origin_is_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _guard(self) -> bool:
        origin = self.headers.get("Origin")
        if origin is not None and not host_auth.origin_is_allowed(origin):
            self._send_json(403, {"error": "ORIGIN_DENIED", "code": 403})
            return False
        if not host_auth.host_is_allowed(self.headers.get("Host"), SERVER_PORT):
            self._send_json(403, {"error": "HOST_DENIED", "code": 403})
            return False
        if not host_auth.token_is_valid(self.headers.get("X-Tcode-Token")):
            self._send_json(401, {"error": "UNAUTHORIZED", "code": 401})
            return False
        return True

    def _serve_index(self) -> None:
        dist = get_dist_path()
        index = dist / "index.html"
        try:
            html = index.read_text(encoding="utf-8")
        except Exception:
            return super().do_GET()
        token = host_auth.get_token()
        if token:
            script = f'<script>window.__TCODE_HOST_TOKEN__ = "{token}";</script>'
            if "</head>" in html:
                html = html.replace("</head>", script + "</head>", 1)
            else:
                html = script + html
        data = html.encode("utf-8")
        self.send_response(200)
        self._apply_cors()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
```

3.3 重写 `do_OPTIONS`：

```python
    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if origin is None or not host_auth.origin_is_allowed(origin):
            self._send_json(403, {"error": "ORIGIN_DENIED", "code": 403})
            return
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Tcode-Token, Authorization")
        self.end_headers()
```

3.4 在 `do_GET` 开头（`parsed = urllib.parse.urlparse(self.path)` 之后）插入：

```python
        if parsed.path in ("/", "/index.html"):
            self._serve_index()
            return
        if parsed.path.startswith("/api/"):
            if not self._guard():
                return
```

3.5 在 `do_POST` 开头插入：

```python
        if self.path.startswith("/api/") and not self._guard():
            return
```

3.6 全文件把每一处 `self.send_header('Access-Control-Allow-Origin', '*')` 替换为 `self._apply_cors()`；删除残留的 `Access-Control-Allow-Methods`/`Access-Control-Allow-Headers` 通配行（OPTIONS 已在 3.3 重写，其余处如有则删）。

3.7 修改 `start_local_server`：

```python
def start_local_server(port=PORT):
    global SERVER_PORT
    try:
        httpd = socketserver.TCPServer((HOST, port), QuietHandler)
    except OSError as error:
        raise RuntimeError(f'无法绑定 {HOST}:{port}，请释放端口后重试') from error
    SERVER_PORT = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return SERVER_PORT
```

3.8 在 `if __name__ == '__main__':` 块开头调用：

```python
    host_auth.init_token()
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 7 passed。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/desktop_app.py tests/test_host_integration.py
git commit -m "feat(security): enforce host token, tighten CORS, inject token into index.html (A1)"
```

---

### Task 7: `desktop_app.py` 集成 A3（路径沙箱 + `/api/workspace/register`）

**Files:**
- Modify: `src-desktop/desktop_app.py`
- Test: `tests/test_host_integration.py`（追加用例）

**Interfaces:**
- Consumes: `path_sandbox.register_roots / assert_path_allowed / PathSandboxError / clear_roots`
- Produces: `POST /api/workspace/register` 端点；fs/git/tests/terminal(cwd) 越界 403

- [ ] **Step 1: 追加失败测试**

在 `tests/test_host_integration.py` 末尾追加：

```python
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
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 新增 3 个用例失败（无 register 端点、无边界校验）。

- [ ] **Step 3: 最小实现（修改 `src-desktop/desktop_app.py`）**

3.1 在 `do_POST` 中、`/api/terminal/exec` 分支之前新增 register 端点：

```python
        if self.path == '/api/workspace/register':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                paths = payload.get('paths') or []
                registered = path_sandbox.register_roots(paths)
                self._send_json(200, {'success': True, 'registered': registered})
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return
```

3.2 `do_GET` 各分支加入根校验（放在已有「参数缺失/路径不存在」早退分支**之后**，保证空路径仍返回 400/404、真实路径越界才 403）：
- `/api/fs/tree`：在 `if not target_path or not Path(target_path).exists(): ... 400` 之后插入
  `try: path_sandbox.assert_path_allowed(target_path); except path_sandbox.PathSandboxError: self._send_json(403, {"error": "PATH_OUTSIDE_WORKSPACE", "code": 403}); return`
- `/api/fs/read`：在 `if not file_path or not Path(file_path).is_file(): ... 404` 之后插入同样的校验（`file_path`）
- `/api/fs/search`：在「参数缺失返回空结果」早退之后插入同样的校验（`target_path`）

3.3 `do_POST` 各分支加入根校验：
- `/api/fs/write`：`try: path_sandbox.assert_path_allowed(file_path); except ... 403; return`（放在解析出 `file_path` 之后、写盘之前）
- `/api/terminal/exec`：若 `payload.get('cwd')` 非空则校验之；空则跳过（保持默认 cwd）
- `/api/git/checkpoint`：校验 `project_path`（`payload.get('projectPath') or os.getcwd()` 之后、使用之前）
- `/api/git/revert`：校验 `project_path`

3.4 `/api/git/status`（do_GET）：仅当请求显式携带 `path` 查询参数时校验之；未携带（使用默认回退路径）时不校验（默认回退是宿主自目录，非用户工作区）。

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 10 passed（7 旧 + 3 新）。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/desktop_app.py tests/test_host_integration.py
git commit -m "feat(security): enforce workspace path boundary on fs/git/terminal (A3)"
```

### Task 8: `desktop_app.py` 集成 A4（代理白名单）

**Files:**
- Modify: `src-desktop/desktop_app.py`
- Test: `tests/test_host_integration.py`（追加用例）

**Interfaces:**
- Consumes: `proxy_policy.is_allowed_target / extract_extra_hosts`
- Produces: `/api/proxy` 目标校验；重定向后二次校验

- [ ] **Step 1: 追加失败测试**

在 `tests/test_host_integration.py` 末尾追加：

```python
def test_proxy_allowed_local_target():
    status, data, _ = _request(
        "GET", "/api/proxy",
        headers={"x-target-url": f"http://127.0.0.1:{desktop.SERVER_PORT}/health"},
    )
    assert status == 200
    assert b"tcode" in data


def test_proxy_denied_internal_ip():
    status, data, _ = _request(
        "GET", "/api/proxy",
        headers={"x-target-url": "http://192.168.1.1/x"},
    )
    assert status == 403
    assert b"PROXY_TARGET_DENIED" in data


def test_proxy_denied_unknown_host():
    status, data, _ = _request(
        "GET", "/api/proxy",
        headers={"x-target-url": "https://evil.example.com/x"},
    )
    assert status == 403
    assert b"PROXY_TARGET_DENIED" in data
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 新增 3 个用例失败（`test_proxy_denied_*` 会返回 200/上游错误而非 403）。

- [ ] **Step 3: 最小实现（修改 `src-desktop/desktop_app.py`）**

3.1 在 `do_GET` 的 `/api/proxy` 分支开头（解析出 `target_url` 之后、`urllib.request.Request` 之前）插入：

```python
            extra_hosts = set()
            for cfg_file in ('codemind_providers.json', 'codemind_gateway_v2.json'):
                try:
                    cfg_path = get_storage_dir() / cfg_file
                    if cfg_path.is_file():
                        payload = json.loads(cfg_path.read_text(encoding='utf-8'))
                        if credential_crypto.is_encrypted_envelope(payload):
                            payload = json.loads(credential_crypto.unwrap_envelope(payload))
                        extra_hosts |= proxy_policy.extract_extra_hosts(
                            payload if isinstance(payload, list)
                            else payload.get('providers') or payload.get('accounts') or []
                        )
                except Exception:
                    pass
            ok, reason = proxy_policy.is_allowed_target(target_url, extra_hosts)
            if not ok:
                self._send_json(403, {'error': 'PROXY_TARGET_DENIED', 'code': 403, 'reason': reason})
                return
```

3.2 在 `urlopen` 成功拿到 `resp` 后、写响应前插入重定向二次校验（在 `with urllib.request.urlopen(...) as resp:` 块内、`while` 循环前）：

```python
                final_url = resp.geturl()
                ok_final, _ = proxy_policy.is_allowed_target(final_url, extra_hosts)
                if not ok_final:
                    resp.close()
                    self._send_json(403, {'error': 'PROXY_TARGET_DENIED', 'code': 403, 'reason': 'REDIRECT_ESCAPE'})
                    return
```

3.3 `do_POST` 的 `/api/proxy` 分支：同样在发请求前做 `is_allowed_target` 校验（该校验逻辑与 3.1 相同，抽成局部函数 `_proxy_guard(target_url, extra_hosts)` 复用，避免两处复制）。

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 13 passed。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/desktop_app.py tests/test_host_integration.py
git commit -m "feat(security): enforce proxy target allowlist and redirect re-check (A4)"
```

---

### Task 9: `desktop_app.py` 集成 A2（存储敏感加密）

**Files:**
- Modify: `src-desktop/desktop_app.py`
- Test: `tests/test_host_integration.py`（追加用例）

**Interfaces:**
- Consumes: `credential_crypto.make_envelope / is_encrypted_envelope / unwrap_envelope`
- Produces: `/api/storage` 写支持 `sensitive: true`；读自动解密信封

- [ ] **Step 1: 追加失败测试**

在 `tests/test_host_integration.py` 末尾追加：

```python
def test_storage_sensitive_encrypted_at_rest():
    key = "tcode_test_secret"
    secret = "fake-api-key-0123456789abcdef"
    status, data, _ = _request("POST", "/api/storage", {"key": key, "data": {"apiKey": secret}, "sensitive": True})
    assert status == 200

    storage_file = desktop.get_storage_dir() / f"{key}.json"
    raw = storage_file.read_text(encoding="utf-8")
    assert secret not in raw
    assert "__tcode_enc__" in raw

    status, data, _ = _request("GET", f"/api/storage?key={key}")
    body = json.loads(data)
    assert body.get("success") is True
    assert body["data"]["apiKey"] == secret
    storage_file.unlink(missing_ok=True)


def test_storage_nonsensitive_plaintext():
    key = "tcode_test_plain"
    status, data, _ = _request("POST", "/api/storage", {"key": key, "data": {"theme": "warm"}})
    assert status == 200
    storage_file = desktop.get_storage_dir() / f"{key}.json"
    raw = storage_file.read_text(encoding="utf-8")
    assert "warm" in raw
    assert "__tcode_enc__" not in raw
    storage_file.unlink(missing_ok=True)
```

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: `test_storage_sensitive_encrypted_at_rest` 失败（明文落盘，`secret in raw` 为 True）。

- [ ] **Step 3: 最小实现（修改 `src-desktop/desktop_app.py`）**

3.1 `do_POST` 的 `/api/storage` 分支，写盘前：

```python
                if payload.get('sensitive'):
                    data = credential_crypto.make_envelope(json.dumps(data, ensure_ascii=False))
```

3.2 `do_GET` 的 `/api/storage` 分支，读盘解析后：

```python
                    data = json.loads(target_file.read_text(encoding='utf-8'))
                    if credential_crypto.is_encrypted_envelope(data):
                        data = json.loads(credential_crypto.unwrap_envelope(data))
```

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests/test_host_integration.py -q
Pop-Location
```

Expected: 15 passed。

- [ ] **Step 5: 提交**

```powershell
git add src-desktop/desktop_app.py tests/test_host_integration.py
git commit -m "feat(security): DPAPI-encrypt sensitive storage payloads at rest (A2)"
```

### Task 10: 前端 Token 全局注入 + 敏感存储标记 + 工作区注册

**Files:**
- Create: `prototype/src/services/hostClient.ts`
- Modify: `prototype/src/main.tsx`（启动时安装全局 fetch 拦截器）
- Modify: `prototype/src/types/contracts.ts`（`saveToDiskStorageAsync` 支持 `sensitive`；`resolveApiEndpoint` 附 Token）
- Modify: `prototype/src/services/gateway/store.ts`（sensitive 标记）
- Modify: `prototype/src/App.tsx`（挂载时注册已保存工程根）
- Test: `prototype/tests/hostSecurity.test.ts`（新建）

**Interfaces:**
- Consumes: 无
- Produces:
  - `getHostToken(): string`（读 `window.__TCODE_HOST_TOKEN__`）
  - `shouldAttachToken(url: string): boolean`（相对 `/api/*` 或同源 127.0.0.1/localhost:8010 才附加；**跨域请求绝不附加**，防止 Token 外泄与 CORS 预检）
  - `installHostTokenInterceptor(): void`（幂等；patch 全局 `window.fetch`，对所有 `shouldAttachToken(url)` 为真的请求附加 `X-Tcode-Token` 头）
  - `hostFetch(input, init?): Promise<Response>`（显式助手，新代码使用）
  - `saveToDiskStorageAsync(key, data, sensitive?)` 支持第三参

**为什么用全局拦截而非逐点迁移：** 前端共有 30+ 处 `/api/*` 调用（App.tsx、EditorWorkspace、Titlebar、LeftPanel、GitSnapshotsPanel、hostGateway、contracts、workflowStore 等）。A1 接入后这些调用若不带 Token 全部 401；逐点迁移遗漏风险高。在 `main.tsx` 启动时一次性 patch `window.fetch`，所有现网与未来调用点自动携带 Token，且通过 `shouldAttachToken` 保证跨域直连（如 llmStreamingClient 直连上游）绝不附加 Token。

- [ ] **Step 1: 写失败测试**

创建 `prototype/tests/hostSecurity.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hostFetch,
  getHostToken,
  shouldAttachToken,
  installHostTokenInterceptor
} from '../src/services/hostClient';
import { saveProvidersToStorage, saveProjectsToStorage, resolveApiEndpoint } from '../src/types/contracts';
import { saveGatewayState } from '../src/services/gateway/store';

function installWindowStub() {
  (globalThis as any).window = {
    location: { protocol: 'http:', hostname: '127.0.0.1', port: '8010' },
    dispatchEvent: () => true,
    CustomEvent: class {}
  };
  (globalThis as any).CustomEvent = (globalThis as any).window.CustomEvent;
  (globalThis as any).__TCODE_HOST_TOKEN__ = 'frontend-test-token';
}

const fetchMock = vi.fn();

beforeEach(() => {
  installWindowStub();
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  } as any);
});

describe('hostClient token scope', () => {
  it('attaches token only to same-origin /api requests', () => {
    expect(getHostToken()).toBe('frontend-test-token');
    expect(shouldAttachToken('/api/fs/tree')).toBe(true);
    expect(shouldAttachToken('http://127.0.0.1:8010/api/proxy')).toBe(true);
    expect(shouldAttachToken('http://localhost:8010/api/storage')).toBe(true);
    expect(shouldAttachToken('https://api.deepseek.com/v1/chat/completions')).toBe(false);
    expect(shouldAttachToken('https://api.openai.com/v1/models')).toBe(false);
  });

  it('global interceptor injects token into same-origin fetch', async () => {
    installHostTokenInterceptor();
    await (globalThis as any).fetch('/api/fs/tree');
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as any).headers as Headers;
    expect(headers.get('X-Tcode-Token')).toBe('frontend-test-token');
  });

  it('global interceptor does not touch cross-origin fetch', async () => {
    installHostTokenInterceptor();
    await (globalThis as any).fetch('https://api.openai.com/v1/models');
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as any).headers as Headers;
    expect(headers.get('X-Tcode-Token')).toBeNull();
  });

  it('explicit hostFetch attaches token', async () => {
    await hostFetch('/api/fs/tree');
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).headers.get('X-Tcode-Token')).toBe('frontend-test-token');
  });
});

describe('sensitive storage marking', () => {
  it('marks providers write as sensitive', async () => {
    saveProvidersToStorage([{ id: 'provider-opencode', apiKey: '' } as any]);
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBe(true);
    expect(body.key).toBe('codemind_providers');
  });

  it('marks gateway state write as sensitive', async () => {
    saveGatewayState({ accounts: [], keys: [], usage: [], scheduler: {} as any });
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBe(true);
    expect(body.key).toBe('codemind_gateway_v2');
  });

  it('does not mark projects write as sensitive', async () => {
    saveProjectsToStorage([]);
    await new Promise(r => setTimeout(r, 0));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === '/api/storage')!;
    const body = JSON.parse((init as any).body);
    expect(body.sensitive).toBeFalsy();
  });
});

describe('resolveApiEndpoint desktop proxy', () => {
  it('includes token header on desktop proxy route', () => {
    const resolved = resolveApiEndpoint('https://api.openai.com/v1/models');
    expect(resolved.url).toBe('/api/proxy');
    expect(resolved.headers['x-target-url']).toBe('https://api.openai.com/v1/models');
    expect(resolved.headers['X-Tcode-Token']).toBe('frontend-test-token');
  });
});
```

注意：本机 Node v24 已内置全局 `fetch/Response/Headers`；`installHostTokenInterceptor` 需幂等（重复调用只 patch 一次），测试中重复调用应无副作用。

- [ ] **Step 2: 运行确认失败（Red）**

```powershell
$node = (Get-Command node).Source
$npmCli = Join-Path (Split-Path $node) "node_modules\npm\bin\npm-cli.js"
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test -- --run tests/hostSecurity.test.ts
Pop-Location
```

Expected: `Cannot find module '../src/services/hostClient'`（或 8 个用例失败）。

- [ ] **Step 3: 最小实现**

3.1 创建 `prototype/src/services/hostClient.ts`：

```typescript
let patched = false;

export function getHostToken(): string {
  if (typeof window === 'undefined') return '';
  return ((window as any).__TCODE_HOST_TOKEN__ as string) || '';
}

export function shouldAttachToken(url: string | URL): boolean {
  const raw = String(url);
  // Relative /api/* calls (served same-origin from the desktop host)
  if (raw.startsWith('/')) return raw.startsWith('/api/') || raw === '/health';
  // Absolute URL: only the desktop host origin itself
  try {
    const u = new URL(raw);
    const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
    return local && (u.pathname.startsWith('/api/') || u.pathname === '/health');
  } catch {
    return false;
  }
}

export function installHostTokenInterceptor(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (shouldAttachToken(input)) {
      const headers = new Headers(init?.headers);
      const token = getHostToken();
      if (token) headers.set('X-Tcode-Token', token);
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
}

export async function hostFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getHostToken();
  if (token && shouldAttachToken(input)) headers.set('X-Tcode-Token', token);
  return fetch(input, { ...init, headers });
}
```

3.2 `prototype/src/main.tsx`：在 `ReactDOM.createRoot(...).render(...)` 之前调用：

```tsx
import { installHostTokenInterceptor } from './services/hostClient';
installHostTokenInterceptor();
```

3.3 `prototype/src/types/contracts.ts`：`saveToDiskStorageAsync` 增加 `sensitive` 参数并走 `hostFetch`（顶部加 `import { hostFetch } from '../services/hostClient';`）：

```typescript
export async function saveToDiskStorageAsync(key: string, data: any, sensitive = false): Promise<void> {
  try {
    const isDesktop = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (isDesktop) {
      await hostFetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data, sensitive })
      });
    }
  } catch (e) {}
}
```

3.4 同文件：`loadFromDiskStorageAsync` 内 `fetch(` 改 `hostFetch(`；`saveProvidersToStorage` 内 `saveToDiskStorageAsync(STORAGE_KEYS.PROVIDERS, providers)` 改为 `..., providers, true`；`resolveApiEndpoint` 的 desktop 分支 headers 增加 `'X-Tcode-Token': getHostToken()`（顶部加 `import { getHostToken } from '../services/hostClient';`）。

3.5 `prototype/src/services/gateway/store.ts`：`saveToDiskStorageAsync(GATEWAY_STORAGE_KEY, state)` → `saveToDiskStorageAsync(GATEWAY_STORAGE_KEY, state, true)`。

3.6 `prototype/src/App.tsx`：在 `const [projects, setProjects] = useState<ProjectGroup[]>(loadSavedProjects());` 之后加挂载 effect：

```tsx
  // Register persisted workspace roots with the desktop host (path sandbox)
  React.useEffect(() => {
    const paths = (loadSavedProjects() || []).map(p => p.path).filter(Boolean) as string[];
    if (paths.length > 0 && typeof window !== 'undefined' && window.location.protocol === 'http:') {
      import('../src/services/hostClient').then(({ hostFetch }) =>
        hostFetch('/api/workspace/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths })
        }).catch(() => {})
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

3.7 其余 30+ 处 `/api/*` 调用（App.tsx/EditorWorkspace/Titlebar/LeftPanel/GitSnapshotsPanel/hostGateway/workflowStore 等）**无需逐点修改**——全局拦截器在 main.tsx 已统一注入 Token。

- [ ] **Step 4: 运行确认通过（Green）**

```powershell
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test
Pop-Location
```

Expected: 全量 Vitest 通过（原 282 + 新增 8 ≈ 290）。

- [ ] **Step 5: 提交**

```powershell
git add prototype/src/services/hostClient.ts prototype/src/main.tsx prototype/src/types/contracts.ts prototype/src/services/gateway/store.ts prototype/src/App.tsx prototype/tests/hostSecurity.test.ts
git commit -m "feat(security): global token interceptor, sensitive storage marking, workspace registration"
```

---

### Task 11: 全量回归 + 铁律 1.5 真实验收闭环

**Files:**
- Modify: `README.md`（补「本地宿主安全模型」小节：Token 鉴权、DPAPI 加密、路径沙箱、代理白名单、`/api/workspace/register`）
- Test: 无新增

**Interfaces:**
- Consumes: 全部前序任务产物

- [ ] **Step 1: Python 全量测试**

```powershell
$VPY = "E:\pro\agent-learning\.venv\Scripts\python.exe"
Push-Location E:\pro\agent-learning
& $VPY -m pytest tests -q
Pop-Location
```

Expected: 全部通过（既有 3 文件 + `test_credential_crypto.py` + `test_host_security.py` + `test_host_integration.py`）。

- [ ] **Step 2: 前端全量测试**

```powershell
$node = (Get-Command node).Source
$npmCli = Join-Path (Split-Path $node) "node_modules\npm\bin\npm-cli.js"
Push-Location E:\pro\agent-learning\prototype
& $node $npmCli test
Pop-Location
```

Expected: 全绿（含既有 282 项回归）。

- [ ] **Step 3: 增量打包**

```powershell
$PY = "C:\Users\13605\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe"
Push-Location E:\pro\agent-learning
& $PY build_installer.py
Pop-Location
```

注意：必须用 `$PY`（uv Python）直接执行 build_installer.py，PATH 上的 `python` 是 Windows Store 占位 stub 不可用。build_installer.py 内部会调用 uv Python 的 pyinstaller（`PYINSTALLER_EXE`）。

Expected: `release/Tcode-Setup-v1.5.0.exe` 与 `dist/Tcode-Setup.exe` 生成成功。

- [ ] **Step 4: 静默安装至全新目录**

```powershell
$installDir = "E:\pro\agent-learning\smoke-security"
Remove-Item -LiteralPath $installDir -Recurse -Force -ErrorAction SilentlyContinue
& "E:\pro\agent-learning\dist\Tcode-Setup.exe" --silent-install-dir $installDir
```

Expected: 安装完成，`$installDir\Tcode.exe` 存在。

- [ ] **Step 5: 启动并探活（真实桌面端）**

```powershell
Start-Process -FilePath "$installDir\Tcode.exe" -WindowStyle Hidden
Start-Sleep -Seconds 6
Invoke-WebRequest -Uri 'http://127.0.0.1:8010/health' -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri 'http://127.0.0.1:8010/' -UseBasicParsing | Select-Object StatusCode
```

Expected: 两者均 200；`/` 返回 HTML 含 `__TCODE_HOST_TOKEN__`。

- [ ] **Step 6: 安全行为实弹验证**

```powershell
# 无 Token → 必须 401
try { Invoke-WebRequest -Uri 'http://127.0.0.1:8010/api/fs/tree' -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
# 带注入 Token → 不再 401
$html = (Invoke-WebRequest -Uri 'http://127.0.0.1:8010/' -UseBasicParsing).Content
$token = [regex]::Match($html, '__TCODE_HOST_TOKEN__ = "([^"]+)"').Groups[1].Value
Invoke-WebRequest -Uri 'http://127.0.0.1:8010/api/fs/tree' -Headers @{ 'X-Tcode-Token' = $token } -UseBasicParsing | Select-Object StatusCode
```

Expected: 无 Token → 401；带 Token → 200/400（非 401）。

- [ ] **Step 7: 真实上游模型调用验证（若配置了真实凭据）**

在应用内配置真实 API Key（经 Settings 面板写入，走加密存储），发起真实模型调用；验证：
- 通过宿主 `/api/proxy` 返回真实上游响应（SSE 流式）；
- 未配置凭据时模型调用 fail-closed（明确提示，不静默回退到内置 Key）。

若当前无真实凭据：验证 `/api/proxy` 拉取 `https://opencode.ai/zen/v1/models` 返回 200（白名单放行 + 上游可达），并记录到验收清单。

- [ ] **Step 8: 更新 README 并提交**

在 README「本地验证与安装包构建」小节后补「🔐 本地宿主安全模型」小节，说明四层防护 + `/api/workspace/register` 契约，然后：

```powershell
git add README.md
git commit -m "docs(security): document local host security model (token/DPAPI/path sandbox/proxy allowlist)"
```

- [ ] **Step 9: 清理 smoke 目录（可选）**

```powershell
Stop-Process -Name Tcode -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "E:\pro\agent-learning\smoke-security" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## 验收清单（Done Definition）

- [ ] Task 1：pytest 就绪，既有 Python 测试基线绿。
- [ ] Task 2：DPAPI 加解密/信封单测 4 项绿。
- [ ] Task 3：host_auth 单测 4 项绿。
- [ ] Task 4：path_sandbox 单测 5 项绿。
- [ ] Task 5：proxy_policy 单测 8 项绿。
- [ ] Task 6：集成测试 7 项绿（鉴权/CORS/Token 注入）。
- [ ] Task 7：集成测试 10 项绿（路径边界）。
- [ ] Task 8：集成测试 13 项绿（代理白名单）。
- [ ] Task 9：集成测试 15 项绿（存储加密）。
- [ ] Task 10：前端 hostSecurity.test.ts 8 项绿 + 全量 Vitest 回归绿。
- [ ] Task 11：打包、静默安装、真实探活、安全行为实弹验证通过；README 已更新。
- [ ] 全部提交完成，工作区仅剩被 .gitignore 忽略的构建产物。
