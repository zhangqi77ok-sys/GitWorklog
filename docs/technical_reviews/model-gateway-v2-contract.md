# Tcode Model Gateway v2 技术契约（多账号分发网关）

> 参照 sub2api / new-api / one-api 等开源中转站的工程思想，将现有单 Provider 网关升级为
> **多账号、多协议、可计费、可调度** 的真正分发模块。核心架构遵循 Tcode 铁律：
> 单一架构主轴（React 19 + TS）、积木解耦、依赖倒置、SDD + TDD、暖色极简。

## 1. 目标与边界

### 1.1 目标（解决用户提出的 7 点）

1. **Codex**：支持 API Key、RT（refresh_token 手动授权）、OAuth 手动授权（粘贴 access/refresh token 或授权码换码）；
2. **Claude**：支持 API Key 与 OAuth 授权（claude.ai 授权码换码 + setup token + 组织发现 + 自动刷新）；
3. **Grok**：支持 API Key、RT、OAuth（SSO 授权码/refresh_token + 自动刷新 + 配额探测）；
4. **多账号**：每个平台可挂载任意数量账号，实时刷新额度、健康度、并发，自动切换（含粘性会话）；
5. **接口兼容性**：统一中间表示（OpenAI Responses 风格 IR），修复工具调用与长对话请求的上游参数错误；
6. **真实分发模块**：非 demo，参照中转站工程思想严谨开发，真实自动化测试；
7. **核心能力**：多账号管理（OAuth/API Key 等类型）、API Key 分发、Token 级精确计费、智能调度（粘性会话）。

### 1.2 边界（Out of Scope）

- 真实支付/充值系统（计费只做 Token 级用量与成本核算，不做支付闭环）；
- 生产级 Redis/PostgreSQL 持久化（沿用 localStorage + 宿主磁盘存储，接口预留可替换存储）；
- WebSocket 传输（保留 HTTP/SSE）；Bedrock/Vertex 企业鉴权；
- 无凭据环境下的上游真实调用验收（沿用 fail-closed 原则，远程调用需有效凭据单独验收）。

## 2. 分层架构

```
Agent Loop / Harness / Swarm / ChatColumn
        │  (只依赖 GatewayFacade，不感知账号细节)
        ▼
┌───────────────────────────── GatewayFacade ─────────────────────────────┐
│  request(下游Key/会话 → 模型) → 路由 → 转换 → 上游调用 → 用量 → 计费     │
│  refreshQuota(账号) / issueKey / revokeKey / recordUsage / balance       │
└───────────┬──────────────────────┬───────────────────┬──────────────────┘
            ▼                      ▼                   ▼
   RouteScheduler(调度器)   RequestTransformer(转换器)  UsageLedger/Billing(计费)
   · 粘性会话 TTL 1h          · 统一 IR 中间表示          · Token 级用量追踪
   · 健康度/配额/并发过滤      · Responses ↔ Chat ↔       · 输入/输出/缓存 Token
   · LRU/轮询/故障转移         · Anthropic ↔ Responses    · 每模型单价表 → 成本
   · 混合调度(备用账号池)      · 上游参数兼容修复          · 账号/下游Key 双账本
            ▼
   AccountRegistry(多账号注册表) + CredentialVault(凭据库) + DownstreamKeyStore(Key 分发)
            ▼
   UpstreamAdapter (Codex / Claude / Grok / Gemini / OpenAI-compatible / Local)
            ▼
   Desktop Host Proxy (`/api/proxy`, 仅做转发/UA/SSE 透传，不做业务)
```

## 3. 数据契约

### 3.1 平台与账号类型

```ts
export type GatewayPlatform =
  | 'codex' | 'claude' | 'grok' | 'gemini'
  | 'openai' | 'deepseek' | 'openai-compatible' | 'local';

export type AccountAuthType =
  | 'api_key'      // 标准平台 API Key
  | 'oauth'        // 完整 OAuth（access token + refresh token）
  | 'refresh_token'// RT 手动授权（refresh token + access token）
  | 'setup_token'; // Claude Code inference-only token

export type AccountStatus =
  | 'active' | 'disabled' | 'error' | 'expired' | 'quota_exhausted';
```

### 3.2 账号与凭据

