use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use crate::core::types::RiskAssessment;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSchema {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct PluginContext {
    pub workspace_dir: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutput {
    pub success: bool,
    pub content: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug)]
pub enum PluginError {
    ExecutionFailed(String),
    PermissionDenied(String),
    InvalidArguments(String),
    NotFound(String),
}

impl std::fmt::Display for PluginError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PluginError::ExecutionFailed(msg) => write!(f, "Execution error: {}", msg),
            PluginError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            PluginError::InvalidArguments(msg) => write!(f, "Invalid arguments: {}", msg),
            PluginError::NotFound(msg) => write!(f, "Not found: {}", msg),
        }
    }
}

impl std::error::Error for PluginError {}

#[async_trait]
pub trait CapabilityPlugin: Send + Sync {
    fn metadata(&self) -> PluginMetadata;
    fn tools(&self) -> Vec<ToolSchema>;
    async fn call(&self, tool: &str, args: serde_json::Value, ctx: &PluginContext) -> Result<ToolOutput, PluginError>;
    fn evaluate_risk(&self, tool: &str, args: &serde_json::Value) -> RiskAssessment;
}
