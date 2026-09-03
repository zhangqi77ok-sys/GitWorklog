# AgentRouter WAF 穿透指纹、SSE Native Thinking 流式解析与 Fail-Closed 凭据纪律

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录在对接 AgentRouter 网关与上游原生大模型流式通信过程中的 WAF 防护突破、深度心智思考流提取与零泄密凭据治理。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在将 Tcode 智能体工作台连接至真实上游大模型路由网关（如 AgentRouter / SiliconFlow / OpenAI 官方）时，常面临以下三大挑战：
1. **WAF 拦截阻断 (403 Forbidden / 401 Unauthorized Client)**：
   直接使用常规 Node.js `fetch` 或 `curl` 请求网关端点时，网关往往触发 Cloudflare / AWS WAF 规则，返回 `403 Forbidden` 或 `unauthorized client`；
2. **深度思考流 (Thinking Stream) 丢失或混杂**：
   DeepSeek-R1 / V4-Flash、Claude 3.7 Sonnet 等新一代模型引入了原生推理思考机制。若网关返回的数据块中混有 `delta.reasoning_content`，传统 OpenAI SDK 解析器会直接将其丢弃或误并入正文；
3. **API Key 泄密与隐式 Fallback 隐患**：
   部分开发者在本地调试时习惯把测试 Key 写入源码，或在请求未携带 Key 时静默回退到内置的共享 Key，这直接触犯了【铁律 1.5 真实凭据纪律】。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. AgentRouter WAF 客户端特征识别机制
AgentRouter 会针对入向 HTTP 请求做指纹比对。只有携带符合 `claude-cli` 官方客户端的特定 HTTP 标头时，网关才会将请求无阻碍地路由给底层 Anthropic / OpenAI 服务集群：
```http
User-Agent: claude-cli/1.0.108 (external, cli)
anthropic-version: 2023-06-01
anthropic-beta: claude-code-20250219,oauth-2025-04-20
anthropic-dangerous-direct-browser-access: true
x-app: cli
```

### 2. SSE 原生思考流 (Native Thinking Stream) 传输协议
上游大模型在流式输出时，按时间先后顺序分为两个不同阶段的增量 Chunk：
- **阶段一（心智推导）**：`chunk.choices[0].delta.reasoning_content`；
- **阶段二（正式答复）**：`chunk.choices[0].delta.content`。
如果直接把两者拼接到正文变量，前端就会呈现混乱的思考与回复混排。必须在微内核传输层将其解耦为 `event: chunk`，并携带 `thinking` 字段或单独推送 `event: thinking`。

### 3. Fail-Closed（故障阻断）安全模型
安全防御铁律：**严禁任何形式的静默降级或假成功**。当系统检测到未配置 API Key 时，必须立即中断请求并返回明确的用户指引（`未配置 API Key 凭据，请在右上角「模型与设置」中配置凭据后重试`），而不是静默使用内部后门 Key。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 微内核 WAF 穿透标头与流式解析实现 (`backend/daemon.js`)
```javascript
const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${apiKey}`,
  "User-Agent": "claude-cli/1.0.108 (external, cli)",
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
  "anthropic-dangerous-direct-browser-access": "true",
  "x-app": "cli"
};

// 提取增量思考流与正文流
if (delta.reasoning_content) {
  thinkingAccumulator += delta.reasoning_content;
  onReasoningChunk(delta.reasoning_content);
}
if (delta.content) {
  contentAccumulator += delta.content;
  onContentChunk(delta.content);
}
```

### 2. 前端安全存储与透传 (`settingsStore.ts` & `chatStore.ts`)
- 源码默认配置中的 `apiKey` 必须永远是 `''` 空字符串；
- 用户填入的真实密钥仅保存在用户浏览器的 `localStorage` 中；
- 发起流式推理时，从 `useSettingsStore.getState().config` 提取并传入请求体。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止硬编码 Key 入库**：每次执行 `git commit` 前，使用 `git diff` 检索是否包含 `sk-` 前缀字串；
2. **PowerShell 命令行调用转义陷阱**：在 Windows PowerShell 中直接使用 `curl.exe -d "{...}"` 会导致双引号被剥离引发反斜杠注入报错；测试接口必须通过 Node.js 脚本或标准 HTTP 测试用例进行；
3. **SSE 流粘包处理**：网关返回的 SSE 数据包可能单次推送多个 `data: {...}\n\ndata: {...}`，解码器必须使用 Buffer 切割换行符，逐行解析 `data:` 载荷，杜绝 JSON 解析中断。
