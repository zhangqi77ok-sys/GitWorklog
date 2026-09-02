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
  toolCalls?: any[];
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
  openSessionIds: string[];
  searchQuery: string;
  selectedTag: string | null;
  isLoading: boolean;
  error: string | null;

  loadInitialData: () => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  setActiveProject: (projectId: string) => void;
  openSessionTab: (sessionId: string) => void;
  closeSessionTab: (sessionId: string) => void;
  closeOtherSessionTabs: (sessionId: string) => void;
  closeAllSessionTabs: () => void;
  reorderSessionTabs: (fromIndex: number, toIndex: number) => void;
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
const STORAGE_OPEN_SESSIONS_KEY = 'tcode_open_session_ids_v2';

export const useProjectSessionStore = create<ProjectSessionState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeSessionId: null,
  openSessionIds: [],
  searchQuery: '',
  selectedTag: null,
  isLoading: false,
  error: null,

  loadInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await invoke<ProjectsDatabase>('list_projects_and_sessions');
      let rawProjects = (db && Array.isArray(db.projects)) ? db.projects : [];

      // If empty, ensure default project exists
      if (rawProjects.length === 0) {
        rawProjects = [
          {
            id: 'proj_default',
            name: 'agent-learning',
            path: 'E:/pro/agent-learning',
            is_active: true,
            created_at: 1788190290530,
            updated_at: 1788190290530,
            sessions: [
              {
                id: 'sess_default',
                project_id: 'proj_default',
                title: '架构重构与执行流设计',
                tags: ['#核心', '#开发'],
                is_pinned: true,
                model_id: 'deepseek-v4-flash',
                created_at: 1788190290531,
                updated_at: 1788190290531,
                messages: [],
              },
            ],
          },
        ];
      }

      // Ensure every project has valid sessions array
      const projects: ProjectRecord[] = rawProjects.map((p) => ({
        ...p,
        sessions: Array.isArray(p.sessions) && p.sessions.length > 0
          ? p.sessions
          : [
              {
                id: `sess_${p.id}_default`,
                project_id: p.id,
                title: `${p.name} (主开发会话)`,
                tags: ['#开发'],
                is_pinned: true,
                model_id: 'deepseek-v4-flash',
                created_at: Date.now(),
                updated_at: Date.now(),
                messages: [],
              },
            ],
      }));

      const allSessions = projects.flatMap((p) => p.sessions || []);
      const savedProj = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_PROJ_KEY) : null;
      const savedSess = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_SESS_KEY) : null;
      const savedOpenRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_OPEN_SESSIONS_KEY) : null;

      let openIds: string[] = [];
      if (savedOpenRaw) {
        try {
          const parsed = JSON.parse(savedOpenRaw);
          if (Array.isArray(parsed)) {
            openIds = parsed.filter((id) => allSessions.some((s) => s.id === id));
          }
        } catch (e) {}
      }

      const activeProjId = (savedProj && projects.some((p) => p.id === savedProj))
        ? savedProj
        : (projects[0]?.id || null);

      const curProj = projects.find((p) => p.id === activeProjId) || projects[0];
      let activeSessId = (savedSess && (curProj?.sessions || []).some((s) => s.id === savedSess))
        ? savedSess
        : (curProj?.sessions?.[0]?.id || null);

      if (openIds.length === 0 && activeSessId) {
        openIds = [activeSessId];
      } else if (activeSessId && !openIds.includes(activeSessId)) {
        openIds.push(activeSessId);
      }

      if (openIds.length > 0 && (!activeSessId || !openIds.includes(activeSessId))) {
        activeSessId = openIds[0];
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(openIds));
        if (activeProjId) localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, activeProjId);
        if (activeSessId) localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, activeSessId);
      }

      set({
        projects,
        activeProjectId: activeProjId,
        activeSessionId: activeSessId,
        openSessionIds: openIds,
        isLoading: false,
      });
    } catch (err: any) {
      console.warn('[useProjectSessionStore] loadInitialData failed:', err);
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveSession: (sessionId: string) => {
    const { projects, openSessionIds } = get();
    let foundProjectId: string | null = null;
    for (const p of projects) {
      if ((p.sessions || []).some((s) => s.id === sessionId)) {
        foundProjectId = p.id;
        break;
      }
    }
    const finalProjId = foundProjectId || get().activeProjectId;
    const nextOpen = openSessionIds.includes(sessionId) ? openSessionIds : [...openSessionIds, sessionId];

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, sessionId);
      if (finalProjId) localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, finalProjId);
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
    }
    set({
      activeSessionId: sessionId,
      activeProjectId: finalProjId,
      openSessionIds: nextOpen,
    });
  },

  setActiveProject: (projectId: string) => {
    const { projects, openSessionIds } = get();
    const proj = projects.find((p) => p.id === projectId);
    const firstSessionId = proj?.sessions?.[0]?.id || null;
    let nextOpen = openSessionIds;
    if (firstSessionId && !openSessionIds.includes(firstSessionId)) {
      nextOpen = [...openSessionIds, firstSessionId];
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, projectId);
      if (firstSessionId) localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, firstSessionId);
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
    }
    set({
      activeProjectId: projectId,
      activeSessionId: firstSessionId,
      openSessionIds: nextOpen,
    });
  },

  openSessionTab: (sessionId: string) => {
    get().setActiveSession(sessionId);
  },

  closeSessionTab: (sessionId: string) => {
    const { openSessionIds, activeSessionId } = get();
    const nextOpen = openSessionIds.filter((id) => id !== sessionId);
    let nextActive = activeSessionId;

    if (activeSessionId === sessionId) {
      const closedIndex = openSessionIds.indexOf(sessionId);
      if (nextOpen.length === 0) {
        nextActive = null;
      } else if (closedIndex >= nextOpen.length) {
        nextActive = nextOpen[nextOpen.length - 1];
      } else {
        nextActive = nextOpen[closedIndex];
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
      if (nextActive) {
        localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, nextActive);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_SESS_KEY);
      }
    }

    set({
      openSessionIds: nextOpen,
      activeSessionId: nextActive,
    });
  },

  closeOtherSessionTabs: (sessionId: string) => {
    const nextOpen = [sessionId];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
      localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, sessionId);
    }
    set({
      openSessionIds: nextOpen,
      activeSessionId: sessionId,
    });
  },

  closeAllSessionTabs: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify([]));
      localStorage.removeItem(STORAGE_ACTIVE_SESS_KEY);
    }
    set({
      openSessionIds: [],
      activeSessionId: null,
    });
  },

  reorderSessionTabs: (fromIndex: number, toIndex: number) => {
    const { openSessionIds } = get();
    if (fromIndex < 0 || fromIndex >= openSessionIds.length || toIndex < 0 || toIndex >= openSessionIds.length) return;
    const nextOpen = [...openSessionIds];
    const [moved] = nextOpen.splice(fromIndex, 1);
    nextOpen.splice(toIndex, 0, moved);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
    }
    set({ openSessionIds: nextOpen });
  },

  addProjectFolder: async (path: string, name?: string) => {
    try {
      const cleanPath = (path || '').trim().replace(/\\/g, '/');
      const project = await invoke<ProjectRecord>('add_project_folder', { path: cleanPath, name });
      await get().loadInitialData();
      
      const currentProjects = get().projects;
      const targetProj = project || currentProjects.find(
        (p) => (p.path || '').replace(/\\/g, '/').toLowerCase() === cleanPath.toLowerCase()
      ) || currentProjects[0];

      if (targetProj) {
        const sessId = targetProj.sessions?.[0]?.id || null;
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_ACTIVE_PROJ_KEY, targetProj.id);
          if (sessId) {
            localStorage.setItem(STORAGE_ACTIVE_SESS_KEY, sessId);
          }
        }
        const openIds = sessId ? Array.from(new Set([...get().openSessionIds, sessId])) : get().openSessionIds;
        if (typeof window !== 'undefined' && openIds.length > 0) {
          localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(openIds));
        }
        set({
          activeProjectId: targetProj.id,
          activeSessionId: sessId || get().activeSessionId,
          openSessionIds: openIds,
        });
        return targetProj;
      }
      return null;
    } catch (err: any) {
      console.warn('[useProjectSessionStore] addProjectFolder error:', err);
      set({ error: String(err) });
      await get().loadInitialData();
      return get().projects[0] || null;
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
      const currentOpen = get().openSessionIds;
      const nextOpen = session?.id && !currentOpen.includes(session.id) ? [...currentOpen, session.id] : currentOpen;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_OPEN_SESSIONS_KEY, JSON.stringify(nextOpen));
      }
      set({ activeSessionId: session?.id || null, activeProjectId: projectId, openSessionIds: nextOpen });
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
        session_id: sessionId,
        title,
        tags,
        isPinned,
        is_pinned: isPinned,
        modelId,
        model_id: modelId,
      });
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await invoke('delete_project_session', { sessionId, session_id: sessionId });
      get().closeSessionTab(sessionId);
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      await invoke('delete_project_folder', { projectId, project_id: projectId });
      await get().loadInitialData();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSelectedTag: (selectedTag: string | null) => set({ selectedTag }),
}));
