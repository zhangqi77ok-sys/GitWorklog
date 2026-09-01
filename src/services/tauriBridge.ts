import { mockIPC } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type {
  PluginMetadata,
  ToolSchema,
  ExecutionMode,
} from '../types';

interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  created_at: number;
  sessions: SessionRecord[];
}

interface SessionRecord {
  id: string;
  title: string;
  tags: string[];
  model_id: string;
  created_at: number;
  is_pinned: boolean;
  messages: any[];
}

interface ProjectsDatabase {
  projects: ProjectRecord[];
  active_project_id: string | null;
  active_session_id: string | null;
}

const STORAGE_PROJECTS_KEY = 'tcode_projects_db';
const STORAGE_CHANNELS_KEY = 'tcode_gateway_channels';

function getHostToken(): string {
  return (window as any).__TCODE_HOST_TOKEN__ || '';
}

function getApiHeaders(): Record<string, string> {
  const token = getHostToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['X-Tcode-Token'] = token;
  }
  return headers;
}

function loadProjectsDb(): ProjectsDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse projects db from localStorage:', e);
  }

  // Seed default project and session
  const defaultProj: ProjectRecord = {
    id: 'proj_default',
    name: 'agent-learning',
    path: 'E:/pro/agent-learning',
    created_at: Date.now(),
    sessions: [
      {
        id: 'sess_default',
        title: '架构重构与执行流设计',
        tags: ['#核心', '#开发'],
        model_id: 'deepseek-chat',
        created_at: Date.now(),
        is_pinned: true,
        messages: [],
      },
    ],
  };

  const initialDb: ProjectsDatabase = {
    projects: [defaultProj],
    active_project_id: defaultProj.id,
    active_session_id: defaultProj.sessions[0].id,
  };

  saveProjectsDb(initialDb);
  return initialDb;
}

function saveProjectsDb(db: ProjectsDatabase): void {
  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save projects db:', e);
  }
}

function loadChannelsDb(): any {
  try {
    const raw = localStorage.getItem(STORAGE_CHANNELS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse channels db from localStorage:', e);
  }

  const defaultDb = {
    channels: [
      {
        id: 'ch_deepseek',
        name: 'DeepSeek 官方渠道',
        protocol: 'openai',
        base_url: 'https://api.deepseek.com/v1',
        api_key: '',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        is_active: true,
        priority: 1,
      },
      {
        id: 'ch_opencode',
        name: 'OpenCode 多模型网关',
        protocol: 'sub2api',
        base_url: 'https://opencode.ai/v1',
        api_key: '',
        models: ['claude-3-7-sonnet', 'gpt-4o', 'deepseek-r1'],
        is_active: true,
        priority: 2,
      },
    ],
    active_channel_id: 'ch_deepseek',
  };

  localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(defaultDb));
  return defaultDb;
}

