<template>
  <aside class="w-64 bg-[#FAF8F5] border-r border-black/[0.08] flex flex-col justify-between select-none z-20 shrink-0 font-sans">
    <!-- 1. 会话抽屉 (Chat Sessions) -->
    <div v-if="store.activeActivity === 'chat'" class="flex flex-col h-full overflow-hidden">
      <!-- 抽屉顶栏 -->
      <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs">📦</span>
          <span class="font-bold text-xs text-[#18181B] truncate">agent-learning</span>
        </div>
        <button
          @click="createNewSession"
          class="text-[10px] text-[#D96B27] bg-[#D96B27]/10 hover:bg-[#D96B27] hover:text-white px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-0.5"
        >
          <span>＋</span><span>新建对话</span>
        </button>
      </div>

      <!-- 标签筛选 -->
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
            {{ tag === '全部' ? '全部 (' + sessions.length + ')' : '#' + tag }}
          </button>
        </div>
      </div>

      <!-- 会话卡片列表 -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div
          v-for="item in filteredSessions"
          :key="item.id"
          @click="selectSession(item.id)"
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
            <span class="truncate">· {{ item.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 文件资源管理器抽屉 (File Explorer) -->
    <div v-else-if="store.activeActivity === 'files'" class="flex flex-col h-full overflow-hidden">
      <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
        <span class="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
          <span>📁</span><span>工程资源管理器</span>
        </span>
        <button @click="loadFileTree" class="text-xs text-[#71717A] hover:text-[#D96B27] cursor-pointer" title="刷新文件树">🔄</button>
      </div>

      <div class="flex-1 overflow-y-auto p-2 text-xs space-y-1 font-mono">
        <div v-for="node in fileTree" :key="node.path" class="space-y-0.5">
          <div
            @click="handleNodeClick(node)"
            class="px-2 py-1 rounded hover:bg-black/[0.04] cursor-pointer flex items-center justify-between transition-all"
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <span>{{ node.is_dir ? (expandedFolders[node.path] ? '📂' : '📁') : '📄' }}</span>
              <span class="truncate" :class="{ 'font-bold': node.is_dir }">{{ node.name }}</span>
            </div>
            <span v-if="node.is_dir" class="text-[10px] text-[#A1A1AA]">{{ expandedFolders[node.path] ? '▲' : '▼' }}</span>
          </div>

          <!-- 子文件展开 -->
          <div v-if="node.is_dir && expandedFolders[node.path] && node.children" class="pl-4 space-y-0.5 border-l border-black/[0.06] ml-2">
            <div
              v-for="sub in node.children"
              :key="sub.path"
              @click="store.openDiff(sub.name)"
              class="px-2 py-0.5 rounded hover:bg-black/[0.04] cursor-pointer flex items-center gap-1.5 text-[11px] text-[#52525B]"
            >
              <span>{{ sub.is_dir ? '📁' : '📄' }}</span>
              <span class="truncate">{{ sub.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Git 源码管理抽屉 (Source Control) -->
    <div v-else-if="store.activeActivity === 'git'" class="flex flex-col h-full overflow-hidden">
      <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
        <span class="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
          <span>🌿</span><span>源代码管理 (Git)</span>
        </span>
        <span class="text-[10px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-bold">
          {{ gitStatus.branch || 'main' }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div>
          <div class="text-[10px] font-bold text-[#71717A] uppercase mb-1">变更文件 (WORKING TREE)</div>
          <div v-if="workingFiles.length > 0" class="space-y-1">
            <div
              v-for="file in workingFiles"
              :key="file.path"
              @click="store.openDiff(file.path)"
              class="p-1.5 rounded hover:bg-black/[0.04] cursor-pointer flex items-center justify-between font-mono text-[11px]"
            >
              <span class="truncate">{{ file.path }}</span>
              <span :class="file.color" class="font-bold">{{ file.type }}</span>
            </div>
          </div>
          <div v-else class="py-6 text-center text-[#71717A] text-[11px]">
            <span class="block mb-1 text-sm">✨</span>
            <span>工作区干净，无未提交变更</span>
          </div>
        </div>

        <div class="pt-2 border-t border-black/[0.06] space-y-2">
          <input v-model="commitMessage" type="text" placeholder="提交信息 (Commit message)..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
          <button @click="handleGitCommit" :disabled="isCommitting || !commitMessage.trim()" class="w-full py-1.5 rounded-lg bg-[#D96B27] disabled:opacity-50 text-white text-xs font-semibold shadow-xs hover:bg-[#B8551B] cursor-pointer">
            {{ isCommitting ? '正在提交...' : '✓ 提交变更 (Commit & Push)' }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { wailsBridge, type FileNode } from '../core/wailsBridge'

const store = useChatStore()
const activeTag = ref('全部')
const fileTree = ref<FileNode[]>([])
const expandedFolders = reactive<Record<string, boolean>>({ 'frontend': true })
const gitStatus = ref<any>({ branch: 'main' })

const sessions = ref<any[]>([])

const workingFiles = computed(() => {
  const list: { path: string; type: string; color: string }[] = []
  if (gitStatus.value?.working) {
    for (const f of gitStatus.value.working) {
      list.push({
        path: f.path,
        type: f.work_code || 'M',
        color: f.work_code === 'D' ? 'text-red-500' : 'text-amber-600'
      })
    }
  }
  if (gitStatus.value?.untracked) {
    for (const p of gitStatus.value.untracked) {
      list.push({
        path: typeof p === 'string' ? p : (p as any).path,
        type: 'U',
        color: 'text-emerald-600'
      })
    }
  }
  return list
})

const filteredSessions = computed(() => {
  if (activeTag.value === '全部') return sessions.value
  return sessions.value.filter(s => s.tag === activeTag.value)
})

onMounted(async () => {
  try {
    sessions.value = await wailsBridge.listSessions() || []
  } catch {}
  loadFileTree()
  loadGitStatus()
})

watch(() => store.activeActivity, (act) => {
  if (act === 'files') loadFileTree()
  if (act === 'git') loadGitStatus()
})

async function loadFileTree() {
  try {
    const tree = await wailsBridge.getFileTree()
    if (tree && tree.length > 0) {
      fileTree.value = tree
    }
  } catch (err) {
    console.error('Failed to load file tree:', err)
  }
}

async function loadGitStatus() {
  try {
    const status = await wailsBridge.getGitStatus()
    if (status) {
      gitStatus.value = status
    }
  } catch (err) {
    console.error('Failed to load git status:', err)
  }
}

function handleNodeClick(node: FileNode) {
  if (node.is_dir) {
    expandedFolders[node.path] = !expandedFolders[node.path]
  } else {
    store.openDiff(node.name)
  }
}

async function createNewSession() {
  const newId = 'sess_' + Date.now()
  sessions.value.unshift({
    id: newId,
    icon: '💬',
    title: '新建工程探索会话',
    time: '刚刚',
    tag: '核心架构',
    tagClass: 'bg-[#D96B27]/10 text-[#D96B27]',
    desc: '已就绪'
  })
  await store.switchSession(newId)
}

const commitMessage = ref('')
const isCommitting = ref(false)

async function handleGitCommit() {
  if (!commitMessage.value.trim() || isCommitting.value) return
  isCommitting.value = true
  try {
    await wailsBridge.gitCommit(commitMessage.value.trim())
    commitMessage.value = ''
    await loadGitStatus()
  } catch (err) {
    console.error('Git commit error:', err)
  } finally {
    isCommitting.value = false
  }
}

async function selectSession(id: string) {
  await store.switchSession(id)
}
</script>
