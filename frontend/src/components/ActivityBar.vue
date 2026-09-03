<template>
  <aside class="w-12 bg-[#F4EFEA] border-r border-black/[0.08] flex flex-col justify-between items-center py-3 select-none z-30 shrink-0">
    <div class="flex flex-col items-center gap-4 w-full">
      <!-- 品牌 Logo 徽章 -->
      <div class="w-8 h-8 rounded-xl bg-[#D96B27] text-white flex items-center justify-center font-bold text-sm shadow-xs">
        T
      </div>

      <!-- 核心工作区图标 -->
      <div class="flex flex-col items-center gap-1.5 w-full">
        <!-- 对话工作台 -->
        <button
          @click="selectActivity('chat')"
          :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative',
            store.activeActivity === 'chat'
              ? 'bg-white text-[#D96B27] shadow-xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04]'
          ]"
          title="对话工作台 (Chat & Agent)"
        >
          <span class="text-base">💬</span>
          <span v-if="store.activeActivity === 'chat'" class="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-[#D96B27] rounded-r"></span>
        </button>

        <!-- 代码文件树 -->
        <button
          @click="selectActivity('files')"
          :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative',
            store.activeActivity === 'files'
              ? 'bg-white text-[#D96B27] shadow-xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04]'
          ]"
          title="工程文件树 (Explorer)"
        >
          <span class="text-base">📁</span>
        </button>

        <!-- Git 源码管理 -->
        <button
          @click="selectActivity('git')"
          :class="[
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative',
            store.activeActivity === 'git'
              ? 'bg-white text-[#D96B27] shadow-xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04]'
          ]"
          title="Git 源码管理 (Source Control)"
        >
          <span class="text-base">🌿</span>
          <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D96B27]"></span>
        </button>

        <!-- 项目知识图谱 (点击直接平滑弹出大模态工作舱) -->
        <button
          @click="openKGModal"
          class="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:text-[#D96B27] hover:bg-orange-50 transition-all cursor-pointer relative group"
          title="点击弹出项目知识图谱与架构决策 (ADR)"
        >
          <span class="text-base group-hover:scale-110 transition-transform">🕸️</span>
        </button>
      </div>
    </div>

    <!-- 底部辅助工具与设置 -->
    <div class="flex flex-col items-center gap-2 w-full">
      <button
        @click="openSettings"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04] transition-all cursor-pointer"
        title="系统全局设置 (Settings)"
      >
        <span class="text-base">⚙️</span>
      </button>
      <div class="w-2.5 h-2.5 rounded-full bg-[#10A37F]" title="Wails 原生宿主运行时正常"></div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()

function selectActivity(act: string) {
  store.activeActivity = act
}

function openKGModal() {
  store.isKnowledgeGraphOpen = true
}

function openSettings() {
  store.isSettingsOpen = true
}
</script>
