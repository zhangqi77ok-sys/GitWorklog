# Tcode

新一代企业级开源 AI 编程桌面工作台，基于 **Tauri v2 / Python Native Desktop Host + React 19 + TypeScript**，遵循暖米白、工作台米灰与陶土橙的极简桌面设计规范。



## Model Gateway v2 · 多账号分发网关（参照 sub2api 工程思想）

网关从"单 Provider 直连"升级为**多账号、多协议、可计费、可调度**的真正分发模块：

- **多账号管理**：Codex / Claude / Grok / Gemini / OpenAI / DeepSeek / 兼容平台 / 本地，每个平台可挂载任意数量账号；支持 `api_key`、`oauth`（完整）、`refresh_token`（RT 手动）、`setup_token` 四种凭据类型；
- **OAuth 生命周期**：Codex（auth.openai.com 换码 + refresh_token 自动刷新）、Claude（claude.ai 授权 + platform.claude.com 换码 + setup token + 组织发现）、Grok（accounts.x.ai SSO + RT 刷新），均可在 Settings 手动粘贴凭据；
- **API Key 分发**：签发 `sk-tcode-<prefix>-<secret>` 下游 Key，支持分组、模型白名单、每日 Token 预算、吊销与掩码；
- **精确计费**：Token 级用量追踪（输入/输出/缓存读/缓存写），按模型单价表计算成本，账号与下游 Key 双账本；
- **智能调度**：粘性会话（1h TTL 保证对话连续性）、用户指定账号、LRU 轮询、健康度/并发/额度过滤、429/5xx/配额故障自动转移（≤2 次重试）；
- **接口兼容修复**：统一中间表示（Responses 风格 IR），Codex OAuth 剥离 `temperature/max_output_tokens`、强制 `store=false/stream=true`，长对话预算感知裁剪，工具调用 id 归一化（`fc_` ≤64）与流式片段合并，`stream_options.include_usage`，Anthropic `max_tokens` 必填与 `tool_result` 块；
- **Fail-closed**：云端账号缺凭据在路由前拒绝，不携带空/伪凭据发请求。

Settings → 网关页底部为「模型网关 v2 · 多账号分发」管理面板（平台/账号/密钥/用量）。Agent Loop 在所选模型对应平台存在网关账号时自动走 v2 调度，否则回退 v1 Provider 目录。

实现与验收契约：`docs/technical_reviews/model-gateway-v2-contract.md`。
## 核心架构

### 1. 统一 ModelGateway 与 OpenCode Zen 模型级路由

OpenCode Zen 在 Tcode 中是一个统一 Provider，不向用户暴露 Responses API / Chat Completions 二选一。模型目录为每个模型保留稳定身份、Adapter、协议、Endpoint、上下文上限和工具能力：

```text
ModelRef(providerId:modelId)
  → ModelCatalogEntry
  → ModelAdapterResolver
  → ModelGateway
  → 统一流事件
  → Agent Loop / Harness / Swarm
```

同一 OpenCode Zen Provider 内的 GPT、Claude、Gemini 和 OpenAI-compatible 模型可以自动使用不同 Adapter。Settings 只允许选择 Provider 与模型；Adapter/Endpoint 作为只读诊断信息。模型同步写入统一 Model Registry，并通过 `tcode_providers_updated` 立即刷新对话框选择器。

技术契约：`docs/technical_reviews/opencode-provider-model-routing-contract.md`。

> **收敛语义（三大黄金不变量）**：本轮无工具调用即自然终结（闲聊单轮秒回，绝不脑补待办项）；有工具调用才驱动下一轮（max 8 轮熔断）；验收清单仅来自显式声明（工作流 spec 或模型 `- [ ]`）。工作流阶段 `allowedTools` 白名单在协议层裁剪 tools 并在运行时硬校验，越权返回结构化 403 反馈引导模型自愈（0 红屏）。

