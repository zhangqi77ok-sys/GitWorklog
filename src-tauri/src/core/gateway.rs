use reqwest::Client;
use serde_json::json;
use crate::core::types::ModelConfig;

pub struct ModelGateway {
    client: Client,
}

impl ModelGateway {
    pub fn new() -> Self {
        Self {
            client: Client::builder().build().unwrap_or_default(),
        }
    }

    pub async fn test_connection(&self, config: &ModelConfig) -> Result<String, String> {
        if config.api_key.trim().is_empty() {
            return Err("API Key 不能为空".into());
        }

        let url = if config.base_url.ends_with("/chat/completions") {
            config.base_url.clone()
        } else {
            format!("{}/chat/completions", config.base_url.trim_end_matches('/'))
        };

        let payload = json!({
            "model": config.model_id,
            "messages": [
                { "role": "user", "content": "ping" }
            ],
            "max_tokens": 5
        });

        let res = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Network request failed: {}", e))?;

        if res.status().is_success() {
            Ok("Connection Successful".into())
        } else {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            Err(format!("Provider returned HTTP {}: {}", status, body))
        }
    }
}
