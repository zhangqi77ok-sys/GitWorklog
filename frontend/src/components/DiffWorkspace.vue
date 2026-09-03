<template>
  <aside
    v-show="store.isDiffWorkspaceOpen"
    class="w-96 bg-[#18181B] text-white border-l border-black/[0.12] flex flex-col justify-between select-none z-10 shrink-0 font-sans"
  >
    <!-- 顶栏: 审查中的文件与操作 -->
    <div class="h-9 min-h-[36px] bg-[#221F1D] border-b border-white/[0.08] px-3 flex items-center justify-between text-xs">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs">📄</span>
        <span class="font-mono font-medium truncate text-white/90">{{ activeDiff.name }}</span>
        <span class="text-[9px] text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">Diff 审查中</span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button @click="rejectDiff" class="px-2 py-0.5 rounded text-[10px] font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer">✕ 放弃</button>
        <button @click="acceptDiff" class="px-2.5 py-0.5 rounded text-[10px] font-bold text-white bg-[#10A37F] hover:bg-[#0E8A6C] shadow-xs transition-all cursor-pointer">✓ 采纳变更</button>
      </div>
    </div>

    <!-- 中间: 红绿行级对比视窗 -->
    <div class="flex-1 overflow-y-auto p-3 font-code text-xs space-y-1 bg-[#18181B]">
      <div class="text-[10px] text-white/40 pb-1 border-b border-white/[0.06] mb-2">{{ activeDiff.header }}</div>
      <template v-for="(line, idx) in activeDiff.lines" :key="idx">
        <div
          v-if="line.type === 'del'"
          class="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded flex items-center justify-between animate-in fade-in"
        >
          <span>{{ line.text }}</span>
          <span class="text-[10px] opacity-60">{{ line.label || '删除' }}</span>
        </div>
        <div
          v-else-if="line.type === 'add'"
          class="bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded flex items-center justify-between animate-in fade-in"
        >
          <span>{{ line.text }}</span>
          <span class="text-[10px] opacity-60">{{ line.label || '新增' }}</span>
        </div>
        <div v-else class="text-white/60">
          {{ line.text }}
        </div>
      </template>
    </div>

    <!-- 底栏: 统计指标与状态 -->
    <div class="h-6 bg-[#161412] border-t border-white/[0.06] px-3 flex items-center justify-between text-[10px] text-white/40 font-mono">
      <span>{{ activeDiff.lang }}</span>
      <span>{{ activeDiff.stats }}</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()

const FILE_DIFFS: Record<string, any> = {
  'main.go': {
    name: 'backend/main.go',
    lang: 'Go · UTF-8',
    stats: '2 行删除 · 4 行新增',
    header: '@@ -1,15 +1,22 @@ Wails 宿主原生窗口初始化',
    lines: [
      { type: 'ctx', text: '1   package main' },
      { type: 'ctx', text: '2   ' },
      { type: 'ctx', text: '3   import (' },
      { type: 'del', text: '- 4       "github.com/webview/webview_go"', label: '旧逻辑 (已废弃)' },
      { type: 'add', text: '+ 4       "github.com/wailsapp/wails/v2"', label: 'Wails 原生' },
      { type: 'add', text: '+ 5       "github.com/wailsapp/wails/v2/pkg/options"', label: '配置包' },
      { type: 'ctx', text: '6   )' },
      { type: 'ctx', text: '7   ' },
      { type: 'ctx', text: '8   func main() {' },
      { type: 'add', text: '+ 9       app := NewApp()' },
      { type: 'add', text: '+ 10      wails.Run(&options.App{ ... })' },
      { type: 'ctx', text: '11  }' }
    ]
  },
  'app.go': {
    name: 'backend/app.go',
    lang: 'Go · UTF-8',
    stats: '0 行删除 · 64 行新增 (全新创建)',
    header: '@@ -0,0 +1,64 @@ Wails 原生事件桥接与绑定定义',
    lines: [
      { type: 'add', text: '+ 1   package main' },
      { type: 'add', text: '+ 2   ' },
      { type: 'add', text: '+ 3   import (' },
      { type: 'add', text: '+ 4       "context"' },
      { type: 'add', text: '+ 5       "runtime"' },
      { type: 'add', text: '+ 6   )' },
      { type: 'add', text: '+ 7   ' },
      { type: 'add', text: '+ 8   type App struct {' },
      { type: 'add', text: '+ 9       ctx context.Context' },
      { type: 'add', text: '+ 10  }' },
      { type: 'add', text: '+ 11  ' },
      { type: 'add', text: '+ 12  func NewApp() *App {' },
      { type: 'add', text: '+ 13      return &App{}' },
      { type: 'add', text: '+ 14  }' }
    ]
  }
}

const activeDiff = computed(() => {
  return FILE_DIFFS[store.activeDiffFile] || FILE_DIFFS['main.go']
})

const isAccepted = ref(false)

function acceptDiff() {
  isAccepted.value = true
  store.appendMessage({
    id: 'msg_' + Date.now(),
    role: 'assistant',
    content: `✓ 已采纳【${activeDiff.value.name}】的行级代码变更，并已通过原子快照写入物理工作区。`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
}

function rejectDiff() {
  isAccepted.value = false
  store.isDiffWorkspaceOpen = false
  store.appendMessage({
    id: 'msg_' + Date.now(),
    role: 'assistant',
    content: `已撤销【${activeDiff.value.name}】的代码补丁修改，恢复至暂存区基准版本。`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
}
</script>