### WP-B · 执行模式收敛（⚡ Agent Loop / 🧩 Graph 编排）+ Stage Gate 质量门禁

### WP-C · 会话级并发调度引擎（Session-Level Concurrency）
- **每会话 prompt 队列**：`promptQueueStore` 纯函数按 sessionId 持有独立待执行队列（入队/撤回/编辑/移动/顶替互不串扰）。

- 每个会话拥有独立运行态（`SessionActorManager` 单例：streaming / gate_pending / idle），`AbortController`、Stage Gate 决策、Token/轮次遥测全部按 sessionId 分发。
- 会话 A 跑重构时切换到会话 B 可立即并发提问，两边独立流式渲染与独立取消；停止按钮只中止目标会话。
- `useChatColumn` Hook 将 D1 运行时状态线程化到每个 ChatColumn 实例。

### WP-D · 缓存与代码索引（RepoMap + KV-Cache 命中保障）
- **Active Working Set 聚焦钉扎**：最近访问/读写的文件自动排入 RepoMap 前列（`recordActiveFile` + `prioritizeActiveFiles`），保证焦点文件永远入图。

- 探查阶段自动注入 <2k tokens 工程骨架图谱（`buildRepoMapFromTree` + `buildRepoMapFromFileContents`），经 `assembleCacheOptimizedMessages` 置于 System Prompt 最前端（字节级前缀不变，服务端 KV-Cache 高命中）。
- 遥测：TTFT 首字响应延迟落盘 TokenStats；Token 大盘与顶部 HUD 展示 3 指标（总 Token / KV 命中率 / TTFT）。

### WP-E · 真并发 Swarm 控制平面（影子工作区 + Master 纠偏 + 2PC）
- **启动入口**：Graph 模式工作流模板新增「🐝 Swarm 多智能体协同」，选中后发送消息即启动真并发 Swarm Run（自动打开工作台查看影子区/2PC/纠偏干预）。

- 宿主新增 `/api/git/worktree/create|list|remove`（Token 鉴权 + 路径沙箱注册，越界 403）。
- 前端：`worktreeManager` 影子生命周期、`swarmSteering` 角色×路径越界规则（如前端改 server/ → Master 纠偏指令）、`SwarmMaster` 遥测总线实时记录干预、`swarmExecution` 真并发（每 Agent 独立请求流 + 影子 cwd）、`twoPhaseMerge` 两阶段提交（测试绿灯后才 git apply 落盘）。
- 说明：控制平面与宿主能力已交付并测试；Swarm 工作台实时可视化接线留待后续专项（与 WP-C actor 模型统一）。

### WP-F · 系统级双通道任务通知（原生右下角）
- **双通道策略**：窗口聚焦时沿用应用内 280×120 完成/异常 Toast（悬停暂停 + 双按钮）；窗口最小化或后台时由桌面宿主弹出 **Windows 原生右下角通知**（任务完成/异常均触发）。
- **宿主 API**：`POST /api/notify/system`（入参 status/projectName/sessionTitle/sessionId/summary，Token 鉴权）；`GET /api/window/restore?sessionId=`（恢复并前置窗口）。
- **点击唤醒**：系统通知点击 → 宿主 `window.restore()/show()` 并 `evaluate_js` 分发 `tcode_activate_session` 事件 → 前端自动切换至对应会话。
- **通道选型说明**：实测 PowerShell 5.1 无法订阅 WinRT Toast 事件（点击回调不可用），故采用 `System.Windows.Forms.NotifyIcon` 气球通知（.NET 事件可订阅，零新增依赖）。
- **失败策略**：宿主通知失败显式写日志并返回 5xx，前端 `console.error`，禁止静默吞错。

