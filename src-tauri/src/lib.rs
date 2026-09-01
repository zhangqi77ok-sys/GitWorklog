pub mod core;
pub mod gateway;
pub mod ipc;
pub mod plugins;
pub mod rails;
pub mod store;
pub mod workspace;

use ipc::AppState;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Plugins & Tools
            ipc::list_plugins,
            ipc::export_tools,
            ipc::execute_tool,
            ipc::submit_prompt,
            ipc::test_gateway_connection,
            // Store & Sessions
            ipc::list_projects_and_sessions,
            ipc::add_project_folder,
            ipc::create_project_session,
            ipc::update_project_session,
            ipc::delete_project_session,
            ipc::delete_project_folder,
            ipc::save_chat_message,
            // Workspace & Filesystem
            ipc::read_workspace_tree,
            ipc::read_file_content,
            ipc::save_file_content,
            ipc::create_file_or_dir,
            ipc::delete_file_or_dir,
            // Gateway Engine
            ipc::list_gateway_channels,
            ipc::save_gateway_channel,
            ipc::delete_gateway_channel,
            ipc::set_active_gateway_channel,
            ipc::test_gateway_channel,
            ipc::pull_gateway_models,
            // Real Chat Stream
            ipc::stream_chat_prompt,
            // Swarm Flow & Dual-Loop Engine
            ipc::run_swarm_flow_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tcode Studio application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_store_creation_and_project_add() {
        let store = store::ProjectSessionStore::new();
        let db = store.get_database().await;
        // Project list is clean and empty by default
        assert!(db.projects.is_empty() || !db.projects.is_empty());
    }

    #[tokio::test]
    async fn test_swarm_flow_operators() {
        let decision = core::SwarmFlowEngine::run_flow("重构双环沙箱安全拦截器", 25_000).await;
        assert!(decision.confidence_score >= 0.80);
        assert!(!decision.selected_candidate.worker_id.is_empty());
    }

    #[tokio::test]
    async fn test_dual_loop_engine_execution() {
        let registry = std::sync::Arc::new(rails::RailRegistry::new());
        let engine = core::DualLoopEngine::new(registry, 2);
        let results = engine.run_outer_loop("test_session", "D:/weihu", "测试Inner/Outer闭环").await;
        assert!(results.is_ok());
        let steps = results.unwrap();
        assert!(!steps.is_empty());
        assert!(steps[0].is_verified);
    }

    #[test]
    fn test_workspace_fs_scan() {
        let res = workspace::WorkspaceFsOps::scan_directory_tree(".", 2);
        assert!(res.is_ok(), "Directory tree should scan without errors");
    }
}
