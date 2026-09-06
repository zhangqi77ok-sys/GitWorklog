<template>
  <section
    v-show="store.isDiffWorkspaceOpen"
    class="w-[45vw] min-w-[380px] max-w-[700px] border-l border-black/[0.08] bg-[#FAF8F5] flex flex-col justify-between select-none z-10 shrink-0 font-sans"
  >
    <!-- 顶栏: 文件标签与操作按钮 -->
    <header class="h-10 min-h-[40px] bg-[#FAF8F5] border-b border-black/[0.08] px-3 flex items-center justify-between text-xs shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-sm">📄</span>
        <span class="font-mono font-bold text-[#18181B] truncate">{{ diffReport?.file_path || store.activeDiffFile }}</span>
        <span class="text-[10px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-bold shrink-0">
          {{ diffReport?.stats || '实时 Diff' }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          @click="loadDiff"
          class="p-1 rounded-md text-[#71717A] hover:bg-black/[0.04] cursor-pointer"
          title="刷新代码差异"
        >
          🔄
        </button>
        <button
          @click="revertAction"
          class="flex items-center gap-1 px-2 py-0.8 rounded-md bg-white border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 shadow-2xs transition-all cursor-pointer"
          title="丢弃本次工作区物理修改 (Git Checkout)"
        >
          <span>✕</span><span>放弃</span>
        </button>
        <button
          @click="acceptAction"
          class="flex items-center gap-1 px-2.5 py-0.8 rounded-md bg-[#10A37F] hover:bg-[#0D8C6D] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          title="确认采纳文件修改"
        >
          <span>✓</span><span>采纳变更</span>
        </button>
        <button
          @click="store.toggleDiffWorkspace"
          class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-black/[0.05] cursor-pointer ml-1"
          title="收起右侧工作区"
        >
          ✕
        </button>
      </div>
    </header>

    <!-- 真实行级 Diff 编辑审查区 (Monaco Diff 仿真器) -->
    <div class="flex-1 overflow-y-auto bg-[#18181B] text-[#F4F4F5] font-mono text-[11px] p-2 space-y-0.5 select-text">
      <!-- 差异头说明 -->
      <div v-if="diffReport?.header" class="text-white/40 pb-1 mb-1 border-b border-white/[0.06] text-[10px]">
        {{ diffReport.header }}
      </div>

      <!-- 行级渲染 (Red / Green) -->
      <div
        v-for="(line, idx) in (diffReport?.lines || [])"
        :key="idx"
        :class="[
          'px-2 py-0.5 rounded leading-relaxed flex items-center gap-2 whitespace-pre-wrap font-mono transition-colors',
          line.type === 'add' ? 'bg-[#10A37F]/15 text-emerald-300 border-l-2 border-emerald-500' : '',
          line.type === 'del' ? 'bg-red-500/15 text-rose-300 border-l-2 border-rose-500' : '',
          line.type === 'ctx' ? 'text-zinc-400 hover:bg-white/[0.02]' : ''
        ]"
      >
        <span class="w-5 text-[10px] select-none opacity-40 font-mono text-right">{{ idx + 1 }}</span>
        <span class="flex-1">{{ line.text }}</span>
      </div>

      <div v-if="!diffReport || diffReport.lines.length === 0" class="text-zinc-500 text-center py-10">
        正在读取磁盘物理差异...
      </div>
    </div>

    <!-- 底部状态栏 -->
    <footer class="h-6 bg-[#FAF8F5] border-t border-black/[0.08] px-3 flex items-center justify-between text-[10px] text-[#71717A] font-mono select-none shrink-0">
      <div class="flex items-center gap-3">
        <span>{{ diffReport?.lang || 'Go · UTF-8' }}</span>
        <span>LF · 2 空格缩进</span>
      </div>
      <span class="text-emerald-700 font-bold">● Git 本地工作区同步就绪</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge, type DiffReport } from '../core/wailsBridge'

const store = useChatStore()
const diffReport = ref<DiffReport | null>(null)

onMounted(() => {
  loadDiff()
})

watch(() => store.activeDiffFile, () => {
  loadDiff()
})

async function loadDiff() {
  if (!store.activeDiffFile) return
  try {
    diffReport.value = await wailsBridge.getStructuredDiff(store.activeDiffFile)
  } catch (err) {
    console.error('Failed to compute diff:', err)
  }
}

async function revertAction() {
  if (!store.activeDiffFile) return
  try {
    await wailsBridge.revertFile(store.activeDiffFile)
    await loadDiff()
  } catch (err) {
    console.error('Revert error:', err)
  }
}

async function acceptAction() {
  if (store.activeDiffFile) {
    try {
      await wailsBridge.gitStage(store.activeDiffFile)
    } catch (err) {
      console.error('Git stage error:', err)
    }
  }
  store.toggleDiffWorkspace()
}
</script>
