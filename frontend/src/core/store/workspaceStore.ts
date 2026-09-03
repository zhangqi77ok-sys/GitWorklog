import { create } from 'zustand'

export type WorkspaceMode = 'chat' | 'split' | 'editor'
export type ActivityTab = 'chat' | 'files' | 'git' | 'usage' | 'kg' | 'mcp'

export interface SessionItem {
  id: string
  title: string
  icon: string
  tag: string
  tagColor: string
  timeAgo: string
  desc: string
  project: string
}

interface WorkspaceState {
  mode: WorkspaceMode
  activityTab: ActivityTab
  isTerminalOpen: boolean
  isKgModalOpen: boolean
  isCodeWorkspaceOpen: boolean
  isCodeMaximized: boolean
  isApprovalMode: boolean
  activeSessionId: string
  selectedTag: string
  splitRatio: number

  setMode: (mode: WorkspaceMode) => void
  setActivityTab: (tab: ActivityTab) => void
  toggleTerminal: () => void
  setTerminalOpen: (open: boolean) => void
  setKgModalOpen: (open: boolean) => void
  setCodeWorkspaceOpen: (open: boolean) => void
  toggleCodeWorkspace: () => void
  toggleCodeMaximize: () => void
  toggleApprovalMode: () => void
  setActiveSessionId: (id: string) => void
  setSelectedTag: (tag: string) => void
  setSplitRatio: (ratio: number) => void
}

export const INITIAL_SESSIONS: SessionItem[] = [
  {
    id: 'sess1',
    title: '架构重构与执行流设计',
    icon: '📌',
    tag: '核心架构',
    tagColor: 'bg-[#D96B27]/10 text-[#D96B27]',
    timeAgo: '刚刚',
    desc: '4 工具闭环',
    project: 'agent-learning',
  },
  {
    id: 'sess2',
    title: 'TDD测试自愈与并发防漏',
    icon: '🧪',
    tag: '单测自愈',
    tagColor: 'bg-teal-50 text-teal-700',
    timeAgo: '5分钟前',
    desc: '失败自动修复',
    project: 'agent-learning',
  },
  {
    id: 'sess3',
    title: 'Sub2API CAP与Sub2订阅',
    icon: '🌐',
    tag: '网关调度',
    tagColor: 'bg-blue-50 text-blue-700',
    timeAgo: '15分钟前',
    desc: '对齐sub2api',
    project: 'agent-learning',
  },
  {
    id: 'sess4',
    title: '高危系统指令沙箱拦截',
    icon: '🛡️',
    tag: '安全防护',
    tagColor: 'bg-amber-50 text-amber-700',
    timeAgo: '1小时前',
    desc: '危险命令阻断',
    project: 'agent-learning',
  },
  {
    id: 'sess5',
    title: 'Monaco行级Diff与暖色规范',
    icon: '🎨',
    tag: '前端开发',
    tagColor: 'bg-purple-50 text-purple-700',
    timeAgo: '昨天',
    desc: '60-30-10设计',
    project: 'agent-learning',
  },
]

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: 'split',
  activityTab: 'chat',
  isTerminalOpen: false,
  isKgModalOpen: false,
  isCodeWorkspaceOpen: true,
  isCodeMaximized: false,
  isApprovalMode: true,
  activeSessionId: 'sess1',
  selectedTag: 'all',
  splitRatio: 0.5,

  setMode: (mode) => set({ mode }),
  setActivityTab: (tab) => set({ activityTab: tab }),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
  setKgModalOpen: (open) => set({ isKgModalOpen: open }),
  setCodeWorkspaceOpen: (open) => set({ isCodeWorkspaceOpen: open }),
  toggleCodeWorkspace: () => set((state) => ({ isCodeWorkspaceOpen: !state.isCodeWorkspaceOpen })),
  toggleCodeMaximize: () => set((state) => ({ isCodeMaximized: !state.isCodeMaximized })),
  toggleApprovalMode: () => set((state) => ({ isApprovalMode: !state.isApprovalMode })),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
}))