### WP-G · Swarm 真并发多角色协同（会话级，Chat 直通，Master 动态组队）
- **Master 动态组队**：8 角色目录（架构/开发/测试/安全/前端/后端/数据库/文档），Master 拆解返回 JSON `{planning, roles[]}` 按任务**动态挑选 2~4 个**执行，不再固定角色。
- **三段式协议**：拆解 → 仅对选中角色各自独立并发流式调用 LLM → 终审仲裁交付；拆解非法（非 JSON/未知角色/数量越界）显式报错，fail-closed。
- **结构化数据**：`ChatMessage.swarm`（`SwarmChatState`）驱动 `SwarmSubagentContainer` 平铺渲染；拆解中显示组队骨架；旧消息走正则回退。
- **执行器**：`swarmChatExecutor.runSwarmChat`（纯编排，可注入 streamChat）；`swarmGatewayStream.createGatewayStreamChat` 复用主 Loop 调度口径（渠道 → Gateway v2 → v1）。
- **渲染**：暖色极简（米白表面/细边框/克制控件），Master 拆解与 Subagent 卡片均可折叠，running/error 状态清晰。
- **v1 边界**：角色仅产出分析文本；工具执行留待后续。

### 2. 目标驱动 Agent Loop

- 通过“理解 → 动作 → 观察 → 验收”推进任务，不能因为空 action 或网络 EOF 就伪装成完成；
- XML、fenced、JSON 和原生 Tool Call 统一标准化，原始 `<tool_call>` 不会泄漏到助手正文；
- `[DONE]`、`finish_reason` 或等价终止事件才表示正常完成；异常断流显示中断/失败原因；
- 写文件、命令执行、审批和验收结果通过统一状态链呈现。

### 3. 三栏百分比流体工作台

- 左侧 12%~35%（默认 18%）、中央聊天 flex、右侧 20%~50%（默认 32%）可通过 Pointer 拖拽调整；
- 支持会话隔离、文件 Tab、Diff 直达、终端抽屉、上下文容量 HUD 和消息自动滚动。

### 4. 统一宿主安全网关

- 文件读取、写入和命令执行经由 `HostGateway`；
- `SecurityShield`、`SandboxGuard` 和审批策略共同拦截高风险动作；
- 支持 Git 影子快照、真实 PowerShell 执行和错误证据回传。

## 本地验证与安装包构建

```powershell
# 前端原型：测试与构建
cd prototype
npm test
npm run build

> Windows PowerShell ????????? `npm.ps1` ???? `UnauthorizedAccess`????????? `npm.cmd test`???? Node ?? npm CLI?`node "$env:APPDATA\npm\node_modules\npm\bin\npm-cli.js" test`?

# 根目录：生成 Windows 安装包
cd ..
python build_installer.py
```

当前安装包产物由构建脚本输出到 `release/`。真实安装验证应在 Windows 宿主中解压/安装后进行，并检查：

```text
GET http://127.0.0.1:8010/health → HTTP 200
GET http://127.0.0.1:8010/       → 完整 HTML
```


## 🔐 本地宿主安全模型（Host Security Model）

桌面宿主（`127.0.0.1:8010`）为所有 `/api/*` 接口实施四层 fail-closed 防护：

1. **Host Token 鉴权**：进程启动生成随机 Token 并注入首页 HTML（`window.__TCODE_HOST_TOKEN__`），前端经全局 `fetch` 拦截器为所有同源 `/api/*` 请求附加 `X-Tcode-Token` 头；缺失/错误一律 401。跨域请求（如直连上游）绝不携带 Token。
2. **CORS 收紧 + Host 校验**：不再返回 `Access-Control-Allow-Origin: *`，仅对白名单 Origin（`127.0.0.1:8010`、dev `localhost:5173`）回显；`Host` 头必须为 `127.0.0.1:8010` / `localhost:8010`，防 DNS Rebinding。
3. **凭据 DPAPI 加密落盘**：`/api/storage` 对 `sensitive: true` 的载荷（providers、gateway v2 账户等）用 Windows DPAPI（当前用户级）加密为信封后写盘，旧明文数据读时兼容。
4. **路径沙箱 + 代理白名单**：`/api/fs/*`、`/api/git/*`、终端 `cwd` 必须位于已注册工作区根内（`POST /api/workspace/register`，越界 403）；`/api/proxy` 仅放行白名单厂商主机与用户自定义端点，禁内网 IP 直连、禁重定向逃逸（403）。

