import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  children?: FileNode[];
}

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  isDiff?: boolean;
  originalContent?: string;
  proposedContent?: string;
}

interface WorkspaceState {
  currentRoot: FileNode | null;
  openTabs: EditorTab[];
  activeTabPath: string | null;
  isLoadingTree: boolean;
  error: string | null;

  loadTree: (rootPath: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveActiveFile: () => Promise<void>;
  openDiffTab: (path: string, originalContent: string, proposedContent: string) => void;
  acceptDiffPatch: (path: string) => Promise<void>;
  rejectDiffPatch: (path: string) => void;
}

const STORAGE_OPEN_TABS_KEY = 'tcode_open_tabs_v2';
const STORAGE_ACTIVE_TAB_KEY = 'tcode_active_tab_path_v2';

function loadSavedTabs(): { openTabs: EditorTab[]; activeTabPath: string | null } {
  try {
    if (typeof window !== 'undefined') {
      const savedTabs = localStorage.getItem(STORAGE_OPEN_TABS_KEY);
      const savedActive = localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
      if (savedTabs) {
        return {
          openTabs: JSON.parse(savedTabs) || [],
          activeTabPath: savedActive || null,
        };
      }
    }
  } catch (e) {}
  return { openTabs: [], activeTabPath: null };
}

function persistTabs(openTabs: EditorTab[], activeTabPath: string | null) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OPEN_TABS_KEY, JSON.stringify(openTabs));
      if (activeTabPath) {
        localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, activeTabPath);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_TAB_KEY);
      }
    }
  } catch (e) {}
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'toml':
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'java':
      return 'java';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

const initialSaved = loadSavedTabs();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentRoot: null,
  openTabs: initialSaved.openTabs,
  activeTabPath: initialSaved.activeTabPath,
  isLoadingTree: false,
  error: null,

  loadTree: async (rootPath: string) => {
    if (!rootPath) return;
    set({ isLoadingTree: true, error: null });
    try {
      const tree = await invoke<FileNode>('read_workspace_tree', { path: rootPath });
      set({ currentRoot: tree, isLoadingTree: false });
    } catch (err: any) {
      set({ error: String(err), isLoadingTree: false });
    }
  },

  openFile: async (path: string) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabPath: path });
      persistTabs(openTabs, path);
      return;
    }

    try {
      const content = await invoke<string>('read_file_content', { path });
      const name = path.split(/[\/\\]/).pop() || path;
      const language = detectLanguage(path);

      const newTab: EditorTab = {
        path,
        name,
        content: content ?? '',
        language,
        isDirty: false,
      };

      const newOpenTabs = [...openTabs, newTab];
      set({
        openTabs: newOpenTabs,
        activeTabPath: path,
      });
      persistTabs(newOpenTabs, path);
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  closeTab: (path: string) => {
    const { openTabs, activeTabPath } = get();
    const filtered = openTabs.filter((t) => t.path !== path);
    let nextActive = activeTabPath;
    if (activeTabPath === path) {
      nextActive = filtered.length > 0 ? filtered[filtered.length - 1].path : null;
    }
    set({ openTabs: filtered, activeTabPath: nextActive });
    persistTabs(filtered, nextActive);
  },

  updateTabContent: (path: string, content: string) => {
    const { openTabs, activeTabPath } = get();
    const updated = openTabs.map((t) =>
      t.path === path ? { ...t, content, isDirty: true } : t
    );
    set({ openTabs: updated });
    persistTabs(updated, activeTabPath);
  },

  saveActiveFile: async () => {
    const { openTabs, activeTabPath, currentRoot } = get();
    const tab = openTabs.find((t) => t.path === activeTabPath);
    if (!tab) return;

    try {
      await invoke('save_file_content', { path: tab.path, content: tab.content });
      const updated = openTabs.map((t) =>
        t.path === tab.path ? { ...t, isDirty: false } : t
      );
      set({ openTabs: updated });
      persistTabs(updated, activeTabPath);
      if (currentRoot) {
        get().loadTree(currentRoot.path);
      }
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  openDiffTab: (path: string, originalContent: string, proposedContent: string) => {
    const { openTabs } = get();
    const name = `🔀 Diff: ${path.split(/[\/\\]/).pop() || path}`;
    const language = detectLanguage(path);

    const diffTab: EditorTab = {
      path: `diff:${path}`,
      name,
      content: proposedContent,
      language,
      isDirty: true,
      isDiff: true,
      originalContent,
      proposedContent,
    };

    const newTabs = [...openTabs.filter((t) => t.path !== diffTab.path), diffTab];
    set({
      openTabs: newTabs,
      activeTabPath: diffTab.path,
    });
    persistTabs(newTabs, diffTab.path);
  },

  acceptDiffPatch: async (diffPath: string) => {
    const { openTabs } = get();
    const diffTab = openTabs.find((t) => t.path === diffPath);
    if (!diffTab || !diffTab.proposedContent) return;

    const realPath = diffPath.replace(/^diff:/, '');
    try {
      await invoke('save_file_content', {
        path: realPath,
        content: diffTab.proposedContent,
      });

      // Close diff tab and open regular tab
      get().closeTab(diffPath);
      await get().openFile(realPath);
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  rejectDiffPatch: (diffPath: string) => {
    get().closeTab(diffPath);
  },
}));
