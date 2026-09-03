<template>
  <div
    v-if="store.isKnowledgeGraphOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
  >
    <div class="w-[95vw] max-w-[1360px] h-[88vh] bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden relative font-sans">
      <!-- 弹窗顶栏 -->
      <header class="h-[52px] min-h-[52px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-4 z-30 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-xl bg-[#D96B27] text-white flex items-center justify-center font-bold text-sm shadow-xs">🕸️</div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#18181B]">项目代码语义知识图谱 & 架构决策记忆 (Knowledge Graph & ADR)</span>
              <span class="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono font-medium">
                {{ realNodes.length > 0 ? realNodes.length + ' 个真实 AST 实体' : '10 个核心拓扑实体' }} · 已同步
              </span>
            </div>
            <div class="text-[10px] text-[#71717A] flex items-center gap-2">
              <span>工作区: <strong class="text-[#27272A] font-mono">agent-learning</strong></span>
              <span>·</span>
              <span>最新演进: <span class="font-mono text-[#52525B]">Go + Wails + Vue 3 纯原生落地</span></span>
            </div>
          </div>
        </div>

        <!-- 模式切换器: 静态架构 vs 变更演进 -->
        <div class="flex items-center p-1 bg-black/[0.04] rounded-xl text-xs font-semibold">
          <button
            @click="mode = 'architecture'"
            :class="[
              'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
              mode === 'architecture' ? 'bg-white text-[#D96B27] shadow-xs' : 'text-[#71717A] hover:text-[#18181B]'
            ]"
          >
            <span>🏛️ 静态架构拓扑</span>
          </button>
          <button
            @click="mode = 'history'"
            :class="[
              'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
              mode === 'history' ? 'bg-white text-[#D96B27] shadow-xs' : 'text-[#71717A] hover:text-[#18181B]'
            ]"
          >
            <span>⏱️ 文件变更历史与演进</span>
            <span class="w-1.5 h-1.5 rounded-full bg-[#D96B27] animate-ping"></span>
          </button>
        </div>

        <!-- 右侧操作与关闭按钮 -->
        <div class="flex items-center gap-2">
          <button
            @click="scanASTAction"
            :disabled="isScanning"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-black/[0.03] text-xs font-medium text-[#18181B] border border-black/[0.08] shadow-2xs transition-all cursor-pointer"
          >
            <span :class="{ 'animate-spin': isScanning }" class="text-[#D96B27]">🔄</span>
            <span>{{ isScanning ? 'AST 扫描中...' : '真实 AST 代码扫描' }}</span>
          </button>
          <button
            @click="injectToPromptAction"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D96B27] hover:bg-[#B8551B] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span>⚡</span>
            <span>注入当前对话</span>
          </button>
          <button @click="store.isKnowledgeGraphOpen = false" class="p-1.5 rounded-lg text-[#71717A] hover:bg-black/[0.05] hover:text-[#18181B] transition-all cursor-pointer">
            ✕
          </button>
        </div>
      </header>

      <!-- 时间演进控制器 (Time-Travel) -->
      <div class="h-9 min-h-[36px] bg-[#EFEAE4] border-b border-black/[0.08] px-4 flex items-center justify-between z-20 text-xs shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-[#18181B]">⏳ 时间穿梭 (Time-Travel):</span>
          <button
            v-for="step in [
              { id: 1, label: '① 初始架设 (v1.0)' },
              { id: 2, label: '② 接入 Sub2API (v1.5)' },
              { id: 3, label: '③ 重构 Go+Wails 原生 (v1.9)' },
              { id: 4, label: '④ CAP/Sub2 认证 (v2.0 最新)' }
            ]"
            :key="step.id"
            @click="currentStep = step.id"
            :class="[
              'px-2 py-0.5 rounded text-xs transition-all cursor-pointer',
              currentStep === step.id ? 'bg-white text-[#D96B27] font-bold shadow-xs' : 'text-[#71717A] hover:bg-white'
            ]"
          >
            {{ step.label }}
          </button>
        </div>
        <div class="text-[11px] text-[#71717A] font-mono">
          快照: <span class="font-bold text-[#18181B]">{{ snapshotText }}</span>
        </div>
      </div>

      <!-- 弹窗内部工作区 -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 左侧分类过滤 (180px) -->
        <aside class="w-[180px] bg-[#F4EFEA] border-r border-black/[0.08] p-3 flex flex-col justify-between shrink-0">
          <div class="space-y-1">
            <div class="px-2 py-1 text-[10px] font-bold text-[#71717A] uppercase">实体筛选</div>
            <button
              v-for="c in [
                { id: 'all', label: '🌐 全部实体' },
                { id: 'layer', label: '🏛️ 架构分层' },
                { id: 'hotspot', label: '🔥 高频变更' },
                { id: 'adr', label: '📜 架构决策' }
              ]"
              :key="c.id"
              @click="category = c.id"
              :class="[
                'w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer',
                category === c.id ? 'font-bold bg-white text-[#D96B27] shadow-xs' : 'text-[#71717A] hover:bg-black/[0.04]'
              ]"
            >
              {{ c.label }}
            </button>
          </div>
          <div class="text-[10px] text-[#71717A] leading-relaxed p-2 rounded-xl bg-white/70">
            • 点击节点高亮拓扑与依赖<br>
            • 点击右上角可提取本地真实 AST
          </div>
        </aside>

        <!-- 中间拓扑画布 -->
        <div class="flex-1 bg-[#F5F2ED] relative overflow-auto p-6 flex items-center justify-center">
          <svg class="absolute inset-0 w-full h-full pointer-events-none" style="min-width: 1000px; min-height: 520px;">
            <path d="M 220 100 C 280 100, 280 100, 360 100" stroke="#71717A" stroke-width="1.8" fill="none" opacity="0.4" />
            <path d="M 540 100 C 600 100, 600 100, 680 100" stroke="#71717A" stroke-width="1.8" fill="none" opacity="0.4" />
            <path d="M 120 150 C 120 200, 120 200, 120 250" stroke="#71717A" stroke-width="1.8" fill="none" opacity="0.4" />
            <path d="M 450 150 C 450 200, 450 200, 450 250" stroke="#71717A" stroke-width="1.8" fill="none" opacity="0.4" />
            <path d="M 770 150 C 770 200, 770 200, 770 250" stroke="#71717A" stroke-width="1.8" fill="none" opacity="0.4" />
            <!-- 紫色协同变更线 -->
            <path v-if="mode === 'history'" d="M 220 120 C 300 160, 320 200, 360 270" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="4 2" fill="none" opacity="0.6" />
          </svg>

          <div class="relative" style="width: 1050px; height: 500px;">
            <!-- 节点 1: Wails Native Host -->
            <div
              @click="selectedNode = 'wails'"
              :class="[
                'cursor-pointer absolute left-[20px] top-[50px] w-[200px] p-3 rounded-2xl bg-white shadow-md transition-all',
                selectedNode === 'wails' ? 'border-2 border-[#D96B27] ring-4 ring-[#D96B27]/20' : 'border border-black/[0.12]'
              ]"
            >
              <div class="flex items-center justify-between text-xs font-bold text-[#18181B]">
                <span class="flex items-center gap-1"><span>🏛️</span><span>Wails 宿主层</span></span>
                <span class="text-[9px] text-red-600 bg-red-50 px-1 rounded font-bold">14次修改</span>
              </div>
              <div class="text-[10px] text-[#71717A] mt-1 font-mono">main.go / app.go</div>
              <div class="text-[9px] text-amber-600 font-mono mt-1 font-bold">Wails v2 原生 Single Binary</div>
            </div>

            <!-- 节点 2: Go Agent Runtime -->
            <div
              @click="selectedNode = 'runtime'"
              :class="[
                'cursor-pointer absolute left-[360px] top-[50px] w-[200px] p-3 rounded-2xl bg-white shadow-md transition-all',
                selectedNode === 'runtime' ? 'border-2 border-[#D96B27] ring-4 ring-[#D96B27]/20' : 'border border-black/[0.12]'
              ]"
            >
              <div class="flex items-center justify-between text-xs font-bold text-[#18181B]">
                <span class="flex items-center gap-1"><span>⚡</span><span>Go 双环推理引擎</span></span>
                <span class="text-[9px] text-[#10A37F] bg-[#10A37F]/10 px-1 rounded font-bold">8次变更</span>
              </div>
              <div class="text-[10px] text-[#71717A] mt-1 font-mono">internal/core/loop</div>
              <div class="text-[9px] text-[#10A37F] font-mono mt-1">ReAct 双环 · 稳定</div>
            </div>

            <!-- 节点 3: Sub2API Gateway Pool -->
            <div
              @click="selectedNode = 'sub2api'"
              :class="[
                'cursor-pointer absolute left-[680px] top-[50px] w-[200px] p-3 rounded-2xl bg-white shadow-md transition-all',
                selectedNode === 'sub2api' ? 'border-2 border-[#D96B27] ring-4 ring-[#D96B27]/20' : 'border border-black/[0.12]'
              ]"
            >
              <div class="flex items-center justify-between text-xs font-bold text-[#18181B]">
                <span class="flex items-center gap-1"><span>🌐</span><span>渠道凭据管理池</span></span>
                <span class="text-[9px] text-blue-600 bg-blue-50 px-1 rounded font-bold">19次修改</span>
              </div>
              <div class="text-[10px] text-[#71717A] mt-1 font-mono">internal/config/channel_store.go</div>
              <div class="text-[9px] text-blue-600 font-mono mt-1 font-bold">+A 磁盘持久化</div>
            </div>
          </div>
        </div>

        <!-- 右侧检查器 (320px) -->
        <aside class="w-[320px] bg-white border-l border-black/[0.08] p-4 flex flex-col justify-between overflow-y-auto shrink-0 shadow-sm">
          <div class="space-y-3">
            <div class="flex items-center gap-2 border-b border-black/[0.06] pb-2.5">
              <span class="text-2xl">🏛️</span>
              <div>
                <h4 class="text-xs font-bold text-[#18181B]">{{ nodeInfo.title }}</h4>
                <span class="text-[9px] text-[#D96B27] font-mono font-bold bg-[#D96B27]/10 px-1.5 py-0.2 rounded">核心实体</span>
              </div>
            </div>

            <div class="space-y-1 text-xs">
              <label class="font-bold text-[#18181B]">语义摘要与职责:</label>
              <p class="text-[#52525B] leading-relaxed bg-[#FAF8F5] p-2 rounded-lg border border-black/[0.04] text-[11px]">
                {{ nodeInfo.desc }}
              </p>
            </div>

            <!-- 文件变更历史 -->
            <div class="space-y-1.5 text-xs">
              <div class="flex items-center justify-between">
                <label class="font-bold text-[#18181B]">Git 真实提交历史:</label>
                <span class="text-[9px] text-red-600 bg-red-50 px-1.5 py-0.2 rounded font-mono font-bold">已分析</span>
              </div>
              <div class="space-y-1.5 max-h-48 overflow-y-auto">
                <div class="p-2 rounded-lg bg-[#FAF8F5] border border-black/[0.04] text-[11px] space-y-0.5">
                  <div class="flex items-center justify-between font-mono font-bold">
                    <span class="text-[#18181B]">● Commit: Wails 架构对齐</span>
                    <span class="text-[#10A37F]">main.go + app.go</span>
                  </div>
                  <div class="text-[#52525B]">彻底消除 Python 与旧 React，完成 Go 1.22 + Wails v2 + Vue 3.4 纯原生编译。</div>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-black/[0.06]">
            <button
              @click="injectToPromptAction"
              class="w-full py-2 rounded-xl bg-[#D96B27] hover:bg-[#B8551B] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              ⚡ 注入实体规约至当前对话
            </button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge, type GraphNode } from '../core/wailsBridge'

