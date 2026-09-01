use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Option<Vec<FileNode>>,
}

pub struct WorkspaceFsOps;

impl WorkspaceFsOps {
    pub fn scan_directory_tree(root_path: &str, max_depth: usize) -> Result<FileNode, String> {
        let root = Path::new(root_path);
        if !root.exists() {
            return Err(format!("Directory does not exist: {}", root_path));
        }

        let name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| root_path.to_string());

        let mut root_node = FileNode {
            name,
            path: root.to_string_lossy().to_string(),
            is_dir: true,
            size: 0,
            children: Some(Vec::new()),
        };

        Self::populate_children(&mut root_node, 0, max_depth);
        Ok(root_node)
    }

    fn populate_children(node: &mut FileNode, current_depth: usize, max_depth: usize) {
        if current_depth >= max_depth {
            return;
        }

        let path = Path::new(&node.path);
        if let Ok(entries) = fs::read_dir(path) {
            let mut children = Vec::new();
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();

                // Skip ignored system and build folders
                if file_name == "node_modules"
                    || file_name == ".git"
                    || file_name == "target"
                    || file_name == "dist"
                    || file_name == ".tcode"
                    || file_name == ".idea"
                    || file_name == ".vscode"
                {
                    continue;
                }

                let file_path = entry.path();
                let is_dir = file_path.is_dir();
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                let mut child = FileNode {
                    name: file_name,
                    path: file_path.to_string_lossy().to_string(),
                    is_dir,
                    size,
                    children: if is_dir { Some(Vec::new()) } else { None },
                };

                if is_dir {
                    Self::populate_children(&mut child, current_depth + 1, max_depth);
                }

                children.push(child);
            }

            // Sort: folders first, then files alphabetically
            children.sort_by(|a, b| {
                if a.is_dir == b.is_dir {
                    a.name.to_lowercase().cmp(&b.name.to_lowercase())
                } else if a.is_dir {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                }
            });

            node.children = Some(children);
        }
    }

    pub fn read_file(path_str: &str) -> Result<String, String> {
        fs::read_to_string(path_str).map_err(|e| format!("Failed to read {}: {}", path_str, e))
    }

    pub fn write_file(path_str: &str, content: &str) -> Result<(), String> {
        let path = Path::new(path_str);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {}", path_str, e))
    }

    pub fn create_entry(path_str: &str, is_dir: bool) -> Result<(), String> {
        let path = Path::new(path_str);
        if is_dir {
            fs::create_dir_all(path).map_err(|e| e.to_string())
        } else {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(path, "").map_err(|e| e.to_string())
        }
    }

    pub fn delete_entry(path_str: &str) -> Result<(), String> {
        let path = Path::new(path_str);
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|e| e.to_string())
        } else {
            fs::remove_file(path).map_err(|e| e.to_string())
        }
    }
}