`/health` 保持开放，供探活。实现契约与测试见 `docs/superpowers/specs/2026-08-30-host-security-hardening-design.md`。
## 工作流 Provider 与范式选择

Tcode 不会因为项目规则、Skill 文件或用户安装了 Superspec/SpecKit 等工具，就自动启用 SDD、TDD 或外部工作流。工作流状态严格遵循：

```text
发现 → 用户选择 → 用户确认 → 当前任务启用 → 执行
```

未表达范式意图时保持普通任务模式；“我安装了 Superspec”只产生发现提示，不会自动执行。详细需求见：

- `docs/PRD_WORKFLOW_PROVIDER_DISCOVERY.md`
- `docs/technical_reviews/workflow-provider-discovery-contract.md`
- `docs/technical_reviews/opencode-provider-model-routing-contract.md`

启动原型进行交互验收：

```powershell
cd prototype
npm run dev -- --host 127.0.0.1
```

在聊天输入区可体验 Provider/模型选择、在线同步、同步后立即刷新模型列表、工具审批和流中断状态。



## OpenCode Zen 调用失败修复与真实验收（2026-08-30）

**根因**：EXE 内 OpenCode 调用失败源于内置目录含官方不存在的 `hy3-free`（混元 3.0），且默认模型选择硬偏好 `hy3/hunyuan` 并允许恢复失效引用，导致首次启动默认选中该模型（叠加空 API Key 时本地 fail-closed，有 Key 时上游 model_not_found）。

**修复**：

1. 内置 OpenCode 目录与 `AVAILABLE_MODELS` 移除 `hy3-free`；内置模型全部以官方 `/models` 快照（`prototype/tests/fixtures/opencodeZenModels.ts`，63 个模型）校验；
2. 默认模型解析收敛为纯函数 `resolveInitialModel(all)`：只从当前可用列表返回，禁止 id 硬编码偏好、禁止恢复失效引用（首次启动默认 `mimo-v2.5-free`）；
3. 升级迁移：`loadSavedProviders` 自动清除已保存目录中的 `hy3-free`，空凭据云端 Provider 归一为 `untested`；
4. OpenCode Provider 初始状态改为 `untested` + 空凭据（诚实展示，需在 Settings 配置 opencode.ai 官方 API Key 后才会请求上游）。

**本轮真实探活证据（2026-08-30）**：`dist/Tcode-Setup.exe` 静默安装至独立目录后启动 `Tcode.exe`：`/health` HTTP 200、`/` HTTP 200（867 字节 HTML）；经宿主 `/api/proxy` 拉取 `https://opencode.ai/zen/v1/models` HTTP 200（含 `mimo-v2.5-free`、`deepseek-v4-flash`，无 `hy3-free`）；`/chat/completions` 未带 Key 返回 401（端点可达，凭据门禁生效）。
## RunEngine P0 硬化（凭据脱敏 + SSE 终态 + 验收铁律，2026-08-30）

依据 implementation_plan.md P0（紧急基础）完成契约化改造，自动化测试 223 项全绿：

1. **硬编码凭据清零**：源码不允许出现真实 `sk-` 凭据字面量；云端凭据一律来自运行时存储，未配置 fail-closed；新增 `tests/credentialHygiene.test.ts` 静态扫描守卫；
2. **SSE 终态五分类**：`completed` / `stream_interrupted`（EOF 无终止事件）/ `provider_empty_response`（HTTP 200 空 Body）/ `tool_protocol_error`（data: 事件非法 JSON，禁止静默吞掉）/ `cancelled`（Abort）；
3. **验收项物理证据铁律**：模型文本自报 ✓ 仅映射 `model_claimed`，只有真实文件落盘 / `exitCode===0` / 测试断言通过才置 `passed`；
4. **新通道诚实状态**：Settings 新增自定义通道不再注入假 Key，`apiKey` 为空 + `status:'untested'`。

