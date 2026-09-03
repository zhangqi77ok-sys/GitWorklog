<template>
  <main class="flex-1 bg-[#FAF8F5] flex flex-col justify-between overflow-hidden relative font-sans">
    <!-- 顶栏: 场景标签与收起代码按钮 -->
    <header class="h-9 min-h-[36px] bg-[#FAF8F5] border-b border-black/[0.08] px-3 flex items-center justify-between text-xs select-none z-10 shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-[#18181B]">{{ currentSessionTitle }}</span>
        <span class="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">DeepSeek-V4-Flash · Act 模式</span>
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
            <span class="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">DeepSeek-V4 · Act 模式</span>
          </div>

          <!-- 深度思考抽屉 (流式动态更新) -->
          <div v-if="msg.thinking" class="w-full rounded-xl border border-black/[0.08] bg-white/60 shadow-2xs overflow-hidden">
            <div @click="toggleThinking(msg.id)" class="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer">
              <div class="flex items-center gap-2">
                <span class="text-sm">🧠</span>
                <span class="text-xs font-semibold text-[#18181B]">深度心智思考</span>
                <span class="text-[10px] text-[#A1A1AA] bg-black/[0.04] px-1.5 py-0.2 rounded">原生 IPC 管道</span>
              </div>
              <span class="text-xs text-[#71717A]">{{ expandedThinkingMap[msg.id] !== false ? '▲' : '▼' }}</span>
            </div>
            <div v-show="expandedThinkingMap[msg.id] !== false" class="px-3 pb-3 text-xs text-[#71717A] leading-relaxed italic border-t border-black/[0.04] bg-[#FAF8F5] pt-2 whitespace-pre-line">
              {{ msg.thinking }}
            </div>
          </div>

          <!-- 需求澄清与参数选择卡片 (仅当第一条回答且尚未提交时展示) -->
          <div v-if="msg.id === 'msg_2' && !hasSubmittedChoice" class="w-full rounded-2xl border border-[#D96B27]/30 bg-gradient-to-b from-[#FAF8F5] to-white p-4 space-y-3 shadow-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-[#D96B27] text-white flex items-center justify-center text-xs font-bold shadow-xs">?</span>
                <div>
                  <h4 class="text-xs font-bold text-[#18181B]">需求澄清与参数多选 (请点击做出选择)</h4>
                  <p class="text-[11px] text-[#71717A]">在为本项目生成 Wails 窗口控制代码前，请确认桌面窗体形态与托盘行为：</p>
                </div>
              </div>
              <span class="text-[9px] text-[#D96B27] bg-[#D96B27]/10 px-2 py-0.5 rounded-full font-mono font-bold">等待您选择</span>
            </div>

            <div class="space-y-2 pt-1">
              <label
                v-for="opt in choiceOptions"
                :key="opt.id"
                @click="selectedChoice = opt.id"
                :class="[
                  'p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all',
                  selectedChoice === opt.id ? 'border-2 border-[#D96B27] bg-white shadow-2xs' : 'border border-black/[0.08] bg-white opacity-80'
                ]"
              >
                <div class="flex items-center gap-3">
                  <input type="radio" :checked="selectedChoice === opt.id" class="text-[#D96B27] focus:ring-[#D96B27]">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-[#18181B]">{{ opt.title }}</span>
                      <span class="text-[9px] bg-[#D96B27]/10 text-[#D96B27] px-1.5 py-0.2 rounded font-mono font-semibold">{{ opt.badge }}</span>
                    </div>
                    <div class="text-[11px] text-[#71717A] mt-0.5">{{ opt.desc }}</div>
                  </div>
                </div>
              </label>
            </div>

            <div class="pt-2 border-t border-black/[0.06] flex items-center justify-between gap-3">
              <input v-model="choiceCustomInput" type="text" placeholder="输入其他补充约束说明 (可选)..." class="flex-1 h-7 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs focus:outline-none focus:border-[#D96B27]">
              <button @click="submitChoiceAction" class="px-4 py-1 rounded-lg bg-[#D96B27] hover:bg-[#B8551B] text-white text-xs font-semibold shadow-xs cursor-pointer">确定提交选择</button>
            </div>
          </div>

          <!-- Tool Call 算子与命令卡片 -->
          <div v-if="msg.tool" class="w-full space-y-2">
            <div class="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden">
              <div @click="isToolLogOpen = !isToolLogOpen" class="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-mono text-[10px] font-bold">$_</span>
                  <span class="text-xs font-mono font-bold text-[#18181B]">{{ msg.tool.name }}</span>
                  <span class="text-xs font-mono text-[#52525B] bg-[#FAF8F5] border border-black/[0.06] px-2 py-0.5 rounded truncate max-w-md">{{ msg.tool.args.command || JSON.stringify(msg.tool.args) }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[10px] text-[#10A37F] font-mono font-bold">● 执行成功</span>
                  <span class="text-xs text-[#71717A]">{{ isToolLogOpen ? '▲' : '▼' }}</span>
                </div>
              </div>
              <div v-show="isToolLogOpen" class="border-t border-black/[0.06] bg-[#18181B] text-white p-3 font-code text-[11px] leading-relaxed space-y-1">
                <div class="text-white/40 pb-1 border-b border-white/[0.08]">STDOUT / STDERR · Exit Code: 0</div>
                <div class="text-emerald-400">{{ msg.tool.output || 'Command executed successfully.' }}</div>
              </div>
            </div>
          </div>

          <!-- 回答正文 -->
          <div class="text-xs text-[#27272A] leading-relaxed space-y-2 bg-white/40 p-3 rounded-xl border border-black/[0.04] w-full whitespace-pre-line">
            {{ msg.content }}
          </div>

          <!-- 改动文件列表与即时 Diff 预览卡片 -->
          <div v-if="msg.id === 'msg_2'" class="w-full rounded-2xl border border-black/[0.08] bg-white shadow-xs p-3 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                <span class="text-sm">📝</span>
                <span>检测到本轮回答涉及 2 个代码文件改动:</span>
              </div>
              <span class="text-[10px] text-[#71717A]">点击任意文件卡片右侧立即预览 Diff 差异</span>
            </div>

            <div class="space-y-2 pt-0.5">
              <div
                v-for="f in modifiedFiles"
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
    <div class="p-3 bg-[#FAF8F5] border-t border-black/[0.06] select-none">
      <!-- 真实附件预览托盘 -->
      <div v-if="attachedFiles.length" class="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
        <div
          v-for="(file, idx) in attachedFiles"
          :key="idx"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-mono shadow-2xs text-[#18181B]"
        >
          <span>📄</span>
          <span class="truncate max-w-xs">{{ file }}</span>
          <button @click="attachedFiles.splice(idx, 1)" class="text-[#71717A] hover:text-red-500 cursor-pointer">✕</button>
        </div>
      </div>

      <!-- 核心输入卡片 -->
      <div class="rounded-2xl bg-white border border-black/[0.12] shadow-sm focus-within:border-[#D96B27] focus-within:ring-2 focus-within:ring-[#D96B27]/15 transition-all p-2.5 flex flex-col gap-2">
        <textarea
          v-model="inputPrompt"
          rows="2"
          :placeholder="store.isFullAuto ? '给 Tcode Agent 发送指令 (⚡ 全自动模式：Agent 自主闭环执行所有命令与代码修改，无需逐项批准)...' : '给 Tcode Agent 发送指令 (点击 📎 选择本地文件，输入 @ 引用会话，Enter 发送)...'"
          class="w-full text-xs text-[#18181B] placeholder-[#A1A1AA] bg-transparent focus:outline-none resize-none leading-relaxed"
          @keydown.enter.prevent="handleSend"
        ></textarea>

        <!-- 工具栏 -->
        <div class="flex items-center justify-between border-t border-black/[0.04] pt-2 text-xs">
          <div class="flex items-center gap-1">
            <!-- 真实系统文件选择对话框 -->
            <button
              @click="triggerUpload"
              class="px-2.5 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] flex items-center gap-1 cursor-pointer"
              title="调起系统文件选择框"
            >
              <span>📎</span><span>上传</span>
            </button>
            <button @click="inputPrompt += '@'" class="px-2 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] cursor-pointer">@</button>
            <button @click="inputPrompt += '/'" class="px-2 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] cursor-pointer">/</button>
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
            <span class="text-[10px] text-[#A1A1AA] font-mono">{{ store.isStreaming ? '正在生成...' : '就绪' }}</span>
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
import { ref, reactive, nextTick } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge } from '../core/wailsBridge'

const store = useChatStore()
const inputPrompt = ref('')
const messageListRef = ref<HTMLDivElement | null>(null)
const isToolLogOpen = ref(true)
const selectedChoice = ref(1)
const choiceCustomInput = ref('')
const hasSubmittedChoice = ref(false)
const attachedFiles = ref<string[]>([])
const currentSessionTitle = ref('架构重构与执行流设计')

const expandedThinkingMap = reactive<Record<string, boolean>>({})

function toggleThinking(id: string) {
  if (expandedThinkingMap[id] === undefined) {
    expandedThinkingMap[id] = false
  } else {
    expandedThinkingMap[id] = !expandedThinkingMap[id]
  }
}

const choiceOptions = [
  { id: 1, title: '✨ (推荐) 无边框沉浸式 + 系统托盘常驻后台', badge: '推荐', desc: '点击右上角关闭时最小化至 Windows 系统托盘，保留 Agent 后台任务运行。' },
  { id: 2, title: '🪟 Windows 11 原生 Mica 材质 + 退出即销毁进程', badge: '原生', desc: '遵循标准系统窗口控制，点击关闭直接退出并清理全部进程。' },
  { id: 3, title: '🔌 纯后台 Headless 守护进程模式 (无图形窗体)', badge: '服务', desc: '仅作为本地后台轻量网关与算子宿主，供外部命令行调用。' }
]

const modifiedFiles = [
  { name: 'main.go', short: 'main.go', type: '~M (修改)', desc: '接入 Wails v2 原生启动绑定并清理遗留代理', diff: '+4 / -2 行', iconColor: 'text-[#D96B27]', badgeBg: 'bg-amber-100 text-amber-700' },
  { name: 'app.go', short: 'app.go', type: '+A (新增)', desc: '封装 Wails 原生事件桥接与操作系统级文件操作', diff: '+64 / -0 行', iconColor: 'text-[#10A37F]', badgeBg: 'bg-emerald-100 text-emerald-700' }
]

// 调起真实系统文件选择窗口
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

// 提交选择
function submitChoiceAction() {
  const chosen = choiceOptions.find(o => o.id === selectedChoice.value)
  let text = `我已选择【${chosen?.title}】`
  if (choiceCustomInput.value.trim()) {
    text += `，补充说明：${choiceCustomInput.value.trim()}`
  }
  hasSubmittedChoice.value = true
  inputPrompt.value = text
  handleSend()
}

// 真实发送消息并通过 Wails 管道流式推送
async function handleSend() {
  const prompt = inputPrompt.value.trim()
  if (!prompt || store.isStreaming) return

  inputPrompt.value = ''
  store.isStreaming = true

  // 1. 追加用户消息
  const userMsgId = 'msg_' + Date.now()
  store.appendMessage({
    id: userMsgId,
    role: 'user',
    content: prompt,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  // 2. 准备 Assistant 消息骨架
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

  // 3. 发起流式推理
  try {
    await wailsBridge.sendMessage(
      {
        session_id: store.currentSessionId,
        prompt: prompt,
        model: 'DeepSeek-V4',
        is_full_auto: store.isFullAuto
      },
      {
        onThinking(thinking) {
          const target = store.messages.find(m => m.id === assistantMsgId)
          if (target) {
            target.thinking = (target.thinking || '') + thinking
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
            target.tool = { name: tool, args: args }
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
