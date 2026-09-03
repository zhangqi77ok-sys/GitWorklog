<template>
  <aside class="w-64 bg-[#FAF8F5] border-r border-black/[0.08] flex flex-col justify-between select-none z-20 shrink-0">
    <div class="flex flex-col h-full overflow-hidden">
      <!-- 抽屉顶栏: 仓库与分支 -->
      <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs">📦</span>
          <span class="font-bold text-xs text-[#18181B] truncate">agent-learning</span>
        </div>
        <span class="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono font-bold">5 个场景分支</span>
      </div>

      <!-- 标签过滤器 -->
      <div class="px-3 pt-2 pb-1 border-b border-black/[0.04]">
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
          <button
            v-for="tag in ['全部', '核心架构', '单测自愈', '网关调度', '安全防护']"
            :key="tag"
            @click="activeTag = tag"
            :class="[
              'px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer',
              activeTag === tag ? 'bg-[#D96B27] text-white' : 'bg-white text-[#71717A] hover:text-[#18181B] border border-black/[0.06]'
            ]"
          >
            {{ tag === '全部' ? '全部 (5)' : '#' + tag }}
          </button>
        </div>
      </div>

      <!-- 会话列表 -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div
          v-for="item in filteredSessions"
          :key="item.id"
          @click="store.currentSessionId = item.id"
          :class="[
            'p-2 rounded-lg border shadow-xs flex flex-col gap-1 cursor-pointer transition-all',
            store.currentSessionId === item.id
              ? 'bg-white border-[#D96B27]/40 ring-2 ring-[#D96B27]/10'
              : 'bg-white/60 hover:bg-white border-transparent hover:border-black/[0.06]'
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-xs">{{ item.icon }}</span>
              <span class="text-xs font-semibold text-[#18181B] truncate">{{ item.title }}</span>
            </div>
            <span class="text-[9px] text-[#A1A1AA] font-mono">{{ item.time }}</span>
          </div>
          <div class="flex items-center gap-1 text-[10px] text-[#71717A]">
            <span :class="item.tagClass" class="px-1 py-0.2 rounded font-medium">#{{ item.tag }}</span>
            <span>· {{ item.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
const activeTag = ref('全部')

const sessions = [
  { id: 'sess1', icon: '📌', title: '架构重构与执行流设计', time: '刚刚', tag: '核心架构', tagClass: 'bg-[#D96B27]/10 text-[#D96B27]', desc: '4 工具闭环' },
  { id: 'sess2', icon: '🧪', title: 'TDD测试自愈与并发防漏', time: '5分钟前', tag: '单测自愈', tagClass: 'bg-teal-50 text-teal-700', desc: '失败自动修复' },
  { id: 'sess3', icon: '🌐', title: 'Sub2API CAP与Sub2订阅', time: '15分钟前', tag: '网关调度', tagClass: 'bg-blue-50 text-blue-700', desc: '对齐sub2api' },
  { id: 'sess4', icon: '🛡️', title: '高危系统指令沙箱拦截', time: '1小时前', tag: '安全防护', tagClass: 'bg-amber-50 text-amber-700', desc: '危险命令阻断' },
  { id: 'sess5', icon: '🎨', title: 'Monaco行级Diff与暖色规范', time: '昨天', tag: '前端开发', tagClass: 'bg-purple-50 text-purple-700', desc: '60-30-10设计' }
]

const filteredSessions = computed(() => {
  if (activeTag.value === '全部') return sessions
  return sessions.filter(s => s.tag === activeTag.value)
})
</script>