真实桌面端验证（真实 Key 仅运行时注入、不入库）：`/health` 200、`/` 200；经宿主 `/api/proxy` 对 OpenCode Zen `mimo-v2.5-free` 非流式 HTTP 200 真实 chat completion（token usage 252/16/268）、流式 `text/event-stream` 24 chunks / 13 data 事件正常 [DONE] 终结。付费模型（`deepseek-v4-flash`/`gpt-5.1-codex`）返回 401 `CreditsError: Insufficient balance`（Key 有效但余额不足，属上游/额度边界）。契约见 `docs/technical_reviews/runengine-p0-hardening-contract.md`。

## 动态平台配置 Schema（每服务商独立配置项，2026-08-30）

用户需求：**opencode 只有 API Key，没有其他的；每个服务商都不一样，配置项必须动态、每平台独立。**

- 新增 `providerSchema.ts`：每个平台定义自己独立的鉴权方式集合（`authTypes`）与凭据字段（`fields`），表单按所选平台动态渲染；
- 平台配置矩阵：**opencode**（仅 API Key）、**codex**（API Key/OAuth/RT）、**claude**（API Key/OAuth+OrgID/Setup Token）、**grok**（API Key/OAuth/RT）、**gemini/openai**（API Key/OAuth）、**deepseek/openai-compatible**（仅 API Key）、**local**（免 Key，仅 Base URL）；
- 鉴权下拉只显示当前平台支持的选项；opencode 不再出现 OAuth/RT/Setup；本地平台隐藏全部凭据字段；
- 测试：`tests/gateway/providerSchema.test.ts`（8 项：平台全覆盖/默认地址同步/opencode 仅 api_key/codex 三方式/claude 含 setup+orgId/local 免 Key/每鉴权至少一字段）。

## 模型服务商控制台 v2（三栏 Master-Detail，2026-08-30）

按用户要求对「模型服务商」前后端整体重设计：

1. **三栏布局**：左侧平台导航（Codex/Claude/Grok/Gemini/OpenAI/DeepSeek/兼容/本地，含账号数与状态点）+ 中间账号列表（状态/额度条/模型数）+ 右侧详情编辑（凭据/Base URL/模型白名单/并发/粘性 TTL + 立即探测 + 下游 Key 分发），暖色极简风格；
2. **单一体系**：v1 Provider 旧目录降级为内置模型目录元数据；账号/凭据统一由 v2 Account 管理，Settings 网关 Tab 不再展示旧主从列表与旧 GatewayAccountManager；
3. **添加后自动真实探测**：新账号保存后立即 `probeAccount`（真实 GET {base}/models），成功才可被调度；
4. **概率轮询调度**：N 个可用账号各 1/N 概率被选中（默认 `probability` 策略，保留 sticky/用户指定优先；可显式 `lru`）；
5. **每 5 分钟自动刷新**：`AccountProbeScheduler` 定时重探所有启用账号，更新状态（active/expired/quota_exhausted/error）与额度，并持久化。

真实桌面端验证：Fresh 安装后经宿主 `/api/proxy` 以真实 Key 执行探测（GET opencode.ai/zen/v1/models → HTTP 200 → active），SSE 流式调用正常（49 data 事件 + [DONE]）。契约见 `docs/technical_reviews/provider-console-redesign-contract.md`。

## 全流式契约：所有模型调用必须流式（Stream-Only，2026-08-30）

用户硬性要求：**所有必须流式**。Tcode 内任何真实的大模型生成请求都必须以 SSE（`stream: true`）发送与消费：

