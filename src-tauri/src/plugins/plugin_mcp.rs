use async_trait::async_trait;
use serde_json::json;
use crate::core::types::{RiskAssessment, RiskLevel};
use crate::plugins::trait_def::{CapabilityPlugin, PluginContext, PluginError, PluginMetadata, ToolOutput, ToolSchema};

pub struct McpPlugin {
    server_name: String,
}

impl McpPlugin {
    pub fn new(server_name: &str) -> Self {
        Self {
            server_name: server_name.to_string(),
        }
    }
}

#[async_trait]
impl CapabilityPlugin for McpPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: format!("mcp_{}", self.server_name),
            name: format!("MCP Server ({})", self.server_name),
            version: "1.0.0".into(),
            description: "External tool bridge over Model Context Protocol (stdio/SSE)".into(),
            author: "External MCP Provider".into(),
            is_builtin: false,
        }
    }

    fn tools(&self) -> Vec<ToolSchema> {
        vec![ToolSchema {
            name: format!("{}_echo", self.server_name),
            description: "Echo message through external MCP protocol server".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "payload": { "type": "string" }
                },
                "required": ["payload"]
            }),
        }]
    }

    async fn call(&self, tool: &str, args: serde_json::Value, _ctx: &PluginContext) -> Result<ToolOutput, PluginError> {
        let payload = args.get("payload").and_then(|v| v.as_str()).unwrap_or("");
        Ok(ToolOutput {
            success: true,
            content: format!("[MCP: {}] Executed tool '{}' with payload: {}", self.server_name, tool, payload),
            data: Some(args),
        })
    }

    fn evaluate_risk(&self, _tool: &str, _args: &serde_json::Value) -> RiskAssessment {
        RiskAssessment {
            level: RiskLevel::Safe,
            reason: None,
            requires_approval: false,
        }
    }
}
