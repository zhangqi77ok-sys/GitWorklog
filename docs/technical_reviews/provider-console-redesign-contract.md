# 模型服务商控制台重设计契约 (Provider Console Redesign Contract)

> 用户需求（2026-08-30 澄清确认）：
> 1. 模型服务商前端与后端重新设计，当前布局混乱、无设计感；
> 2. **合并为单一体系**：v1 Provider 旧目录降级为内置模型元数据，账号/凭据统一由 v2 Account 管理；
> 3. **三栏 Master-Detail 布局**：左平台导航 / 中账号列表 / 右详情编辑与测试；
> 4. **添加账号后自动真实连通性测试**，可用即可被调度；
> 5. **概率轮询调度**：N 个可用账号各 1/N 概率被选中（2 账号即 50/50）；
> 6. **每 5 分钟刷新**一次账号可用状态。

## 1. 目标与边界

### 1.1 目标
1. **统一数据源**：服务商=平台，账号=凭据实例；聊天路由只认 v2 Account，v1 Provider 仅作内置模型目录/文档元数据；
2. **三栏控制台**：暖色极简（`#FAF8F5` 底 / `#D96B27` 陶土橙 / `#1E1C1A` 暖炭黑），控件 24-28px，无大卡片网格；
3. **真实健康探测**：新增账号后立即 probe（真实 HTTP 请求 `/models` 等），失败如实标记，不伪造健康；
4. **概率调度**：候选账号池中均匀随机（每账号 1/N），保留 sticky/用户指定优先；
5. **5 分钟周期刷新**：定时重探所有启用账号，更新状态与额度。

### 1.2 边界（Out of Scope）
- 不重写 OAuth 换码/RT 刷新内核（已有 `oauth.ts`），仅复用；
- 不改动下游 Key 签发/计费内核（`keys.ts`/`usage.ts`），UI 归入右栏；
- `/models` 清单同步逻辑保留，但入口并入新控制台。

## 2. 数据契约

### 2.1 调度策略（概率轮询）

```ts
export type SelectionStrategy = 'probability' | 'lru';

export interface SelectAccountOptions {
  strategy?: SelectionStrategy;   // 默认 'probability'
}

// selectAccount(pool, req, state, now, options?)
// 优先级：sticky 会话 → 用户指定账号 → （策略）：
//   probability：在候选池中均匀随机（每账号 1/N）
//   lru：最近最少使用
```

### 2.2 健康探测

```ts
export interface ProbeResult {
  ok: boolean;
  status: GatewayAccount['status'];
  latencyMs: number;
  error?: string;
  quota?: AccountQuota;   // 若上游返回额度信息则记录
  probedAt: number;
}

export async function probeAccount(
  account: GatewayAccount,
  opts?: { fetchImpl?: typeof fetch; resolveProxy?: (url: string) => { url: string; headers: Record<string, string> } }
): Promise<ProbeResult>
```

探测行为：
- 本地账号（`isLocalAccount`）→ 探测 `{base}/models`；
- 云端账号 → 带凭据请求 `{base}/models`（GET），HTTP 2xx 视为 active；
- 401/403 → `expired`（凭据失效）；429 → `quota_exhausted`；网络错误/5xx → `error`；
- 探测结果写回 `AccountRegistry`（`markSuccess` / `markError` / `refreshQuota` / `status`）。

### 2.3 定时刷新（5 分钟）

```ts
export class AccountProbeScheduler {
  constructor(deps: { registry: AccountRegistry; probe: typeof probeAccount; intervalMs?: number });
  start(): void;   // 立即对启用账号探测一轮，再每 intervalMs（默认 5min）轮询
  stop(): void;
  probeAll(): Promise<void>;
}
```

### 2.4 UI 布局（三栏）

```
┌──────────┬──────────────────────────┬──────────────────────────────┐
│ 平台导航   │ 账号列表                  │ 详情编辑 + 测试               │
│ Codex  (2)│ ▸ codex-主号  [OAuth·绿]   │ 名称 / 鉴权方式 / 凭据字段     │
│ Claude (0)│ ▸ codex-副号  [API·橙]    │ Base URL / 模型白名单 / 并发   │
│ Grok   (1)│                          │ [立即探测] [保存] [删除]       │
│ ...       │ + 添加账号                │ ─ 下游 Key / 用量 ─           │
└──────────┴──────────────────────────┴──────────────────────────────┘
```

## 3. 验收场景（自动化测试）

1. `selectAccount` 概率策略：候选池 2 账号，多次采样统计每账号被选概率 ≈ 50%（±容差）；
2. `probeAccount`：mock fetch 2xx → active / 401 → expired / 429 → quota_exhausted / 网络错误 → error，且写回 registry；
3. `AccountProbeScheduler`：立即首轮探测 + 按 interval 轮询（mock 时钟），stop 后不再触发；
4. 添加账号后调用 `probeAccount`（UI 触发即时探测）；
5. 三栏控制台渲染：平台导航、账号列表、详情编辑、下游 Key 区块齐全；v1 老列表不再出现在设置网关 Tab；
6. 全量测试回归 + EXE 真实安装 + 桌面端真实探测/调度验证。

## 4. 平台增补：OpenCode 独立服务商（2026-08-30）

按用户要求新增独立平台 `opencode`：

- `GatewayPlatform` 增加 `'opencode'`；`DEFAULT_BASE_URLS.opencode = 'https://opencode.ai/zen/v1'`；
- `platformForProvider('provider-opencode')` → `'opencode'`（原为 openai-compatible）；
- `adapterFor('opencode')` → `'openai-compatible-chat'`；`buildUpstreamRequest` → `{base}/chat/completions` + Bearer；
- `RequestTransformer` 对 opencode 输出流式 chat_completions 请求体；
- `DEFAULT_PLATFORM_MODELS.opencode = ['mimo-v2.5-free', 'deepseek-v4-flash', 'nemotron-3.5-lightning-free']`；
- ProviderConsole 平台导航新增「OpenCode ⚡」。

验收：`tests/gateway/opencode.test.ts`（6 项：映射/默认地址/adapter/上游请求/请求体/默认模型）。