1. `buildGatewayRequestBody` 移除可选的 `stream` 参数，四种 Adapter（Chat / Responses / Anthropic / Gemini）恒输出 `stream: true`，调用方无法再传 `false`；
2. 新增共享积木 `consumeSseResponse(response, adapter, signal?)`：逐行消费 SSE、聚合 content/reasoning/tool_calls、识别 `[DONE]`，并守住 P0 终态铁律（空 Body → `provider_empty_response`、非法 `data:` → `tool_protocol_error`、EOF 无终止 → `stream_interrupted`、abort → 取消读取）；
3. **Swarm 角色执行（multiRoleAgentRunner）与 v1 `ModelGateway.request` 已从非流式 `response.json()` 全面改为流式消费**；主 Agent Loop / 打字机客户端 / v2 多账号网关本就流式；
4. 静态守卫 `tests/streamOnly.test.ts` 扫描 `prototype/src`：禁止 `stream: false` 字面量、禁止向 `buildGatewayRequestBody` 传布尔 stream 实参，防止回归。

真实桌面端验证：Fresh 安装后经宿主 `/api/proxy` 对 OpenCode Zen `mimo-v2.5-free` 发送 `stream:true`，HTTP 200 `text/event-stream`，12 data 事件 + `[DONE]`，真实流式内容 `STREAM_OK`（含 110 字符推理流）。契约见 `docs/technical_reviews/stream-only-contract.md`。

## 本轮真实验收边界（2026-08-30）

本轮已闭环的是 Windows 安装与宿主运行链路：安装器由当前 `prototype/dist` 和当前桌面宿主重新构建，安装目录中的 `Tcode.exe` 可作为脱离源码目录的独立宿主启动；验收必须以安装目录进程实际返回为准，而不是以构建成功或截图推断成功。

远程模型调用目前**未闭环**。在没有云端 Provider 的真实 API Key 和可达 Base URL 时，模型目录同步、连通性测试和模型请求应 fail-closed：显示缺少配置、HTTP 400/401/403/500 或网络错误的真实原因，不得标记为健康、同步成功或 Agent 完成。本地 Ollama/兼容本地端点是唯一允许免 API Key 的例外；它仍必须具备有效 Base URL 和可达服务。默认 Provider 不再携带伪造 API Key；兼容升级时会清除已知历史占位凭据，避免把伪凭据发送给云端。

| 验收面 | 当前结论 | 证据边界 |
| --- | --- | --- |
| 安装器构建 | 已闭环 | `release/Tcode-Setup-v1.5.0.exe` 与稳定兼容副本 `dist/Tcode-Setup.exe` 均由本轮脚本生成 |
| 安装目录冷启动 | 已闭环 | 真实安装至 `E:/pro/agent-learning/smoke-install` 后启动 `Tcode.exe`：`/health` HTTP 200，`/` HTTP 200、867 字节并包含 `<html>`/`index` |
| Provider/模型路由 | 已实现 fail-closed | 云端缺 API Key/Base URL 时在路由前拒绝；模型级 Adapter/Endpoint 来自目录元数据；默认/历史伪凭据会被清除 |
| 远程模型真实调用 | 已闭环（凭据可达模型） | 真实 Key 经宿主 /api/proxy 调用 OpenCode Zen mimo-v2.5-free：非流式 HTTP 200（真实 chat completion）与流式 HTTP 200（[DONE] 正常终结）；付费模型 401 余额不足属上游/额度边界，如实记录 |
| Agent Loop | 原型契约已覆盖 | `[DONE]`/finish reason 才能完成；异常 EOF、无动作未完成、工具解析失败分别保留真实状态 |

完整契约见 [`docs/technical_reviews/opencode-provider-model-routing-contract.md`](docs/technical_reviews/opencode-provider-model-routing-contract.md) 与 [`docs/technical_reviews/windows-installer-contract.md`](docs/technical_reviews/windows-installer-contract.md)。






