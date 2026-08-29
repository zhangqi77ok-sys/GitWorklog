# 上下文容量 HUD 修复规范

## 目标
修复上下文容量达到 100% 后始终不变的问题，使 HUD 能区分“刚好达到上限”和“已经超出上限”，并确保压缩逻辑可以降低实际发送给模型的上下文占用。

## 当前问题
`getContextTelemetry` 使用 `Math.min(100, ...)` 截断使用率。历史消息超过模型上下文上限后，所有更大的值都被显示为 100%。同时，Agent Loop 的 `compressModelContext` 只生成请求副本，不改变 UI 展示的原始会话历史，因此 HUD 仍持续测量超限的原始消息。

## 契约
- `ContextTelemetry.usagePercent` 以当前模型上下文窗口为分母，并封顶为 100%；100% 表示原始历史已达到或超过窗口上限。
- `getEffectiveContextTelemetry` 在接近上限时基于非破坏性的压缩请求副本计算 HUD，压缩后的有效请求占用可以回落到 100% 以下。
- `ContextTelemetry.canProceed` 在实际使用量小于上下文上限时为 `true`，达到或超过上限时为 `false`。
- 使用率达到上限时状态至少为 `force_compress`，不得回退为 `normal`。
- `compressModelContext` 必须压缩历史 `<think>` 与 `<thinking>` 块，以及较大的 `write_file` 块；压缩后的 telemetry 应能反映实际请求副本的下降。
- HUD 可以显示累计 Token，但累计 Token 不是上下文窗口水位；上下文百分比只能使用当前模型的 `contextLimit` 作为分母。

## 边界
- 不改变会话原始消息，压缩仍是非破坏性的请求副本操作。
- 不修改模型真实上下文上限。
- 不把 Token 估算器伪装成供应商精确计量；当前仍使用字符估算。
- 上限非法或小于最小窗口时继续使用现有最小值保护。

## 验收标准
1. 使用量为 100% 时显示 100%。
2. 使用量为 125% 时 telemetry 返回 125%，并且 `canProceed` 为 false。
3. 超限状态为 `force_compress`。
4. 历史 thinking/write_file 内容压缩后，使用量和百分比下降。