```ts
export interface UpstreamCredential {
  authType: AccountAuthType;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;      // access token 过期时间戳(ms)
  setupToken?: string;     // Claude setup token
  orgId?: string;          // Claude 组织 UUID
  orgName?: string;
  cookie?: string;         // Codex 会话 Cookie（可选）
}

export interface AccountQuota {
  refreshedAt: number;
  limit: number;           // 窗口内总配额（请求数或点数）
  used: number;
  remaining: number;
  windowHours: number;
  source: 'upstream' | 'estimated' | 'unknown';
}

export interface GatewayAccount {
  id: string;                       // `acct-<platform>-<n>`
  platform: GatewayPlatform;
  label: string;
  authType: AccountAuthType;
  credential: UpstreamCredential;
  baseUrl: string;
  enabled: boolean;
  status: AccountStatus;
  quota: AccountQuota;
  concurrency: { active: number; max: number };
  health: { lastProbeAt?: number; lastError?: string; consecutiveErrors: number };
  models: string[];                 // 可服务模型白名单（空 = 平台全部）
  stickySessionTtlMs: number;       // 默认 3600_000
  createdAt: number;
  updatedAt: number;
}
```

### 3.3 下游 Key 分发

```ts
export interface DownstreamKey {
  id: string;              // `key_<uuid>`
  key: string;             // `sk-tcode-<prefix>-<secret>`（secret 仅展示一次）
  name: string;
  enabled: boolean;
  groups: string[];        // 路由分组（默认 `default`）
  modelAllowlist: string[] | null;  // null=全部
  dailyTokenBudget?: number;        // 每日 Token 预算
  usedTokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  createdAt: number;
}
```

### 3.4 用量与计费

```ts
export interface UsageRecord {
  id: string;
  accountId: string;
  downstreamKeyId: string;
  model: string;
  sessionKey: string;
  inputTokens: number; outputTokens: number;
  cacheReadTokens: number; cacheWriteTokens: number;
  costUsd: number;
  startedAt: number; finishedAt: number;
  status: 'ok' | 'error' | 'cancelled';
}

export interface ModelPricing {
  inputPerM: number; outputPerM: number;
  cacheReadPerM?: number; cacheWritePerM?: number;
}

export function computeCost(usage: TokenUsage, pricing: ModelPricing): number;
// cost = input/1e6*inputPerM + output/1e6*outputPerM
//      + cacheRead/1e6*(cacheReadPerM ?? inputPerM*0.1)
//      + cacheWrite/1e6*(cacheWritePerM ?? inputPerM)
```

## 4. 智能调度器（RouteScheduler）

```ts
export interface RouteRequest {
  model: string;
  platform: GatewayPlatform;
  sessionKey?: string;          // 粘性会话键（会话 ID）
  preferredAccountId?: string;  // 用户手动指定账号
  signal?: AbortSignal;
}
export interface RouteDecision {
  account: GatewayAccount;
  reason: 'sticky' | 'preferred' | 'round_robin' | 'failover' | 'mixed';
  stickyKey?: string;
}
export function selectAccount(
  pool: GatewayAccount[],
  req: RouteRequest,
  state: SchedulerState
): RouteDecision;
```

**选择规则（按优先级）**：
1. 候选过滤：`enabled && status==='active' && concurrency.active < max && quota.remaining > 0 && 连续错误 < 3`；
2. **粘性会话**：`sessionKey` 命中 1h TTL 内记录且账号仍健康 → 复用；
3. **用户指定**：`preferredAccountId` 在候选集 → 命中；
4. **轮询/LRU**：候选集中按 `lastUsedAt` 最久未用者优先（round-robin 等价于 LRU）；
5. **故障转移**：当前账号配额耗尽/报错（401/403/429/5xx/RESOURCE_EXHAUSTED）时，从候选集中剔除并选择下一个（最多重试 2 次）；
6. **混合调度**：平台候选为空但存在备用平台池（如 Gemini 溢出 → Antigravity）时，使用备用池。

**并发与配额状态机**：进入请求 `active+1`；结束（完成/失败/取消）`active-1`；
连续错误累计，成功清零；配额不足置 `quota_exhausted`，轮询刷新后恢复。

## 5. OAuth / 凭据生命周期（Codex / Claude / Grok）

所有上游网络交互经 Desktop Host Proxy，前端只做编排；网络层以 fetch mock 做自动化测试。

### 5.1 Codex（OpenAI ChatGPT 内部 API）

