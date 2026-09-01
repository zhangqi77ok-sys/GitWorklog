use std::sync::Arc;
use crate::core::agent_loop::AgentLoop;
use crate::core::types::{AgentEvent, TaskDAG};
use crate::rails::PlanningRail;

pub struct TaskEngine {
    pub agent_loop: Arc<AgentLoop>,
    pub planning_rail: Arc<PlanningRail>,
}

impl TaskEngine {
    pub fn new(agent_loop: Arc<AgentLoop>, planning_rail: Arc<PlanningRail>) -> Self {
        Self {
            agent_loop,
            planning_rail,
        }
    }

    pub async fn run_goal(
        &self,
        session_id: &str,
        workspace_dir: &str,
        goal: &str,
    ) -> Result<TaskDAG, String> {
        let dag = self.planning_rail.create_dag_from_goal(goal);

        for subtask in &dag.subtasks {
            self.agent_loop.observability_rail.emit_event(&AgentEvent::SubtaskUpdated {
                session_id: session_id.to_string(),
                subtask: subtask.clone(),
            });
        }

        let _ = self.agent_loop.execute_step(session_id, workspace_dir, goal).await?;

        Ok(dag)
    }
}
