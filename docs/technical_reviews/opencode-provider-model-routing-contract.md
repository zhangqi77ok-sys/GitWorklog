# OpenCode Zen Provider 与模型级路由技术契约

## 1. 目标与边界

本契约解决四个问题：

1. OpenCode Zen 作为一个统一 Provider/Gateway，不向用户暴露 Responses API 与 Chat Completions 二选一；
2. 同一 Provider 内的模型按照官方目录元数据选择 endpoint、协议与 Adapter；
3. Settings 同步的模型立即进入对话框模型选择器，并使用稳定复合身份；
4. Agent Loop 对流结束、工具调用和失败状态做明确区分，避免问答无故显示完成。

本阶段不实现：完整 Swarm DAG 执行、LangGraph 集成、生产凭据迁移、Tauri Rust 侧新的模型协议实现。普通对话、现有 Harness/Swarm 代码必须通过同一个 ModelGateway 扩展点接入，不能继续自行拼接 endpoint。

## 2. 数据契约

```ts
export type ModelAdapter =
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-language'
  | 'openai-compatible-chat';

export type ModelProtocol =
  | 'responses'
  | 'anthropic_messages'
  | 'google_native'
  | 'chat_completions';

export interface ModelRef {
  providerId: string;
  modelId: string;
  uniqueKey: string; // `${providerId}:${modelId}`
}

export interface ModelCatalogEntry {
  ref: ModelRef;
  displayName: string;
  enabled: boolean;
  adapter: ModelAdapter;
  protocol: ModelProtocol;
  endpointPath: string;
  contextLimit: number;
  outputLimit?: number;
  capabilities: {
    streaming: boolean;
    toolCalling: boolean;
    reasoning: boolean;
    vision: boolean;
    structuredOutput: boolean;
  };
  source: 'official_catalog' | 'custom' | 'builtin';
  description?: string;
}
```

Provider 配置只保存服务入口、密钥和启停状态；`protocol`、`adapter`、`endpointPath` 属于模型目录项，不属于 OpenCode Provider 全局设置。

## 3. ModelGateway 契约

```ts
export interface ModelGatewayRequest {
  model: ModelRef;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ResolvedModelRoute {
  providerId: string;
  modelId: string;
  endpointUrl: string;
  adapter: ModelAdapter;
  protocol: ModelProtocol;
}

export interface ModelGateway {
  resolve(model: ModelRef): ResolvedModelRoute;
  request(request: ModelGatewayRequest): Promise<string>;
}
```

`resolve()` 找不到 Provider、模型、启用状态或 Adapter 时必须抛出可识别错误；禁止根据 Provider 显示名称或模型名猜测协议。

## 4. 模型同步契约

- 同步 `/models` 时保留模型级 endpoint/adapter/protocol/capabilities 元数据；无元数据的自定义模型使用明确的兼容 Chat Adapter，而不是伪装为 OpenCode 原生模型。
- 写入 Provider Registry 后必须派发 `tcode_providers_updated`，事件 detail 为完整 Provider 数组。
- ChatColumn 不维护独立的永久模型缓存，每次 Provider 更新后重新派生可用模型。
- 选中模型持久化 `uniqueKey`；同名模型不得互相覆盖。
- 当前模型被禁用或删除时必须选择可用 fallback，不得保留失效引用。

## 5. Agent Loop 终止契约

- `[DONE]`、finish_reason 或等价终止事件才表示 Provider 正常完成；网络 EOF 本身表示异常中断，除非已经收到终止事件。
- `actions.length === 0` 不等价于完成；无法识别的工具调用必须进入 parse error 或继续请求澄清。
- XML、fenced、JSON、原生 tool call 必须转换为统一 `AgentAction`，原始 XML 不得出现在助手正文。
- 失败、取消、中断、等待审批、完成使用不同状态，UI 只能根据终止状态显示结果。
- 空 catch 不得吞掉流、解析、工具和审批错误；错误必须包含阶段与可重试性。

## 6. 验收场景

1. OpenCode Zen 页面只有一个 Provider；页面没有全局协议二选一。
2. GPT、Claude、Gemini、DeepSeek/兼容模型在同一 Provider 下能解析到不同 Adapter/Endpoint。
3. Settings 同步模型后无需刷新页面即可在 ChatColumn 选择。
4. 两个 Provider 中同名模型共存，`uniqueKey` 不冲突。
5. XML `read_file`/`write_file`/`run_command` 不泄漏到助手正文并可进入执行审批链。
6. 无 `[DONE]` 的异常 EOF 不进入 completed。
7. 模型 HTTP 错误、JSON 解析错误和工具失败均显示真实失败原因。

## 7. 本轮新增门禁与真实验收记录（2026-08-30）

### 7.1 凭据与端点 fail-closed

