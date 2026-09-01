import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
  timestamp: number;
  status?: string;
  dag?: any;
}

export interface SessionRecord {
  id: string;
  project_id: string;
  title: string;
  tags: string[];
  is_pinned: boolean;
  model_id: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  sessions: SessionRecord[];
}

export interface ProjectsDatabase {
  active_project_id: string | null;
  active_session_id: string | null;
  projects: ProjectRecord[];
}

interface ProjectSessionState {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  searchQuery: string;
  selectedTag: string | null;
  isLoading: boolean;
  error: string | null;

  loadInitialData: () => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  setActiveProject: (projectId: string) => void;
  addProjectFolder: (path: string, name?: string) => Promise<ProjectRecord | null>;
  createSession: (projectId: string, title?: string, tags?: string[], modelId?: string) => Promise<SessionRecord | null>;
  updateSession: (sessionId: string, title?: string, tags?: string[], isPinned?: boolean, modelId?: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
}

const STORAGE_ACTIVE_PROJ_KEY = 'tcode_active_project_id_v2';
const STORAGE_ACTIVE_SESS_KEY = 'tcode_active_session_id_v2';

export const useProjectSessionStore = create<ProjectSessionState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeSessionId: null,
  searchQuery: '',
  selectedTag: null,
  isLoading: false,
  error: null,

  loadInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await invoke<ProjectsDatabase>('list_projects_and_sessions');
      const projects = db.projects || [];
      const savedProj = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_PROJ_KEY) : null;
      const savedSess = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_SESS_KEY) : null;

      const activeProjId = (savedProj && projects.some((p) => p.id === savedProj))
        ? savedProj
        : (db.active_project_id || projects[0]?.id || null);

      const curProj = projects.find((p) => p.id === activeProjId);
      const activeSessId = (savedSess && (curProj?.sessions || []).some((s) => s.id === savedSess))
        ? savedSess
        : (db.active_session_id || curProj?.sessions?.[0]?.id || null);

      set({
        projects,
        activeProjectId: activeProjId,
        activeSessionId: activeSessId,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveSession: (sessionId: string) => {
    const { projects } = get();
    let foundProjectId: string | null = null;
    for (const p of projects) {
      if ((p.sessions || []).some((s) => s.id === sessionId)) {
        foundProjectId = p.id;
        break;
      }
    }
    const finalProjId = foundProjectId || get().activeProjectId;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, sessionId);
      if (finalProjId) localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, finalProjId);
    }
    set({
      activeSessionId: sessionId,
      activeProjectId: finalProjId,
    });
  },

  setActiveProject: (projectId: string) => {
    const { projects } = get();
    const proj = projects.find((p) => p.id === projectId);
    const firstSessionId = proj?.sessions?.[0]?.id || null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, projectId);
      if (firstSessionId) localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, firstSessionId);
    }
    set({
      activeProjectId: projectId,
      activeSessionId: firstSessionId,
    });
  },

  addProjectFolder: async (path: string, name?: string) => {
    try {
      const project = await invoke<ProjectRecord>('add_project_folder', { path, name });
      if (project && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, project.id);
        if (project.sessions?.[0]?.id) {
          localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, project.sessions[0].id);
        }
      }
      await get().loadInitialData();
      return project;
    } catch (err: any) {
      set({ error: String(err) });
      return null;
    }
  },

  createSession: async (projectId: string, title?: string, tags?: string[], modelId?: string) => {
    try {
      const session = await invoke<SessionRecord>('create_project_session', {
        projectId,
        title,
        tags,
        modelId: modelId || 'deepseek-v4-flash',
      });
      if (session && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, projectId);
        localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, session.id);
      }
      await get().loadInitialData();
      set({ activeSessionId: session?.id || null, activeProjectId: projectId });
      return session;
    } catch (err: any) {
      set({ error: String(err) });
      return null;
    }
  },

  updateSession: async (sessionId: string, title?: string, tags?: string[], isPinned?: boolean, modelId?: string) => {
    try {
      await invoke('update_project_session', {
        sessionId,
        title,
        tags,
        isPinned,
        modelId,
      });
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await invoke('delete_project_session', { sessionId });
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      await invoke('delete_project_folder', { projectId });
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSelectedTag: (selectedTag: string | null) => set({ selectedTag }),
}));
