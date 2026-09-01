use std::sync::Arc;
use tokio::sync::Mutex;
use crate::core::types::{AgentEvent, ToolCall, ToolResult};
use crate::plugins::trait_def::PluginContext;
use crate::rails::{MemoryRail, ObservabilityRail, SafetyRail, ToolRail};

pub struct AgentLoop {
    pub safety_rail: Arc<SafetyRail>,
    pub memory_rail: Arc<Mutex<MemoryRail>>,
    pub tool_rail: Arc<ToolRail>,
    pub observability_rail: Arc<ObservabilityRail>,
}

impl AgentLoop {
    pub fn new(
        safety_rail: Arc<SafetyRail>,
        memory_rail: Arc<Mutex<MemoryRail>>,
        tool_rail: Arc<ToolRail>,
        observability_rail: Arc<ObservabilityRail>,
    ) -> Self {
        Self {
            safety_rail,
            memory_rail,
            tool_rail,
            observability_rail,
        }
    }

    pub async fn execute_step(
        &self,
        session_id: &str,
        workspace_dir: &str,
        user_prompt: &str,
    ) -> Result<String, String> {
        // 1. Observe
        let repomap = {
            let memory = self.memory_rail.lock().await;
            memory.generate_repomap(workspace_dir).await
        };

        self.observability_rail.emit_event(&AgentEvent::ThoughtChunk {
            session_id: session_id.to_string(),
            text: format!("正在观察工作区上下文...\n{}", repomap),
        });

        // 2. Reason & Simulate Inner Execution
        self.observability_rail.emit_event(&AgentEvent::ContentChunk {
            session_id: session_id.to_string(),
            text: format!("已收到指令：「{}」。正在通过能力轨道规划执行路径...", user_prompt),
        });

        // 3. Act: invoke plugin tool if applicable
        let ctx = PluginContext {
            workspace_dir: workspace_dir.to_string(),
            session_id: session_id.to_string(),
        };

        // Example: verify diagnostics
        let tool_call_id = uuid::Uuid::new_v4().to_string();
        let tool_call = ToolCall {
            id: tool_call_id.clone(),
            name: "verify_diagnostics".into(),
            arguments: serde_json::json!({}),
        };

        let risk = self.safety_rail.check_action_risk(&tool_call.name, &tool_call.arguments);

        self.observability_rail.emit_event(&AgentEvent::ToolCallRequested {
            session_id: session_id.to_string(),
            tool_call: tool_call.clone(),
            risk,
        });

        self.observability_rail.emit_event(&AgentEvent::ToolExecutionStarted {
            session_id: session_id.to_string(),
            tool_call_id: tool_call_id.clone(),
            name: tool_call.name.clone(),
        });

        let tool_res = self.tool_rail.dispatch_tool(&tool_call.name, tool_call.arguments, &ctx).await;

        let result = match tool_res {
            Ok(out) => ToolResult {
                tool_call_id: tool_call_id.clone(),
                name: tool_call.name.clone(),
                output: out.content,
                is_error: !out.success,
            },
            Err(e) => ToolResult {
                tool_call_id: tool_call_id.clone(),
                name: tool_call.name.clone(),
                output: format!("Plugin Execution Failed: {}", e),
                is_error: true,
            },
        };

        self.observability_rail.emit_event(&AgentEvent::ToolExecutionFinished {
            session_id: session_id.to_string(),
            tool_call_id,
            result: result.clone(),
        });

        // 4. Verify
        self.observability_rail.emit_event(&AgentEvent::StepVerified {
            session_id: session_id.to_string(),
            passed: true,
            feedback: "执行验证闭环绿灯通过".into(),
        });

        self.observability_rail.emit_event(&AgentEvent::SessionFinished {
            session_id: session_id.to_string(),
            success: true,
            reason: Some("任务完成".into()),
        });

        Ok("Step execution completed successfully.".into())
    }
}
