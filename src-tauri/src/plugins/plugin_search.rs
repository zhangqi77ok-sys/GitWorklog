use async_trait::async_trait;
use serde_json::json;
use std::path::Path;
use tokio::fs;
use crate::core::types::{RiskAssessment, RiskLevel};
use crate::plugins::trait_def::{CapabilityPlugin, PluginContext, PluginError, PluginMetadata, ToolOutput, ToolSchema};

pub struct SearchPlugin;

impl SearchPlugin {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl CapabilityPlugin for SearchPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: "plugin_search".into(),
            name: "Search & Grep Capability".into(),
            version: "2.0.0".into(),
            description: "Fast in-memory and recursive text grep across workspace".into(),
            author: "Tcode Team".into(),
            is_builtin: true,
        }
    }

    fn tools(&self) -> Vec<ToolSchema> {
        vec![ToolSchema {
            name: "grep_search".into(),
            description: "Search for pattern or string inside workspace files".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Text pattern or regex to search" },
                    "max_results": { "type": "integer", "description": "Maximum matches to return (default 50)" }
                },
                "required": ["query"]
            }),
        }]
    }

    async fn call(&self, tool: &str, args: serde_json::Value, ctx: &PluginContext) -> Result<ToolOutput, PluginError> {
        if tool != "grep_search" {
            return Err(PluginError::NotFound(format!("Tool '{}' not found", tool)));
        }

        let query = args.get("query").and_then(|v| v.as_str()).ok_or_else(|| {
            PluginError::InvalidArguments("Missing 'query' argument".into())
        })?;

        let max_results = args.get("max_results").and_then(|v| v.as_u64()).unwrap_or(50) as usize;

        // Perform recursive file search
        let ws = Path::new(&ctx.workspace_dir);
        let mut results = Vec::new();
        let mut stack = vec![ws.to_path_buf()];

        while let Some(dir) = stack.pop() {
            if let Ok(mut read_dir) = fs::read_dir(&dir).await {
                while let Ok(Some(entry)) = read_dir.next_entry().await {
                    let path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();

                    if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                        continue;
                    }

                    if path.is_dir() {
                        stack.push(path);
                    } else if path.is_file() {
                        if let Ok(content) = fs::read_to_string(&path).await {
                            for (line_idx, line) in content.lines().enumerate() {
                                if line.contains(query) {
                                    let rel_path = path.strip_prefix(ws).unwrap_or(&path).to_string_lossy();
                                    results.push(format!("{}:{}: {}", rel_path, line_idx + 1, line.trim()));
                                    if results.len() >= max_results {
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if results.len() >= max_results {
                        break;
                    }
                }
            }
            if results.len() >= max_results {
                break;
            }
        }

        let output_text = if results.is_empty() {
            format!("No matches found for query: {}", query)
        } else {
            results.join("\n")
        };

        Ok(ToolOutput {
            success: true,
            content: output_text,
            data: Some(json!({ "count": results.len() })),
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
