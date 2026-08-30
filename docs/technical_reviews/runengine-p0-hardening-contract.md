# RunEngine P0 硬化技术契约（凭据脱敏 + SSE 终态 + 验收铁律）

> 依据 `~/.gemini/antigravity/brain/<id>/implementation_plan.md` 的 P0 阶段（紧急基础），
> 收敛至本工程现有 `streamProtocol.ts` / `agentLoop.ts` / `contracts.ts` 的契约化改造。

## 1. 目标与边界

### 1.1 目标
1. **硬编码凭据清零**：源码中不允许出现任何 `sk-<secret>` 真实凭据字面量；云端凭据一律来自运行时存储，未配置则 fail-closed 提示中断；
2. **SSE 生命周期终态分类**（严格，禁止误标完成）：
   - `[DONE]` 或 `finish_reason` 终止事件 → `completed`；
   - EOF 但无终止事件 → `stream_interrupted`；
   - HTTP 200 但 Body 为空 → `provider_empty_response`；
   - `data:` 事件 JSON 无法解析 → `tool_protocol_error`（禁止静默吞掉）；
   - AbortController 中断 → `cancelled`；
3. **验收项物理证据铁律**：模型文本自报 `✓` 仅映射为 `model_claimed`；只有真实文件落盘、命令 `exitCode===0` 且无失败模式、或测试断言通过才置为 `passed`（`verified_passed`）。

### 1.2 边界
- P1~P5（ChatTurn/TaskRun 状态机、中央 ToolExecutor、RunStore、ProviderStore、Swarm 收敛）为后续阶段，本轮仅完成 P0 基础止血。

## 2. 数据契约

### 2.1 流终态

```ts
export type StreamTermination =
  | 'completed'
  | 'stream_interrupted'
  | 'cancelled'
  | 'provider_empty_response'
  | 'tool_protocol_error';

export interface StreamTerminationInput {
  readerDone: boolean;
  sawDoneSentinel: boolean;
  sawFinishReason: boolean;
  aborted?: boolean;
  emptyResponse?: boolean;
  toolProtocolError?: boolean;
}
```

判定优先级：`aborted → cancelled`；`emptyResponse → provider_empty_response`；
`toolProtocolError → tool_protocol_error`；`sawDone||sawFinish → completed`；否则 `stream_interrupted`。

### 2.2 验收项

```ts
// contracts.ts TargetAcceptanceItem.status 增加：
//   'model_claimed'  —— 模型自报通过（✓/[x]），不具备物理证据，绝不视为完成
// parseAcceptanceCriteria：✓/[x] → 'model_claimed'；✕ → 'failed'；其余 'pending'
// mergeAcceptanceCriteria：禁止把模型输入升级为 'passed'（含入参误传 'passed' 时降级为 'model_claimed'）
// verifyTargetAcceptance：唯一允许置 'passed' 的路径，且必须携带 evidenceDetails（test/file/command）
```

## 3. 验收场景（自动化测试）

1. `classifyStreamTermination` 对空 Body / 工具协议错误分别返回 `provider_empty_response` / `tool_protocol_error`；
2. `parseAcceptanceCriteria('✓ 完成')` → `model_claimed`（不是 `passed`）；
3. `mergeAcceptanceCriteria` 收到 `passed` 输入 → 不会置 `passed`（降级 `model_claimed`）；
4. `verifyTargetAcceptance` 无物理证据时模型自报项仍为 `model_claimed`，不触发 completed；
5. 静态扫描 `prototype/src` 不含 `sk-<16+位>` 真实凭据字面量；
6. 全量测试回归 + EXE 真实安装 + 桌面端真实模型调用（真实 Key 仅注入运行时存储，不入库）。

---

## 4. 真实桌面端验证记录（2026-08-30 实测）

> 全部验证基于 `python build_installer.py` 增量打包产物（223 项自动化测试全绿后打包），
> 静默安装至独立目录并启动 `Tcode.exe` 完成，非模拟、非仅构建成功。

### 4.1 宿主探活
| 检查项 | 结果 |
| --- | --- |
| `GET http://127.0.0.1:8010/health` | HTTP 200，`{"status":"ok","service":"tcode"}` |
| `GET http://127.0.0.1:8010/` | HTTP 200，完整 HTML（867B） |

### 4.2 真实模型调用（真实 Key 仅运行时注入，未入库）
经桌面宿主 `/api/proxy` 对 OpenCode Zen 上游实测：

| 场景 | 结果 |
| --- | --- |
| `GET https://opencode.ai/zen/v1/models`（Bearer） | HTTP 200（5286B 模型清单） |
| `POST .../chat/completions` `mimo-v2.5-free`（非流式） | HTTP 200，真实 `chat.completion`（usage: 252/16/268 tokens，cost:"0"） |
| `POST .../chat/completions` `mimo-v2.5-free`（`stream:true`） | HTTP 200，`text/event-stream`，24 chunks / 13 个 `data:` 事件，正常 `[DONE]` 终结 |
| `deepseek-v4-flash` / `gpt-5.1-codex` | HTTP 401 `CreditsError: Insufficient balance`（Key 有效但余额不足，上游/额度限制，非应用缺陷） |
| 直连同请求（不经代理） | 与代理结果一致，证明代理透传无篡改 |

### 4.3 过程中发现并已排除的假象
- 早期 PowerShell `curl.exe` 拼 JSON 时 `model` 字段被损坏为空 → 上游报 `Model  is not supported`；
  改用 Node `fetch(JSON.stringify(body))` 后请求体完好，上游返回正常结果。**结论：非应用缺陷，系测试脚本编码问题。**

### 4.4 凭据卫生最终检查
- `git grep -E "sk-[A-Za-z0-9]{20,}"` 覆盖 `prototype/src`、`src-desktop`、`scripts`：无真实 `sk-` 字面量；
- `tests/credentialHygiene.test.ts` 静态扫描通过（仅放行 3 个运行时主动清空的占位符）。