- 端点：`https://chatgpt.com/backend-api/codex/responses`（OAuth/RT）、`https://api.openai.com/v1/responses`（API Key）；
- 手动授权：用户粘贴 `access_token` + `refresh_token`（来自 Codex CLI OAuth 或 cookie 换码）；
- 自动刷新：`POST https://auth.openai.com/oauth/token`（grant_type=refresh_token）；
- 请求转换：剥离 `max_output_tokens`、`temperature`、`prompt_cache_retention`；`store=false`、`stream=true`；工具调用 id 归一化（`fc_` 前缀、≤64 字符）；多轮工具调用保留 `item_reference`/`id`；
- 配额探测：`GET /backend-api/codex/usage`（5h/7d 窗口）。

### 5.2 Claude（Anthropic）

- API Key：`https://api.anthropic.com/v1/messages` + `x-api-key` + `anthropic-version`；
- OAuth：授权码换码 `POST https://platform.claude.com/v1/oauth/token`（授权端点 `claude.ai/oauth/authorize`），返回 `access_token` + `refresh_token` + `setup_token`；
- 组织发现：`GET https://claude.ai/api/organizations`（Bearer oauth token）→ 选取 team 组织，保存 `orgId`；
- 自动刷新：`POST /v1/oauth/token`（grant_type=refresh_token）；
- 请求转换：`max_tokens` 必填（默认按模型输出上限）；`cache_control` 块；thinking 块透传；剥离 OpenAI 专属字段。

### 5.3 Grok（xAI）

- API Key：`https://api.x.ai/v1/chat/completions`；
- OAuth/RT：SSO 授权后粘贴 `access_token`/`refresh_token`；自动刷新；`GET https://api.x.ai/v1/usage`（或等效）探测配额；
- 请求转换：OpenAI-compatible，工具调用 `tool_calls` 归一化；`stream_options.include_usage`。

### 5.4 凭据安全

- `CredentialVault`：凭据仅写入 localStorage + 宿主磁盘（现有 `/api/storage`），读取即用即销；
- fail-closed：云端账号缺有效凭据时在路由前拒绝，禁止带空/伪凭据发请求；
- 前端 UI 永远不展示完整 secret（仅掩码 + 复制按钮）。

## 6. 请求/响应转换与兼容修复（RequestTransformer）

统一中间表示（IR）采用 **OpenAI Responses 风格**，提供四个方向转换：

```
Anthropic Messages ←→ IR(Responses) ←→ Chat Completions
Responses(原生) ←→ IR
```

### 6.1 修复清单（对应需求 5：工具调用与长对话上游参数错误）

| # | 场景 | 修复 |
|---|---|---|
| T1 | Codex OAuth 拒绝 `temperature/max_output_tokens` | 剥离（见 5.1） |
| T2 | 长对话超上下文窗口 | 预算感知裁剪：保留 system + 最近 N 条，按 `contextLimit` 与估算 Token 裁剪（估算 = ceil(len/3.2)），丢弃最旧非 system |
| T3 | 工具调用参数长度/格式 | 统一 `tool_calls[].id/type/function`；id 归一化（`fc_` ≤64）；参数必须是合法 JSON 字符串；流式片段按 call_id 合并再解析 |
| T4 | `stream_options` 缺失导致无 usage | Chat Completions 强制 `stream_options: {include_usage: true}`，解析 `usage` 事件 |
| T5 | Anthropic `max_tokens` 缺失 400 | 按模型输出上限默认填充；`stream` 语义映射（`stream:true` + `stream_options`） |
| T6 | 上游不支持的字段（`reasoning_effort`、`prompt_cache_retention`、`store`） | 按平台白名单剥离 |
| T7 | 重复/空 system 消息 | 合并为单条 system；过滤空 content 消息 |
| T8 | 非法 JSON/NaN 泄漏 | 序列化前 `JSON.parse(JSON.stringify())` 清洗 + 剔除 undefined/NaN |

## 7. 网关门面（GatewayFacade）

```ts
export interface GatewayFacade {
  request(req: GatewayRequest): Promise<GatewayResult>;   // 完整流式/非流式管线
  refreshQuota(accountId: string): Promise<AccountQuota>;
  issueDownstreamKey(input): DownstreamKey;
  revokeDownstreamKey(keyId): void;
  recordUsage(record: UsageRecord): void;
  getBalance(keyId): TokenUsage;
}
```

`GatewayRequest`：`{ downstreamKey, model, platform, sessionKey, messages, systemPrompt, temperature, tools?, signal }`。

