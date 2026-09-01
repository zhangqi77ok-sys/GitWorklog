use std::collections::VecDeque;
use std::path::Path;
use tokio::fs;

pub struct MemoryRail {
    active_files: VecDeque<String>,
    max_active: usize,
}

impl MemoryRail {
    pub fn new() -> Self {
        Self {
            active_files: VecDeque::new(),
            max_active: 10,
        }
    }

    pub fn record_active_file(&mut self, file_path: &str) {
        if let Some(pos) = self.active_files.iter().position(|f| f == file_path) {
            self.active_files.remove(pos);
        }
        self.active_files.push_front(file_path.to_string());
        if self.active_files.len() > self.max_active {
            self.active_files.pop_back();
        }
    }

    pub fn get_active_files(&self) -> Vec<String> {
        self.active_files.iter().cloned().collect()
    }

    pub async fn generate_repomap(&self, workspace_dir: &str) -> String {
        let ws = Path::new(workspace_dir);
        let mut structure = Vec::new();
        let mut stack = vec![ws.to_path_buf()];
        let mut count = 0;

        while let Some(dir) = stack.pop() {
            if count >= 40 {
                break;
            }
            if let Ok(mut read_dir) = fs::read_dir(&dir).await {
                while let Ok(Some(entry)) = read_dir.next_entry().await {
                    let path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();

                    if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                        continue;
                    }

                    let rel = path.strip_prefix(ws).unwrap_or(&path).to_string_lossy().to_string();
                    if path.is_dir() {
                        structure.push(format!("📁 {}/", rel));
                        stack.push(path);
                    } else {
                        structure.push(format!("📄 {}", rel));
                    }
                    count += 1;
                    if count >= 40 {
                        break;
                    }
                }
            }
        }

        format!("=== WORKSPACE REPOMAP ===\n{}", structure.join("\n"))
    }
}
