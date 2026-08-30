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

# 根目录：生成 Windows 安装包
cd ..
python build_installer.py
```

当前安装包产物由构建脚本输出到 `release/`。真实安装验证应在 Windows 宿主中解压/安装后进行，并检查：

```text
GET http://127.0.0.1:8010/health → HTTP 200
GET http://127.0.0.1:8010/       → 完整 HTML
```

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
## 本轮真实验收边界（2026-08-30）

本轮已闭环的是 Windows 安装与宿主运行链路：安装器由当前 `prototype/dist` 和当前桌面宿主重新构建，安装目录中的 `Tcode.exe` 可作为脱离源码目录的独立宿主启动；验收必须以安装目录进程实际返回为准，而不是以构建成功或截图推断成功。

远程模型调用目前**未闭环**。在没有云端 Provider 的真实 API Key 和可达 Base URL 时，模型目录同步、连通性测试和模型请求应 fail-closed：显示缺少配置、HTTP 400/401/403/500 或网络错误的真实原因，不得标记为健康、同步成功或 Agent 完成。本地 Ollama/兼容本地端点是唯一允许免 API Key 的例外；它仍必须具备有效 Base URL 和可达服务。默认 Provider 不再携带伪造 API Key；兼容升级时会清除已知历史占位凭据，避免把伪凭据发送给云端。

| 验收面 | 当前结论 | 证据边界 |
| --- | --- | --- |
| 安装器构建 | 已闭环 | `release/Tcode-Setup-v1.5.0.exe` 与稳定兼容副本 `dist/Tcode-Setup.exe` 均由本轮脚本生成 |
| 安装目录冷启动 | 已闭环 | 真实安装至 `E:/pro/agent-learning/smoke-install` 后启动 `Tcode.exe`：`/health` HTTP 200，`/` HTTP 200、867 字节并包含 `<html>`/`index` |
| Provider/模型路由 | 已实现 fail-closed | 云端缺 API Key/Base URL 时在路由前拒绝；模型级 Adapter/Endpoint 来自目录元数据；默认/历史伪凭据会被清除 |
| 远程模型真实调用 | 未闭环 | 当前环境没有可用于验收的云端凭据；400/500 等错误不能写成成功 |
| Agent Loop | 原型契约已覆盖 | `[DONE]`/finish reason 才能完成；异常 EOF、无动作未完成、工具解析失败分别保留真实状态 |

完整契约见 [`docs/technical_reviews/opencode-provider-model-routing-contract.md`](docs/technical_reviews/opencode-provider-model-routing-contract.md) 与 [`docs/technical_reviews/windows-installer-contract.md`](docs/technical_reviews/windows-installer-contract.md)。


