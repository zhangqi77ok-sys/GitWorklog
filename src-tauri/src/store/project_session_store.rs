use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageRecord {
    pub id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub thought: Option<String>,
    pub timestamp: i64,
    pub status: Option<String>, // "streaming" | "completed" | "error"
    pub dag: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub model_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub messages: Vec<ChatMessageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub sessions: Vec<SessionRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectsDatabase {
    pub active_project_id: Option<String>,
    pub active_session_id: Option<String>,
    pub projects: Vec<ProjectRecord>,
}

pub struct ProjectSessionStore {
    db_path: PathBuf,
    db: Arc<Mutex<ProjectsDatabase>>,
}

impl ProjectSessionStore {
    pub fn new() -> Self {
        let db_dir = dirs_or_fallback();
        let _ = fs::create_dir_all(&db_dir);
        let db_path = db_dir.join("projects_sessions.json");

        let mut data = if db_path.exists() {
            fs::read_to_string(&db_path)
                .ok()
                .and_then(|s| serde_json::from_str::<ProjectsDatabase>(&s).ok())
                .unwrap_or_default()
        } else {
            ProjectsDatabase::default()
        };

        // By default, projects database is completely empty until user opens a folder.

        Self {
            db_path,
            db: Arc::new(Mutex::new(data)),
        }
    }

    pub async fn get_database(&self) -> ProjectsDatabase {
        self.db.lock().await.clone()
    }

    pub async fn save_database(&self) -> Result<(), String> {
        let data = self.db.lock().await.clone();
        let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
        fs::write(&self.db_path, json).map_err(|e| e.to_string())
    }

    pub async fn add_project(&self, path: String, name: Option<String>) -> Result<ProjectRecord, String> {
        let mut db = self.db.lock().await;
        let proj_name = name.unwrap_or_else(|| {
            std::path::Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "new-project".to_string())
        });

        // Check if project path already exists
        if let Some(pos) = db.projects.iter().position(|p| p.path == path) {
            for (i, p) in db.projects.iter_mut().enumerate() {
                p.is_active = i == pos;
            }
            let pid = db.projects[pos].id.clone();
            let sid = db.projects[pos].sessions.first().map(|s| s.id.clone());
            db.active_project_id = Some(pid);
            db.active_session_id = sid;
            let result = db.projects[pos].clone();
            drop(db);
            let _ = self.save_database().await;
            return Ok(result);
        }

        let now = chrono::Utc::now().timestamp_millis();
        let proj_id = Uuid::new_v4().to_string();
        let session_id = Uuid::new_v4().to_string();

        let initial_session = SessionRecord {
            id: session_id.clone(),
            project_id: proj_id.clone(),
            title: "会话 1: 项目初始化与探索 (默认)".to_string(),
            tags: vec!["#初始化".to_string()],
            is_pinned: true,
            model_id: "deepseek-chat".to_string(),
            created_at: now,
            updated_at: now,
            messages: vec![ChatMessageRecord {
                id: Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: format!("已成功挂载新项目 [{}]！请输入您的开发目标。", proj_name),
                thought: Some("完成工程目录挂载与会话初始化。".to_string()),
                timestamp: now,
                status: Some("completed".to_string()),
                dag: None,
            }],
        };

        for p in db.projects.iter_mut() {
            p.is_active = false;
        }

        let new_proj = ProjectRecord {
            id: proj_id.clone(),
            name: proj_name,
            path,
            is_active: true,
            created_at: now,
            updated_at: now,
            sessions: vec![initial_session],
        };

        db.projects.push(new_proj.clone());
        db.active_project_id = Some(proj_id);
        db.active_session_id = Some(session_id);
        drop(db);

        let _ = self.save_database().await;
        Ok(new_proj)
    }

    pub async fn create_session(
        &self,
        project_id: String,
        title: Option<String>,
        tags: Option<Vec<String>>,
        model_id: Option<String>,
    ) -> Result<SessionRecord, String> {
        let mut db = self.db.lock().await;
        let proj = db
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| "Project not found".to_string())?;

        let now = chrono::Utc::now().timestamp_millis();
        let session_count = proj.sessions.len() + 1;
        let session_id = Uuid::new_v4().to_string();

        let new_session = SessionRecord {
            id: session_id.clone(),
            project_id: project_id.clone(),
            title: title.unwrap_or_else(|| format!("会话 {}: 新任务分支", session_count)),
            tags: tags.unwrap_or_else(|| vec!["#开发".to_string()]),
            is_pinned: false,
            model_id: model_id.unwrap_or_else(|| "deepseek-chat".to_string()),
            created_at: now,
            updated_at: now,
            messages: vec![],
        };

        proj.sessions.insert(0, new_session.clone());
        db.active_project_id = Some(project_id);
        db.active_session_id = Some(session_id);
        drop(db);

        let _ = self.save_database().await;
        Ok(new_session)
    }

    pub async fn update_session(
        &self,
        session_id: String,
        title: Option<String>,
        tags: Option<Vec<String>>,
        is_pinned: Option<bool>,
    ) -> Result<(), String> {
        let mut db = self.db.lock().await;
        let now = chrono::Utc::now().timestamp_millis();
        let mut found = false;

        for proj in db.projects.iter_mut() {
            if let Some(session) = proj.sessions.iter_mut().find(|s| s.id == session_id) {
                if let Some(t) = title {
                    session.title = t;
                }
                if let Some(tg) = tags {
                    session.tags = tg;
                }
                if let Some(p) = is_pinned {
                    session.is_pinned = p;
                }
                session.updated_at = now;
                found = true;
                break;
            }
        }

        if found {
            drop(db);
            return self.save_database().await;
        }

        Err("Session not found".to_string())
    }

    pub async fn delete_session(&self, session_id: String) -> Result<(), String> {
        let mut db = self.db.lock().await;
        let mut found = false;
        let mut new_active_session = None;

        for proj in db.projects.iter_mut() {
            if let Some(pos) = proj.sessions.iter().position(|s| s.id == session_id) {
                proj.sessions.remove(pos);
                new_active_session = proj.sessions.first().map(|s| s.id.clone());
                found = true;
                break;
            }
        }

        if found {
            if db.active_session_id.as_deref() == Some(&session_id) {
                db.active_session_id = new_active_session;
            }
            drop(db);
            return self.save_database().await;
        }

        Err("Session not found".to_string())
    }

    pub async fn delete_project(&self, project_id: String) -> Result<(), String> {
        let mut db = self.db.lock().await;
        if let Some(pos) = db.projects.iter().position(|p| p.id == project_id) {
            db.projects.remove(pos);
            if db.active_project_id.as_deref() == Some(&project_id) {
                db.active_project_id = db.projects.first().map(|p| p.id.clone());
                db.active_session_id = db.projects.first().and_then(|p| p.sessions.first()).map(|s| s.id.clone());
            }
            drop(db);
            return self.save_database().await;
        }
        Err("Project not found".to_string())
    }

    pub async fn add_message(&self, session_id: &str, message: ChatMessageRecord) -> Result<(), String> {
        let mut db = self.db.lock().await;
        let now = chrono::Utc::now().timestamp_millis();
        for proj in db.projects.iter_mut() {
            if let Some(session) = proj.sessions.iter_mut().find(|s| s.id == session_id) {
                session.messages.push(message);
                session.updated_at = now;
                drop(db);
                return self.save_database().await;
            }
        }
        Err("Session not found".to_string())
    }
}

fn dirs_or_fallback() -> PathBuf {
    if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        PathBuf::from(home).join(".tcode")
    } else {
        PathBuf::from(".tcode")
    }
}
