use std::path::{Path, PathBuf};
use crate::core::types::{RiskAssessment, RiskLevel};

#[derive(Default)]
pub struct SafetyRail;

impl SafetyRail {
    pub fn new() -> Self {
        Self
    }

    pub fn validate_path(&self, target_path: &Path, workspace_root: &Path) -> Result<PathBuf, String> {
        let ws = workspace_root.canonicalize().map_err(|e| format!("Invalid workspace: {}", e))?;
        let abs_target = if target_path.is_absolute() {
            target_path.to_path_buf()
        } else {
            ws.join(target_path)
        };

        let norm_target = abs_target.canonicalize().unwrap_or(abs_target.clone());

        if !norm_target.starts_with(&ws) && !abs_target.starts_with(&ws) {
            return Err(format!(
                "Security Breach: Path '{:?}' is outside workspace boundary '{:?}'",
                target_path, workspace_root
            ));
        }

        Ok(abs_target)
    }

    pub fn check_action_risk(&self, tool_name: &str, args: &serde_json::Value) -> RiskAssessment {
        if tool_name == "run_command" {
            let cmd = args.get("command").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            if cmd.contains("rm -rf") || cmd.contains("git reset --hard") || cmd.contains("drop table") {
                return RiskAssessment {
                    level: RiskLevel::HighRisk,
                    reason: Some(format!("Destructive shell command: {}", cmd)),
                    requires_approval: true,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_safety_rail_detects_dangerous_command() {
        let rail = SafetyRail::new();
        let risk = rail.check_action_risk("run_command", &json!({ "command": "rm -rf /" }));
        assert_eq!(risk.level, RiskLevel::HighRisk);
        assert!(risk.requires_approval);
    }

    #[test]
    fn test_safety_rail_permits_safe_command() {
        let rail = SafetyRail::new();
        let risk = rail.check_action_risk("run_command", &json!({ "command": "cargo test" }));
        assert_eq!(risk.level, RiskLevel::Safe);
        assert!(!risk.requires_approval);
    }
}