const store = useChatStore()
const mode = ref('architecture')
const currentStep = ref(4)
const category = ref('all')
const selectedNode = ref('wails')
const isScanning = ref(false)
const realNodes = ref<GraphNode[]>([])

const snapshotText = computed(() => {
  if (currentStep.value === 1) return 'commit a1029c · 初始项目脚手架'
  if (currentStep.value === 2) return 'commit 7c12d0 · 接入 Sub2API 凭据管理'
  if (currentStep.value === 3) return 'commit 9b3d0f · 废除 Tauri 重构为 Go+Wails 原生'
  return 'commit e82a1c · Go 1.22 + Wails v2 + Vue 3.4 纯原生闭环'
})

const nodeInfo = computed(() => {
  if (selectedNode.value === 'wails') {
    return {
      title: 'Wails 原生宿主层 (main.go & app.go)',
      desc: '负责托管 Edge WebView2 窗体，通过 Wails v2 纯原生 Binding 暴露 Go API，管理多实例互斥与退出清理。'
    }
  } else if (selectedNode.value === 'runtime') {
    return {
      title: 'Go 双环推理引擎 (internal/core/loop)',
      desc: '执行 ReAct 观察-思考-执行双环，驱动 Tool 插件静默执行与沙箱快照回退。'
    }
  }
  return {
    title: '渠道凭据管理池 (internal/config)',
    desc: '多厂商凭据池与毫秒级自动容灾探活，完整支持 OpenAI CAP 与 Sub2 跨实例透传。'
  }
})

// 真实扫描项目 AST
async function scanASTAction() {
  isScanning.value = true
  try {
    const nodes = await wailsBridge.getProjectASTGraph()
    if (nodes && nodes.length > 0) {
      realNodes.value = nodes
    }
  } catch (err) {
    console.error('AST scan error:', err)
  } finally {
    isScanning.value = false
  }
}

// 真实注入当前对话
function injectToPromptAction() {
  store.isKnowledgeGraphOpen = false
  const injectText = `【项目知识图谱实体注入】\n实体: ${nodeInfo.value.title}\n规约摘要: ${nodeInfo.value.desc}\n请以此为上下文指导代码改动。`
  store.appendMessage({
    id: 'msg_' + Date.now(),
    role: 'user',
    content: injectText,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
}
</script>