export function initTauriBridge(): void {
  if (typeof window === 'undefined') return;

  // If real native Tauri 2.0 Rust backend is running, do nothing
  if ((window as any).__TAURI_INTERNALS__?.invoke) {
    console.info('[TauriBridge] Native Tauri 2.0 runtime detected, keeping native IPC.');
    return;
  }

  console.info('[TauriBridge] Non-Tauri environment detected, mounting universal IPC Bridge.');

  mockIPC(async (cmd: string, args: any) => {
    switch (cmd) {
      // 1. Native Folder Picker
      case 'select_folder_dialog': {
        // Try Python desktop backend first
        try {
          const res = await fetch('/api/fs/pick_folder', { headers: getApiHeaders() });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.path) {
              return data.path;
            }
            if (data.cancelled) {
              return null;
            }
          }
        } catch (e) {
          // Backend not running on same origin
        }

        // Browser fallback: window.showDirectoryPicker
        if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
          try {
            const dirHandle = await (window as any).showDirectoryPicker();
            return dirHandle.name || 'local-folder';
          } catch (e: any) {
            if (e.name === 'AbortError') return null;
          }
        }

        // Prompt fallback
        const promptPath = window.prompt('请输入要打开的本地项目绝对路径 (例如 E:/pro/my-project):');
        return promptPath && promptPath.trim() ? promptPath.trim() : null;
      }

      // 2. Projects & Sessions
      case 'list_projects_and_sessions': {
        return loadProjectsDb();
      }

      case 'add_project_folder': {
        const { path, name } = args || {};
        const db = loadProjectsDb();
        const folderName = name || path?.split(/[/\\]/).filter(Boolean).pop() || '未命名项目';
        const newProjId = 'proj_' + Math.random().toString(36).substring(2, 9);
        const newSessId = 'sess_' + Math.random().toString(36).substring(2, 9);

        const newProject: ProjectRecord = {
          id: newProjId,
          name: folderName,
          path: path || 'D:/workspace/' + folderName,
          created_at: Date.now(),
          sessions: [
            {
              id: newSessId,
              title: '初始任务分支',
              tags: ['#主线'],
              model_id: 'deepseek-chat',
              created_at: Date.now(),
              is_pinned: true,
              messages: [],
            },
          ],
        };

        db.projects.push(newProject);
        db.active_project_id = newProjId;
        db.active_session_id = newSessId;
        saveProjectsDb(db);
        return newProject;
      }

      case 'create_project_session': {
        const { projectId, title, tags, modelId } = args || {};
        const db = loadProjectsDb();
        const proj = db.projects.find((p) => p.id === projectId);
        const newSess: SessionRecord = {
          id: 'sess_' + Math.random().toString(36).substring(2, 9),
          title: title || '新任务分支',
          tags: tags || ['#开发'],
          model_id: modelId || 'deepseek-chat',
          created_at: Date.now(),
          is_pinned: false,
          messages: [],
        };
        if (proj) {
          proj.sessions.unshift(newSess);
        }
        db.active_session_id = newSess.id;
        saveProjectsDb(db);
        return newSess;
      }

      case 'update_project_session': {
        const { sessionId, title, tags, isPinned } = args || {};
        const db = loadProjectsDb();
        for (const p of db.projects) {
          const s = p.sessions.find((sess) => sess.id === sessionId);
          if (s) {
            if (title !== undefined) s.title = title;
            if (tags !== undefined) s.tags = tags;
            if (isPinned !== undefined) s.is_pinned = isPinned;
            break;
          }
        }
        saveProjectsDb(db);
        return true;
      }

      case 'delete_project_session': {
        const { sessionId } = args || {};
        const db = loadProjectsDb();
        for (const p of db.projects) {
          p.sessions = p.sessions.filter((s) => s.id !== sessionId);
        }
        if (db.active_session_id === sessionId) {
          const activeProj = db.projects.find((p) => p.id === db.active_project_id);
          db.active_session_id = activeProj?.sessions[0]?.id || null;
        }
        saveProjectsDb(db);
        return true;
      }

      case 'delete_project_folder': {
        const { projectId } = args || {};
        const db = loadProjectsDb();
        db.projects = db.projects.filter((p) => p.id !== projectId);
        if (db.active_project_id === projectId) {
          db.active_project_id = db.projects[0]?.id || null;
          db.active_session_id = db.projects[0]?.sessions[0]?.id || null;
        }
        saveProjectsDb(db);
        return true;
      }

      // 3. Workspace File Tree & File I/O
      case 'read_workspace_tree': {
        const { path } = args || {};
        try {
          const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(path)}`, {
            headers: getApiHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.tree) {
              const mapNode = (n: any): any => ({
                name: n.name,
                path: (n.path || '').replace(/\\/g, '/'),
                is_dir: !!n.is_dir || n.type === 'directory',
                size_bytes: n.size || 0,
                children: n.children ? n.children.map(mapNode) : undefined,
              });
              return mapNode(data.tree);
            }
          }
        } catch (e) {
          // Backend tree not available
        }

        // Fallback file node
        const folderName = (path || 'workspace').split(/[/\\]/).filter(Boolean).pop() || 'workspace';
        return {
          name: folderName,
          path: path || 'workspace',
          is_dir: true,
          size_bytes: 4096,
          children: [
            { name: 'src', path: `${path}/src`, is_dir: true, size_bytes: 4096, children: [
              { name: 'App.tsx', path: `${path}/src/App.tsx`, is_dir: false, size_bytes: 2048 },
              { name: 'main.tsx', path: `${path}/src/main.tsx`, is_dir: false, size_bytes: 512 },
            ]},
            { name: 'package.json', path: `${path}/package.json`, is_dir: false, size_bytes: 1024 },
            { name: 'README.md', path: `${path}/README.md`, is_dir: false, size_bytes: 3500 },
          ],
        };
      }

      case 'read_file_content': {
        const { path } = args || {};
        try {
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`, {
            headers: getApiHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.content !== undefined) {
              return data.content;
            }
          }
        } catch (e) {}
        return `// [Tcode Workspace] File: ${path}\n// Content loaded via Tcode Bridge\n`;
      }

      case 'save_file_content': {
        const { path, content } = args || {};
        try {
          const res = await fetch('/api/fs/write', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ path, content }),
          });
          if (res.ok) {
            const data = await res.json();
            return data.success;
          }
        } catch (e) {}
        return true;
      }

      // 4. Gateway Channels
      case 'list_gateway_channels': {
        return loadChannelsDb();
      }

      case 'save_gateway_channel': {
        const { channel } = args || {};
        const db = loadChannelsDb();
        const existingIdx = db.channels.findIndex((c: any) => c.id === channel.id);
        if (existingIdx >= 0) {
          db.channels[existingIdx] = channel;
        } else {
          db.channels.push(channel);
        }
        localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(db));
        return channel;
      }

      case 'delete_gateway_channel': {
        const { channelId } = args || {};
        const db = loadChannelsDb();
        db.channels = db.channels.filter((c: any) => c.id !== channelId);
        localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(db));
        return true;
      }

      case 'set_active_gateway_channel': {
        const { channelId } = args || {};
        const db = loadChannelsDb();
        db.active_channel_id = channelId;
        localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(db));
        return true;
      }

      case 'test_gateway_channel': {
        const { channel } = args || {};
        return {
          channel_id: channel?.id || 'test',
          is_healthy: true,
          latency_ms: 128,
          error: null,
        };
      }

      case 'pull_gateway_models': {
        return [
          'deepseek-chat',
          'deepseek-reasoner',
          'qwen2.5-coder:latest',
          'claude-3-7-sonnet',
          'gpt-4o',
        ];
      }

      // 5. Plugins & Tools
      case 'list_plugins': {
        const plugins: PluginMetadata[] = [
          { id: 'plugin_fs', name: 'FileSystem Capability', version: '2.0.0', description: 'Native file I/O & patching', author: 'Tcode Team', is_builtin: true },
          { id: 'plugin_shell', name: 'Shell Terminal Execution', version: '2.0.0', description: 'PowerShell / Bash sandboxed execution', author: 'Tcode Team', is_builtin: true },
          { id: 'plugin_git', name: 'Git Checkpoint & Rollback', version: '2.0.0', description: 'Shadow commit snapshots & diff restore', author: 'Tcode Team', is_builtin: true },
          { id: 'plugin_lsp', name: 'LSP Diagnostics Loop', version: '2.0.0', description: 'Compiler feedback self-healing', author: 'Tcode Team', is_builtin: true },
          { id: 'plugin_mcp', name: 'Model Context Protocol (MCP)', version: '2.0.0', description: 'External stdio/SSE tools bridge', author: 'Tcode Team', is_builtin: true },
        ];
        return plugins;
      }

      case 'export_tools': {
        const tools: ToolSchema[] = [
          { name: 'read_file', description: 'Read file from workspace', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
          { name: 'write_file', description: 'Write content to workspace file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
          { name: 'execute_command', description: 'Run sandboxed terminal command', parameters: { type: 'object', properties: { command: { type: 'string' } } } },
        ];
        return tools;
      }

      case 'call_plugin_tool': {
        const { pluginId, toolName, arguments: toolArgs } = args || {};
        if (toolName === 'execute_command') {
          try {
            const res = await fetch('/api/terminal/run', {
              method: 'POST',
              headers: getApiHeaders(),
              body: JSON.stringify({ command: toolArgs?.command, cwd: toolArgs?.cwd }),
            });
            if (res.ok) {
              const data = await res.json();
              return JSON.stringify(data);
            }
          } catch (e) {}
        }
        return JSON.stringify({ status: 'ok', output: `Tool [${toolName}] executed successfully` });
      }

      // 6. Chat Streaming & Swarm Flow
      case 'stream_chat_prompt': {
        const { sessionId, prompt } = args || {};

        // Emulate streaming thoughts and content for smooth user feedback
        setTimeout(async () => {
          await emit('agent_thought_chunk', {
            session_id: sessionId,
            chunk: `正在观察工作区上下文与任务目标: "${prompt}"\n已加载 MemoryRail 长期工程记忆，准备调用模型...`,
          });

          setTimeout(async () => {
            await emit('agent_text_chunk', {
              session_id: sessionId,
              chunk: `收到您的开发指令: **${prompt}**。\n\n我已定位相关代码与上下文，正在按规范执行分析与修改。`,
            });

            setTimeout(async () => {
              await emit('agent_stream_done', {
                session_id: sessionId,
                full_content: `收到您的开发指令: **${prompt}**。\n\n我已定位相关代码与上下文，正在按规范执行分析与修改。`,
                full_thought: `正在观察工作区上下文与任务目标: "${prompt}"\n已加载 MemoryRail 长期工程记忆，准备调用模型...`,
              });
            }, 600);
          }, 600);
        }, 300);

        return true;
      }

      case 'run_swarm_flow_task': {
        const { prompt, budgetTokens } = args || {};
        return {
          selected_candidate: {
            worker_id: 'Worker-B',
            candidate_name: 'Candidate_Worker-B (双环沙箱极致方案)',
            code_patch: `// SwarmFlow 7 算子流选出最优补丁\n// 任务目标: ${prompt}\npub fn execute_optimized() -> bool {\n    println!("Candidate Worker-B running successfully");\n    true\n}\n`,
            execution_trace: 'Worker-B: Observe -> Reason -> Act -> Verify passed with 100% tests',
            is_empty: false,
          },
          confidence_score: 0.96,
          is_confident: true,
          human_reviewed: false,
          rationale: 'Candidate [Worker-B] chosen with highest review score 0.96 (预算配额: ' + (budgetTokens || 25000) + ' tokens)',
        };
      }

      default:
        console.warn(`[TauriBridge] Unhandled IPC command: ${cmd}`, args);
        return null;
    }
  }, { shouldMockEvents: true });
}
