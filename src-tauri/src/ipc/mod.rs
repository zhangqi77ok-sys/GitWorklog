use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use crate::core::agent_loop::AgentLoop;
use crate::core::task_engine::TaskEngine;
use crate::core::types::{ModelConfig, TaskDAG};
use crate::plugins::trait_def::{PluginContext, PluginMetadata, ToolOutput, ToolSchema};
use crate::plugins::{FsPlugin, LspPlugin, McpPlugin, SearchPlugin, TerminalPlugin};
use crate::rails::{MemoryRail, ObservabilityRail, PlanningRail, SafetyRail, ToolRail};

pub struct AppState {
    pub task_engine: Mutex<Option<Arc<TaskEngine>>>,
    pub tool_rail: Mutex<ToolRail>,
    pub memory_rail: Arc<Mutex<MemoryRail>>,
    pub safety_rail: Arc<SafetyRail>,
    pub planning_rail: Arc<PlanningRail>,
    pub observability_rail: Arc<ObservabilityRail>,
}

impl AppState {
    pub fn new() -> Self {
        let mut tool_rail = ToolRail::new();
        tool_rail.register_plugin(Arc::new(FsPlugin::new()));
        tool_rail.register_plugin(Arc::new(TerminalPlugin::new()));
        tool_rail.register_plugin(Arc::new(SearchPlugin::new()));
        tool_rail.register_plugin(Arc::new(LspPlugin::new()));
        tool_rail.register_plugin(Arc::new(McpPlugin::new("github")));

        Self {
            task_engine: Mutex::new(None),
            tool_rail: Mutex::new(tool_rail),
            memory_rail: Arc::new(Mutex::new(MemoryRail::new())),
            safety_rail: Arc::new(SafetyRail::new()),
            planning_rail: Arc::new(PlanningRail::new()),
            observability_rail: Arc::new(ObservabilityRail::new(None)),
        }
    }
}

#[tauri::command]
pub async fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginMetadata>, String> {
    let tool_rail = state.tool_rail.lock().await;
    Ok(tool_rail.list_plugins())
}

#[tauri::command]
pub async fn export_tools(state: State<'_, AppState>) -> Result<Vec<ToolSchema>, String> {
    let tool_rail = state.tool_rail.lock().await;
    Ok(tool_rail.export_all_tools())
}

#[tauri::command]
pub async fn execute_tool(
    state: State<'_, AppState>,
    tool_name: String,
    args: serde_json::Value,
    workspace_dir: String,
    session_id: String,
) -> Result<ToolOutput, String> {
    let tool_rail = state.tool_rail.lock().await;
    let ctx = PluginContext {
        workspace_dir,
        session_id,
    };
    tool_rail
        .dispatch_tool(&tool_name, args, &ctx)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn submit_prompt(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    workspace_dir: String,
    prompt: String,
) -> Result<TaskDAG, String> {
    let mut obs = ObservabilityRail::new(Some(app.clone()));
    obs.set_app_handle(app);
    let obs_arc = Arc::new(obs);

    let tool_rail_snapshot = {
        let _tr = state.tool_rail.lock().await;
        let mut new_tr = ToolRail::new();
        new_tr.register_plugin(Arc::new(FsPlugin::new()));
        new_tr.register_plugin(Arc::new(TerminalPlugin::new()));
        new_tr.register_plugin(Arc::new(SearchPlugin::new()));
        new_tr.register_plugin(Arc::new(LspPlugin::new()));
        Arc::new(new_tr)
    };

    let agent_loop = Arc::new(AgentLoop::new(
        state.safety_rail.clone(),
        state.memory_rail.clone(),
        tool_rail_snapshot,
        obs_arc,
    ));

    let engine = TaskEngine::new(agent_loop, state.planning_rail.clone());
    engine.run_goal(&session_id, &workspace_dir, &prompt).await
}

#[tauri::command]
pub async fn test_gateway_connection(config: ModelConfig) -> Result<String, String> {
    let gateway = crate::core::ModelGateway::new();
    gateway.test_connection(&config).await
}