管线（同步顺序）：
1. 校验下游 Key（存在/启用/模型白名单/预算）→ 拒绝则 401/403；
2. `selectAccount`（调度器）；
3. `RequestTransformer` 归一化请求体；
4. `UpstreamAdapter` 构造上游请求（经 `/api/proxy`，携带正确 UA/鉴权头）；
5. 流式读取 → `parseGatewayEvent` → 归一化工具调用/终止事件；
6. `UsageLedger.record`（从 usage 事件或估算回填）+ `BillingEngine.computeCost`；
7. 错误 → 判断可重试（429/5xx/配额）→ `selectAccount` 故障转移重试（≤2 次）；不可重试 → 返回结构化错误。

## 8. 验收场景（自动化测试）

1. 多账号：同一平台 3 个账号，粘性会话复用同一账号；新会话 LRU 轮换；
2. 故障转移：首选账号配额耗尽 → 自动切到健康账号；
3. 并发上限：账号 active==max 时不参与候选；
4. 计费：`computeCost` 对输入/输出/缓存 Token 精确到小数点后 6 位；usage 记录可聚合到账号与下游 Key；
5. Key 分发：签发/吊销/掩码；模型白名单与每日预算生效；
6. 转换：Codex 剥离字段；长对话裁剪不超 `contextLimit`；工具调用 id 归一化与流式片段合并；`include_usage` 注入；
7. OAuth：Codex/Claude/Grok 换码与刷新（fetch mock）正确构造请求并持久化 token；
8. fail-closed：缺凭据账号被路由前拒绝，不发出 HTTP 请求。

## 9. 存储与宿主集成

- 账号/Key/用量持久化：`localStorage`（键 `codemind_gateway_v2_*`）+ 宿主 `/api/storage`（现有机制）；
- 上游网络：统一走 `/api/proxy`（桌面宿主）；浏览器直连仅限非 127.0.0.1 的调试模式；
- 现有 `modelGateway.ts`（v1）保留为兼容层：`ModelRegistry`/`resolveModelRoute` 继续服务旧目录；v2 `GatewayFacade` 成为 Agent Loop 的新入口，v1 逐步降级为只读目录源。


## 9. 本轮实现与真实验收记录（2026-08-30）

### 9.1 实现清单

- `prototype/src/services/gateway/`：`types`（域模型）、`accounts`（多账号注册表 + fail-closed 凭据校验）、`scheduler`（粘性/LRU/故障转移）、`keys`（下游 Key 分发）、`usage`（Token 级计费 + 账本）、`transform`（统一 IR + 兼容修复）、`oauth`（Codex/Claude/Grok 换码与刷新）、`adapters`（上游传输面）、`gateway`（门面：key 门禁→调度→转换→上游→流解析→计费→故障转移）、`store`（localStorage + 宿主磁盘持久化）、`gatewayRuntime`（默认单例 + 桌面代理接线 + 默认客户端 Key）；
- `prototype/src/components/GatewayAccountManager.tsx`：Settings 网关 v2 管理面板（平台/账号 CRUD/凭据/密钥/用量）；
- `prototype/src/App.tsx`：Agent Loop 在平台存在网关账号时走 v2 调度（`prepare` + 增量流式 + `recordCompletion`），否则回退 v1。

### 9.2 自动化测试（51 个网关测试，全绿）

| 模块 | 用例数 | 覆盖 |
| --- | --- | --- |
| billing | 6 | computeCost 精确度/缓存回退/账本聚合 |
| scheduler | 9 | 可用性过滤/粘性/优先/LRU/故障转移/模型白名单 |
| keys | 6 | 签发/吊销/掩码/模型白名单/预算/用量 |
| accounts | 5 | 多账号/CRUD/fail-closed/本地免 Key/并发错误配额 |
| transform | 9 | 长对话裁剪/工具 id 归一化/Codex 剥离/Anthropic/chat 修复 |
| oauth | 6 | 三平台换码与刷新/错误结构化 |
| gateway | 6 | 端到端流式+计费/Key 门禁/429 故障转移/异常 EOF/Claude 路由/prepare+record |
| store | 4 | 持久化 round-trip/清除 |

### 9.3 安装宿主验证

- `dist/Tcode-Setup.exe` 静默安装 → `Tcode.exe` 独立启动：`/health` HTTP 200、`/` HTTP 200；
- 产物 JS 含 `codemind_gateway_v2`、`sk-tcode`、`acct-`、`include_usage` 及三平台 OAuth 端点，证明 v2 已随包分发；
- 远程模型真实调用仍以用户有效凭据为准（OAuth/API Key），环境内已按 fail-closed 处理。
