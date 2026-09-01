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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentRoot: null,
  openTabs: [],
  activeTabPath: null,
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
    const existing = openTabs.find(t => t.path === path);
    if (existing) {
      set({ activeTabPath: path });
      return;
    }

    try {
      const content = await invoke<string>('read_file_content', { path });
      const name = path.split(/[\/\\]/).pop() || path;
      const language = detectLanguage(path);

      const newTab: EditorTab = {
        path,
        name,
        content,
        language,
        isDirty: false,
      };

      set({
        openTabs: [...openTabs, newTab],
        activeTabPath: path,
      });
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  closeTab: (path: string) => {
    const { openTabs, activeTabPath } = get();
    const filtered = openTabs.filter(t => t.path !== path);
    let nextActive = activeTabPath;
    if (activeTabPath === path) {
      nextActive = filtered.length > 0 ? filtered[filtered.length - 1].path : null;
    }
    set({ openTabs: filtered, activeTabPath: nextActive });
  },

  updateTabContent: (path: string, content: string) => {
    const { openTabs } = get();
    set({
      openTabs: openTabs.map(t =>
        t.path === path ? { ...t, content, isDirty: true } : t
      ),
    });
  },

  saveActiveFile: async () => {
    const { openTabs, activeTabPath, currentRoot } = get();
    const tab = openTabs.find(t => t.path === activeTabPath);
    if (!tab) return;

    try {
      await invoke('save_file_content', { path: tab.path, content: tab.content });
      set({
        openTabs: openTabs.map(t =>
          t.path === tab.path ? { ...t, isDirty: false } : t
        ),
      });
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

    set({
      openTabs: [...openTabs.filter(t => t.path !== diffTab.path), diffTab],
      activeTabPath: diffTab.path,
    });
  },

  acceptDiffPatch: async (diffPath: string) => {
    const { openTabs } = get();
    const diffTab = openTabs.find(t => t.path === diffPath);
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
