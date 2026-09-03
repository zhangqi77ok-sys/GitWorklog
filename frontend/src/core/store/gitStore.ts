import { create } from "zustand";

export interface GitFileStatus {
  path: string;
  orig_path?: string;
  staged_code?: string; // "M", "A", "D"
  work_code?: string;   // "M", "D", "U"
}

interface GitState {
  branch: string;
  staged: GitFileStatus[];
  working: GitFileStatus[];
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  restoreFile: (path: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  branch: "main",
  staged: [],
  working: [],
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("http://127.0.0.1:8765/api/git/status");
      if (!res.ok) {
        throw new Error(`Failed to fetch git status: HTTP ${res.status}`);
      }
      const data = await res.json();
      set({
        branch: data.branch || "main",
        staged: data.staged || [],
        working: data.working || [],
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  stageFile: async (path: string) => {
    try {
      const res = await fetch("http://127.0.0.1:8765/api/git/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        await get().fetchStatus();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  unstageFile: async (path: string) => {
    try {
      const res = await fetch("http://127.0.0.1:8765/api/git/unstage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        await get().fetchStatus();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  restoreFile: async (path: string) => {
    try {
      const res = await fetch("http://127.0.0.1:8765/api/git/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        await get().fetchStatus();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
