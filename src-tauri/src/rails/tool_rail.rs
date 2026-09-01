use std::collections::HashMap;
use std::sync::Arc;
use crate::plugins::trait_def::{CapabilityPlugin, PluginContext, PluginError, PluginMetadata, ToolOutput, ToolSchema};

pub struct ToolRail {
    plugins: HashMap<String, Arc<dyn CapabilityPlugin>>,
    tool_to_plugin: HashMap<String, String>,
}

impl ToolRail {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            tool_to_plugin: HashMap::new(),
        }
    }

    pub fn register_plugin(&mut self, plugin: Arc<dyn CapabilityPlugin>) {
        let meta = plugin.metadata();
        for tool in plugin.tools() {
            self.tool_to_plugin.insert(tool.name.clone(), meta.id.clone());
        }
        self.plugins.insert(meta.id.clone(), plugin);
    }

    pub fn list_plugins(&self) -> Vec<PluginMetadata> {
        self.plugins.values().map(|p| p.metadata()).collect()
    }

    pub fn export_all_tools(&self) -> Vec<ToolSchema> {
        let mut tools = Vec::new();
        for plugin in self.plugins.values() {
            tools.extend(plugin.tools());
        }
        tools
    }

    pub async fn dispatch_tool(
        &self,
        tool_name: &str,
        args: serde_json::Value,
        ctx: &PluginContext,
    ) -> Result<ToolOutput, PluginError> {
        let plugin_id = self.tool_to_plugin.get(tool_name).ok_or_else(|| {
            PluginError::NotFound(format!("No capability plugin registered for tool '{}'", tool_name))
        })?;

        let plugin = self.plugins.get(plugin_id).ok_or_else(|| {
            PluginError::NotFound(format!("Plugin '{}' not found in registry", plugin_id))
        })?;

        plugin.call(tool_name, args, ctx).await
    }
}
