use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

/// Standard execution context for Rails across Inner/Outer Loop
#[derive(Debug, Clone)]
pub struct RailContext {
    pub session_id: String,
    pub workspace_dir: String,
    pub iteration: u32,
    pub budget_tokens_remaining: u64,
}

/// Action decision returned by Rail hooks
#[derive(Debug, Clone)]
pub enum RailDecision {
    Continue,
    Modify(Value),
    Block { reason: String },
}

/// Universal Rail Trait: Capabilities as Plugins
/// Mounted on fixed lifecycle hooks in the execution engine.
#[async_trait]
pub trait RailHandler: Send + Sync {
    /// Rail name for observability & identification
    fn name(&self) -> &str;

    /// Priority: Higher number means executed earlier and can override lower rails
    fn priority(&self) -> u32;

    /// Lifecycle Hook: Before observing workspace/context
    async fn on_before_observe(&self, _ctx: &RailContext) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: After context observation (e.g. MemoryRail injects RepoMap)
    async fn on_after_observe(&self, _ctx: &RailContext, _observed_data: &mut Value) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: Before LLM reasoning
    async fn on_before_reason(&self, _ctx: &RailContext, _prompt: &str) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: Before executing tool/action (e.g. SafetyRail intercepting dangerous commands)
    async fn on_before_act(&self, _ctx: &RailContext, _tool_name: &str, _args: &Value) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: After action has been executed
    async fn on_after_act(&self, _ctx: &RailContext, _tool_name: &str, _output: &str) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: Before verifying results
    async fn on_before_verify(&self, _ctx: &RailContext) -> RailDecision {
        RailDecision::Continue
    }

    /// Lifecycle Hook: After step verification
    async fn on_after_verify(&self, _ctx: &RailContext, _passed: bool, _feedback: &str) -> RailDecision {
        RailDecision::Continue
    }

    /// Outer Loop Hook: Check whether to stop or continue to the next iteration
    async fn on_outer_loop_check(&self, _ctx: &RailContext) -> RailDecision {
        RailDecision::Continue
    }
}

/// Rail Registry that manages and sorts rails by priority
#[derive(Default)]
pub struct RailRegistry {
    rails: Vec<Arc<dyn RailHandler>>,
}

impl RailRegistry {
    pub fn new() -> Self {
        Self { rails: Vec::new() }
    }

    pub fn register(&mut self, rail: Arc<dyn RailHandler>) {
        self.rails.push(rail);
        // Sort descending by priority (highest priority first)
        self.rails.sort_by(|a, b| b.priority().cmp(&a.priority()));
    }

    pub fn rails(&self) -> &[Arc<dyn RailHandler>] {
        &self.rails
    }
}
