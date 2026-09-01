use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

use crate::gateway::types::{GatewayChannel, GatewayConfigDatabase, GatewayHealthResult};

pub struct GatewayEngine {
    db_path: PathBuf,
    config: Arc<Mutex<GatewayConfigDatabase>>,
    http_client: reqwest::Client,
}

impl GatewayEngine {
    pub fn new() -> Self {
        let db_dir = dirs_or_fallback();
        let _ = fs::create_dir_all(&db_dir);
        let db_path = db_dir.join("gateway_channels.json");

        let data = if db_path.exists() {
            fs::read_to_string(&db_path)
                .ok()
                .and_then(|s| serde_json::from_str::<GatewayConfigDatabase>(&s).ok())
                .unwrap_or_default()
        } else {
            let default_db = GatewayConfigDatabase::default();
            let _ = fs::write(&db_path, serde_json::to_string_pretty(&default_db).unwrap_or_default());
            default_db
        };

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .unwrap_or_default();

        Self {
            db_path,
            config: Arc::new(Mutex::new(data)),
            http_client,
        }
    }

    pub async fn list_channels(&self) -> GatewayConfigDatabase {
        self.config.lock().await.clone()
    }

    pub async fn save_channel(&self, mut channel: GatewayChannel) -> Result<GatewayChannel, String> {
        let mut cfg = self.config.lock().await;
        if let Some(pos) = cfg.channels.iter().position(|c| c.id == channel.id) {
            cfg.channels[pos] = channel.clone();
        } else {
            if channel.id.is_empty() {
                channel.id = uuid::Uuid::new_v4().to_string();
            }
            cfg.channels.push(channel.clone());
        }

        let json = serde_json::to_string_pretty(&*cfg).map_err(|e| e.to_string())?;
        let _ = fs::write(&self.db_path, json);
        Ok(channel)
    }

    pub async fn delete_channel(&self, channel_id: &str) -> Result<(), String> {
        let mut cfg = self.config.lock().await;
        if let Some(pos) = cfg.channels.iter().position(|c| c.id == channel_id) {
            cfg.channels.remove(pos);
            if cfg.active_channel_id.as_deref() == Some(channel_id) {
                cfg.active_channel_id = cfg.channels.first().map(|c| c.id.clone());
            }
            let json = serde_json::to_string_pretty(&*cfg).map_err(|e| e.to_string())?;
            let _ = fs::write(&self.db_path, json);
            return Ok(());
        }
        Err("Channel not found".to_string())
    }

    pub async fn set_active_channel(&self, channel_id: &str) -> Result<(), String> {
        let mut cfg = self.config.lock().await;
        if cfg.channels.iter().any(|c| c.id == channel_id) {
            cfg.active_channel_id = Some(channel_id.to_string());
            let json = serde_json::to_string_pretty(&*cfg).map_err(|e| e.to_string())?;
            let _ = fs::write(&self.db_path, json);
            return Ok(());
        }
        Err("Channel not found".to_string())
    }

    pub async fn test_channel(&self, channel: &GatewayChannel) -> GatewayHealthResult {
        let start = Instant::now();
        let base = channel.base_url.trim_end_matches('/');
        let models_url = if base.ends_with("/v1") {
            format!("{}/models", base)
        } else {
            format!("{}/v1/models", base)
        };

        let mut req = self.http_client.get(&models_url).header("User-Agent", "opencode/1.0");
        if let Some(key) = &channel.api_key {
            if !key.trim().is_empty() {
                req = req.header("Authorization", format!("Bearer {}", key.trim()));
            }
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let latency_ms = start.elapsed().as_millis() as u64;
                if resp.status().is_success() {
                    let mut models_found = Vec::new();
                    if let Ok(val) = resp.json::<serde_json::Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            for item in arr.iter().take(20) {
                                if let Some(id) = item.get("id").and_then(|i| i.as_str()) {
                                    models_found.push(id.to_string());
                                }
                            }
                        }
                    }
                    GatewayHealthResult {
                        channel_id: channel.id.clone(),
                        success: true,
                        http_status: status,
                        latency_ms,
                        models_found,
                        message: format!("探活成功 (HTTP {}) · TTFT: {}ms", status, latency_ms),
                    }
                } else {
                    let err_txt = resp.text().await.unwrap_or_default();
                    GatewayHealthResult {
                        channel_id: channel.id.clone(),
                        success: false,
                        http_status: status,
                        latency_ms,
                        models_found: vec![],
                        message: format!("上游返回错误 (HTTP {}): {}", status, err_txt),
                    }
                }
            }
            Err(err) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                GatewayHealthResult {
                    channel_id: channel.id.clone(),
                    success: false,
                    http_status: 0,
                    latency_ms,
                    models_found: vec![],
                    message: format!("网络连接超时或无法触达: {}", err),
                }
            }
        }
    }

    pub async fn pull_models(&self, base_url: &str, api_key: Option<&str>) -> Result<Vec<String>, String> {
        let base = base_url.trim_end_matches('/');
        let models_url = if base.ends_with("/v1") {
            format!("{}/models", base)
        } else {
            format!("{}/v1/models", base)
        };

        let mut req = self.http_client.get(&models_url).header("User-Agent", "opencode/1.0");
        if let Some(key) = api_key {
            if !key.trim().is_empty() {
                req = req.header("Authorization", format!("Bearer {}", key.trim()));
            }
        }

        let resp = req.send().await.map_err(|e| format!("Request failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Upstream error: HTTP {}", resp.status()));
        }

        let val: serde_json::Value = resp.json().await.map_err(|e| format!("Parse JSON failed: {}", e))?;
        let mut models = Vec::new();
        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
            for item in arr {
                if let Some(id) = item.get("id").and_then(|i| i.as_str()) {
                    models.push(id.to_string());
                }
            }
        }
        Ok(models)
    }
}

fn dirs_or_fallback() -> PathBuf {
    if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        PathBuf::from(home).join(".tcode")
    } else {
        PathBuf::from(".tcode")
    }
}
