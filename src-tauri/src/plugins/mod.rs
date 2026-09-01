pub mod trait_def;
pub mod plugin_fs;
pub mod plugin_terminal;
pub mod plugin_search;
pub mod plugin_lsp;
pub mod plugin_mcp;

pub use trait_def::{CapabilityPlugin, PluginMetadata, ToolSchema, PluginContext, ToolOutput, PluginError};
pub use plugin_fs::FsPlugin;
pub use plugin_terminal::TerminalPlugin;
pub use plugin_search::SearchPlugin;
pub use plugin_lsp::LspPlugin;
pub use plugin_mcp::McpPlugin;
