use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderPlatform {
    Anthropic,
    Openai,
    Gemini,
    Deepseek,
    Siliconflow,
    Kimi,
    Zhipu,
    Grok,
    Ollama,
    Custom,
}

impl Default for ProviderPlatform {
    fn default() -> Self {
        Self::Deepseek
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IngressType {
    ApiKey,
    Oauth,
    Sub2,
    Cap,
    SetupToken,
    Bedrock,
    Vertex,
    Proxy,
}

impl Default for IngressType {
    fn default() -> Self {
        Self::ApiKey
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayChannel {
    pub id: String,
    pub name: String,
    pub platform: ProviderPlatform,
    pub ingress_type: IngressType,
    pub base_url: String,
    pub api_key: Option<String>,
    pub auth_payload: Option<serde_json::Value>,
    pub models: Vec<String>,
    pub priority: u32,
    pub weight: u32,
    pub enabled: bool,
    pub is_healthy: bool,
    pub last_latency_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayHealthResult {
    pub channel_id: String,
    pub success: bool,
    pub http_status: u16,
    pub latency_ms: u64,
    pub models_found: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfigDatabase {
    pub active_channel_id: Option<String>,
    pub channels: Vec<GatewayChannel>,
}

impl Default for GatewayConfigDatabase {
    fn default() -> Self {
        Self {
            active_channel_id: Some("ch_agentrouter".to_string()),
            channels: vec![
                GatewayChannel {
                    id: "ch_agentrouter".to_string(),
                    name: "AgentRouter 官方中转".to_string(),
                    platform: ProviderPlatform::Openai,
                    ingress_type: IngressType::Proxy,
                    base_url: "https://agentrouter.org".to_string(),
                    api_key: Some("sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ".to_string()),
                    auth_payload: None,
                    models: vec![
                        "deepseek-v4-flash".to_string(),
                        "gpt-5.6-sol".to_string(),
                        "claude-opus-5".to_string(),
                        "claude-opus-4-8".to_string(),
                        "glm-5.3".to_string(),
                    ],
                    priority: 1,
                    weight: 100,
                    enabled: true,
                    is_healthy: true,
                    last_latency_ms: Some(138),
                },
                GatewayChannel {
                    id: "default-deepseek".to_string(),
                    name: "DeepSeek 官方直连".to_string(),
                    platform: ProviderPlatform::Deepseek,
                    ingress_type: IngressType::ApiKey,
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    api_key: None,
                    auth_payload: None,
                    models: vec!["deepseek-chat".to_string(), "deepseek-reasoner".to_string()],
                    priority: 2,
                    weight: 80,
                    enabled: true,
                    is_healthy: true,
                    last_latency_ms: Some(98),
                },
                GatewayChannel {
                    id: "default-siliconflow".to_string(),
                    name: "SiliconFlow 硅基流动备用".to_string(),
                    platform: ProviderPlatform::Siliconflow,
                    ingress_type: IngressType::ApiKey,
                    base_url: "https://api.siliconflow.cn/v1".to_string(),
                    api_key: None,
                    auth_payload: None,
                    models: vec!["deepseek-ai/DeepSeek-V3".to_string(), "deepseek-ai/DeepSeek-R1".to_string()],
                    priority: 2,
                    weight: 50,
                    enabled: true,
                    is_healthy: true,
                    last_latency_ms: Some(112),
                },
                GatewayChannel {
                    id: "default-ollama".to_string(),
                    name: "Ollama 本地离线模型".to_string(),
                    platform: ProviderPlatform::Ollama,
                    ingress_type: IngressType::ApiKey,
                    base_url: "http://127.0.0.1:11434".to_string(),
                    api_key: None,
                    auth_payload: None,
                    models: vec!["qwen2.5-coder:latest".to_string(), "deepseek-r1:latest".to_string()],
                    priority: 3,
                    weight: 10,
                    enabled: true,
                    is_healthy: false,
                    last_latency_ms: None,
                },
            ],
        }
    }
}