- `resolve()`、模型目录同步和 Provider 连通性测试都必须先定位明确的 Provider，再校验 `Base URL`；云端 Provider 缺少 API Key 时必须在发起请求前拒绝。
- `localhost`、`127.0.0.1`、`0.0.0.0` 或显式 Ollama Provider 可免 API Key，但不能免 Base URL 和实际网络可达性校验。
- HTTP 400/401/403/500、JSON 解析错误、网络错误和空模型目录不能被标记为健康或同步成功；应保留既有模型目录并展示真实阶段与原因。
- 当前环境没有可用于远程 Provider 真实调用验收的凭据，因此“安装/宿主运行已闭环”不等于“远程模型调用已闭环”。远程调用只能在提供有效凭据和可达端点后单独验收。

### 7.2 原型状态流转

- Settings 与 ChatColumn 都从当前 Provider tab 定位目标 Provider；写入 Registry 后通过 `tcode_providers_updated` 重新派生模型选择器，不维护永久的孤立模型缓存。
- XML `read_file` 只被转换为受控的只读查看动作；路径作为参数传入宿主命令，不把模型输出中的原始 XML 直接当作助手正文或任意命令执行。
- 原生 Responses、Anthropic、Google 和 Chat Completions tool call 统一为 `NormalizedToolCall`，再进入 `AgentAction`/审批链。
- 无终止事件的 EOF、解析失败、无可执行动作但验收项未通过、凭据阻塞分别保持中断/失败、`needs_decision` 或 `blocked` 等非 `completed` 状态。

### 7.3 证据规则

本契约只接受命令输出、安装目录进程和 HTTP 响应作为验收证据。构建成功、静态截图或单独的 UI 成功文案不能替代真实 HTTP 200、完整 HTML、有效模型响应和对应 Agent 终止事件。

### 7.4 默认 Provider 凭据门禁（2026-08-30）

- `INITIAL_PROVIDERS` 只能提供 Provider 元数据和模型目录，不得内置任何看似真实的 API Key、演示 Key 或伪造健康状态。
- 首次启动时，所有云端 Provider 必须以空凭据和未验证状态进入配置；只有用户明确保存凭据并完成真实连通性验证后，才可标记为健康。
- 兼容升级时必须清除已知的历史占位凭据，不能让旧 localStorage 配置绕过 fail-closed 门禁；用户自行保存的未知凭据必须原样保留。
- 缺少凭据应在本地路由阶段显示配置阻塞，而不是发出带伪凭据的 HTTP 请求并将 401/400 误归因于安装器或宿主。

### 7.5 内置目录真实性与默认模型选择门禁（2026-08-30）

**问题复盘**：用户报告 EXE 内 OpenCode 调用失败。根因链：

1. 内置 OpenCode 目录与 `AVAILABLE_MODELS` 含 `hy3-free`（混元 3.0），但该模型**不在 OpenCode Zen 官方目录**（2026-08-30 实拉 63 个模型快照，无 `hy3-free`）；
2. 默认模型选择逻辑硬编码偏好 `hy3/hunyuan` 模型 id，且允许无条件恢复已失效的持久化模型对象（`if (parsed.id && parsed.name) return parsed;`），导致首次启动默认选中 `hy3-free` → 无论凭据是否有效，OpenCode 调用必然失败（无 Key 时本地 fail-closed，有 Key 时上游 model_not_found）；
3. OpenCode Provider 初始 `status:'healthy'` 与空凭据矛盾（运行时已通过 `sanitizeProviderCredentials` 归一为 `untested`，但常量本身不诚实）。

**数据契约**：

```ts
// 默认模型解析：必须从可用列表中返回，绝不返回失效引用
export function resolveInitialModel(all: AIModelOption[]): AIModelOption;
// 规则：
//  1) 优先恢复持久化模型对象，但必须仍在 all 中（uniqueKey/providerId+id/name 精确匹配）；
//  2) 其次按持久化模型 id 精确/包含匹配 all；
//  3) 均未命中时返回 all[0]；all 为空时回退 AVAILABLE_MODELS[0]；
//  4) 禁止按 id 硬编码偏好（如 hy3/hunyuan）挑选模型。
```

**升级迁移规则**（`loadSavedProviders` 路径）：

- `provider-opencode` 的已保存模型目录中，删除已知不存在的 `hy3-free`；其余官方模型与用户自定义模型原样保留；
- 空凭据云端 Provider 一律归一为 `status:'untested'`、`latencyMs:0`（沿用 `sanitizeProviderCredentials`）。

**本轮修复验收（自动化单测）**：

1. 内置 OpenCode 目录（`INITIAL_PROVIDERS[0].models`）与 `AVAILABLE_MODELS` 中所有 `provider-opencode` 模型必须存在于官方目录快照（`tests/fixtures/opencodeZenModels.ts`），且不得包含 `hy3-free`；
2. `resolveInitialModel` 不得返回不在 `all` 中的模型；不得因 id 含 `hy3/hunyuan` 而优先选中；
3. 保存含 `hy3-free` 的旧目录后重新 `loadSavedProviders`，`hy3-free` 被清除且空 Key 状态为 `untested`；
4. `INITIAL_PROVIDERS` 中 OpenCode 初始 `apiKey === ''` 且 `status === 'untested'`。

**范围外**：真实远程调用验收需有效 OpenCode Zen 凭据（当前环境无凭据）；开发模式 Vite `/api/proxy` 支持列为独立问题。
