use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::core::agent_loop::AgentLoop;
use crate::core::task_engine::TaskEngine;
use crate::core::types::{ModelConfig, TaskDAG};
use crate::gateway::{GatewayChannel, GatewayConfigDatabase, GatewayEngine, GatewayHealthResult};
use crate::plugins::trait_def::{PluginContext, PluginMetadata, ToolOutput, ToolSchema};
use crate::plugins::{FsPlugin, LspPlugin, McpPlugin, SearchPlugin, TerminalPlugin};
use crate::rails::{MemoryRail, ObservabilityRail, PlanningRail, SafetyRail, ToolRail};
use crate::store::{ChatMessageRecord, ProjectRecord, ProjectSessionStore, ProjectsDatabase, SessionRecord};
use crate::workspace::{FileNode, WorkspaceFsOps};

pub struct AppState {
    pub task_engine: Mutex<Option<Arc<TaskEngine>>>,
    pub tool_rail: Mutex<ToolRail>,
    pub memory_rail: Arc<Mutex<MemoryRail>>,
    pub safety_rail: Arc<SafetyRail>,
    pub planning_rail: Arc<PlanningRail>,
    pub observability_rail: Arc<ObservabilityRail>,
    pub session_store: Arc<ProjectSessionStore>,
    pub gateway_engine: Arc<GatewayEngine>,
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
            session_store: Arc::new(ProjectSessionStore::new()),
            gateway_engine: Arc::new(GatewayEngine::new()),
        }
    }
}

// ==========================================
// STORE & SESSION COMMANDS
// ==========================================

#[tauri::command]
pub async fn list_projects_and_sessions(state: State<'_, AppState>) -> Result<ProjectsDatabase, String> {
    Ok(state.session_store.get_database().await)
}

#[tauri::command]
pub async fn add_project_folder(
    state: State<'_, AppState>,
    path: String,
    name: Option<String>,
) -> Result<ProjectRecord, String> {
    state.session_store.add_project(path, name).await
}

#[tauri::command]
pub async fn create_project_session(
    state: State<'_, AppState>,
    project_id: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
    model_id: Option<String>,
) -> Result<SessionRecord, String> {
    state.session_store.create_session(project_id, title, tags, model_id).await
}

#[tauri::command]
pub async fn update_project_session(
    state: State<'_, AppState>,
    session_id: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
    is_pinned: Option<bool>,
) -> Result<(), String> {
    state.session_store.update_session(session_id, title, tags, is_pinned).await
}

#[tauri::command]
pub async fn delete_project_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state.session_store.delete_session(session_id).await
}

#[tauri::command]
pub async fn delete_project_folder(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    state.session_store.delete_project(project_id).await
}

#[tauri::command]
pub async fn save_chat_message(
    state: State<'_, AppState>,
    session_id: String,
    message: ChatMessageRecord,
) -> Result<(), String> {
    state.session_store.add_message(&session_id, message).await
}

// ==========================================
// WORKSPACE & FILESYSTEM COMMANDS
// ==========================================

#[tauri::command]
pub async fn read_workspace_tree(path: String, max_depth: Option<usize>) -> Result<FileNode, String> {
    WorkspaceFsOps::scan_directory_tree(&path, max_depth.unwrap_or(6))
}

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    WorkspaceFsOps::read_file(&path)
}

#[tauri::command]
pub async fn save_file_content(path: String, content: String) -> Result<(), String> {
    WorkspaceFsOps::write_file(&path, &content)
}

#[tauri::command]
pub async fn create_file_or_dir(path: String, is_dir: bool) -> Result<(), String> {
    WorkspaceFsOps::create_entry(&path, is_dir)
}

#[tauri::command]
pub async fn delete_file_or_dir(path: String) -> Result<(), String> {
    WorkspaceFsOps::delete_entry(&path)
}

// ==========================================
// GATEWAY COMMANDS
// ==========================================

#[tauri::command]
pub async fn list_gateway_channels(state: State<'_, AppState>) -> Result<GatewayConfigDatabase, String> {
    Ok(state.gateway_engine.list_channels().await)
}

#[tauri::command]
pub async fn save_gateway_channel(
    state: State<'_, AppState>,
    channel: GatewayChannel,
) -> Result<GatewayChannel, String> {
    state.gateway_engine.save_channel(channel).await
}

#[tauri::command]
pub async fn delete_gateway_channel(state: State<'_, AppState>, channel_id: String) -> Result<(), String> {
    state.gateway_engine.delete_channel(&channel_id).await
}

#[tauri::command]
pub async fn set_active_gateway_channel(state: State<'_, AppState>, channel_id: String) -> Result<(), String> {
    state.gateway_engine.set_active_channel(&channel_id).await
}

#[tauri::command]
pub async fn test_gateway_channel(
    state: State<'_, AppState>,
    channel: GatewayChannel,
) -> Result<GatewayHealthResult, String> {
    Ok(state.gateway_engine.test_channel(&channel).await)
}

#[tauri::command]
pub async fn pull_gateway_models(
    state: State<'_, AppState>,
    base_url: String,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    state.gateway_engine.pull_models(&base_url, api_key.as_deref()).await
}

// ==========================================
// STREAMING AGENT & CHAT COMMANDS
// ==========================================

#[derive(serde::Serialize, Clone)]
pub struct StreamChunkPayload {
    pub session_id: String,
    pub chunk: String,
}

