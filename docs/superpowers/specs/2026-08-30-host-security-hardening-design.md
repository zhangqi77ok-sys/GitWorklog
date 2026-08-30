# WP1 · 桌面宿主安全加固设计文档 (Host Security Hardening)

> 日期：2026-08-30
> 状态：已确认（User Approved 2026-08-30）
> 范围：A 组安全加固 A1–A4（A5 明确排除）；B/C/D 组不在此 WP
> 关联铁律：铁律 1（SDD+TDD）、铁律 1.5（打包+安装+真实桌面调用闭环）

---

## 1. 背景与问题（实测证据）

当前 `src-desktop/desktop_app.py` 在 `127.0.0.1:8010` 启动本地 HTTP 宿主，存在四类已验证的安全缺陷：

| 编号 | 缺陷 | 实测证据 |
|---|---|---|
| A1 | 零鉴权 + 全量 CORS `*` | 带 `Origin: http://evil.example.com` 请求 `/health` 返回 `Access-Control-Allow-Origin: *`；所有响应头均为 `*` |
| A2 | 凭据明文落盘 | `/api/storage` 将 `apiKey/refreshToken/setupToken/oauth` 以明文 JSON 写入 `%LOCALAPPDATA%\Tcode\storage\*.json` |
| A3 | 路径无工作区边界 | `/api/fs/tree|read|search|write`、`/api/git/*`、`/api/tests/discover` 接受任意绝对路径，无根目录约束 |
| A4 | 开放 SSRF 代理 | `/api/proxy` 可请求任意 URL（含内网）并透传任意 `Authorization` 头，无目标白名单、无重定向校验 |

**危害链**：浏览器中任意恶意网页 → 跨域 POST `http://127.0.0.1:8010/api/terminal/exec` → 任意 PowerShell 执行 / 任意文件读写 / 窃取明文 API Key。这是最高优先级的真实风险。

## 2. 目标与非目标

### 2.1 目标
1. 所有 `/api/*` 接口要求有效 Host Token，缺失/错误一律拒绝（fail-closed，401/403）。
2. 消除 CORS `*`：仅对白名单 Origin 回显 CORS 头，生产同源不再依赖 CORS。
3. 敏感凭据（apiKey / refreshToken / setupToken / oauth 等）落盘前用 Windows DPAPI（当前用户级）加密。
4. 文件系统与 Git 接口强制工作区根边界，越界拒绝。
5. 代理仅允许解析到白名单域名的目标，禁止内网 IP 直连与重定向逃逸。
6. 全部通过 SDD+TDD 与铁律 1.5 真实桌面闭环验证。

### 2.2 非目标（明确排除）
- A5：终端输出大小上限（用户指定不处理）。
- B 组（文档一致性 / Tauri mock / 旧品牌清理）：WP2 另行处理。
- C 组（工程质量）、D 组（功能补全）：WP3/WP4 另行处理。
- 非 Windows 平台支持：产品为 Windows 桌面端（PyInstaller + PyWebView），DPAPI 为 Windows 专有能力。

## 3. 总体架构

新增 4 个 Python 模块（均位于 `src-desktop/`，全部使用标准库，不引入新外部依赖）：

```text
src-desktop/
├── desktop_app.py          # 修改：接入鉴权/CORS/路径/代理策略；注入 Token 到 index.html
├── host_auth.py            # 新增：Token 生成/校验、Origin 白名单、Host 头校验
├── credential_crypto.py    # 新增：DPAPI 加解密（ctypes 直调 crypt32）
├── path_sandbox.py         # 新增：工作区根注册表 + 路径规范化校验
└── proxy_policy.py         # 新增：上游目标白名单 + 重定向校验
```

前端改动集中在 API 调用封装层（相对路径 fetch），新增统一请求助手：
```text
prototype/src/services/
├── hostGateway.ts          # 修改：所有 fetch 自动携带 X-Tcode-Token；新增 403 错误映射
└── hostClient.ts           # 新增：统一 fetch 助手（token 注入 + 错误规范化），供 hostGateway/contracts.ts 复用
```

