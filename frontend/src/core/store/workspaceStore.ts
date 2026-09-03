import { create } from 'zustand'

export type WorkspaceMode = 'chat' | 'split' | 'editor'
export type ActivityTab = 'chat' | 'files' | 'git' | 'usage' | 'settings'

interface WorkspaceState {
  mode: WorkspaceMode
  activityTab: ActivityTab
  isTerminalOpen: boolean
  splitRatio: number // 0.2 ~ 0.8, 默认 0.5
  setMode: (mode: WorkspaceMode) => void
  setActivityTab: (tab: ActivityTab) => void
  toggleTerminal: () => void
  setTerminalOpen: (open: boolean) => void
  setSplitRatio: (ratio: number) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: 'split',
  activityTab: 'chat',
  isTerminalOpen: false,
  splitRatio: 0.5,
  setMode: (mode) => set({ mode }),
  setActivityTab: (tab) => set({ activityTab: tab }),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio })
}))
