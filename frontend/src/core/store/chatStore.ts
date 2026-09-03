import { create } from 'zustand'
import { streamChatApi } from '../transport/sseClient'
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
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  currentModel: string
  setCurrentModel: (model: string) => void
  sendMessage: (prompt: string) => Promise<void>
  clearHistory: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'msg-init',
      role: 'assistant',
      content: '你好！Tcode 生产级微内核与前端基础框架已就绪，已原生配置 OpenAI 与 Claude 双轨上游协议支持。在下方输入框输入指令即可体验首条端到端流式闭环。',
      timestamp: Date.now(),
      model: 'system',
    },
  ],
  isStreaming: false,
  currentModel: 'deepseek-v4-flash',

  setCurrentModel: (model) => set({ currentModel: model }),

  clearHistory: () => set({ messages: [] }),

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

    await streamChatApi({
      model: currentModel,
      prompt: text,
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