## 4. 详细设计

### 4.1 A1 宿主鉴权 + CORS 收紧

**Token 生成与注入**
- 进程启动时 `HOST_TOKEN = secrets.token_urlsafe(32)`（每次启动随机，不落盘）。
- 注入方式：宿主在响应首页 `GET /`（及任何 `index.html` 静态响应）时，在 `</head>` 前注入
  `<script>window.__TCODE_HOST_TOKEN__ = "<token>";</script>`。生产 webview 加载的正是该页面，同源读取。
- Dev 模式（vite 5173）不注入 token：前端在无 token 时不附加头（dev 本身无法直连宿主，不影响现有 UI 交互验收）。

**服务端校验**
- 新增 `host_auth.require_token(handler) -> bool`：读取 `X-Tcode-Token` 头，与 `HOST_TOKEN` 恒定时间比较（`hmac.compare_digest`）。
- 所有 `/api/*` 路由（含 GET/POST/OPTIONS）在业务处理前先校验：
  - 无/错 Token → `401 {"error":"UNAUTHORIZED","code":401}`（fail-closed，不做任何后续处理）。
- `/health` 保持开放（仅返回静态状态串，无敏感信息），保证铁律 1.5 探活命令不变。

**CORS 收紧**
- 移除所有 `Access-Control-Allow-Origin: *` 与 `Access-Control-Allow-Headers: *`。
- 新增 `host_auth.cors_headers(handler) -> dict`：仅当请求 `Origin` 属于白名单时回显该 Origin；
  否则不返回任何 CORS 头（浏览器直接阻断跨域读取）。
  - 生产白名单：`http://127.0.0.1:8010`、`http://localhost:8010`（同源请求通常不带 Origin，兼容处理）。
  - Dev 白名单：`http://localhost:5173`、`http://127.0.0.1:5173`。
- `Access-Control-Allow-Headers` 收紧为 `Content-Type, X-Tcode-Token, Authorization`。
- `Access-Control-Allow-Methods` 收紧为 `GET, POST, OPTIONS`。

**Host 头校验（防 DNS Rebinding）**
- `host_auth.is_allowed_host(handler)`：`Host` 头必须为 `127.0.0.1:<port>` 或 `localhost:<port>`，否则 403。

**错误码约定**：401 = Token 缺失/无效；403 = Origin/Host/路径/代理策略拒绝；400 = 请求格式错误。

### 4.2 A2 凭据加密存储（DPAPI）

**`credential_crypto.py`**
- `protect_bytes(data: bytes) -> bytes`：ctypes 调 `crypt32.CryptProtectData`，`CRYPTPROTECT_UI_FORBIDDEN=0x1`，作用域为当前 Windows 用户。
- `unprotect_bytes(blob: bytes) -> bytes`：`CryptUnprotectData`。
- 高层封装：`encrypt_text(s: str) -> str`（返回 base64）、`decrypt_text(s: str) -> str`。
- 非 Windows：`raise NotImplementedError`（产品仅 Windows；单元测试在 Windows 执行）。

**存储契约**
- `/api/storage` 写：请求体支持 `{key, data, sensitive?: boolean}`。
  - `sensitive: true` → 将整个 `data` JSON 序列化后 DPAPI 加密，落盘为信封：
    `{"__tcode_enc__": true, "alg": "dpapi", "v": "<base64>"}`。
  - 非 sensitive → 维持现有明文 JSON（如主题、布局等非敏感项）。
- `/api/storage` 读：若文件内容是信封（含 `__tcode_enc__` 标记）→ 自动解密后返回原始 `data`；旧版本明文数据保持兼容可读。
- 新增 `sensitive` 判定规则（前端显式标记，避免宿主启发式误判）：
  - 标记为 sensitive 的存储键：provider/account/oauth 相关（`tcode_providers`、账户列表、oauth 状态等含凭据项）。
  - 实现时在 `contracts.ts` 的 `saveProvidersToStorage`/账户存储调用处统一加 `sensitive: true`。

