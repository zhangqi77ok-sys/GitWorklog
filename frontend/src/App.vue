<template>
  <div class="h-screen w-screen flex flex-col bg-[#FAF8F5] text-[#18181B] overflow-hidden select-none">
    <!-- 极简标题栏 -->
    <header class="h-8 min-h-[32px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-3 text-xs select-none z-40">
      <div class="flex items-center gap-2">
        <span class="font-bold text-xs text-[#18181B]">Tcode Studio</span>
        <span class="text-[10px] text-[#D96B27] bg-[#D96B27]/10 px-1.5 py-0.2 rounded font-mono font-bold">Wails v2 + Vue 3.4 原生单二进制</span>
      </div>
      <div class="text-[11px] text-[#71717A] font-mono">
        工作区: <strong class="text-[#27272A]">E:\pro\agent-learning</strong> · Git: <strong class="text-[#10A37F]">main*</strong>
      </div>
    </header>

    <!-- 工作台三栏主体 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 1. 最左侧 48px Activity Bar -->
      <ActivityBar />

      <!-- 2. 会话抽屉 -->
      <LeftDrawer />

      <!-- 3. 中间对话工作舱 -->
      <ChatCockpit />

      <!-- 4. 右侧 Monaco Diff 审查工作区 -->
      <DiffWorkspace />
    </div>

    <!-- 全模态弹窗组 -->
    <KnowledgeGraphModal />
    <SettingsModal />
  </div>
</template>

<script setup lang="ts">
import ActivityBar from './components/ActivityBar.vue'
import LeftDrawer from './components/LeftDrawer.vue'
import ChatCockpit from './components/ChatCockpit.vue'
import DiffWorkspace from './components/DiffWorkspace.vue'
import KnowledgeGraphModal from './components/KnowledgeGraphModal.vue'
import SettingsModal from './components/SettingsModal.vue'
</script>
