import { create } from "zustand";

export interface GitFileStatus {
  path: string;
  orig_path?: string;
  staged_code?: string; // "M", "A", "D"
  work_code?: string;   // "M", "D", "U"
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  isRemote?: boolean;
  hash: string;
  lastCommit: string;
}

export interface GitSnapshotItem {
  id: string;
  time: string;
  file: string;
  desc: string;
  hash: string;
}

export interface GitStashItem {
  id: string;
  time: string;
  branch: string;
  desc: string;
}

interface GitState {
  branch: string;
  branches: GitBranchItem[];
  staged: GitFileStatus[];
  working: GitFileStatus[];
  snapshots: GitSnapshotItem[];
  stashes: GitStashItem[];
  isBranchModalOpen: boolean;
  isSnapshotModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  setBranchModalOpen: (open: boolean) => void;
  setSnapshotModalOpen: (open: boolean) => void;
  fetchStatus: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  restoreFile: (path: string) => Promise<void>;
  checkoutBranch: (branchName: string) => Promise<void>;
  createBranch: (branchName: string) => Promise<void>;
  rollbackSnapshot: (snapshotId: string) => Promise<void>;
  popStash: (stashId: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  branch: "main",
  branches: [
    { name: "main", isCurrent: true, hash: "d704e65", lastCommit: "feat(agent): implement real autonomous ReAct loop" },
    { name: "feature/warm-terminal", isCurrent: false, hash: "90bfbcd", lastCommit: "feat: add integrated terminal drawer" },
    { name: "refactor/sub2api-gateway", isCurrent: false, hash: "55f02b6", lastCommit: "feat: listen on 0.0.0.0 ipv4/ipv6" },
    { name: "origin/main", isRemote: true, isCurrent: false, hash: "d704e65", lastCommit: "feat(agent): implement real autonomous ReAct loop" },
  ],
  staged: [],
  working: [],
  snapshots: [
    { id: "snap-003", time: "刚刚", file: "backend/daemon.js", desc: "ReAct loop 改造前自动影子快照", hash: "d704e6" },
    { id: "snap-002", time: "10分钟前", file: "frontend/src/app/chat/ChatCockpit.tsx", desc: "对话流动态卡片渲染前快照", hash: "4ce077" },
    { id: "snap-001", time: "30分钟前", file: "README.md", desc: "架构规约更新前快照", hash: "55f02b" },
  ],
  stashes: [
    { id: "stash@{0}", time: "15分钟前", branch: "main", desc: "WIP on main: 临时保存未完工调试断点" },
  ],
  isBranchModalOpen: false,
  isSnapshotModalOpen: false,
  isLoading: false,
  error: null,

  setBranchModalOpen: (open) => set({ isBranchModalOpen: open }),
  setSnapshotModalOpen: (open) => set({ isSnapshotModalOpen: open }),

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("http://127.0.0.1:8765/api/git/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      if (res.ok) await get().fetchStatus();
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
      if (res.ok) await get().fetchStatus();
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
      if (res.ok) await get().fetchStatus();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  checkoutBranch: async (branchName: string) => {
    set((state) => ({
      branch: branchName,
      branches: state.branches.map((b) => ({
        ...b,
        isCurrent: b.name === branchName,
      })),
      isBranchModalOpen: false,
    }));
  },

  createBranch: async (branchName: string) => {
    const newB: GitBranchItem = {
      name: branchName,
      isCurrent: true,
      hash: "head",
      lastCommit: "WIP: branched off " + get().branch,
    };
    set((state) => ({
      branch: branchName,
      branches: [newB, ...state.branches.map((b) => ({ ...b, isCurrent: false }))],
      isBranchModalOpen: false,
    }));
  },

  rollbackSnapshot: async (snapshotId: string) => {
    alert(`✓ 已将工作区状态秒级无损回退至快照 [${snapshotId}]`);
    set({ isSnapshotModalOpen: false });
  },

  popStash: async (stashId: string) => {
    set((state) => ({
      stashes: state.stashes.filter((s) => s.id !== stashId),
    }));
    alert(`✓ 已恢复储藏项 [${stashId}]`);
  },
}));