**兼容性**：旧版明文文件可直接读取（无信封即不解密）；升级后新写入自动加密。

### 4.3 A3 工作区路径沙箱

**`path_sandbox.py`**
- `register_roots(paths: list[str])`：追加注册工作区根（去重、规范化）。
- `is_within_roots(target: str) -> bool`：
  - `real = os.path.realpath(target)`（解析符号链接）；
  - 对每个根 `root_real = os.path.realpath(root)`，Windows 下大小写不敏感地比较 `real` 是否等于 `root_real` 或以 `root_real + os.sep` 开头；
  - 任何根匹配即放行，否则拒绝。
- `assert_path_allowed(target, *, fs: bool)`：不合规抛 `PathSandboxError`（403 语义）。

**新端点**
- `POST /api/workspace/register` `{paths: [...]}`：注册工作区根（需 Token）。
  - 前端启动时把已保存工程路径（`loadSavedProjects()`）批量注册；
  - `pick_folder` 返回的路径在打开工程时自动注册。

**接入点（全部增加根校验，越界返回 403 `PATH_OUTSIDE_WORKSPACE`）**
- `GET /api/fs/tree`（path）、`GET /api/fs/read`（path）、`GET /api/fs/search`（path）、`POST /api/fs/write`（path）。
- `POST /api/git/checkpoint`（projectPath）、`POST /api/git/revert`（projectPath）、`GET /api/git/status`（projectPath，如带路径）。
- `GET /api/tests/discover`（路径参数）。
- `POST /api/terminal/exec`（cwd）：若显式传 cwd，必须位于已注册根内，否则 403；未传 cwd 时维持默认。

### 4.4 A4 代理目标白名单（SSRF 治理）

**`proxy_policy.py`**
- `DEFAULT_ALLOWED_HOSTS`：以 `prototype/src/services/gateway/providerSchema.ts` 中厂商 baseUrl 的主机名为蓝本生成默认集合（覆盖 opencode.ai、api.openai.com、auth.openai.com、api.anthropic.com、platform.claude.com、claude.ai、api.x.ai、generativelanguage.googleapis.com、api.deepseek.com、api.moonshot.cn、api.dashscope.aliyuncs.com、api.siliconflow.cn 等已内置厂商），外加本地 `127.0.0.1` / `localhost`（本地 Ollama 等）。
- 自定义端点：请求时从凭据存储（`tcode_providers` 配置中的 baseUrl/endpoint 主机）合并进允许集合——用户自建 NewAPI/sub2api 网关可正常使用。
- `is_allowed_target(url: str, extra_hosts: set[str]) -> (bool, reason)`：
  - scheme 必须为 `https`（本地主机可 `http`）；
  - 主机名必须在允许集合（精确匹配或域名后缀匹配，如 `*.opencode.ai`）；
  - 禁止 IP 字面量（除 `127.0.0.1`/`::1`）；
  - 禁止带凭据的 URL（`user:pass@host`）。
- 重定向逃逸防护：`urlopen` 后校验 `resp.geturl()` 的主机仍在允许集合，否则关闭连接并 403。

**接入点**
- `GET/POST /api/proxy`：请求前 `is_allowed_target` 校验，失败返回 403 `PROXY_TARGET_DENIED`；
- Authorization 头仅在目标放行时透传（放行判定已隐含该约束）。

## 5. 前端改动

### 5.1 统一请求助手 `hostClient.ts`
- `hostFetch(input, init)`：自动附加 `X-Tcode-Token: window.__TCODE_HOST_TOKEN__`（无 token 时不附加）；
- 响应规范化：401/403 → 抛出带 `code` 的错误对象；其余保持原响应；
- 供 `hostGateway.ts`、`contracts.ts` 存储/代理调用点复用（逐步替换裸 `fetch`）。