#[derive(serde::Serialize, Clone)]
pub struct StreamDonePayload {
    pub session_id: String,
    pub full_content: String,
    pub full_thought: String,
}

#[tauri::command]
pub async fn stream_chat_prompt(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    workspace_dir: String,
    prompt: String,
) -> Result<(), String> {
    let user_msg = ChatMessageRecord {
        id: Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: prompt.clone(),
        thought: None,
        timestamp: chrono::Utc::now().timestamp_millis(),
        status: Some("completed".to_string()),
        dag: None,
    };
    let _ = state.session_store.add_message(&session_id, user_msg).await;

    // Check active gateway channel
    let channels_db = state.gateway_engine.list_channels().await;
    let active_channel = channels_db
        .channels
        .iter()
        .find(|c| channels_db.active_channel_id.as_deref() == Some(&c.id))
        .or_else(|| channels_db.channels.first());

    let (base_url, api_key, model) = if let Some(ch) = active_channel {
        let m = ch.models.first().cloned().unwrap_or_else(|| "deepseek-chat".to_string());
        (ch.base_url.clone(), ch.api_key.clone(), m)
    } else {
        (
            "https://api.deepseek.com/v1".to_string(),
            None,
            "deepseek-chat".to_string(),
        )
    };

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": format!("You are Tcode Next-Gen AI coding assistant. You are currently in workspace directory: {}. Respond concisely and provide clean code changes.", workspace_dir)
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": true
    });

    let mut req = client.post(&url).header("User-Agent", "opencode/1.0").json(&body);
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key.trim()));
        }
    }

    let app_clone = app.clone();
    let sess_id = session_id.clone();
    let store = state.session_store.clone();

    tokio::spawn(async move {
        let mut full_thought = String::new();
        let mut full_content = String::new();

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                use futures_util::StreamExt;
                let mut stream = resp.bytes_stream();
                let mut buffer = String::new();

                while let Some(chunk_res) = stream.next().await {
                    if let Ok(chunk_bytes) = chunk_res {
                        if let Ok(text) = std::str::from_utf8(&chunk_bytes) {
                            buffer.push_str(text);

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer = buffer[pos + 1..].to_string();

                                if line.starts_with("data: ") {
                                    let json_part = line.trim_start_matches("data: ").trim();
                                    if json_part == "[DONE]" {
                                        break;
                                    }
                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_part) {
                                        if let Some(choice) = val.get("choices").and_then(|c| c.get(0)) {
                                            let delta = choice.get("delta");
                                            // 1. Extract reasoning_content (DeepSeek)
                                            if let Some(reasoning) = delta.and_then(|d| d.get("reasoning_content")).and_then(|r| r.as_str()) {
                                                if !reasoning.is_empty() {
                                                    full_thought.push_str(reasoning);
                                                    let _ = app_clone.emit("agent_thought_chunk", StreamChunkPayload {
                                                        session_id: sess_id.clone(),
                                                        chunk: reasoning.to_string(),
                                                    });
                                                }
                                            }
                                            // 2. Extract standard content
                                            if let Some(content) = delta.and_then(|d| d.get("content")).and_then(|c| c.as_str()) {
                                                if !content.is_empty() {
                                                    full_content.push_str(content);
                                                    let _ = app_clone.emit("agent_text_chunk", StreamChunkPayload {
                                                        session_id: sess_id.clone(),
                                                        chunk: content.to_string(),
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(resp) => {
                let err_text = resp.text().await.unwrap_or_default();
                full_content = format!("⚠️ 上游服务返回异常 (HTTP): {}", err_text);
                let _ = app_clone.emit("agent_text_chunk", StreamChunkPayload {
                    session_id: sess_id.clone(),
                    chunk: full_content.clone(),
                });
            }
            Err(err) => {
                // If direct network failed (e.g. no valid key configured yet), provide helpful explanation
                full_content = format!(
                    "⚠️ 无法连接到上游模型网关 ({})。\n\n💡 请点击右上角 **⚙️ 模型网关** 填入您的 DeepSeek / OpenAI / Claude API Key 或配置本地 Ollama 后再次提问。",
                    err
                );
                let _ = app_clone.emit("agent_text_chunk", StreamChunkPayload {
                    session_id: sess_id.clone(),
                    chunk: full_content.clone(),
                });
            }
        }

        // Save assistant response to session store
        let assistant_msg = ChatMessageRecord {
            id: Uuid::new_v4().to_string(),
            role: "assistant".to_string(),
            content: full_content.clone(),
            thought: if full_thought.is_empty() { None } else { Some(full_thought.clone()) },
            timestamp: chrono::Utc::now().timestamp_millis(),
            status: Some("completed".to_string()),
            dag: None,
        };
        let _ = store.add_message(&sess_id, assistant_msg).await;

        let _ = app_clone.emit("agent_stream_done", StreamDonePayload {
            session_id: sess_id.clone(),
            full_content,
            full_thought,
        });
    });

    Ok(())
}

// Legacy helpers
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

#[tauri::command]
pub async fn run_swarm_flow_task(
    prompt: String,
    budget_tokens: Option<u64>,
) -> Result<crate::core::ArbiterDecision, String> {
    let budget = budget_tokens.unwrap_or(30_000);
    let decision = crate::core::SwarmFlowEngine::run_flow(&prompt, budget).await;
    Ok(decision)
}

#[tauri::command]
pub async fn select_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("选择本地代码项目文件夹")
        .pick_folder()
        .await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}
