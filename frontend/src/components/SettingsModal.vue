<template>
  <div
    v-if="store.isSettingsOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
  >
    <div class="w-[90vw] max-w-[1050px] h-[82vh] bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden relative">
      <!-- 顶栏 -->
      <header class="h-12 bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-5 select-none shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-base">⚙️</span>
          <span class="font-bold text-sm text-[#18181B]">系统全局设置中枢 (Tcode Studio Settings)</span>
        </div>
        <button @click="store.isSettingsOpen = false" class="p-1.5 rounded-lg text-[#71717A] hover:bg-black/[0.05] cursor-pointer">✕</button>
      </header>

      <!-- 主体: 左侧导航 + 右侧内容 -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 左侧菜单 -->
        <aside class="w-48 bg-[#F4EFEA] border-r border-black/[0.08] p-3 space-y-1 select-none shrink-0">
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
          <!-- 1. 渠道管理 (Master-Detail 真实持久化与测速) -->
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

            <!-- 渠道卡片列表 -->
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
                      {{ ch.endpoint }} · 模型: <strong class="text-[#18181B]">{{ ch.model }}</strong> · 延迟: <strong :class="pingLoadingMap[ch.id] ? 'text-amber-500 animate-pulse' : 'text-[#10A37F]'">{{ pingLoadingMap[ch.id] ? '测速中...' : ch.latency }}</strong>
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
                  <input v-model="form.name" type="text" placeholder="例如：AgentRouter 聚合中转站" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
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
                  <input v-model="form.endpoint" type="text" placeholder="https://agentrouter.org/v1" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">API Key / Token (加密存储)</label>
                  <input v-model="form.api_key" type="password" placeholder="sk-..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">默认模型标识</label>
                  <input v-model="form.model" type="text" placeholder="deepseek-chat / gpt-4o" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button @click="isEditing = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs text-[#52525B]">取消</button>
                <button @click="saveChannelForm" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B]">保存配置至磁盘</button>
              </div>
            </div>
          </div>

          <!-- 2. MCP 服务协议管理 (全量探活与工具探测面板) -->
          <div v-else-if="activeMenu === 'mcp'" class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-[#18181B]">Model Context Protocol (MCP) 服务治理看板</h3>
                <p class="text-[11px] text-[#71717A] mt-0.5">跨进程 Stdio 与 SSE 动态扩展 · 算子自动注入 ReAct 执行循环</p>
              </div>
              <button @click="openAddMCP" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer flex items-center gap-1">
                <span>➕</span><span>新增 MCP 服务</span>
              </button>
            </div>

            <!-- MCP 服务列表 -->
            <div class="space-y-2.5">
              <div
                v-for="mcp in mcps"
                :key="mcp.id"
                class="rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 shadow-2xs hover:border-[#D96B27]/40 transition-all space-y-2"
              >
                <!-- 卡片顶层元数据与操作 -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span :class="mcp.enabled ? 'bg-emerald-500' : 'bg-gray-300'" class="w-2.5 h-2.5 rounded-full inline-block shrink-0"></span>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#18181B]">{{ mcp.name }}</span>
                        <span class="text-[9px] bg-black/[0.05] text-[#52525B] px-1.5 py-0.2 rounded font-mono font-semibold">{{ mcp.type }}</span>
                        <span v-if="mcpTestResultMap[mcp.id]" :class="mcpTestResultMap[mcp.id].status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'" class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                          {{ mcpTestResultMap[mcp.id].status === 'ONLINE' ? '⚡ ' + mcpTestResultMap[mcp.id].latency : '❌ 连接失败' }}
                        </span>
                        <span v-if="mcpTestResultMap[mcp.id]?.tool_count" class="text-[9px] bg-orange-50 text-[#D96B27] px-1.5 py-0.2 rounded font-mono font-bold">
                          🛠️ {{ mcpTestResultMap[mcp.id].tool_count }} 算子
                        </span>
                      </div>
                      <div class="text-[11px] text-[#71717A] mt-0.5 font-mono">
                        {{ mcp.command }} {{ (mcp.args || []).join(' ') }}
                      </div>
                    </div>
                  </div>

                  <!-- 交互按钮组 -->
                  <div class="flex items-center gap-2">
                    <button
                      @click="executeTestMCP(mcp)"
                      :disabled="mcpTestLoadingMap[mcp.id]"
                      class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer flex items-center gap-1"
                    >
                      <span>{{ mcpTestLoadingMap[mcp.id] ? '⏳ 握手中...' : '⚡ 测速探活' }}</span>
                    </button>
                    <button
                      v-if="mcpTestResultMap[mcp.id]?.tools?.length"
                      @click="toggleToolsList(mcp.id)"
                      class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer"
                    >
                      {{ expandedToolsMap[mcp.id] ? '收起算子 ▲' : '查看算子 ▼' }}
                    </button>
                    <button
                      @click="editMCP(mcp)"
                      class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer"
                    >
                      ✏️ 配置
                    </button>
                    <button
                      @click="deleteMCP(mcp.id)"
                      class="px-2 py-1 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      🗑️
                    </button>
                    <label class="relative inline-flex items-center cursor-pointer ml-1">
                      <input type="checkbox" v-model="mcp.enabled" @change="toggleMCP(mcp)" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                    </label>
                  </div>
                </div>

                <!-- 探测到的工具清单抽屉 (可折叠) -->
                <div v-if="expandedToolsMap[mcp.id] && mcpTestResultMap[mcp.id]?.tools?.length" class="mt-2 pt-2 border-t border-black/[0.06] space-y-1.5 animate-in fade-in">
                  <div class="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">已挂载受控工具清单 (Tools Available):</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <div
                      v-for="tName in mcpTestResultMap[mcp.id].tools"
                      :key="tName"
                      class="px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.06] text-xs flex items-center gap-1.5 font-mono"
                    >
                      <span class="text-[#D96B27] font-bold">🔧</span>
                      <span class="text-[#18181B] font-semibold">{{ tName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 内嵌表单抽屉: 新增/编辑 MCP 服务 -->
            <div v-if="isEditingMCP" class="p-4 rounded-xl border border-[#D96B27]/40 bg-white shadow-sm space-y-3">
              <div class="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <h4 class="text-xs font-bold text-[#18181B]">{{ mcpForm.id ? '编辑 MCP 服务配置' : '新增 MCP 服务配置' }}</h4>
                <button @click="isEditingMCP = false" class="text-xs text-[#71717A] hover:text-[#18181B]">取消</button>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">服务名称</label>
                  <input v-model="mcpForm.name" type="text" placeholder="例如：Local Filesystem" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">协议传输类型</label>
                  <select v-model="mcpForm.type" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27] bg-white">
                    <option value="stdio">stdio (本地外部子进程管道)</option>
                    <option value="sse">sse (远程 HTTP SSE 端点)</option>
                  </select>
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">启动命令 (Command)</label>
                  <input v-model="mcpForm.command" type="text" placeholder="例如：npx / uvx / node" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
                <div>
                  <label class="block font-medium text-[#71717A] mb-1">启动参数 (以空格分隔)</label>
                  <input v-model="mcpArgsInput" type="text" placeholder="-y @modelcontextprotocol/server-filesystem ." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <button @click="isEditingMCP = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs text-[#52525B]">取消</button>
                <button @click="saveMCPForm" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B]">保存 MCP 服务</button>
              </div>
            </div>
          </div>

          <!-- 3. Skill 技能库管理 -->
          <div v-else-if="activeMenu === 'skill'" class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-[#18181B]">Agent 技能库 (Skills)</h3>
                <p class="text-[11px] text-[#71717A] mt-0.5">预制工程化能力模型 · 指导 Agent 在特定领域行为</p>
              </div>
            </div>

            <div class="space-y-2">
              <div
                v-for="skill in skills"
                :key="skill.id"
                class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-[#18181B]">{{ skill.name }}</span>
                  </div>
                  <div class="text-[11px] text-[#71717A] mt-0.5">{{ skill.description }}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="skill.enabled" @change="toggleSkill(skill)" class="sr-only peer">
                  <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- 4. Rules 规则管理 -->
          <div v-else-if="activeMenu === 'rules'" class="space-y-4">
            <div>
              <h3 class="text-xs font-bold text-[#18181B]">软件工程规则与提示词规约</h3>
              <p class="text-[11px] text-[#71717A] mt-0.5">所有指令将自动注入 Agent 每次对话的 System Prompt 中</p>
            </div>

            <div class="space-y-2">
              <div
                v-for="rule in rules"
                :key="rule.id"
                class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] space-y-1.5 shadow-2xs"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#18181B]">{{ rule.title }}</span>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="rule.enabled" @change="toggleRule(rule)" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                  </label>
                </div>
                <div class="text-[11px] text-[#52525B] font-mono bg-white p-2 rounded border border-black/[0.04]">{{ rule.content }}</div>
              </div>
            </div>
          </div>

          <!-- 5. 外观与安全 -->
          <div v-else class="space-y-3">
            <h3 class="text-xs font-bold text-[#18181B]">{{ activeMenu.toUpperCase() }} 配置</h3>
            <div class="p-3 rounded-xl bg-[#FAF8F5] border border-black/[0.06] text-xs text-[#52525B] leading-relaxed">
              当前配置由 Wails v2 原生微内核与本地磁盘持久化全权托管，所做修改即时生效。
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
import {
  wailsBridge,
  type ChannelConfig,
  type MCPServerConfig,
  type MCPTestResult,
  type SkillConfig,
  type RuleConfig
} from '../core/wailsBridge'

const store = useChatStore()
const activeMenu = ref('gateway')
const isEditing = ref(false)
const isEditingMCP = ref(false)

const channels = ref<ChannelConfig[]>([])
const mcps = ref<MCPServerConfig[]>([])
const skills = ref<SkillConfig[]>([])
const rules = ref<RuleConfig[]>([])

const pingLoadingMap = reactive<Record<string, boolean>>({})
const mcpTestLoadingMap = reactive<Record<string, boolean>>({})
const mcpTestResultMap = reactive<Record<string, MCPTestResult>>({})
const expandedToolsMap = reactive<Record<string, boolean>>({})

const mcpForm = reactive<MCPServerConfig>({
  id: '',
  name: '',
  type: 'stdio',
  command: 'npx',
  args: [],
  enabled: true,
  updated_at: 0
})
const mcpArgsInput = ref('')

const form = reactive<ChannelConfig>({
  id: '',
  name: '',
  primary: false,
  status: 'online',
  auth_type: 'bearer_token',
  endpoint: 'https://agentrouter.org/v1',
  api_key: '',
  model: 'deepseek-chat',
  latency: '未测速',
  updated_at: 0
})

onMounted(async () => {
  await Promise.all([loadChannels(), loadMCPs(), loadSkills(), loadRules()])
})

async function loadChannels() {
  try {
    const list = await wailsBridge.listChannels()
    if (list && list.length > 0) channels.value = list
  } catch (err) {
    console.error('Failed to load channels:', err)
  }
}

async function loadMCPs() {
  try {
    mcps.value = await wailsBridge.listMCPs()
  } catch (err) {
    console.error('Failed to load MCPs:', err)
  }
}

async function loadSkills() {
  try {
    skills.value = await wailsBridge.listSkills()
  } catch (err) {
    console.error('Failed to load Skills:', err)
  }
}

async function loadRules() {
  try {
    rules.value = await wailsBridge.listRules()
  } catch (err) {
    console.error('Failed to load Rules:', err)
  }
}

async function toggleMCP(mcp: MCPServerConfig) {
  await wailsBridge.saveMCP(mcp)
}

async function toggleSkill(skill: SkillConfig) {
  await wailsBridge.saveSkill(skill)
}

async function toggleRule(rule: RuleConfig) {
  await wailsBridge.saveRule(rule)
}

async function executePing(id: string) {
  pingLoadingMap[id] = true
  try {
    const latency = await wailsBridge.pingChannel(id)
    const target = channels.value.find(c => c.id === id)
    if (target) target.latency = latency
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
  if (current) wailsBridge.saveChannel(current)
}

function openAddChannel() {
  form.id = ''
  form.name = ''
  form.primary = false
  form.status = 'online'
  form.auth_type = 'bearer_token'
  form.endpoint = 'https://agentrouter.org/v1'
  form.api_key = ''
  form.model = 'deepseek-chat'
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
  if (!toSave.id) toSave.id = 'ch_' + Date.now()
  try {
    await wailsBridge.saveChannel(toSave)
    await loadChannels()
    isEditing.value = false
  } catch (err) {
    console.error('Save channel error:', err)
  }
}

function openAddMCP() {
  mcpForm.id = ''
  mcpForm.name = ''
  mcpForm.type = 'stdio'
  mcpForm.command = 'npx'
  mcpForm.args = []
  mcpForm.enabled = true
  mcpArgsInput.value = ''
  isEditingMCP.value = true
}

function editMCP(mcp: MCPServerConfig) {
  Object.assign(mcpForm, mcp)
  mcpArgsInput.value = (mcp.args || []).join(' ')
  isEditingMCP.value = true
}

async function deleteMCP(id: string) {
  try {
    await wailsBridge.deleteMCP(id)
    mcps.value = mcps.value.filter(m => m.id !== id)
    delete mcpTestResultMap[id]
    delete expandedToolsMap[id]
  } catch (err) {
    console.error('Delete MCP error:', err)
  }
}

async function saveMCPForm() {
  if (!mcpForm.name.trim() || !mcpForm.command.trim()) return
  const toSave: MCPServerConfig = {
    ...mcpForm,
    args: mcpArgsInput.value.trim() ? mcpArgsInput.value.trim().split(/\s+/) : []
  }
  if (!toSave.id) toSave.id = 'mcp_' + Date.now()
  try {
    await wailsBridge.saveMCP(toSave)
    await loadMCPs()
    isEditingMCP.value = false
  } catch (err) {
    console.error('Save MCP error:', err)
  }
}

async function executeTestMCP(mcp: MCPServerConfig) {
  mcpTestLoadingMap[mcp.id] = true
  try {
    const res = await wailsBridge.testMCPServer(mcp.id)
    mcpTestResultMap[mcp.id] = res
    if (res.tools && res.tools.length > 0) {
      expandedToolsMap[mcp.id] = true
    }
  } catch (err) {
    console.error('Test MCP error:', err)
  } finally {
    mcpTestLoadingMap[mcp.id] = false
  }
}

function toggleToolsList(id: string) {
  expandedToolsMap[id] = !expandedToolsMap[id]
}
</script>
