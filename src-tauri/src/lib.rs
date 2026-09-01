pub mod core;
pub mod plugins;
pub mod rails;
pub mod ipc;

use ipc::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            ipc::list_plugins,
            ipc::export_tools,
            ipc::execute_tool,
            ipc::submit_prompt,
            ipc::test_gateway_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tcode Studio application");
}