### 5.2 调用点更新
- `hostGateway.ts`：`executeCommand/writeFile/readFile/gitCheckpoint/gitRevert` 改走 `hostFetch`。
- `contracts.ts`：`/api/storage` 读写与 `/api/proxy` 调用改走 `hostFetch`；`saveProvidersToStorage` 等敏感写入标记 `sensitive: true`。
- `workflowStore.ts`：`/api/storage` 调用改走 `hostFetch`。
- 错误展示：401/403 时前端提示「宿主鉴权失效，请重启应用」/「路径越界」/「代理目标不允许」；不静默吞错。

## 6. 错误处理总则

- 全部安全拦截返回结构化 JSON：`{"error": "<CODE>", "code": <http>}`（CODE ∈ UNAUTHORIZED / ORIGIN_DENIED / HOST_DENIED / PATH_OUTSIDE_WORKSPACE / PROXY_TARGET_DENIED）。
- Fail-closed：任何校验失败即短路，不执行任何业务副作用，不静默 fallback。
- 前端统一错误映射，避免 Raw 错误泄漏到界面。

## 7. 测试计划（SDD+TDD）

### 7.1 Python 单元测试（新增 `tests/test_host_security.py`，需先安装 pytest 到 uv Python）
| 用例组 | 断言 |
|---|---|
| Token 校验 | 无 Token→401；错误 Token→401；正确 Token→200；恒定时间比较 |
| Origin/Host | 白名单 Origin 回显；非白名单不返回 CORS 头；错误 Host→403 |
| 路径沙箱 | 根内放行；`..` 逃逸→403；根外绝对路径→403；符号链接逃逸→403；大小写变体（Windows）→放行 |
| 代理策略 | 白名单主机放行；恶意域名→403；`http://192.168.*`→403；`http://user:pass@host`→403；重定向到非白名单→403 |
| 凭据加密 | `encrypt_text→decrypt_text` 往返一致；密文不含明文子串；`__tcode_enc__` 信封读写兼容（旧明文可读） |
| 存储契约 | sensitive 写入后文件内容不含明文；读回解密正确 |

### 7.2 前端 Vitest（新增 `prototype/tests/hostSecurity.test.ts`）
- `hostFetch` 自动附加 Token 头；
- 401/403 错误对象带 `code`；
- `saveProvidersToStorage` 标记 `sensitive: true`（存储请求体断言）。

### 7.3 回归
- 现有 26 个测试文件 282 用例保持全绿（SDD 阶段先补测试，绿后实现）。

### 7.4 铁律 1.5 真实验收闭环
1. `python build_installer.py` 增量打包；
2. `Tcode-Setup.exe --silent-install-dir <新目录>` 静默安装；
3. 启动 `Tcode.exe` 验证：
   - `GET /health` → 200；
   - `GET /` → 200 且 HTML 含 `__TCODE_HOST_TOKEN__` 注入；
   - 无 Token 请求 `/api/fs/tree` → 401/403（证明鉴权生效）；
   - 带 Token 请求 `/api/fs/tree`（已注册工作区）→ 200；
   - `/api/proxy` 拉取 opencode 官方 `/models` → 200（真实上游）；
   - 未配置凭据时模型调用 fail-closed（401/明确提示），不静默回退；
4. 循环直至全部通过，再提交。

## 8. 验收标准（Done Definition）

- [ ] A1：所有 `/api/*` 无 Token 均 401/403；恶意 Origin 拿不到 CORS 头；生产同源功能不受影响。
- [ ] A2：敏感存储文件 `grep` 不到明文 `sk-`/refreshToken/setupToken；旧数据可读；新数据加密。
- [ ] A3：fs/git/tests/terminal(cwd) 对根外路径全部 403；根内正常。
- [ ] A4：代理仅放行白名单目标；恶意/内网/重定向逃逸全部 403。
- [ ] 新增 Python 单测 + 前端单测全绿；282 项既有测试全绿。
- [ ] 打包 → 静默安装 → 真实桌面探活 + 真实上游调用闭环通过。

## 9. 范围外（后续 WP）
- A5 输出上限（用户排除）、B 组一致性、C 组工程质量、D 组功能补全与 D3 自动化验收。
