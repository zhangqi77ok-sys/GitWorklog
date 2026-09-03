import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wailsBridge, type SessionMessage } from '../core/wailsBridge'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  tool?: {
    name: string
    args: any
    output?: string
  }
  time: string
}

export const useChatStore = defineStore('chat', () => {
  const currentSessionId = ref('sess1')
  const isFullAuto = ref(false)
  const isThinkingExpanded = ref(true)
  const activeDiffFile = ref('app.go')
  const isDiffWorkspaceOpen = ref(true)
  const isKnowledgeGraphOpen = ref(false)
  const isSettingsOpen = ref(false)
  const activeActivity = ref('chat')
  const isStreaming = ref(false)

  // 动态对话消息队列
  const messages = ref<ChatMessage[]>([
    {
      id: 'msg_1',
      role: 'user',
      content: `1. 原型设计上，厂商不仅支持自动获取模型，还要支持手动添加。
2. 还缺skill管理、MCP管理、软件规则管理。
3. 主页面应该还要有一个最左侧的活动导航栏。`,
      time: '14:20'
    },
    {
      id: 'msg_2',
      role: 'assistant',
      thinking: `1. 引入 48px 最左侧活动栏，支持工作台秒切；
2. 补齐自动抓取与手动模型录入；
3. 落地 MCP、Skill、Rules 设置管理。`,
      content: `已成功按照原型与技术规范重构为纯原生 Go 1.22 + Wails v2 + Vue 3.4 架构。
所有 Python 与旧 React 遗留已全部清理，系统已接通原生 IPC 通信管道与 ReAct 自主算子循环。`,
      tool: {
        name: 'exec_command',
        args: { command: 'go build -o bin/tcode.exe .' },
        output: 'Wails v2.9.2 Native Compiler Packaged bin/tcode.exe (5.1MB)'
      },
      time: '14:21'
    }
  ])

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
    try {
      const sess = await wailsBridge.getSession(id)
      if (sess && sess.messages && sess.messages.length > 0) {
        messages.value = sess.messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          thinking: m.thinking,
          tool: m.tool ? {
            name: m.tool.name,
            args: m.tool.args,
            output: m.tool.output
          } : undefined,
          time: m.time
        }))
      }
    } catch (err) {
      console.error('Failed to load session history:', err)
    }
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
    messages,
    toggleApprovalMode,
    toggleDiffWorkspace,
    openDiff,
    appendMessage,
    switchSession
  }
})
