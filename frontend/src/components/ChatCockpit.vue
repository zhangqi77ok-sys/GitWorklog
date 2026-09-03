<template>
  <main
    class="flex-1 bg-[#FAF8F5] flex flex-col justify-between overflow-hidden relative font-sans"
    @dragover.prevent="isDraggingOver = true"
    @dragenter.prevent="isDraggingOver = true"
    @dragleave.prevent="isDraggingOver = false"
    @drop.prevent="handleDrop"
  >
    <!-- 原生文件拖拽放置全屏浮层 (Drag & Drop Overlay) -->
    <div
      v-if="isDraggingOver"
      class="absolute inset-0 bg-[#FAF8F5]/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center border-2 border-dashed border-[#D96B27] m-3 rounded-2xl animate-in fade-in duration-150"
    >
      <div class="w-16 h-16 rounded-2xl bg-[#D96B27]/10 text-[#D96B27] flex items-center justify-center text-3xl mb-3 shadow-xs">
        📎
      </div>
      <div class="text-base font-bold text-[#18181B]">松开鼠标，即可将文件注入 Agent 上下文</div>
      <div class="text-xs text-[#71717A] mt-1 font-mono">支持 Go、Vue、TypeScript、Markdown、JSON 等工程文件</div>
    </div>

    <!-- 顶栏: 场景标签、真实多模型切换器与收起代码按钮 -->
    <header class="h-10 min-h-[40px] bg-[#FAF8F5] border-b border-black/[0.08] px-3 flex items-center justify-between text-xs select-none z-10 shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-[#18181B]">{{ currentSessionTitle }}</span>
        <span class="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded font-mono">AgentRouter</span>

        <!-- 真实模型下拉选择器 -->
        <div class="relative flex items-center">
          <select
            v-model="selectedModel"
            class="bg-white border border-black/[0.1] rounded-lg px-2 py-0.8 text-xs font-mono font-medium text-[#10A37F] focus:outline-none focus:border-[#D96B27] cursor-pointer shadow-2xs"
          >
            <option value="deepseek-v4-flash">⚡ deepseek-v4-flash (深度心智思考)</option>
            <option value="gpt-5.6-sol">🧠 gpt-5.6-sol (OpenAI 架构旗舰)</option>
            <option value="claude-opus-4-8">👑 claude-opus-4-8 (Claude 顶级推理)</option>
            <option value="glm-5.3">🌐 glm-5.3 (多语言通用模型)</option>
          </select>
        </div>
      </div>

      <button
        @click="store.toggleDiffWorkspace"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.02] shadow-2xs transition-all cursor-pointer"
      >
        <span>{{ store.isDiffWorkspaceOpen ? '收起代码' : '展开代码' }}</span>
      </button>
    </header>

    <!-- 消息对话流 (动态 Pinia 消息列表) -->
    <div ref="messageListRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <template v-for="msg in store.messages" :key="msg.id">
        <!-- 用户提问气泡 -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div class="max-w-[80%] bg-[#F4EFEA] text-[#18181B] px-4 py-3 rounded-2xl rounded-tr-sm border border-black/[0.06] shadow-2xs text-xs leading-relaxed whitespace-pre-line">
            {{ msg.content }}
          </div>
        </div>

        <!-- Agent 回答主体 -->
        <div v-else class="flex flex-col items-start space-y-3.5 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
            <div class="w-4 h-4 rounded bg-[#D96B27] text-white flex items-center justify-center text-[9px] font-bold">T</div>
            <span>Tcode Agent</span>
            <span class="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">{{ selectedModel }} · 自主算子模式</span>
          </div>

          <!-- 深度思考抽屉 (真实大模型 reasoning_content 流式动态展开) -->
          <div v-if="msg.thinking" class="w-full rounded-xl border border-black/[0.08] bg-white/60 shadow-2xs overflow-hidden">
            <div @click="toggleThinking(msg.id)" class="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer">
              <div class="flex items-center gap-2">
                <span class="text-sm">🧠</span>
                <span class="text-xs font-semibold text-[#18181B]">深度心智思考 (Reasoning Process)</span>
                <span class="text-[10px] text-[#A1A1AA] bg-black/[0.04] px-1.5 py-0.2 rounded font-mono">实时推流</span>
              </div>
              <span class="text-xs text-[#71717A]">{{ expandedThinkingMap[msg.id] !== false ? '▲' : '▼' }}</span>
            </div>
            <div v-show="expandedThinkingMap[msg.id] !== false" class="px-3 pb-3 text-xs text-[#71717A] leading-relaxed italic border-t border-black/[0.04] bg-[#FAF8F5] pt-2 whitespace-pre-line">
              {{ msg.thinking }}
            </div>
          </div>

          <!-- Tool Call 算子与命令卡片 -->
          <div v-if="msg.tool" class="w-full space-y-2">
            <div class="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden">
              <div @click="isToolLogOpen = !isToolLogOpen" class="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-mono text-[10px] font-bold">$_</span>
                  <span class="text-xs font-mono font-bold text-[#18181B]">{{ msg.tool.name }}</span>
                  <span class="text-xs font-mono text-[#52525B] bg-[#FAF8F5] border border-black/[0.06] px-2 py-0.5 rounded truncate max-w-md">{{ typeof msg.tool.args === 'string' ? msg.tool.args : (msg.tool.args.command || JSON.stringify(msg.tool.args)) }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[10px] text-[#10A37F] font-mono font-bold">● 执行成功</span>
                  <span class="text-xs text-[#71717A]">{{ isToolLogOpen ? '▲' : '▼' }}</span>
                </div>
              </div>
              <div v-show="isToolLogOpen" class="border-t border-black/[0.06] bg-[#18181B] text-white p-3 font-code text-[11px] leading-relaxed space-y-1">
                <div class="text-white/40 pb-1 border-b border-white/[0.08]">STDOUT / STDERR · Exit Code: 0</div>
                <div class="text-emerald-400 whitespace-pre-wrap">{{ msg.tool.output || 'Command executed successfully.' }}</div>
              </div>
            </div>
          </div>

          <!-- 优雅 Markdown 回答正文 -->
          <div
            class="markdown-body text-xs text-[#27272A] leading-relaxed space-y-2 bg-white/50 p-3.5 rounded-xl border border-black/[0.04] w-full"
            v-html="renderMarkdown(msg.content)"
          ></div>

          <!-- 改动文件列表与即时 Diff 预览卡片 -->
          <div v-if="msg.id === 'msg_2' || dynamicallyModifiedFiles.length > 0" class="w-full rounded-2xl border border-black/[0.08] bg-white shadow-xs p-3 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                <span class="text-sm">📝</span>
                <span>检测到本轮涉及代码文件改动:</span>
              </div>
              <span class="text-[10px] text-[#71717A]">点击右侧即时在 Monaco 中审查 Diff</span>
            </div>

            <div class="space-y-2 pt-0.5">
              <div
                v-for="f in allModifiedFiles"
                :key="f.name"
                class="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] hover:border-[#D96B27] hover:bg-white shadow-2xs flex items-center justify-between transition-all"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span :class="f.iconColor" class="text-base">📄</span>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-bold text-[#18181B]">{{ f.name }}</span>
                      <span :class="f.badgeBg" class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">{{ f.type }}</span>
                    </div>
                    <div class="text-[11px] text-[#71717A] mt-0.5">{{ f.desc }}</div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-mono font-bold text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.5 rounded">{{ f.diff }}</span>
                  <button
                    @click="store.openDiff(f.short)"
                    class="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D96B27] bg-[#D96B27]/10 hover:bg-[#D96B27] hover:text-white transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>查看 Diff</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部输入胶囊舱 (Prompt Capsule) -->
    <div class="p-3 bg-[#FAF8F5] border-t border-black/[0.06] select-none relative">
      <!-- 真实全工程文件检索 @ 引用浮层菜单 -->
      <div v-if="showMentionMenu" class="absolute left-4 bottom-20 w-80 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/[0.1] p-2 space-y-1 z-50 text-xs">
        <div class="px-2 py-1 text-[10px] font-bold text-[#71717A] uppercase border-b border-black/[0.04] flex items-center justify-between">
          <span>引用工程代码上下文 (@)</span>
          <span class="text-[9px] font-mono text-[#D96B27]">{{ filteredProjectFiles.length }} 个文件</span>
        </div>
        <div
          v-for="item in filteredProjectFiles"
          :key="item.path"
          @click="insertMention(item.path)"
          class="px-2 py-1.5 rounded-lg hover:bg-[#D96B27]/10 hover:text-[#D96B27] cursor-pointer flex items-center justify-between transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span>📄</span>
            <span class="font-mono truncate">{{ item.path }}</span>
          </div>
          <span class="text-[10px] text-[#A1A1AA] font-mono shrink-0">{{ item.ext }}</span>
        </div>
      </div>

      <!-- / 快捷指令浮层菜单 -->
      <div v-if="showCommandMenu" class="absolute left-16 bottom-20 w-72 bg-white rounded-xl shadow-xl border border-black/[0.1] p-2 space-y-1 z-50 text-xs">
        <div class="px-2 py-1 text-[10px] font-bold text-[#71717A] uppercase border-b border-black/[0.04]">快捷算子指令 (/)</div>
        <div
          v-for="cmd in commandItems"
          :key="cmd.command"
          @click="insertCommand(cmd.command)"
          class="px-2 py-1.5 rounded-lg hover:bg-[#D96B27]/10 hover:text-[#D96B27] cursor-pointer flex items-center justify-between"
        >
          <span class="font-bold font-mono">{{ cmd.command }}</span>
          <span class="text-[10px] text-[#71717A]">{{ cmd.desc }}</span>
        </div>
      </div>

      <!-- 真实附件预览托盘 (含原生拖拽入库) -->
      <div v-if="attachedFiles.length" class="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
        <div
          v-for="(file, idx) in attachedFiles"
          :key="idx"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-mono shadow-2xs text-[#18181B]"
        >
          <span class="text-[#D96B27]">📎</span>
          <span class="truncate max-w-xs">{{ file }}</span>
          <button @click="attachedFiles.splice(idx, 1)" class="text-[#71717A] hover:text-red-500 cursor-pointer">✕</button>
        </div>
      </div>

      <!-- 核心输入卡片 -->
      <div class="rounded-2xl bg-white border border-black/[0.12] shadow-sm focus-within:border-[#D96B27] focus-within:ring-2 focus-within:ring-[#D96B27]/15 transition-all p-2.5 flex flex-col gap-2">
        <textarea
          ref="textareaRef"
          v-model="inputPrompt"
          rows="2"
          :placeholder="store.isFullAuto ? '给 Tcode Agent 发送指令 (⚡ 全自动免审核模式：Agent 自主闭环执行代码写入与终端命令)...' : '给 Tcode Agent 发送指令 (支持直接拖拽文件入内，输入 @ 检索工程，/ 调起算子)...'"
          class="w-full text-xs text-[#18181B] placeholder-[#A1A1AA] bg-transparent focus:outline-none resize-none leading-relaxed"
          @keydown="handleKeydown"
          @keydown.enter.prevent="handleSend"
        ></textarea>

        <!-- 工具栏 -->
        <div class="flex items-center justify-between border-t border-black/[0.04] pt-2 text-xs">
          <div class="flex items-center gap-1">
            <button
              @click="triggerUpload"
              class="px-2.5 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] flex items-center gap-1 cursor-pointer"
              title="调起系统文件选择框"
            >
              <span>📎</span><span>上传</span>
            </button>
            <button @click="toggleMention" class="px-2 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] cursor-pointer" title="引用工程文件">@</button>
            <button @click="toggleCommand" class="px-2 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] cursor-pointer" title="调起算子">/</button>
            <div class="h-3.5 w-px bg-black/[0.1] mx-1"></div>

            <!-- Act 双环模式标识 -->
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D96B27]/10 text-[#D96B27] text-xs font-semibold select-none">
              <span>⚡</span><span>Act 极速双环</span>
            </div>

            <!-- 自主执行与审核控制开关 -->
            <button
              @click="store.toggleApprovalMode"
              :class="[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-2xs',
                store.isFullAuto
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white text-[#52525B] border-black/[0.08] hover:border-black/[0.18]'
              ]"
            >
              <span :class="['w-2 h-2 rounded-full', store.isFullAuto ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500']"></span>
              <span>{{ store.isFullAuto ? '⚡ 全自动执行 (免审核)' : '需人工审核' }}</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-[#A1A1AA] font-mono">{{ store.isStreaming ? '正在流式推理...' : '就绪' }}</span>
            <button
              @click="handleSend"
              :disabled="store.isStreaming"
              :class="[
                'w-7 h-7 rounded-xl flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer',
                store.isStreaming ? 'bg-[#A1A1AA] text-white cursor-not-allowed' : 'bg-[#D96B27] hover:bg-[#B8551B] text-white'
              ]"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge, type FileNode } from '../core/wailsBridge'
import { renderMarkdown } from '../core/markdown'

const store = useChatStore()
const inputPrompt = ref('')
const selectedModel = ref('deepseek-v4-flash')
const messageListRef = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isToolLogOpen = ref(true)
const attachedFiles = ref<string[]>([])
const currentSessionTitle = ref('架构重构与执行流设计')
const dynamicallyModifiedFiles = ref<any[]>([])

const isDraggingOver = ref(false)
const showMentionMenu = ref(false)
const showCommandMenu = ref(false)
const allProjectFiles = ref<{ path: string; ext: string }[]>([])

const commandItems = [
  { command: '/test', desc: '运行项目全量单元测试并检查红绿灯' },
  { command: '/diff', desc: '查看当前工作区未暂存行级差异' },
  { command: '/ast', desc: '重新解析代码语义拓扑树' },
  { command: '/clean', desc: '清理工作区临时编译残留' }
]

const expandedThinkingMap = reactive<Record<string, boolean>>({})

function toggleThinking(id: string) {
  if (expandedThinkingMap[id] === undefined) {
    expandedThinkingMap[id] = false
  } else {
    expandedThinkingMap[id] = !expandedThinkingMap[id]
  }
}

const baseModifiedFiles = [
  { name: 'main.go', short: 'main.go', type: '~M (修改)', desc: '接入 Wails v2 原生启动绑定并清理遗留代理', diff: '+4 / -2 行', iconColor: 'text-[#D96B27]', badgeBg: 'bg-amber-100 text-amber-700' },
  { name: 'app.go', short: 'app.go', type: '+A (新增)', desc: '封装 Wails 原生事件桥接与操作系统级文件操作', diff: '+64 / -0 行', iconColor: 'text-[#10A37F]', badgeBg: 'bg-emerald-100 text-emerald-700' }
]

const allModifiedFiles = computed(() => {
  return [...baseModifiedFiles, ...dynamicallyModifiedFiles.value]
})

// 加载全工程文件供 @ 检索
onMounted(async () => {
  try {
    const tree = await wailsBridge.getFileTree()
    const flat: { path: string; ext: string }[] = []
    const traverse = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.is_dir && n.children) {
          traverse(n.children)
        } else if (!n.is_dir) {
          const parts = n.path.split('.')
          flat.push({
            path: n.path,
            ext: parts.length > 1 ? '.' + parts.pop() : ''
          })
        }
      }
    }
    traverse(tree)
    allProjectFiles.value = flat
  } catch (err) {
    console.error('Failed to load project files for mention:', err)
  }
})

const filteredProjectFiles = computed(() => {
  return allProjectFiles.value.slice(0, 15)
})

// 原生拖拽上传处理
function handleDrop(e: DragEvent) {
  isDraggingOver.value = false
  if (!e.dataTransfer) return

  const files = e.dataTransfer.files
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!attachedFiles.value.includes(f.name)) {
        attachedFiles.value.push(f.name)
      }
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === '@') {
    showMentionMenu.value = true
    showCommandMenu.value = false
  } else if (e.key === '/') {
    showCommandMenu.value = true
    showMentionMenu.value = false
  } else if (e.key === 'Escape') {
    showMentionMenu.value = false
    showCommandMenu.value = false
  }
}

