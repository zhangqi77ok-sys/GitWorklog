# 全流式契约：所有模型调用必须流式 (Stream-Only Contract)

> 用户需求：**所有必须流式**。即 Tcode 内任何真实的大模型生成请求都必须以
> 流式（SSE，`stream: true`）发送与消费；禁止任何非流式（`stream: false` + `response.json()`）的生成路径。

## 1. 目标与边界

### 1.1 目标
1. **请求恒流式**：所有上游 LLM 生成请求体必须包含 `stream: true`，覆盖 Chat、Responses、Anthropic Messages、Google Native 四种 Adapter；
2. **消费恒流式**：响应必须按 SSE 逐行消费（`data:` 事件），聚合内容/思维链/工具调用；禁止对生成端点直接 `response.json()`；
3. **终态仍守 P0 铁律**：空 Body、非法 `data:` JSON、EOF 无 `[DONE]`/`finish_reason` 必须显式报错，不得静默吞掉或误标完成；
4. **回归守卫**：静态扫描 `prototype/src`，禁止出现 `stream: false` 字面量或向 `buildGatewayRequestBody` 传入布尔 stream 实参。

### 1.2 边界（Out of Scope）
- `/models` 模型清单拉取、连通性探测（GET 型接口）不属于生成请求，无需流式；
- v2 网关 `RequestTransformer` 的 `stream: boolean` 字段保留（契约类型），但网关调用方恒传 `true`；
- UI 打字机渲染 / SSE 事件投影不在本轮改动范围（已有实现）。

## 2. 数据契约

### 2.1 请求构建（强制恒流式）

```ts
// 原签名（stream 可被调用方改为 false，风险源）
// buildGatewayRequestBody(route, messages, stream = true, temperature = 0.3)

// 新签名：移除 stream 参数，任何 adapter 恒输出 stream: true
export function buildGatewayRequestBody(
  route: ResolvedModelRoute,
  messages: GatewayMessage[],
  temperature = 0.3
): GatewayRequestBody
```

覆盖 adapter：
- `openai-responses` → `{ model, input, stream: true, temperature }`
- `anthropic-messages` → `{ model, system, messages, max_tokens, stream: true, temperature }`
- `google-generative-language` → `{ model, contents, systemInstruction, generationConfig, stream: true }`
- 默认 `openai-compatible-chat` → `{ model, messages, stream: true, temperature }`

### 2.2 流式消费助手（共享积木）

```ts
export interface ConsumedSseResult {
  content: string;
  reasoning: string;
  finished: boolean;
  toolCalls: NormalizedToolCall[];
}

export async function consumeSseResponse(
  response: Response,
  adapter: ModelAdapter,
  signal?: AbortSignal
): Promise<ConsumedSseResult>
```

行为：
- 逐行解析 `data: <json>`，`[DONE]` 视为正常终止；
- 逐事件调用 `parseGatewayEvent(adapter, json)` 聚合 `content` / `reasoning` / `toolCalls`；
- HTTP 200 但零字节 Body → 抛 `provider_empty_response` 语义错误；
- `data:` 事件 JSON 非法 → 抛 `tool_protocol_error` 语义错误（禁止静默吞掉）；
- EOF 但无终止事件 → 抛 `stream_interrupted` 语义错误；
- `signal.aborted` → 抛 AbortError（`cancelled`）。

## 3. 受影响的调用点（必须全部改造为流式）

| 调用点 | 现状 | 改造 |
| --- | --- | --- |
| `multiRoleAgentRunner.callLLM`（Swarm 角色执行） | `stream=false` + `response.json()` | 流式发送 + `consumeSseResponse` 聚合 |
| `ModelGateway.request()`（v1 完整请求） | `stream=false` + `response.json()` | 流式发送 + `consumeSseResponse` 聚合 |
| `llmStreamingClient.startStream`（打字机） | 已流式 | 适配新签名（去除 `true` 实参） |
| `App.tsx` 主 Agent Loop | 已流式 | 适配新签名（去除 `true` 实参） |
| v2 `gateway.request/prepare` | 已 `stream:true` | 无需改动 |

## 4. 验收场景（自动化测试）

1. `buildGatewayRequestBody` 四种 adapter 恒 `stream: true`；
2. `consumeSseResponse` 聚合多块 content/reasoning、识别 `[DONE]`、空 Body 抛错（provider_empty_response）、非法 JSON 抛错（tool_protocol_error）、EOF 无终止事件抛错（stream_interrupted），且 abort 信号会取消读取；
3. `ModelGateway.request()` 发送 `stream: true` 请求体并消费 SSE 返回聚合文本；
4. 静态扫描 `prototype/src`：无 `stream: false` / `stream = false`；无 `buildGatewayRequestBody(..., <bool>)` 旧式调用；`ModelGateway.request` 发送 `stream: true` 请求体并消费 SSE；
5. 全量测试回归 + EXE 真实安装 + 桌面端真实流式调用验证（`mimo-v2.5-free` SSE 200 + `[DONE]`）。
