# 📘 Tcode Next-Gen AI 模型网关引擎 (AI Model Gateway & Hub)
## 产品需求文档与技术契约规约说明书 (PRD)

> **文档版本**：v2.2.0  
> **编写团队**：Tcode 架构设计组 / 产品体验中心 / 核心引擎研发组  
> **深度参考标杆**：`D:\weihu\sub2api`（企业级 AI API 聚合与智能调度分发网关架构）  
> **归档路径**：[`docs/PRD_TCODE_MODEL_GATEWAY.md`](file:///d:/weihu/agent-learning/docs/PRD_TCODE_MODEL_GATEWAY.md)

---

## 1. 业务背景与设计愿景 (Background & Vision)

在现代 AI Agentic IDE（如 Cursor、Windsurf、Claude Code、Codex）中，模型层是整个智能体的大脑中枢。然而，开发者在实际日常开发中经常面临多供应商协议割裂、Token 计费混乱、OAuth 令牌维护复杂等痛点。

为此，Tcode 深度参考吸收 **`sub2api`** 的成熟网关体系，在 **Tcode Rust Core 内核** 中构建轻量、极速、无锁、支持多类型渠道接入与智能调度的 **内置真·AI 模型网关引擎 (Tcode Model Gateway)**。

---

## 2. 核心架构拓扑图 (Architecture Topology)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Tcode UI (React 19 + TypeScript Gateway Cockpit)                │
│       [ 渠道管理 | 6大接入模式 | 实时测速探活 | 智能调度与粘性会话 | 模型别名映射 ]        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Tauri v2 Typed IPC (`gateway_ipc`)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                    Tcode Rust Core Daemon - Model Gateway Engine                       │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Multi-Type Channel Ingress (6 大多元化网关接入适配器 - 参考 sub2api)          │  │
│  │    ① 标准 API Key (OpenAI / DeepSeek / SiliconFlow / Kimi / 智谱 / Groq)         │  │
│  │    ② OAuth 授权登录 (Anthropic Claude / Google Gemini / Grok / Codex OAuth)     │  │
│  │    ③ Setup Token / Session 令牌 (Claude Code CLI / Web Session 推理专有 Token)   │  │
│  │    ④ 云厂商企业凭据 (AWS Bedrock SigV4 / Google Vertex AI Service Account JSON)  │  │
│  │    ⑤ 上游中转透传 (Custom Reverse Proxy / OneAPI / NewAPI 自定义 Header)        │  │
│  │    ⑥ 本地/私有化引擎 (Ollama / LM Studio / vLLM / LocalAI)                       │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │                                            │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │ 2. Dual Billing Mode & Protocol Adaptive Engine (双计费模式与协议自适应转发)       │  │
│  │    • Mode 1: PAYG 按量扣费 (余额检测与按 Token 成本实时核算)                     │  │
│  │    • Mode 2: Coding Plan 订阅模式 (5h / 7d 滚动窗口用量保护与速率熔断)            │  │
│  │    • API Protocol Adaptive: Chat Completions ➔ Anthropic Messages ➔ Responses   │  │
│  │    • Zero-Transform Passthrough (同协议直通零开销；跨协议自动执行 AST/JSON 桥接) │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │                                            │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │ 3. Smart Scheduler & Multi-Account Pool (智能调度器与账号池负载均衡)              │  │
│  │    • Sticky Session (会话粘性，最大化 Prompt Cache KV-Cache 命中率 >90%)          │  │
│  │    • Account Health Circuit Breaker (熔断降级: 429 冷却退避 / 500 惩罚 / 401 报警)│  │
│  │    • Weighted Priority & Round-Robin (多账号优先级与负载均衡)                     │  │
│  │    • Model Aliasing & Routing (虚拟模型别名映射: `tcode/fast` -> `deepseek-chat`) │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │                                            │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │ 4. Resilience, Proxy & Security Vault (韧性网络、代理与密钥安全库)                 │  │
│  │    • HTTP / SOCKS5 住宅/数据中心代理隔离  • Reqwest HTTP/2 连接池与 Keep-Alive    │  │
│  │    • 本地 SQLite AES-GCM 加密密钥库       • 请求/日志脱敏 (Credentials Redaction) │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │ Upstream HTTP Requests                     │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐  │
│  │ 5. Telemetry & Pricing Engine (遥测与计费引擎)                                    │  │
│  │    • 首字延迟 (TTFT) / 传输速率 (TPS)      • Token 精确计量 (Input/Output/Cache)   │  │
│  │    • 实时成本计算 (Model Pricing Map)     • 请求历史与 Trace 归档                 │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 六大网关接入方式详细规格 (6 Core Ingress Types)

参考 `sub2api` 的成熟实现，Tcode 模型网关全面支持以下 6 种添加网关方式：

### 方式 1：标准 API Key 接入 (`apikey`)
* **适用场景**：官方 OpenAI、DeepSeek、SiliconFlow（硅基流动）、Moonshot（Kimi）、智谱 GLM、Groq、OpenRouter 等。
* **输入字段**：
  * `provider_type`: `OpenAI` / `DeepSeek` / `SiliconFlow` / `Kimi` / `Zhipu` / `OpenRouter`
  * `base_url`: API 服务端点（如 `https://api.deepseek.com/v1`）
  * `api_key`: `sk-...`
  * `models`: 声明或自动拉取的模型列表（如 `deepseek-chat`, `deepseek-reasoner`）
* **特性**：支持一键“从端点自动拉取模型列表 (`/v1/models`)”。

### 方式 2：OAuth 2.0 授权登录 (`oauth`)
* **适用场景**：Anthropic Claude Pro/Team 订阅、Google Gemini Advanced、xAI Grok、OpenAI Codex 账号。
* **工作流程**：
  1. 点击“OAuth 登录”，系统启动本地临时回调服务并打开浏览器进行官方授权；
  2. 获取 `access_token` 与 `refresh_token` 并安全存入本地 SQLite 加密库；
  3. Rust 后台守护进程在 Token 临近过期（如剩余 10 分钟）时，自动静默调用上游刷新接口进行 `Token Refresh`，用户零感知。

### 3. 方式 3：Setup Token / Session 令牌接入 (`setup-token`)
* **适用场景**：从 Claude Code CLI 导出的 setup-token、官方 Web Session Token。
* **特性**：
  * 该类型 Token 仅具备模型推理（Inference）权限，无账号敏感资料读取权限；
  * 支持配置 Session Hash 校验与防风控 Header 伪装。

### 方式 4：云厂商企业级凭据接入 (`bedrock` / `service_account`)
* **适用场景**：AWS Bedrock 与 Google Cloud Vertex AI 企业私有化部署。
* **接入参数**：
  * **AWS Bedrock**：`aws_access_key_id` + `aws_secret_access_key` + `aws_region`（网关底层自动计算 AWS SigV4 动态请求签名）；
  * **Google Vertex AI**：上传 Google Cloud `service_account.json` 密钥文件，网关自动派生 short-lived OAuth Bearer Token 与 Google Cloud Project ID。

### 方式 5：上游中转透传与自定义 Header (`upstream`)
* **适用场景**：企业内部聚合网关、自建 OneAPI / NewAPI 中转站、第三方高防中继。
* **特性**：
  * 支持自定义 Header 覆写（`account_header_override`）；
  * 支持路径通配与端点重定向（如 `/v1/chat/completions` ➔ `/custom/v1/chat/completions`）。

### 方式 6：本地 / 离线私有化模型 (`ollama`)
* **适用场景**：本地 Ollama、LM Studio、vLLM、OobaBooga。
* **接入参数**：
  * `base_url`: `http://127.0.0.1:11434`
  * `api_key`: 可选（默认无需 Key）
* **特性**：零外网依赖，离线断网时 Agent 自动切换至本地模型运行。

---

## 4. 双计费与协议自适应引擎 (Billing & Adaptive Protocol)

### 4.1 计费模式与限流控制 (Billing Modes)
* **模式 A：PAYG 按量付费 (`payg`)**：
  * 精确追踪 Input Token、Output Token 以及 Cache Read Token（如 DeepSeek/Claude 缓存命中）；
  * 根据模型内置价目表实时计算单次与累计花费。
* **模式 B：Coding Plan 订阅模式 (`coding`)**：
  * 专为 Claude Code / OpenAI Codex 等订阅制套餐设计；
  * 支持 5 小时滚动用量窗口与周级用量阈值监控，用量达标后自动进入优雅冷却或切换备用账号，防止主账号被上游硬限流。

### 4.2 协议自适应与思考流标准化 (Adaptive Protocol)
* **同协议零开销直通**：入站请求为 Anthropic 协议且目标为 Claude 渠道时，直接透传，不做任何 JSON 反序列化损耗；
* **跨协议自动转译**：当 Agent 发送 OpenAI 格式请求但分配给 Anthropic / Gemini 时，网关自动完成 Schema 转换；
* **思考链流式标准化**：
  * 统一提取 DeepSeek `delta.reasoning_content` 与 `<think>` 标签、Claude `thinking` 块；
  * 标准化为 `AgentEvent::ThoughtChunk(String)` 实时推送到前端折叠思考卡片。

---

## 5. 前端交互与视觉规范 (UI/UX Cockpit)

遵循 Tcode 暖色工程极简规范：
* **主色调**：暖米白 `#FAF8F5`、工作台灰 `#F4EFEA`、陶土暖橙 `#D96B27`；
* **网关弹窗布局**：
  * **左侧**：接入方式选择导航（API Key / OAuth 授权 / Setup Token / 云凭据 / 中转站 / 本地 Ollama）；
  * **右侧**：动态表单配置区 + 实时探活测试面板；
  * **底部**：已配置渠道列表卡片（显示健康度指示灯、延迟毫秒数、今日 Token、一键设为默认）。

---

## 6. Rust 核心数据模型契约 (Domain Contracts)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IngressType {
    ApiKey,          // 标准 API Key
    OAuth,           // OAuth 2.0 授权
    SetupToken,      // Setup Token / Session Token
    Bedrock,         // AWS Bedrock (SigV4)
    ServiceAccount,  // Google Vertex AI Service Account
    Upstream,        // 自定义中转透传
    Ollama,          // 本地 Ollama
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BillingMode {
    Payg,            // 按量付费
    Coding,          // Coding Plan 订阅模式
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayChannel {
    pub id: String,
    pub name: String,
    pub ingress_type: IngressType,
    pub billing_mode: BillingMode,
    pub base_url: String,
    pub api_key: Option<String>,
    pub auth_payload: Option<serde_json::Value>, // OAuth tokens, Service Account JSON 等
    pub models: Vec<String>,
    pub priority: u32,
    pub weight: u32,
    pub enabled: bool,
    pub is_healthy: bool,
    pub last_latency_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelHealthVerdict {
    pub channel_id: String,
    pub success: bool,
    pub http_status: u16,
    pub latency_ms: u64,
    pub models_found: Vec<String>,
    pub error_message: Option<String>,
}
```

---

## 7. 实施计划 (Execution Steps)

1. **Step 1：Rust Core 网关多接入内核实现**
   * 创建 `src-tauri/src/gateway/`，实现 `IngressType` 枚举、OpenAI/Claude/Ollama 请求分发器、OAuth 凭据存储与 `test_channel_health` 真实探活请求。
2. **Step 2：Tauri IPC 桥接**
   * 导出 `list_gateway_channels`, `save_gateway_channel`, `delete_gateway_channel`, `test_gateway_channel`, `auto_fetch_models` 命令。
3. **Step 3：前端网关驾驶舱 UI 重构**
   * 在 [`SettingsModal.tsx`](file:///d:/weihu/agent-learning/src/components/settings/SettingsModal.tsx) 提供 6 种接入方式的切换卡片与表单，直连真实 Rust 网关。
4. **Step 4：端到端连通性测试与验证**
   * 真实配置 API Key / Ollama 并在桌面端进行探活，验证通过后构建发布。
