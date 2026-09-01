use tauri::{AppHandle, Emitter};
use crate::core::types::AgentEvent;

pub struct ObservabilityRail {
    app_handle: Option<AppHandle>,
}

impl ObservabilityRail {
    pub fn new(app_handle: Option<AppHandle>) -> Self {
        Self { app_handle }
    }

    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    pub fn emit_event(&self, event: &AgentEvent) {
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("tcode_agent_event", event);
        }
    }
}
