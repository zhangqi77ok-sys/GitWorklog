use crate::core::types::{Subtask, SubtaskStatus, TaskDAG};
use uuid::Uuid;

pub struct PlanningRail;

impl PlanningRail {
    pub fn new() -> Self {
        Self
    }

    pub fn create_dag_from_goal(&self, goal: &str) -> TaskDAG {
        // High-level task decomposition
        let subtasks = vec![
            Subtask {
                id: Uuid::new_v4().to_string(),
                title: "1. 需求理解与环境观察 (Observe)".into(),
                description: format!("分析目标上下文与工作区状态: {}", goal),
                status: SubtaskStatus::Running,
                dependencies: vec![],
                evidence: vec![],
            },
            Subtask {
                id: Uuid::new_v4().to_string(),
                title: "2. 方案规划与代码修改 (Act)".into(),
                description: "执行文件读写、补丁修改或命令执行".into(),
                status: SubtaskStatus::Pending,
                dependencies: vec![],
                evidence: vec![],
            },
            Subtask {
                id: Uuid::new_v4().to_string(),
                title: "3. 编译诊断与结果验证 (Verify)".into(),
                description: "运行自动化测试与编译诊断确保自愈".into(),
                status: SubtaskStatus::Pending,
                dependencies: vec![],
                evidence: vec![],
            },
        ];

        TaskDAG {
            goal: goal.to_string(),
            subtasks,
            current_index: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_dag_from_goal() {
        let rail = PlanningRail::new();
        let dag = rail.create_dag_from_goal("重构认证模块");
        assert_eq!(dag.goal, "重构认证模块");
        assert_eq!(dag.subtasks.len(), 3);
        assert_eq!(dag.subtasks[0].status, SubtaskStatus::Running);
    }
}
