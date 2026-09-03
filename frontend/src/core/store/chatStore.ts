import { create } from 'zustand'
import { streamChatApi } from '../transport/sseClient'
import { useSettingsStore } from './settingsStore'
import { useWorkspaceStore } from './workspaceStore'
import type { ToolCallItem } from '../../app/chat/ToolCard'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  toolCalls?: ToolCallItem[]
  timestamp: number
  model?: string
  isStreaming?: boolean
  snapshotId?: string
  forkedFromId?: string
}

interface ChatState {
  messages: ChatMessage[]
  sessionsMessages: Record<string, ChatMessage[]>
  isStreaming: boolean
  currentModel: string
  setCurrentModel: (model: string) => void
  sendMessage: (prompt: string) => Promise<void>
  clearHistory: () => void
  forkSessionFromMessage: (messageId: string, customTitle?: string) => string
  revertToMessage: (messageId: string) => void
  switchSession: (sessionId: string) => void
}

const DEFAULT_INIT_MESSAGE: ChatMessage = {
  id: 'msg-init',
  role: 'assistant',
  content: '你好！Tcode 生产级微内核与前端基础框架已就绪，已原生配置 OpenAI 与 Claude 双轨上游协议支持。在下方输入框输入指令即可体验首条端到端流式闭环。',
  timestamp: Date.now(),
  model: 'system',
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [DEFAULT_INIT_MESSAGE],
  sessionsMessages: {
    sess1: [DEFAULT_INIT_MESSAGE],
  },
  isStreaming: false,
  currentModel: 'deepseek-v4-flash',

  setCurrentModel: (model) => set({ currentModel: model }),

  clearHistory: () => {
    const wsState = useWorkspaceStore.getState()
    const activeId = wsState.activeSessionId
    set((state) => ({
      messages: [],
      sessionsMessages: {
        ...state.sessionsMessages,
        [activeId]: [],
      },
    }))
  },

  switchSession: (sessionId: string) => {
    const messages = get().sessionsMessages[sessionId] || []
    set({ messages })
  },

  forkSessionFromMessage: (messageId: string, customTitle?: string) => {
    const currentMessages = get().messages
    const idx = currentMessages.findIndex((m) => m.id === messageId)
    if (idx === -1) return ''

    const sliced = currentMessages.slice(0, idx + 1)
    const forkId = `fork_${Date.now()}`
    const wsState = useWorkspaceStore.getState()
    const curSession = wsState.sessions.find((s) => s.id === wsState.activeSessionId)
    const baseTitle = curSession ? curSession.title : '架构重构'
    const newTitle = customTitle || `${baseTitle} (分支 #${wsState.sessions.length + 1})`

    const noticeMsg: ChatMessage = {
      id: `msg-fork-${Date.now()}`,
      role: 'assistant',
      content: `🌿 **已成功从会话「${baseTitle}」分叉出独立探索分支**\n\n此分支完整保留了截至本轮的前序上下文（共 ${sliced.length} 条记录）。您可以随时在左侧会话抽屉中切回原分支，或在此分支尝试不同的技术路线。`,
      timestamp: Date.now(),
      model: 'system',
      forkedFromId: messageId,
    }

    const newMessages = [...sliced, noticeMsg]

    set((state) => ({
      sessionsMessages: {
        ...state.sessionsMessages,
        [forkId]: newMessages,
      },
      messages: newMessages,
    }))

    wsState.addSession({
      id: forkId,
      title: newTitle,
      icon: '🌿',
      tag: '探索分支',
      tagColor: 'bg-emerald-50 text-emerald-700',
      timeAgo: '刚刚',
      desc: `源自 ${messageId.slice(-6)}`,
      project: wsState.projectName || 'agent-learning',
    })
    wsState.setActiveSessionId(forkId)

    return forkId
  },

  revertToMessage: (messageId: string) => {
    const currentMessages = get().messages
    const idx = currentMessages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    const truncated = currentMessages.slice(0, idx + 1)
    const wsState = useWorkspaceStore.getState()
    const activeId = wsState.activeSessionId

    set((state) => ({
      messages: truncated,
      sessionsMessages: {
        ...state.sessionsMessages,
        [activeId]: truncated,
      },
    }))
  },

  sendMessage: async (prompt: string) => {
    const text = prompt.trim()
    if (!text || get().isStreaming) return

    const userMsgId = `msg-user-${Date.now()}`
    const assistantMsgId = `msg-asst-${Date.now()}`
    const currentModel = get().currentModel

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: Date.now(),
      model: currentModel,
      isStreaming: true,
    }

    // 乐观 UI 插入两条消息
    set((state) => ({
      messages: [...state.messages, userMsg, assistantPlaceholder],
      isStreaming: true,
    }))

    const { config } = useSettingsStore.getState()

    await streamChatApi({
      model: currentModel,
      prompt: text,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      onChunk: (chunk) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== assistantMsgId) return m

            let newContent = m.content
            let newThinking = m.thinking || ''

            if (chunk.delta_content) {
              newContent += chunk.delta_content
            }
            if (chunk.thinking) {
              newThinking += chunk.thinking
            }

            return {
              ...m,
              content: newContent,
              thinking: newThinking,
            }
          }),
        }))
      },
      onToolStart: (tool) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== assistantMsgId) return m
            const existing = m.toolCalls || []
            const item: ToolCallItem = {
              id: tool.id,
              name: tool.name,
              args: tool.args,
              status: 'running',
            }
            return {
              ...m,
              toolCalls: [...existing, item],
            }
          }),
        }))
      },
      onToolEnd: (tool) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== assistantMsgId) return m
            const existing = m.toolCalls || []
            return {
              ...m,
              toolCalls: existing.map((tc) => {
                if (tc.id !== tool.id) return tc
                return {
                  ...tc,
                  output: tool.output,
                  status: tool.is_error ? 'error' : 'success',
                }
              }),
            }
          }),
        }))
      },
      onError: (err) => {
        set((state) => ({
          isStreaming: false,
          messages: state.messages.map((m) => {
            if (m.id !== assistantMsgId) return m
            return {
              ...m,
              isStreaming: false,
              content: m.content
                ? `${m.content}\n\n[错误: ${err.message}]`
                : `[调用错误: ${err.message}]`,
            }
          }),
        }))
      },
      onDone: () => {
        set((state) => ({
          isStreaming: false,
          messages: state.messages.map((m) => {
            if (m.id !== assistantMsgId) return m
            return {
              ...m,
              isStreaming: false,
            }
          }),
        }))
      },
    })
  },
}))
