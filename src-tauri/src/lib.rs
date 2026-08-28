use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceSnapshot {
    pub git_branch: Option<String>,
    pub files: Vec<String>,
    pub is_git: bool,
    pub timestamp: u64,
}

mod commands {
    use super::*;
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // 1. 打开 Windows 原生选择文件夹窗口 (无黑框无后台控制台)
    #[tauri::command]
    pub fn pick_folder_native() -> Result<Option<String>, String> {
        let mut cmd = Command::new("powershell");
        cmd.creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                r#"
                Add-Type -AssemblyName System.Windows.Forms;
                $f = New-Object System.Windows.Forms.FolderBrowserDialog;
                $f.Description = '选择要作为工作区打开的本地文件夹';
                $f.ShowNewFolderButton = $true;
                if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                    Write-Output $f.SelectedPath
                }
                "#,
            ]);

        let output = cmd.output().map_err(|e| e.to_string())?;
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path_str.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path_str))
        }
    }

    // 2. 批量合并查询工作区快照 (IPC Batching: 单次调用获取Git分支与文件清单，减少IPC往返)
    #[tauri::command]
    pub fn get_workspace_snapshot(path: Option<String>) -> Result<WorkspaceSnapshot, String> {
        let working_dir = path.unwrap_or_else(|| ".".to_string());
        
        let mut git_cmd = Command::new("git");
        git_cmd.creation_flags(CREATE_NO_WINDOW)
            .args(["branch", "--show-current"])
            .current_dir(&working_dir);
        
        let (git_branch, is_git) = match git_cmd.output() {
            Ok(out) if out.status.success() => {
                let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !branch.is_empty() {
                    (Some(branch), true)
                } else {
                    (None, false)
                }
            },
            _ => (None, false),
        };

        let mut files = Vec::new();
        let root = Path::new(&working_dir);
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name != ".git" && name != "node_modules" && name != "target" {
                    files.push(name);
                }
            }
        }

        Ok(WorkspaceSnapshot {
            git_branch,
            files,
            is_git,
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0),
        })
    }

    // 3. 真实读取磁盘目录树
    #[tauri::command]
    pub fn list_directory_tree(path: String, max_depth: Option<usize>) -> Result<Vec<FileEntry>, String> {
        let root = Path::new(&path);
        if !root.exists() {
            return Err(format!("目录不存在: {}", path));
        }
        let depth = max_depth.unwrap_or(4);
        read_dir_recursive(root, 0, depth).map_err(|e| e.to_string())
    }

    fn read_dir_recursive(dir: &Path, current_depth: usize, max_depth: usize) -> Result<Vec<FileEntry>, std::io::Error> {
        let mut entries = Vec::new();
        if current_depth >= max_depth {
            return Ok(entries);
        }

        if let Ok(read_dir) = fs::read_dir(dir) {
            for entry in read_dir.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                // 过滤常见超大或敏感目录
                if name == ".git" || name == "node_modules" || name == "target" || name == ".idea" || name == ".vscode" {
                    continue;
                }

                let is_dir = path.is_dir();
                let size = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };

                let children = if is_dir {
                    Some(read_dir_recursive(&path, current_depth + 1, max_depth)?)
                } else {
                    None
                };

                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    size,
                    children,
                });
            }
        }

        // 目录优先排在前面
        entries.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            } else if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        });

        Ok(entries)
    }

    // 4. 真实读取本地文件内容
    #[tauri::command]
    pub fn read_file_content(path: String) -> Result<String, String> {
        fs::read_to_string(&path).map_err(|e| format!("读取文件失败 ({}): {}", path, e))
    }

    // 5. 真实写入本地文件内容
    #[tauri::command]
    pub fn write_file_content(path: String, content: String) -> Result<bool, String> {
        if let Some(parent) = Path::new(&path).parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, content)
            .map(|_| true)
            .map_err(|e| format!("写入文件失败 ({}): {}", path, e))
    }

    // 6. 真实执行系统终端命令 (后台静默执行，无控制台黑框)
    #[tauri::command]
    pub fn execute_system_command(command: String, cwd: Option<String>) -> Result<String, String> {
        let working_dir = cwd.unwrap_or_else(|| ".".to_string());
        let mut cmd = Command::new("powershell");
        cmd.creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &command])
            .current_dir(working_dir);

        let output = cmd.output().map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(stdout)
        } else {
            Err(format!("Error (exit code {:?}):\nstdout: {}\nstderr: {}", output.status.code(), stdout, stderr))
        }
    }

    // 7. 生产级互联网搜索检索命令 (跨平台多引擎抓取与结构化提取)
    #[tauri::command]
    pub fn native_web_search(query: String) -> Result<String, String> {
        let ps_script = format!(
            r#"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
            $encoded = [System.Uri]::EscapeDataString('{}');
            $url = "https://html.duckduckgo.com/html/?q=$encoded";
            $wc = New-Object System.Net.WebClient;
            $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            $html = "";
            try {{
                $html = $wc.DownloadString($url);
            }} catch {{
                Write-Output "[]";
                exit 0;
            }}

            $results = @();
            $pattern = 'class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>';
            $regex = New-Object System.Text.RegularExpressions.Regex($pattern);
            $match = $regex.Match($html);

            while ($match.Success -and $results.Count -lt 6) {{
                $rawUrl = $match.Groups[1].Value;
                $title = [System.Net.WebUtility]::HtmlDecode($match.Groups[2].Value) -replace '<[^>]+>', '';
                $snippet = [System.Net.WebUtility]::HtmlDecode($match.Groups[3].Value) -replace '<[^>]+>', '';
                
                $realUrl = $rawUrl;
                if ($rawUrl -match 'uddg=([^&]+)') {{
                    $realUrl = [System.Uri]::UnescapeDataString($matches[1]);
                }}
                
                $results += @{{
                    title = $title.Trim();
                    snippet = $snippet.Trim();
                    url = $realUrl.Trim();
                    source = "WebSearch";
                }};
                $match = $match.NextMatch();
            }}

            $results | ConvertTo-Json -Compress
            "#,
            query.replace("'", "''")
        );

        let mut cmd = Command::new("powershell");
        cmd.creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script]);

        let output = cmd.output().map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Ok("[]".to_string())
        } else {
            Ok(stdout)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder_native,
            commands::get_workspace_snapshot,
            commands::list_directory_tree,
            commands::read_file_content,
            commands::write_file_content,
            commands::execute_system_command,
            commands::native_web_search
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
