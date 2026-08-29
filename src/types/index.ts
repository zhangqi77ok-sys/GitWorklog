export interface Account {
  id: string;
  name: string;
  status: "active" | "standby" | "disabled";
  quota_used: number;
  quota_total: number;
  reset_time?: string;
  created_at?: string;
  tags?: string[];
  claude5h?: string;
  claudeWeekly?: string;
  gemini5h?: string;
  geminiWeekly?: string;
  credits?: string;
}

export interface Provider {
  name: string;
  icon?: string;
  version?: string;
  accounts: Account[];
}

export interface Skill {
  id: string;
  name: string;
  desc: string;
  category: "testing" | "refactor" | "docs" | "review";
  enabled: boolean;
}

export interface McpTool {
  id: string;
  name: string;
  server: string;
  desc: string;
  enabled: boolean;
}

export type SettingsTab = "gateway" | "skills" | "mcp" | "logs" | "general" | "shortcuts";
export type CockpitSubTab = "accounts" | "models" | "wakeup" | "multi" | "sessions";
export type AuthMode = "oauth" | "token" | "import";

// 真实大模型渠道配置接口 (参考 New API / One API / Cockpit)
export type ProtocolType = "openai" | "anthropic" | "codex" | "opencode" | "bailian" | "gemini" | "ollama" | "azure" | "custom";
export type RelayMode = "direct" | "newapi" | "sub2api";

export type GeminiAuthMode = "apikey" | "oauth_rt" | "google_oauth" | "credentials_json" | "local_ide";

export interface GeminiAuthCredentials {
  mode: GeminiAuthMode;                // 认证模式 (API Key / RT 导入 / OAuth 授权 / JSON 文件 / 本地 IDE 桥接)
  apiKey?: string;                     // 传统 API Key
  refreshToken?: string;               // 长期有效 Refresh Token (以 1// 开头)
  clientId?: string;                   // Google OAuth Client ID
  clientSecret?: string;               // Google OAuth Client Secret
  accessToken?: string;                // 临时生成的 Access Token (Bearer Token)
  tokenExpiresAt?: number;             // Access Token 过期时间戳 (ms)
  accountEmail?: string;               // 绑定的 Google 账号邮箱 (如 user@gmail.com)
  projectId?: string;                  // GCP Project ID
  localIdePort?: number;               // 本地 Antigravity IDE 桥接监听端口 (默认 32145)
  useLocalIdeBridge?: boolean;         // 是否启用本地 IDE 桥接
  localIdeStatus?: "online" | "offline" | "checking"; // 本地 IDE 探测状态
  lastRefreshedAt?: string;            // 上次刷新时间说明
}

export interface ModelMeta {
  id: string;                          // 模型实际 ID (如 'deepseek-reasoner')
  name?: string;                       // 显示别名
  contextWindow: number;               // 上下文总窗口大小 (如 128000, 200000, 1000000)
  maxOutputTokens?: number;            // 单次输出最大 Token 限制 (如 4096, 8192)
  supportsThinking?: boolean;          // 是否支持深度推理/思考
  custom?: boolean;                    // 是否为用户自定义添加的模型
}

export interface LLMChannel {
  id: string;                          // 唯一渠道标识 (如 'chan-deepseek-official')
  name: string;                        // 渠道名称 (如 'DeepSeek 官方平台')
  type: ProtocolType;                  // 协议类型
  baseUrl: string;                     // 真实 API Base URL (如 'https://api.deepseek.com/v1')
  apiKey: string;                      // 真实 API Key (支持加密与脱敏显示)
  relayMode?: RelayMode;               // 中转站模式 ('direct' | 'newapi' | 'sub2api')
  newApiChannelId?: string;            // NewAPI 中转站专用指定渠道 ID
  sub2ApiUrl?: string;                 // sub2api 专用订阅或聚合网关端点
  geminiAuth?: GeminiAuthCredentials;  // Gemini 专属高级 OAuth / RT 认证凭据
  models: string[];                    // 该渠道支持的模型列表 (如 ['deepseek-chat', 'deepseek-reasoner'])
  modelMetas?: ModelMeta[];            // 每个模型的深度元数据与上下文窗口配置
  modelMapping?: Record<string, string>; // 模型映射重定向字典
  compressionThreshold?: number;       // 上下文自动压缩触发阈值 (默认 0.95，即 95%)
  status: "active" | "disabled" | "error"; // 启用状态
  latencyMs?: number;                  // 最近真实测速延迟 (毫秒)
  lastChecked?: string;                // 最近检查时间
  balance?: string;                    // 额度/余额
  icon?: string;                       // 图标标识
}

export interface GlobalLLMConfig {
  activeChannelId: string;             // 当前激活渠道 ID
  activeModelId: string;               // 当前激活模型 ID
  channels: LLMChannel[];              // 所有配置渠道
  temperature: number;                 // 采样温度 (0.0 ~ 2.0)
  maxTokens: number;                   // 最大 Token 限制
  stream: boolean;                     // 是否启用流式传输
  timeoutSec: number;                  // 超时时间 (秒)
  defaultCompressionThreshold: number; // 全局默认压缩阈值 (0.95)
}
