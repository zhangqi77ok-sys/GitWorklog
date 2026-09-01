use tcode_lib::core::types::{RiskLevel, SubtaskStatus};
use tcode_lib::rails::{PlanningRail, SafetyRail};
use serde_json::json;

#[test]
fn test_safety_rail_dangerous_command_blocked() {
    let safety = SafetyRail::new();
    let risk = safety.check_action_risk("run_command", &json!({ "command": "rm -rf /" }));
    assert_eq!(risk.level, RiskLevel::HighRisk);
    assert!(risk.requires_approval);
}

#[test]
fn test_safety_rail_safe_command_allowed() {
    let safety = SafetyRail::new();
    let risk = safety.check_action_risk("run_command", &json!({ "command": "npm test" }));
    assert_eq!(risk.level, RiskLevel::Safe);
    assert!(!risk.requires_approval);
}

#[test]
fn test_planning_rail_goal_decomposition() {
    let planner = PlanningRail::new();
    let dag = planner.create_dag_from_goal("全量重构认证与权限模块");
    assert_eq!(dag.goal, "全量重构认证与权限模块");
    assert_eq!(dag.subtasks.len(), 3);
    assert_eq!(dag.subtasks[0].status, SubtaskStatus::Running);
}
