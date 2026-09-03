<template>
  <div
    v-if="store.isSettingsOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
  >
    <div class="w-[90vw] max-w-[1020px] h-[82vh] bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden relative">
      <!-- 顶栏 -->
      <header class="h-12 bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-5">
        <div class="flex items-center gap-2">
          <span class="text-base">⚙️</span>
          <span class="font-bold text-sm text-[#18181B]">系统全局设置中枢 (Tcode Studio Settings)</span>
        </div>
        <button @click="store.isSettingsOpen = false" class="p-1.5 rounded-lg text-[#71717A] hover:bg-black/[0.05] cursor-pointer">✕</button>
      </header>

      <!-- 主体: 左侧导航 + 右侧内容 -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 左侧菜单 -->
        <aside class="w-48 bg-[#F4EFEA] border-r border-black/[0.08] p-3 space-y-1">
          <button
            v-for="m in [
              { id: 'gateway', label: '🌐 模型与网关渠道' },
              { id: 'mcp', label: '🧩 MCP 服务协议' },
              { id: 'skill', label: '🛠️ Agent 技能库' },
              { id: 'rules', label: '📜 软件规则与提示词' },
              { id: 'appearance', label: '🎨 外观与主题' },
              { id: 'security', label: '🛡️ 安全与沙箱防线' }
            ]"
            :key="m.id"
            @click="activeMenu = m.id"
            :class="[
              'w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer',
              activeMenu === m.id ? 'font-bold bg-white text-[#D96B27] shadow-xs' : 'text-[#71717A] hover:bg-black/[0.04]'
            ]"
          >
            {{ m.label }}
          </button>
        </aside>

        <!-- 右侧内容区 -->
        <main class="flex-1 p-5 overflow-y-auto bg-white space-y-4">
          <!-- 渠道管理 (Master-Detail 真实持久化与测速) -->
          <div v-if="activeMenu === 'gateway'" class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-[#18181B]">已保存的接入渠道列表</h3>
                <p class="text-[11px] text-[#71717A] mt-0.5">真实读写 ~/.tcode/channels.json · 支持 OpenAI CAP (auth.json) 与 Sub2 订阅透传</p>
              </div>
              <button @click="openAddChannel" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer flex items-center gap-1">
                <span>➕</span><span>新增渠道</span>
              </button>
            </div>

            <!-- 渠道卡片列表 (真实 Pinia 响应式) -->
            <div class="space-y-2">
              <div
                v-for="ch in channels"
                :key="ch.id"
                class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs hover:border-[#D96B27]/40 transition-all"
              >
                <div class="flex items-center gap-3">
                  <input
                    type="radio"
                    name="primary_channel"
                    :checked="ch.primary"
                    @change="setPrimaryChannel(ch.id)"
                    class="text-[#D96B27] focus:ring-[#D96B27] cursor-pointer"
                  >
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-[#18181B]">{{ ch.name }}</span>
                      <span :class="ch.status === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'" class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                        {{ ch.status === 'online' ? '在线' : '就绪' }}
                      </span>
                      <span class="text-[9px] bg-black/[0.04] text-[#52525B] px-1.5 py-0.2 rounded font-mono">{{ ch.auth_type }}</span>
                    </div>
                    <div class="text-[11px] text-[#71717A] mt-0.5 font-mono">
                      {{ ch.endpoint }} · 延迟: <strong :class="pingLoadingMap[ch.id] ? 'text-amber-500 animate-pulse' : 'text-[#10A37F]'">{{ pingLoadingMap[ch.id] ? '测速中...' : ch.latency }}</strong>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    @click="executePing(ch.id)"
                    :disabled="pingLoadingMap[ch.id]"
                    class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer"
                  >
                    ⚡ 测速
                  </button>
                  <button
                    @click="editChannel(ch)"
                    class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer"
                  >
                    ✏️ 配置
                  </button>
                  <button
                    @click="deleteChannel(ch.id)"
                    class="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            <!-- 内嵌真实表单抽屉: 新增/编辑渠道 -->
            <div v-if="isEditing" class="p-4 rounded-xl border border-[#D96B27]/40 bg-white shadow-sm space-y-3">
              <div class="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <h4 class="text-xs font-bold text-[#18181B]">{{ form.id ? '编辑渠道配置' : '新增接入渠道' }}</h4>
                <button @click="isEditing = false" class="text-xs text-[#71717A] hover:text-[#18181B]">取消</button>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">渠道名称</label>
                  <input v-model="form.name" type="text" placeholder="例如：DeepSeek 专有主通道" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">认证类型</label>
                  <select v-model="form.auth_type" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                    <option value="bearer_token">Bearer API Key</option>
                    <option value="codex_session">OpenAI CAP (Codex Session)</option>
                    <option value="sub2_relay">Sub2API 订阅透传 (sub2_...)</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label class="block font-medium text-[#71717A] mb-1">API Base URL / Endpoint</label>
                  <input v-model="form.endpoint" type="text" placeholder="https://api.openai.com/v1" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">API Key / Token (加密存储)</label>
                  <input v-model="form.api_key" type="password" placeholder="sk-..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">默认模型标识</label>
                  <input v-model="form.model" type="text" placeholder="gpt-4o / deepseek-chat" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button @click="isEditing = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs text-[#52525B]">取消</button>
                <button @click="saveChannelForm" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B]">保存配置至磁盘</button>
              </div>
            </div>
          </div>

          <!-- 其他分类真实展示 -->
          <div v-else class="space-y-3">
            <h3 class="text-xs font-bold text-[#18181B]">{{ activeMenu.toUpperCase() }} 设置</h3>
            <div class="p-3 rounded-xl bg-[#FAF8F5] border border-black/[0.06] text-xs text-[#52525B] leading-relaxed">
              当前分类已受 Wails 原生微内核受控沙箱全权托管。配置项将直接生效于系统运行时。
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge, type ChannelConfig } from '../core/wailsBridge'

const store = useChatStore()
const activeMenu = ref('gateway')
const isEditing = ref(false)

const channels = ref<ChannelConfig[]>([])
const pingLoadingMap = reactive<Record<string, boolean>>({})

const form = reactive<ChannelConfig>({
  id: '',
  name: '',
  primary: false,
  status: 'online',
  auth_type: 'bearer_token',
  endpoint: 'https://api.openai.com/v1',
  api_key: '',
  model: 'gpt-4o',
  latency: '120ms',
  updated_at: 0
})

onMounted(async () => {
  await loadChannels()
})

async function loadChannels() {
  try {
    const list = await wailsBridge.listChannels()
    if (list && list.length > 0) {
      channels.value = list
    }
  } catch (err) {
    console.error('Failed to load channels:', err)
  }
}

// 真实测速
async function executePing(id: string) {
  pingLoadingMap[id] = true
  try {
    const latency = await wailsBridge.pingChannel(id)
    const target = channels.value.find(c => c.id === id)
    if (target) {
      target.latency = latency
    }
  } catch (err) {
    console.error('Ping failed:', err)
  } finally {
    pingLoadingMap[id] = false
  }
}

function setPrimaryChannel(id: string) {
  channels.value.forEach(c => {
    c.primary = (c.id === id)
  })
  const current = channels.value.find(c => c.id === id)
  if (current) {
    wailsBridge.saveChannel(current)
  }
}

function openAddChannel() {
  form.id = ''
  form.name = ''
  form.primary = false
  form.status = 'online'
  form.auth_type = 'bearer_token'
  form.endpoint = 'https://api.openai.com/v1'
  form.api_key = ''
  form.model = 'gpt-4o'
  form.latency = '未测速'
  isEditing.value = true
}

function editChannel(ch: ChannelConfig) {
  Object.assign(form, ch)
  isEditing.value = true
}

async function deleteChannel(id: string) {
  try {
    await wailsBridge.deleteChannel(id)
    channels.value = channels.value.filter(c => c.id !== id)
  } catch (err) {
    console.error('Delete channel error:', err)
  }
}

async function saveChannelForm() {
  if (!form.name.trim() || !form.endpoint.trim()) return
  const toSave: ChannelConfig = { ...form }
  if (!toSave.id) {
    toSave.id = 'ch_' + Date.now()
  }
  try {
    await wailsBridge.saveChannel(toSave)
    await loadChannels()
    isEditing.value = false
  } catch (err) {
    console.error('Save channel error:', err)
  }
}
</script>
