import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wailsBridge, type SessionMessage } from '../core/wailsBridge'

export interface ToolCallRecord {
  id?: string
  name: string
  args: any
  output?: string
  status?: 'running' | 'success' | 'error'
  turn?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  tool?: ToolCallRecord
  tools?: ToolCallRecord[]
  time: string
}

export const useChatStore = defineStore('chat', () => {
  const currentSessionId = ref('')
  const isFullAuto = ref(false)
  const isThinkingExpanded = ref(true)
  const activeDiffFile = ref('')
  const isDiffWorkspaceOpen = ref(false)
  const isKnowledgeGraphOpen = ref(false)
  const isSettingsOpen = ref(false)
  const activeActivity = ref('chat')
  const isStreaming = ref(false)
  const gitVersion = ref(0)

  function notifyGitStatusChanged() {
    gitVersion.value++
  }

  // 动态对话消息队列 (纯净真实空状态)
  const messages = ref<ChatMessage[]>([])

  function toggleApprovalMode() {
    isFullAuto.value = !isFullAuto.value
  }

  function toggleDiffWorkspace() {
    isDiffWorkspaceOpen.value = !isDiffWorkspaceOpen.value
  }

  function openDiff(file: string) {
    activeDiffFile.value = file
    isDiffWorkspaceOpen.value = true
  }

  function appendMessage(msg: ChatMessage) {
    messages.value.push(msg)
  }

  async function switchSession(id: string) {
    currentSessionId.value = id
    messages.value = []
    if (!id) return
    try {
      const sess = await wailsBridge.getSession(id)
      if (sess && sess.messages && sess.messages.length > 0) {
        messages.value = sess.messages.map(m => {
          const mappedTools = (m.tools && m.tools.length > 0)
            ? m.tools.map((t, idx) => ({
                id: t.id || `hist_tool_${m.id}_${idx}`,
                name: t.name,
                args: t.args,
                output: t.output
              }))
            : (m.tool ? [{
                id: `hist_tool_${m.id}_0`,
                name: m.tool.name,
                args: m.tool.args,
                output: m.tool.output
              }] : undefined)

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            thinking: m.thinking,
            tool: m.tool ? {
              name: m.tool.name,
              args: m.tool.args,
              output: m.tool.output
            } : undefined,
            tools: mappedTools,
            time: m.time
          }
        })
      }
    } catch (err) {
      console.error('Failed to load session history:', err)
    }
  }

  async function stopGeneration() {
    await wailsBridge.cancelAgentStream()
    isStreaming.value = false
  }

  return {
    currentSessionId,
    isFullAuto,
    isThinkingExpanded,
    activeDiffFile,
    isDiffWorkspaceOpen,
    isKnowledgeGraphOpen,
    isSettingsOpen,
    activeActivity,
    isStreaming,
    gitVersion,
    messages,
    toggleApprovalMode,
    toggleDiffWorkspace,
    openDiff,
    appendMessage,
    switchSession,
    stopGeneration,
    notifyGitStatusChanged
  }
})