function toggleMention() {
  showMentionMenu.value = !showMentionMenu.value
  showCommandMenu.value = false
}

function toggleCommand() {
  showCommandMenu.value = !showCommandMenu.value
  showMentionMenu.value = false
}

function insertMention(path: string) {
  inputPrompt.value += `@${path} `
  showMentionMenu.value = false
}

function insertCommand(cmd: string) {
  inputPrompt.value = cmd + ' '
  showCommandMenu.value = false
}

async function triggerUpload() {
  try {
    const selected = await wailsBridge.openFileDialog()
    if (selected && selected.length > 0) {
      for (const item of selected) {
        if (!attachedFiles.value.includes(item)) {
          attachedFiles.value.push(item)
        }
      }
    }
  } catch (err) {
    console.error('File dialog error:', err)
  }
}

async function handleSend() {
  let prompt = inputPrompt.value.trim()
  if (!prompt || store.isStreaming) return

  // 若存在拖拽或上传的附件，附加至 Prompt
  if (attachedFiles.value.length > 0) {
    prompt += `\n[附件参考文件]: ${attachedFiles.value.join(', ')}`
  }

  inputPrompt.value = ''
  attachedFiles.value = []
  showMentionMenu.value = false
  showCommandMenu.value = false
  store.isStreaming = true

  const userMsgId = 'msg_' + Date.now()
  store.appendMessage({
    id: userMsgId,
    role: 'user',
    content: prompt,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  const assistantMsgId = 'asst_' + Date.now()
  store.appendMessage({
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    thinking: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }

  try {
    await wailsBridge.sendMessage(
      {
        session_id: store.currentSessionId,
        prompt: prompt,
        model: selectedModel.value,
        is_full_auto: store.isFullAuto
      },
      {
        onThinking(thinking) {
          const target = store.messages.find(m => m.id === assistantMsgId)
          if (target) {
            target.thinking = (target.thinking || '') + thinking
          }
          if (messageListRef.value) {
            messageListRef.value.scrollTop = messageListRef.value.scrollHeight
          }
        },
        onChunk(delta) {
          const target = store.messages.find(m => m.id === assistantMsgId)
          if (target) {
            target.content += delta
          }
          if (messageListRef.value) {
            messageListRef.value.scrollTop = messageListRef.value.scrollHeight
          }
        },
        onToolStart(tool, args) {
          const target = store.messages.find(m => m.id === assistantMsgId)
          if (target) {
            target.tool = { name: tool, args: typeof args === 'string' ? JSON.parse(args) : args }
          }
        },
        onToolEnd(tool, output) {
          const target = store.messages.find(m => m.id === assistantMsgId)
          if (target && target.tool) {
            target.tool.output = output
          }
        },
        onDone() {
          store.isStreaming = false
        }
      }
    )
  } catch (err) {
    console.error('Send error:', err)
    store.isStreaming = false
  }
}
</script>

<style>
.markdown-body pre {
  background-color: #18181B;
  color: #F4F4F5;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: 'Fira Code', monospace;
  margin: 0.5rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.markdown-body code {
  font-family: 'Fira Code', monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.markdown-body pre code {
  background-color: transparent;
  padding: 0;
}
.markdown-body p {
  margin-bottom: 0.5rem;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-body ul {
  list-style-type: disc;
}
.markdown-body ol {
  list-style-type: decimal;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  font-weight: 700;
  margin: 0.75rem 0 0.25rem 0;
  color: #18181B;
}
</style>
