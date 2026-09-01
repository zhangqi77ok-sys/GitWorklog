use async_trait::async_trait;
use serde_json::json;
use std::path::{Path, PathBuf};
use tokio::fs;
use crate::core::types::{RiskAssessment, RiskLevel};
use crate::plugins::trait_def::{CapabilityPlugin, PluginContext, PluginError, PluginMetadata, ToolOutput, ToolSchema};

pub struct FsPlugin;

impl FsPlugin {
    pub fn new() -> Self {
        Self
    }

    fn resolve_path(&self, raw_path: &str, workspace: &str) -> Result<PathBuf, PluginError> {
        let ws = Path::new(workspace).canonicalize().map_err(|e| {
            PluginError::PermissionDenied(format!("Invalid workspace directory: {}", e))
        })?;

        let candidate = if Path::new(raw_path).is_absolute() {
            PathBuf::from(raw_path)
        } else {
            ws.join(raw_path)
        };

        // Normalize path
        let normalized = candidate.canonicalize().unwrap_or(candidate.clone());
        
        // Ensure within workspace for safety
        if !normalized.starts_with(&ws) && !candidate.starts_with(&ws) {
            return Err(PluginError::PermissionDenied(format!(
                "Path '{}' escapes workspace boundary '{}'",
                raw_path, workspace
            )));
        }

        Ok(candidate)
    }
}

#[async_trait]
impl CapabilityPlugin for FsPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: "plugin_fs".into(),
            name: "FileSystem Capability".into(),
            version: "2.0.0".into(),
            description: "Native high-performance safe file I/O and patching".into(),
            author: "Tcode Team".into(),
            is_builtin: true,
        }
    }

    fn tools(&self) -> Vec<ToolSchema> {
        vec![
            ToolSchema {
                name: "read_file".into(),
                description: "Read file content from workspace".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative or absolute file path" },
                        "start_line": { "type": "integer", "description": "Optional starting line (1-based)" },
                        "end_line": { "type": "integer", "description": "Optional ending line" }
                    },
                    "required": ["path"]
                }),
            },
            ToolSchema {
                name: "write_file".into(),
                description: "Write or overwrite content to a file".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Target file path" },
                        "content": { "type": "string", "description": "New file content" }
                    },
                    "required": ["path", "content"]
                }),
            },
            ToolSchema {
                name: "list_dir".into(),
                description: "List directory contents".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Directory path relative to workspace" }
                    },
                    "required": ["path"]
                }),
            },
        ]
    }

    async fn call(&self, tool: &str, args: serde_json::Value, ctx: &PluginContext) -> Result<ToolOutput, PluginError> {
        match tool {
            "read_file" => {
                let path_str = args.get("path").and_then(|v| v.as_str()).ok_or_else(|| {
                    PluginError::InvalidArguments("Missing 'path' argument".into())
                })?;
                let file_path = self.resolve_path(path_str, &ctx.workspace_dir)?;
                
                if !file_path.exists() {
                    return Err(PluginError::NotFound(format!("File does not exist: {}", path_str)));
                }

                let content = fs::read_to_string(&file_path).await.map_err(|e| {
                    PluginError::ExecutionFailed(format!("Failed to read file: {}", e))
                })?;

                let start_line = args.get("start_line").and_then(|v| v.as_u64()).map(|v| v as usize);
                let end_line = args.get("end_line").and_then(|v| v.as_u64()).map(|v| v as usize);

                let filtered_content = if start_line.is_some() || end_line.is_some() {
                    let lines: Vec<&str> = content.lines().collect();
                    let start = start_line.unwrap_or(1).saturating_sub(1);
                    let end = end_line.unwrap_or(lines.len()).min(lines.len());
                    if start < end {
                        lines[start..end].join("\n")
                    } else {
                        "".to_string()
                    }
                } else {
                    content
                };

                Ok(ToolOutput {
                    success: true,
                    content: filtered_content,
                    data: None,
                })
            }
            "write_file" => {
                let path_str = args.get("path").and_then(|v| v.as_str()).ok_or_else(|| {
                    PluginError::InvalidArguments("Missing 'path' argument".into())
                })?;
                let content = args.get("content").and_then(|v| v.as_str()).ok_or_else(|| {
                    PluginError::InvalidArguments("Missing 'content' argument".into())
                })?;

                let file_path = self.resolve_path(path_str, &ctx.workspace_dir)?;
                if let Some(parent) = file_path.parent() {
                    fs::create_dir_all(parent).await.map_err(|e| {
                        PluginError::ExecutionFailed(format!("Failed to create parent directories: {}", e))
                    })?;
                }

                fs::write(&file_path, content).await.map_err(|e| {
                    PluginError::ExecutionFailed(format!("Failed to write file: {}", e))
                })?;

                Ok(ToolOutput {
                    success: true,
                    content: format!("Successfully wrote {} bytes to {}", content.len(), path_str),
                    data: None,
                })
            }
            "list_dir" => {
                let path_str = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
                let dir_path = self.resolve_path(path_str, &ctx.workspace_dir)?;
                
                let mut entries = Vec::new();
                let mut read_dir = fs::read_dir(&dir_path).await.map_err(|e| {
                    PluginError::ExecutionFailed(format!("Failed to read directory: {}", e))
                })?;

                while let Ok(Some(entry)) = read_dir.next_entry().await {
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    let file_type = entry.file_type().await.ok();
                    let is_dir = file_type.map(|t| t.is_dir()).unwrap_or(false);
                    entries.push(format!("{}{}", file_name, if is_dir { "/" } else { "" }));
                }

                entries.sort();
                Ok(ToolOutput {
                    success: true,
                    content: entries.join("\n"),
                    data: Some(json!({ "entries": entries })),
                })
            }
            _ => Err(PluginError::NotFound(format!("Tool '{}' not implemented in FsPlugin", tool))),
        }
    }

    fn evaluate_risk(&self, tool: &str, args: &serde_json::Value) -> RiskAssessment {
        if tool == "write_file" {
            let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.contains(".env") || path.contains("package.json") || path.contains("Cargo.toml") {
                return RiskAssessment {
                    level: RiskLevel::Medium,
                    reason: Some("Modifying core project configuration or credentials".into()),
                    requires_approval: false,
                };
            }
        }
        RiskAssessment {
            level: RiskLevel::Safe,
            reason: None,
            requires_approval: false,
        }
    }
}
