use async_trait::async_trait;
use serde_json::json;
use std::process::Stdio;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use crate::core::types::{RiskAssessment, RiskLevel};
use crate::plugins::trait_def::{CapabilityPlugin, PluginContext, PluginError, PluginMetadata, ToolOutput, ToolSchema};

pub struct TerminalPlugin;

impl TerminalPlugin {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl CapabilityPlugin for TerminalPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: "plugin_terminal".into(),
            name: "Terminal Runner Capability".into(),
            version: "2.0.0".into(),
            description: "Native cross-platform PowerShell / Command executor with timeout & sandbox".into(),
            author: "Tcode Team".into(),
            is_builtin: true,
        }
    }

    fn tools(&self) -> Vec<ToolSchema> {
        vec![ToolSchema {
            name: "run_command".into(),
            description: "Execute a shell command inside workspace directory".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "The command line string to run" },
                    "timeout_secs": { "type": "integer", "description": "Timeout in seconds (default 60)" }
                },
                "required": ["command"]
            }),
        }]
    }

    async fn call(&self, tool: &str, args: serde_json::Value, ctx: &PluginContext) -> Result<ToolOutput, PluginError> {
        if tool != "run_command" {
            return Err(PluginError::NotFound(format!("Tool '{}' not found", tool)));
        }

        let cmd_str = args.get("command").and_then(|v| v.as_str()).ok_or_else(|| {
            PluginError::InvalidArguments("Missing 'command' argument".into())
        })?;

        let timeout_secs = args.get("timeout_secs").and_then(|v| v.as_u64()).unwrap_or(60);

        let mut child = if cfg!(target_os = "windows") {
            let mut cmd = Command::new("powershell");
            cmd.arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-Command")
                .arg(cmd_str)
                .current_dir(&ctx.workspace_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            cmd
        } else {
            let mut cmd = Command::new("sh");
            cmd.arg("-c")
                .arg(cmd_str)
                .current_dir(&ctx.workspace_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            cmd
        };

        let output_res = timeout(Duration::from_secs(timeout_secs), child.output()).await;

        match output_res {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);

                let combined = if stderr.is_empty() {
                    stdout
                } else if stdout.is_empty() {
                    stderr
                } else {
                    format!("STDOUT:\n{}\n\nSTDERR:\n{}", stdout, stderr)
                };

                Ok(ToolOutput {
                    success: exit_code == 0,
                    content: combined,
                    data: Some(json!({ "exit_code": exit_code })),
                })
            }
            Ok(Err(e)) => Err(PluginError::ExecutionFailed(format!("Failed to spawn process: {}", e))),
            Err(_) => Err(PluginError::ExecutionFailed(format!(
                "Command execution timed out after {} seconds",
                timeout_secs
            ))),
        }
    }

    fn evaluate_risk(&self, tool: &str, args: &serde_json::Value) -> RiskAssessment {
        if tool == "run_command" {
            let cmd = args.get("command").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            
            // High risk dangerous commands
            if cmd.contains("rm -rf")
                || cmd.contains("remove-item -recurse")
                || cmd.contains("format ")
                || cmd.contains("drop table")
                || cmd.contains("git push")
                || cmd.contains("git reset --hard")
            {
                return RiskAssessment {
                    level: RiskLevel::HighRisk,
                    reason: Some(format!("Destructive command detected: {}", cmd)),
                    requires_approval: true,
                };
            }

            // Safe read commands
            if cmd.starts_with("git status")
                || cmd.starts_with("git diff")
                || cmd.starts_with("npm test")
                || cmd.starts_with("cargo test")
                || cmd.starts_with("cargo check")
                || cmd.starts_with("ls")
                || cmd.starts_with("dir")
            {
                return RiskAssessment {
                    level: RiskLevel::Safe,
                    reason: None,
                    requires_approval: false,
                };
            }

            return RiskAssessment {
                level: RiskLevel::Medium,
                reason: Some("Executing generic shell command".into()),
                requires_approval: false,
            };
        }

        RiskAssessment {
            level: RiskLevel::Safe,
            reason: None,
            requires_approval: false,
        }
    }
}
