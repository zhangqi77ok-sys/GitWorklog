<template>
  <div class="h-full w-full bg-[#FAF8F5] text-[#18181B] flex flex-col font-sans select-none overflow-hidden antialiased">
    <!-- ========================================================================= -->
    <!-- 1. 沉浸式无边框标题栏 (Titlebar) -->
    <!-- ========================================================================= -->
    <header style="--wails-draggable:drag" class="h-[38px] min-h-[38px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-3 z-30 select-none">
      <div style="--wails-draggable:no-drag" class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-bold text-xs shadow-xs">T</div>
        <span class="text-xs font-semibold tracking-tight text-[#18181B]">Tcode Studio</span>
        <span class="text-[#A1A1AA] text-xs">/</span>
        <button
          @click="chooseWorkspace"
          style="--wails-draggable:no-drag"
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-black/[0.05] transition-all cursor-pointer group text-xs font-medium text-[#27272A]"
          title="点击切换工作区文件夹 (系统原生文件夹对话框)"
        >
          <span class="text-[#D96B27]">📁</span>
          <span class="group-hover:text-[#D96B27] max-w-[160px] truncate">{{ workspaceName }}</span>
          <span class="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono">{{ gitStatus.branch || 'main' }}</span>
        </button>
        <div class="h-3 w-[1px] bg-black/[0.08] mx-1"></div>
        <div class="flex items-center gap-1.5 text-[11px] text-[#10A37F] font-medium bg-[#10A37F]/10 px-2 py-0.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-[#10A37F]" :class="{ 'animate-pulse': isStreaming }"></span>
          <span>{{ selectedModel }} · {{ isStreaming ? '推理中' : '就绪' }}</span>
        </div>
      </div>

      <div class="hidden md:flex items-center gap-2 text-[11px] text-[#A1A1AA]">
        <span>按 <kbd class="px-1.5 py-0.5 rounded bg-black/[0.04] border border-black/[0.08] font-mono text-[10px] text-[#52525B]">Ctrl+K</kbd> 快速检索分支、文件与算子</span>
      </div>

      <div style="--wails-draggable:no-drag" class="flex items-center gap-2">
        <button
          @click="openKnowledgeGraphModal"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <span class="text-[#D96B27]">🕸️</span><span>项目知识图谱</span>
        </button>
        <button
          @click="toggleTerminalDrawer()"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
          title="唤起/收起集成终端抽屉 (Ctrl+`)"
        >
          <span class="text-[#D96B27] font-mono font-bold">$_</span><span>终端</span>
        </button>
        <button
          @click="isSettingsOpen = true"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <span class="text-[#D96B27]">⚙️</span><span>设置</span>
        </button>
        <div class="flex items-center gap-1 border-l border-black/[0.08] pl-2">
          <button @click="wailsBridge.windowMinimise()" class="w-6 h-6 rounded flex items-center justify-center hover:bg-black/[0.05] text-[#71717A] cursor-pointer" title="最小化">-</button>
          <button @click="wailsBridge.windowToggleMaximise()" class="w-6 h-6 rounded flex items-center justify-center hover:bg-black/[0.05] text-[#71717A] cursor-pointer" title="最大化/还原">□</button>
          <button @click="wailsBridge.windowClose()" class="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500 hover:text-white text-[#71717A] cursor-pointer" title="关闭">✕</button>
        </div>
      </div>
    </header>

    <!-- ========================================================================= -->
    <!-- 2. 主体工作区容器 (48px 活动栏 + 抽屉 + 对话舱 + 代码工作区) -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- 48px 最左侧活动栏 (Activity Bar) -->
      <nav class="w-12 bg-[#FAF8F5] border-r border-black/[0.08] flex flex-col justify-between py-3 items-center z-20 shrink-0 select-none">
        <div class="flex flex-col gap-2 items-center w-full">
          <button
            @click="activeActivity = 'chat'"
            :class="['w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer', activeActivity === 'chat' ? 'bg-white shadow-2xs text-[#D96B27] border border-black/[0.06]' : 'text-[#71717A] hover:bg-black/[0.04]']"
            title="对话工作台"
          >
            <span class="text-base">💬</span>
          </button>
          <button
            @click="switchToFileActivity"
            :class="['w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer', activeActivity === 'files' ? 'bg-white shadow-2xs text-[#D96B27] border border-black/[0.06]' : 'text-[#71717A] hover:bg-black/[0.04]']"
            title="工程文件树"
          >
            <span class="text-base">📁</span>
          </button>
          <button
            @click="switchToGitActivity"
            :class="['w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer', activeActivity === 'git' ? 'bg-white shadow-2xs text-[#D96B27] border border-black/[0.06]' : 'text-[#71717A] hover:bg-black/[0.04]']"
            title="Git 版本控制"
          >
            <span class="text-base">🌿</span>
          </button>
          <button
            @click="openKnowledgeGraphModal"
            class="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:bg-black/[0.04] transition-all cursor-pointer"
            title="项目知识图谱与记忆"
          >
            <span class="text-base">🕸️</span>
          </button>
          <button
            @click="openSettingsTab('mcp')"
            class="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:bg-black/[0.04] transition-all cursor-pointer"
            title="MCP 与技能扩展"
          >
            <span class="text-base">🧩</span>
          </button>
          <button
            @click="toggleTerminalDrawer()"
            :class="['w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer font-mono font-bold text-xs', isTerminalOpen ? 'bg-white shadow-2xs text-[#D96B27] border border-black/[0.06]' : 'text-[#71717A] hover:bg-black/[0.04]']"
            title="唤起/收起集成终端抽屉 (Ctrl+`)"
          >
            <span>$_</span>
          </button>
        </div>

        <div class="flex flex-col gap-2 items-center w-full">
          <button
            @click="isSettingsOpen = true"
            class="w-9 h-9 rounded-xl flex items-center justify-center text-[#71717A] hover:bg-black/[0.04] transition-all cursor-pointer"
            title="设置"
          >
            <span class="text-base">⚙️</span>
          </button>
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D96B27] to-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
            ZQ
          </div>
        </div>
      </nav>

      <!-- 左侧抽屉 (Left Drawer) -->
      <aside class="w-64 bg-[#FAF8F5] border-r border-black/[0.08] flex flex-col justify-between select-none z-10 shrink-0 font-sans">
        <!-- 抽屉视图 1: 真实会话列表 (Chat Sessions) -->
        <div v-if="activeActivity === 'chat'" class="flex flex-col h-full overflow-hidden">
          <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs">📦</span>
              <span class="font-bold text-xs text-[#18181B] truncate">agent-learning</span>
            </div>
            <button
              @click="createNewSession"
              class="text-[10px] text-[#D96B27] bg-[#D96B27]/10 hover:bg-[#D96B27] hover:text-white px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-0.5"
            >
              <span>＋</span><span>新建会话</span>
            </button>
          </div>

          <!-- 场景标签筛选 -->
          <div class="px-3 pt-2 pb-1 border-b border-black/[0.04]">
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
              <button
                v-for="tag in availableTags"
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

          <!-- 真实会话卡片列表 (从 ~/.tcode/sessions/ 动态读取) -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div v-if="filteredSessions.length === 0" class="p-6 text-center text-[#A1A1AA] text-xs flex flex-col items-center justify-center gap-2 mt-8">
              <span class="text-2xl">📭</span>
              <span>暂无会话记录</span>
              <button @click="createNewSession" class="text-[11px] text-[#D96B27] font-semibold hover:underline cursor-pointer">＋ 新建会话</button>
            </div>

            <div
              v-for="sess in filteredSessions"
              :key="sess.id"
              @click="selectSession(sess.id)"
              :class="[
                'p-2.5 rounded-xl border shadow-xs flex flex-col gap-1 cursor-pointer transition-all',
                currentSessionId === sess.id
                  ? 'bg-white border-[#D96B27]/40 ring-2 ring-[#D96B27]/10'
                  : 'bg-white/60 hover:bg-white border-transparent hover:border-black/[0.06]'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-xs">💬</span>
                  <span class="text-xs font-semibold text-[#18181B] truncate">{{ sess.title }}</span>
                </div>
                <button @click.stop="deleteSession(sess.id)" class="text-[#A1A1AA] hover:text-red-500 text-[11px] p-0.5 cursor-pointer" title="删除会话">🗑️</button>
              </div>
              <div class="flex items-center justify-between text-[10px] text-[#71717A] mt-0.5">
                <span v-if="sess.tag" class="bg-[#D96B27]/10 text-[#D96B27] px-1.5 py-0.2 rounded font-medium">#{{ sess.tag }}</span>
                <span v-else class="text-[#A1A1AA]">未分类</span>
                <span class="font-mono text-[#A1A1AA]">{{ sess.time }}</span>
              </div>
              <div v-if="sess.desc" class="text-[11px] text-[#71717A] truncate mt-0.5">{{ sess.desc }}</div>
            </div>
          </div>
        </div>

        <!-- 抽屉视图 2: 真实工程文件树 (File Explorer) -->
        <div v-else-if="activeActivity === 'files'" class="flex flex-col h-full overflow-hidden">
          <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
            <span class="font-bold text-xs text-[#18181B] flex items-center gap-1.5 truncate mr-2" :title="workspacePath">
              <span>📁</span><span class="truncate">{{ workspaceName }}</span>
            </span>
            <div class="flex items-center gap-1.5 shrink-0">
              <button @click="chooseWorkspace" class="text-xs text-[#71717A] hover:text-[#D96B27] cursor-pointer" title="打开/切换工程文件夹 (原生对话框)">📂</button>
              <button @click="loadFileTree" class="text-xs text-[#71717A] hover:text-[#D96B27] cursor-pointer" title="刷新文件树">🔄</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-2 text-xs space-y-1 font-mono">
            <div v-if="isFileTreeLoading" class="p-6 text-center text-[#A1A1AA] text-xs flex flex-col items-center justify-center gap-2">
              <span class="animate-spin text-lg">⏳</span>
              <span>正在读取工程目录...</span>
            </div>
            <div v-else-if="fileTree.length === 0" class="p-6 text-center text-[#A1A1AA] text-xs">
              <span>工作区暂无文件</span>
            </div>
            <div v-for="node in fileTree" :key="node.path" class="space-y-0.5">
              <div
                @click="handleFileClick(node)"
                class="px-2 py-1 rounded hover:bg-black/[0.04] cursor-pointer flex items-center justify-between transition-all"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <span>{{ node.is_dir ? (expandedFolders[node.path] ? '📂' : '📁') : '📄' }}</span>
                  <span class="truncate" :class="{ 'font-bold': node.is_dir }">{{ node.name }}</span>
                </div>
                <span v-if="node.is_dir" class="text-[10px] text-[#A1A1AA]">{{ expandedFolders[node.path] ? '▲' : '▼' }}</span>
              </div>

              <div v-if="node.is_dir && expandedFolders[node.path] && node.children" class="pl-4 space-y-0.5 border-l border-black/[0.06] ml-2">
                <div
                  v-for="sub in node.children"
                  :key="sub.path"
                  @click="openFileDiff(sub.path)"
                  class="px-2 py-0.5 rounded hover:bg-black/[0.04] cursor-pointer flex items-center gap-1.5 text-[11px] text-[#52525B]"
                >
                  <span>{{ sub.is_dir ? '📁' : '📄' }}</span>
                  <span class="truncate">{{ sub.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 抽屉视图 3: 真实 Git 变更管理 (Source Control) -->
        <div v-else-if="activeActivity === 'git'" class="flex flex-col h-full overflow-hidden">
          <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
            <span class="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
              <span>🌿</span><span>源代码管理 (Git)</span>
            </span>
            <span class="text-[10px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-bold">
              {{ gitStatus.branch || 'main' }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            <div v-if="isGitLoading" class="p-6 text-center text-[#A1A1AA] text-xs flex flex-col items-center justify-center gap-2">
              <span class="animate-spin text-lg">⏳</span>
              <span>正在获取 Git 状态...</span>
            </div>
            <div v-else>
              <div class="text-[10px] font-bold text-[#71717A] uppercase mb-1">变更文件 (WORKING TREE)</div>
              <div v-if="!gitStatus.working || gitStatus.working.length === 0" class="p-3 text-center text-[#A1A1AA] text-xs bg-black/[0.02] rounded-lg">
                ✓ 工作区干净，无未暂存改动
              </div>
              <div v-else class="space-y-1">
                <div
                  v-for="file in gitStatus.working"
                  :key="file"
                  @click="openFileDiff(file)"
                  class="p-1.5 rounded hover:bg-black/[0.04] cursor-pointer flex items-center justify-between font-mono text-[11px]"
                >
                  <span class="truncate">{{ file }}</span>
                  <span class="text-amber-600 font-bold">~M</span>
                </div>
              </div>
            </div>

            <div class="pt-2 border-t border-black/[0.06] space-y-2">
              <input v-model="commitMessage" type="text" placeholder="提交信息 (Commit message)..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-xs focus:outline-none focus:border-[#D96B27]">
              <button @click="handleGitCommit" class="w-full py-1.5 rounded-lg bg-[#D96B27] text-white text-xs font-semibold shadow-xs hover:bg-[#B8551B] cursor-pointer">
                ✓ 提交变更 (Commit & Push)
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 中央工作区 + 底部终端抽屉容器 -->
      <div class="flex-1 flex flex-col overflow-hidden relative">
        <!-- 上方：对话主舱与 Monaco Diff 并列区 -->
        <div class="flex-1 flex overflow-hidden relative">
          <!-- 对话工作舱 (Chat Cockpit) -->
          <main class="flex-1 bg-[#FAF8F5] flex flex-col justify-between overflow-hidden relative font-sans">
        <!-- 顶栏: 场景标签、多模型切换器与收起代码按钮 -->
        <header class="h-10 min-h-[40px] bg-[#FAF8F5] border-b border-black/[0.08] px-3 flex items-center justify-between text-xs select-none z-10 shrink-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-[#18181B]">{{ currentSession.title }}</span>
            <span class="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded font-mono">AgentRouter</span>

            <select
              v-model="selectedModel"
              class="bg-white border border-black/[0.1] rounded-lg px-2 py-0.8 text-xs font-mono font-medium text-[#10A37F] focus:outline-none focus:border-[#D96B27] cursor-pointer shadow-2xs"
            >
              <option v-for="m in availableModels" :key="m" :value="m">⚡ {{ m }}</option>
            </select>
          </div>

          <button
            @click="isDiffOpen = !isDiffOpen"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.02] shadow-2xs transition-all cursor-pointer"
          >
            <span>{{ isDiffOpen ? '收起代码' : '展开代码' }}</span>
          </button>
        </header>

        <!-- 真实动态对话消息列表 (从当前 Session 动态读取与渲染) -->
        <div ref="messagesContainerRef" class="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
          <!-- 干净真实的空会话状态 -->
          <div v-if="!currentSession.messages || currentSession.messages.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-8 select-none my-auto">
            <div class="w-14 h-14 rounded-2xl bg-white border border-black/[0.08] shadow-xs flex items-center justify-center text-2xl mb-4">
              💬
            </div>
            <h3 class="text-sm font-bold text-[#18181B] mb-1.5">Tcode Agentic Studio</h3>
            <p class="text-xs text-[#71717A] max-w-sm mb-5 leading-relaxed">
              当前暂无活跃对话。请在下方输入框键入编程任务，或点击【＋新建会话】开始。
            </p>
            <div class="flex items-center gap-2">
              <button
                @click="createNewSession"
                class="px-3.5 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-semibold shadow-xs hover:bg-[#B8551B] transition-all cursor-pointer flex items-center gap-1"
              >
                <span>＋</span><span>新建会话</span>
              </button>
            </div>
          </div>

          <template v-for="msg in currentSession.messages" :key="msg.id">
            <!-- 用户提问气泡 -->
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] bg-[#F4EFEA] text-[#18181B] px-4 py-3 rounded-2xl rounded-tr-sm border border-black/[0.06] shadow-2xs text-xs leading-relaxed whitespace-pre-line">
                {{ msg.content }}
              </div>
            </div>

            <!-- Agent 回答卡片组 -->
            <div v-else class="flex flex-col items-start space-y-3.5 max-w-3xl w-full">
              <div class="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
                <div class="w-4 h-4 rounded bg-[#D96B27] text-white flex items-center justify-center text-[9px] font-bold">T</div>
                <span>Tcode Agent</span>
                <span class="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">{{ selectedModel }} · 自主算子模式</span>
              </div>

              <!-- 深度思考抽屉 (真实 reasoning_content) -->
              <div v-if="msg.thinking" class="w-full rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs overflow-hidden">
                <div class="p-2.5 flex items-center justify-between bg-black/[0.02] text-xs font-semibold text-[#18181B]">
                  <div class="flex items-center gap-2">
                    <span>🧠</span><span>深度心智思考 (Reasoning Process)</span>
                  </div>
                  <span class="text-[10px] text-[#10A37F] font-mono">Token 流</span>
                </div>
                <div class="px-3 pb-3 text-xs text-[#71717A] leading-relaxed italic border-t border-black/[0.04] pt-2 whitespace-pre-wrap font-mono">
                  {{ msg.thinking }}
                </div>
              </div>

              <!-- Tool Call 算子执行卡片列表 (多轮自主执行时序链路) -->
              <div v-if="(msg.tools && msg.tools.length > 0) || msg.tool" class="w-full space-y-2">
                <div
                  v-for="(tItem, tIdx) in (msg.tools && msg.tools.length > 0 ? msg.tools : [msg.tool!])"
                  :key="tItem.id || tIdx"
                  class="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden"
                >
                  <div class="p-2 flex items-center justify-between bg-black/[0.02] text-xs font-mono">
                    <span class="font-bold text-[#18181B]">$_ {{ tItem.name }} {{ typeof tItem.args === 'string' ? tItem.args : JSON.stringify(tItem.args) }}</span>
                    <span class="text-[10px] text-[#10A37F]">● 执行成功</span>
                  </div>
                  <div class="p-2.5 bg-[#18181B] text-emerald-400 font-mono text-[11px] whitespace-pre-wrap">
                    {{ tItem.output }}
                  </div>
                </div>
              </div>


              <!-- 优雅 Markdown 正文 -->
              <div
                class="markdown-body text-xs text-[#27272A] leading-relaxed space-y-2 bg-white/70 p-3.5 rounded-xl border border-black/[0.04] w-full"
                v-html="renderMarkdown(msg.content)"
              ></div>
            </div>
          </template>

          <div v-if="currentSession.messages.length === 0" class="h-64 flex flex-col items-center justify-center text-center text-xs text-[#71717A] space-y-2">
            <span class="text-3xl">💬</span>
            <div class="font-semibold text-sm text-[#18181B]">新会话已创建就绪</div>
            <div>请输入编程需求或直接拖拽文件，开始自主智能体编程之旅。</div>
          </div>
        </div>

        <!-- 底部输入胶囊舱 (Prompt Capsule) -->
        <div class="p-3 bg-[#FAF8F5] border-t border-black/[0.06] select-none relative">
          <!-- 真实附件预览托盘 -->
          <div v-if="attachedFiles.length" class="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
            <div
              v-for="(file, idx) in attachedFiles"
              :key="idx"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-mono shadow-2xs text-[#18181B]"
            >
              <span class="text-[#D96B27]">📎</span>
              <span class="truncate max-w-xs">{{ file }}</span>
              <button @click="attachedFiles.splice(idx, 1)" class="text-[#71717A] hover:text-red-500 cursor-pointer">✕</button>
            </div>
          </div>

          <!-- 输入卡片 -->
          <div class="rounded-2xl bg-white border border-black/[0.12] shadow-sm focus-within:border-[#D96B27] focus-within:ring-2 focus-within:ring-[#D96B27]/15 transition-all p-2.5 flex flex-col gap-2">
            <textarea
              v-model="inputPrompt"
              rows="2"
              placeholder="给 Tcode Agent 发送指令 (支持拖拽文件，输入 @ 引用工程，/ 调起算子)..."
              class="w-full text-xs text-[#18181B] placeholder-[#A1A1AA] bg-transparent focus:outline-none resize-none leading-relaxed"
              @keydown.enter.prevent="handleSend"
            ></textarea>

            <div class="flex items-center justify-between border-t border-black/[0.04] pt-2 text-xs">
              <div class="flex items-center gap-1">
                <button
                  @click="triggerUpload"
                  class="px-2.5 py-1 rounded-full text-xs text-[#52525B] hover:text-[#18181B] hover:bg-black/[0.04] flex items-center gap-1 cursor-pointer"
                  title="调起系统文件选择框"
                >
                  <span>📎</span><span>上传</span>
                </button>
                <div class="h-3.5 w-px bg-black/[0.1] mx-1"></div>

                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D96B27]/10 text-[#D96B27] text-xs font-semibold select-none">
                  <span>⚡</span><span>Act 极速双环</span>
                </div>

                <button
                  @click="isFullAuto = !isFullAuto"
                  :class="[
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-2xs',
                    isFullAuto
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                      : 'bg-white text-[#52525B] border-black/[0.08] hover:border-black/[0.18]'
                  ]"
                >
                  <span :class="['w-2 h-2 rounded-full', isFullAuto ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500']"></span>
                  <span>{{ isFullAuto ? '⚡ 全自动执行 (免审核)' : '需人工审核' }}</span>
                </button>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-[10px] text-[#A1A1AA] font-mono">{{ isStreaming ? '正在流式推理...' : '就绪' }}</span>
                <button
                  v-if="isStreaming"
                  @click="stopGenerationAction"
                  title="中断本次生成 (Esc)"
                  class="w-7 h-7 rounded-xl flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer bg-red-500 hover:bg-red-600 text-white animate-pulse"
                >
                  ■
                </button>
                <button
                  v-else
                  @click="handleSend"
                  title="发送消息 (Enter)"
                  class="w-7 h-7 rounded-xl flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer bg-[#D96B27] hover:bg-[#B8551B] text-white"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- 右侧 Monaco Diff 审查工作区 (Diff Workspace) -->
      <section
        v-show="isDiffOpen"
        class="w-[45vw] min-w-[380px] max-w-[700px] border-l border-black/[0.08] bg-[#FAF8F5] flex flex-col justify-between select-none z-10 shrink-0 font-sans"
      >
        <header class="h-10 min-h-[40px] bg-[#FAF8F5] border-b border-black/[0.08] px-3 flex items-center justify-between text-xs shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm">📄</span>
            <span class="font-mono font-bold text-[#18181B] truncate">{{ activeDiffFile }}</span>
            <span class="text-[10px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-bold shrink-0">
              {{ diffReport?.stats || '0 行修改' }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button @click="loadDiff" class="p-1 rounded-md text-[#71717A] hover:bg-black/[0.04] cursor-pointer" title="刷新代码差异">🔄</button>
            <button
              @click="revertFileAction"
              class="flex items-center gap-1 px-2 py-0.8 rounded-md bg-white border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 shadow-2xs transition-all cursor-pointer"
              title="丢弃本次物理改动 (Git Checkout)"
            >
              <span>✕</span><span>放弃</span>
            </button>
            <button
              @click="stageFileAction"
              class="flex items-center gap-1 px-2.5 py-0.8 rounded-md bg-[#10A37F] hover:bg-[#0D8C6D] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="确认采纳文件修改并提交暂存区 (Git Stage)"
            >
              <span>✓</span><span>采纳变更</span>
            </button>
            <button @click="isDiffOpen = false" class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-black/[0.05] cursor-pointer ml-1">✕</button>
          </div>
        </header>

        <!-- 真实物理行级 Diff (Red / Green) -->
        <div class="flex-1 overflow-y-auto bg-[#18181B] text-[#F4F4F5] font-mono text-[11px] p-2 space-y-2 select-text flex flex-col">
          <div v-if="!activeDiffFile || !diffReport?.lines || diffReport.lines.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#71717A] my-auto">
            <span class="text-3xl mb-3">📄</span>
            <p class="text-xs font-semibold text-[#A1A1AA]">暂无代码差异对比</p>
            <p class="text-[11px] text-[#71717A] mt-1.5 max-w-xs leading-relaxed">
              当前工作区干净，或尚未选定对比文件。可从左侧文件树或 Git 状态点击文件审查。
            </p>
          </div>

          <!-- 分块 Hunks 细粒度审查模式 -->
          <template v-if="diffReport?.hunks && diffReport.hunks.length > 0">
            <div
              v-for="(hunk, hIdx) in diffReport.hunks"
              :key="hIdx"
              class="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] select-none"
            >
              <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.06] text-[10px]">
                <div class="flex items-center gap-1.5 font-mono min-w-0">
                  <span class="text-[#D96B27] font-bold shrink-0">块 #{{ hIdx + 1 }}</span>
                  <span class="text-white/40 truncate">{{ hunk.header }}</span>
                  <span v-if="hunk.add_count > 0" class="text-emerald-400 font-bold shrink-0">+{{ hunk.add_count }}</span>
                  <span v-if="hunk.del_count > 0" class="text-rose-400 font-bold shrink-0">-{{ hunk.del_count }}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    @click="applyHunkAction(hunk.index, true)"
                    title="将此块代码改动暂存入 Git Index (git apply --cached)"
                    class="px-2 py-0.5 rounded bg-[#10A37F]/20 hover:bg-[#10A37F]/30 text-[#10A37F] font-bold text-[10px] cursor-pointer transition-all active:scale-95"
                  >
                    ✓ 采纳块
                  </button>
                  <button
                    @click="discardHunkAction(hunk.index)"
                    title="无损丢弃撤销此块代码改动 (git apply --reverse)"
                    class="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] cursor-pointer transition-all active:scale-95"
                  >
                    ✕ 丢弃块
                  </button>
                </div>
              </div>
              <div class="space-y-0.5 font-mono text-[11px] select-text">
                <div
                  v-for="(line, lIdx) in hunk.lines"
                  :key="lIdx"
                  :class="[
                    'px-2 py-0.5 rounded leading-relaxed flex items-center gap-2 whitespace-pre-wrap font-mono transition-colors',
                    line.type === 'add' ? 'bg-[#10A37F]/15 text-emerald-300 border-l-2 border-emerald-500' : '',
                    line.type === 'del' ? 'bg-red-500/15 text-rose-300 border-l-2 border-rose-500' : '',
                    line.type === 'ctx' ? 'text-zinc-400 hover:bg-white/[0.02]' : ''
                  ]"
                >
                  <span class="flex-1">{{ line.text }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- 备用平铺模式 (Clean 工作区或无 Hunk 分块) -->
          <template v-else>
            <div v-if="diffReport?.header" class="text-white/40 pb-1 mb-1 border-b border-white/[0.06] text-[10px]">
              {{ diffReport.header }}
            </div>
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
          </template>
        </div>

        <footer class="h-6 bg-[#FAF8F5] border-t border-black/[0.08] px-3 flex items-center justify-between text-[10px] text-[#71717A] font-mono select-none shrink-0">
          <span>{{ diffReport?.lang || 'Go · UTF-8' }}</span>
          <span class="text-emerald-700 font-bold">● Git 磁盘实时同步</span>
        </footer>
      </section>
        </div>

        <!-- 下方：集成式可折叠流式终端抽屉 (Terminal Drawer) -->
        <div
          v-show="isTerminalOpen"
          :style="{ height: isTerminalMaximized ? '60vh' : `${terminalHeight}px` }"
          class="min-h-[160px] max-h-[70vh] bg-[#161412] text-white flex flex-col border-t border-black/[0.3] shadow-2xl transition-all duration-150 z-30 shrink-0 select-none font-sans"
        >
          <!-- 终端控制顶栏 -->
          <div class="h-8 bg-[#1E1C1A] border-b border-white/[0.08] px-3 flex items-center justify-between select-none shrink-0">
            <div class="flex items-center gap-1.5 text-xs">
              <button
                @click="activeTerminalTab = 'shell'"
                :class="['px-2.5 py-1 rounded font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer', activeTerminalTab === 'shell' ? 'bg-[#2A2724] text-white' : 'text-white/60 hover:text-white']"
              >
                <span class="text-[#D96B27] font-bold">$_</span><span>终端控制台</span>
              </button>
              <button
                @click="activeTerminalTab = 'logs'"
                :class="['px-2.5 py-1 rounded font-mono flex items-center gap-1.5 transition-all cursor-pointer', activeTerminalTab === 'logs' ? 'bg-[#2A2724] text-white' : 'text-white/60 hover:text-white']"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-[#10A37F] animate-pulse"></span><span>Agent 执行链路</span>
              </button>
              <div v-if="isTerminalRunning" class="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-mono">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>进程执行中...</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 text-white/50 text-xs">
              <button
                v-if="isTerminalRunning"
                @click="cancelTerminalAction"
                title="终止正在执行的命令 (Ctrl+C)"
                class="px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[10px] font-mono font-bold cursor-pointer transition-all"
              >
                ■ 终止
              </button>
              <button
                @click="clearTerminalLogs"
                title="清空终端屏幕"
                class="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer text-xs"
              >
                🗑️
              </button>
              <button
                @click="isTerminalMaximized = !isTerminalMaximized"
                :title="isTerminalMaximized ? '还原终端高度' : '最大化终端'"
                class="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer text-xs font-mono"
              >
                {{ isTerminalMaximized ? '🗗' : '🗖' }}
              </button>
              <button
                @click="isTerminalOpen = false"
                title="收起终端抽屉 (Ctrl+`)"
                class="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- 终端内容区 -->
          <div class="flex-1 overflow-hidden relative font-mono text-xs select-text">
            <!-- 视图 1: Shell 实时交互控制台 -->
            <div
              v-show="activeTerminalTab === 'shell'"
              ref="terminalScrollRef"
              class="h-full flex flex-col p-3 overflow-y-auto space-y-1.5 bg-[#161412]"
            >
              <div class="text-white/40 mb-1 text-[11px]">
                Tcode Studio 受控静默终端 · 工作区: agent-learning [Windows 安全沙箱就绪]
              </div>
              
              <!-- 历史流式输出块 -->
              <div v-for="(log, idx) in terminalOutputs" :key="idx" class="space-y-0.5">
                <div v-if="log.type === 'cmd'" class="text-white/60 flex items-center gap-1.5 font-bold">
                  <span class="text-[#D96B27]">PS></span>
                  <span class="text-white">{{ log.text }}</span>
                </div>
                <div
                  v-else-if="log.type === 'output'"
                  class="whitespace-pre-wrap leading-relaxed text-zinc-300 pl-4 border-l-2 border-white/10"
                >{{ log.text }}</div>
                <div
                  v-else-if="log.type === 'exit'"
                  :class="['text-[10px] pl-4', log.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400']"
                >
                  ● 进程退出 · Exit Code: {{ log.exitCode }} (耗时 {{ log.durationMs }}ms)
                </div>
              </div>

              <!-- 正在运行时的流式增量输出缓冲 -->
              <div v-if="currentTerminalBuffer" class="whitespace-pre-wrap leading-relaxed text-zinc-300 pl-4 border-l-2 border-[#D96B27]">
                {{ currentTerminalBuffer }}
              </div>

              <!-- 命令行输入提示符 -->
              <div class="flex items-center gap-2 pt-2 border-t border-white/[0.06] mt-auto shrink-0">
                <span class="text-[#D96B27] font-bold font-mono select-none">PS></span>
                <input
                  v-model="terminalInputCmd"
                  @keydown.enter="submitTerminalCommand"
                  @keydown.up.prevent="navigateCommandHistory(-1)"
                  @keydown.down.prevent="navigateCommandHistory(1)"
                  :disabled="isTerminalRunning"
                  type="text"
                  placeholder="输入工作区命令回车执行 (如: go test ./..., git status, go build, clear)..."
                  class="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-white/20 disabled:opacity-50"
                />
              </div>
            </div>

            <!-- 视图 2: Agent 执行链路事件日志 -->
            <div
              v-show="activeTerminalTab === 'logs'"
              class="h-full p-3 overflow-y-auto space-y-1.5 select-text bg-[#12100E] font-mono text-[11px]"
            >
              <div class="text-white/40 pb-1 border-b border-white/[0.06]">--- Tcode Microkernel Live Event Trace (SSE Active) ---</div>
              <div v-for="(trace, tIdx) in agentTraceLogs" :key="tIdx" class="flex items-center gap-2">
                <span class="text-white/30">[{{ trace.time }}]</span>
                <span class="text-[#D96B27]">[{{ trace.phase }}]</span>
                <span class="text-zinc-300">{{ trace.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. 全局设置中枢模态窗 (Settings Modal - 7 Tabs + Sub-Modals) -->
    <!-- ========================================================================= -->
    <div
      v-if="isSettingsOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
    >
      <div class="w-[90vw] max-w-[1050px] h-[82vh] bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden relative">
        <header class="h-12 bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-5 select-none shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-base">⚙️</span>
            <span class="font-bold text-sm text-[#18181B]">系统设置中枢 (Settings Hub)</span>
          </div>
          <button @click="isSettingsOpen = false" class="p-1.5 rounded-lg text-[#71717A] hover:bg-black/[0.05] cursor-pointer">✕</button>
        </header>

        <div class="flex-1 flex overflow-hidden">
          <!-- 左侧菜单 -->
          <aside class="w-48 bg-[#F4EFEA] border-r border-black/[0.08] p-3 space-y-1 select-none shrink-0">
            <button
              v-for="m in [
                { id: 'models', label: '🌐 模型与网关渠道' },
                { id: 'mcp', label: '🧩 MCP 服务协议' },
                { id: 'skills', label: '🛠️ Agent 技能库' },
                { id: 'rules', label: '📜 软件规则与提示词' },
                { id: 'theme', label: '🎨 外观与工作区' },
                { id: 'sandbox', label: '🛡️ 安全沙箱与防线' },
                { id: 'about', label: 'ℹ️ 关于系统' }
              ]"
              :key="m.id"
              @click="activeSettingsTab = m.id"
              :class="[
                'w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer',
                activeSettingsTab === m.id ? 'font-bold bg-white text-[#D96B27] shadow-xs' : 'text-[#71717A] hover:bg-black/[0.04]'
              ]"
            >
              {{ m.label }}
            </button>
          </aside>

          <!-- 右侧选项卡主体 -->
          <main class="flex-1 p-5 overflow-y-auto bg-white space-y-4">
            <!-- 选项卡 1: 模型与网关 -->
            <div v-if="activeSettingsTab === 'models'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-[#18181B]">活跃网关与模型渠道</h3>
                  <p class="text-[11px] text-[#71717A]">已读写 ~/.tcode/channels.json · 支持实时在线探活测速</p>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="pingAllChannels" class="px-3 py-1.5 rounded-xl border border-black/[0.1] text-xs font-medium hover:bg-black/[0.02] cursor-pointer">
                    ⚡ 探测全部通道
                  </button>
                  <button @click="openAddChannelModal" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer">
                    ➕ 新增渠道
                  </button>
                </div>
              </div>

              <!-- 渠道卡片列表 -->
              <div class="space-y-2">
                <div v-if="channels.length === 0" class="p-8 text-center bg-[#FAF8F5] rounded-xl border border-black/[0.06] text-[#71717A] text-xs">
                  <span class="text-2xl block mb-2">🌐</span>
                  <span class="font-bold text-[#18181B] block mb-1">当前未配置任何模型渠道</span>
                  <p class="text-[11px] text-[#A1A1AA] mb-3">支持配置 AgentRouter、OpenAI、Claude、DeepSeek 等兼容端点</p>
                  <button @click="openAddChannelModal" class="px-3 py-1.5 rounded-lg bg-[#D96B27] text-white text-xs font-semibold shadow-xs hover:bg-[#B8551B] cursor-pointer">➕ 新增渠道</button>
                </div>
                <div
                  v-for="ch in channels"
                  :key="ch.id"
                  class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs"
                >
                  <div class="flex items-center gap-3">
                    <input type="radio" :checked="ch.primary" @change="setPrimaryChannel(ch.id)" class="text-[#D96B27] focus:ring-[#D96B27] cursor-pointer">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#18181B]">{{ ch.name }}</span>
                        <span class="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold">{{ ch.status }}</span>
                        <span class="text-[9px] bg-black/[0.04] text-[#52525B] px-1.5 py-0.2 rounded font-mono">{{ ch.auth_type }}</span>
                      </div>
                      <div class="text-[11px] text-[#71717A] mt-0.5 font-mono">
                        {{ ch.endpoint }} · 延迟: <strong :class="pingLoadingMap[ch.id] ? 'text-amber-500 animate-pulse' : 'text-[#10A37F]'">{{ pingLoadingMap[ch.id] ? '测速中...' : ch.latency }}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button @click="executePing(ch.id)" class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer">⚡ 测速</button>
                    <button @click="editChannel(ch)" class="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-xs font-medium hover:bg-black/[0.02] cursor-pointer">✏️ 配置</button>
                    <button @click="deleteChannel(ch.id)" class="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer">🗑️</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 选项卡 2: MCP 服务 -->
            <div v-else-if="activeSettingsTab === 'mcp'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-[#18181B]">Model Context Protocol (MCP) 本地服务</h3>
                  <p class="text-[11px] text-[#71717A]">已读写 ~/.tcode/mcp_servers.json</p>
                </div>
                <button @click="isMcpModalOpen = true" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer">
                  ➕ 导入 MCP 服务
                </button>
              </div>

              <div class="space-y-2">
                <div v-if="mcps.length === 0" class="p-8 text-center bg-[#FAF8F5] rounded-xl border border-black/[0.06] text-[#71717A] text-xs">
                  <span class="text-2xl block mb-2">🧩</span>
                  <span class="font-bold text-[#18181B] block mb-1">当前暂无挂载的 MCP 本地服务</span>
                  <p class="text-[11px] text-[#A1A1AA]">可导入并管理基于 Model Context Protocol 的工具算子服务</p>
                </div>
                <div v-for="mcp in mcps" :key="mcp.id" class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-[#18181B]">{{ mcp.name }}</span>
                      <span class="text-[9px] bg-black/[0.04] text-[#52525B] px-1.5 py-0.2 rounded font-mono">{{ mcp.type }}</span>
                    </div>
                    <div class="text-[11px] text-[#71717A] mt-0.5 font-mono">{{ mcp.command }} {{ (mcp.args || []).join(' ') }}</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="mcp.enabled" @change="toggleMcp(mcp)" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- 选项卡 3: Skill 技能库 -->
            <div v-else-if="activeSettingsTab === 'skills'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-[#18181B]">Agent 技能库 (Skills)</h3>
                  <p class="text-[11px] text-[#71717A]">已读写 ~/.tcode/skills.json</p>
                </div>
                <button @click="isSkillModalOpen = true" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer">
                  ➕ 创建新技能
                </button>
              </div>

              <div class="space-y-2">
                <div v-if="skills.length === 0" class="p-8 text-center bg-[#FAF8F5] rounded-xl border border-black/[0.06] text-[#71717A] text-xs">
                  <span class="text-2xl block mb-2">🛠️</span>
                  <span class="font-bold text-[#18181B] block mb-1">当前暂无自定义技能</span>
                  <p class="text-[11px] text-[#A1A1AA]">点击右上角可为智能体扩展专有技术栈提示词与工作流</p>
                </div>
                <div v-for="skill in skills" :key="skill.id" class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs">
                  <div>
                    <span class="text-xs font-bold text-[#18181B]">{{ skill.name }}</span>
                    <div class="text-[11px] text-[#71717A] mt-0.5">{{ skill.description }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" v-model="skill.enabled" @change="toggleSkill(skill)" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                    </label>
                    <button @click="deleteSkillAction(skill.id)" class="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer text-xs" title="删除技能">🗑️</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 选项卡 4: 软件规则 -->
            <div v-else-if="activeSettingsTab === 'rules'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-[#18181B]">软件工程规则与提示词规约</h3>
                  <p class="text-[11px] text-[#71717A]">已读写 ~/.tcode/rules.json · 自动注入大模型 System Prompt</p>
                </div>
                <button @click="isRuleModalOpen = true" class="px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer">
                  ➕ 添加规则
                </button>
              </div>

              <div class="space-y-2">
                <div v-if="rules.length === 0" class="p-8 text-center bg-[#FAF8F5] rounded-xl border border-black/[0.06] text-[#71717A] text-xs">
                  <span class="text-2xl block mb-2">📜</span>
                  <span class="font-bold text-[#18181B] block mb-1">当前暂无自定义工程规则</span>
                  <p class="text-[11px] text-[#A1A1AA]">点击右上角可配置规范守卫，自动在推理时注入智能体 System Prompt</p>
                </div>
                <div v-for="rule in rules" :key="rule.id" class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] space-y-1 shadow-2xs">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-[#18181B]">{{ rule.title }}</span>
                    <div class="flex items-center gap-2">
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="rule.enabled" @change="toggleRule(rule)" class="sr-only peer">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                      </label>
                      <button @click="deleteRuleAction(rule.id)" class="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer text-xs" title="删除规则">🗑️</button>
                    </div>
                  </div>
                  <div class="text-[11px] text-[#52525B] font-mono bg-white p-2 rounded border border-black/[0.04]">{{ rule.content }}</div>
                </div>
              </div>
            </div>

            <!-- 外观、安全、关于 -->
            <div v-else class="space-y-3">
              <h3 class="text-xs font-bold text-[#18181B]">{{ activeSettingsTab.toUpperCase() }} 配置</h3>
              <div class="p-3 rounded-xl bg-[#FAF8F5] border border-black/[0.06] text-xs text-[#52525B] leading-relaxed">
                当前系统全部由 Wails v2 原生微内核与本地磁盘全权托管，运行环境处于安全沙箱保护中。
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 4. 项目知识图谱模态窗 (Knowledge Graph Modal) -->
    <!-- ========================================================================= -->
    <div
      v-if="isKnowledgeGraphOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
    >
      <div class="w-[92vw] max-w-[1200px] h-[86vh] bg-white rounded-2xl shadow-2xl border border-black/[0.1] flex flex-col overflow-hidden relative">
        <header class="h-12 bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-5 select-none shrink-0">
          <div class="flex items-center gap-3">
            <span class="text-base">🕸️</span>
            <span class="font-bold text-sm text-[#18181B]">项目代码语义与拓扑知识图谱 (AST Topology Graph)</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="scanASTGraph"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer"
            >
              <span>🔄</span><span>代码扫描与图谱重建</span>
            </button>
            <button @click="isKnowledgeGraphOpen = false" class="p-1.5 rounded-lg text-[#71717A] hover:bg-black/[0.05] cursor-pointer">✕</button>
          </div>
        </header>

        <div class="flex-1 flex overflow-hidden">
          <!-- 拓扑节点列表 -->
          <div class="flex-1 p-5 overflow-y-auto bg-[#FAF8F5] space-y-3">
            <div v-if="isGraphLoading" class="p-12 text-center text-[#71717A] text-xs flex flex-col items-center justify-center gap-3 mt-12">
              <span class="animate-spin text-3xl">⏳</span>
              <span class="font-bold text-[#18181B] text-sm">正在深度解析工作区 Go AST 语法拓扑树...</span>
              <p class="text-[11px] text-[#A1A1AA]">提取代码包、结构体、接口与依赖实体，请稍候</p>
            </div>
            <div v-else-if="astNodes.length === 0" class="p-12 text-center text-[#71717A] text-xs flex flex-col items-center justify-center gap-2 mt-12">
              <span class="text-3xl">🕸️</span>
              <span class="font-bold text-[#18181B]">暂无代码拓扑节点</span>
              <p class="text-[11px] text-[#A1A1AA]">点击右上角【代码扫描与图谱重建】即可扫描当前工作区</p>
            </div>
            <div v-else>
              <div class="text-xs font-bold text-[#71717A] uppercase mb-2">已解析提取的代码拓扑实体 ({{ astNodes.length }} 个节点)</div>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="node in astNodes"
                  :key="node.id"
                  @click="selectedAstNode = node"
                  :class="[
                    'p-3.5 rounded-2xl border bg-white shadow-2xs flex items-center justify-between cursor-pointer transition-all',
                    selectedAstNode?.id === node.id ? 'border-2 border-[#D96B27] ring-2 ring-[#D96B27]/20' : 'border-black/[0.08] hover:border-[#D96B27]/40'
                  ]"
                >
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm">{{ node.type === 'package' ? '📦' : (node.type === 'struct' ? '🏛️' : '📄') }}</span>
                      <span class="text-xs font-bold text-[#18181B] font-mono">{{ node.name }}</span>
                      <span class="text-[9px] bg-[#D96B27]/10 text-[#D96B27] px-1.5 py-0.2 rounded font-mono font-bold">{{ node.type }}</span>
                    </div>
                    <div class="text-[11px] text-[#71717A] mt-1 font-mono">{{ node.file }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          <!-- 实体详情侧板 -->
          <aside class="w-80 border-l border-black/[0.08] bg-white p-5 flex flex-col justify-between overflow-y-auto">
            <div v-if="selectedAstNode" class="space-y-4 text-xs">
              <div class="flex items-center gap-2 pb-3 border-b border-black/[0.06]">
                <span class="text-xl">🏛️</span>
                <div>
                  <h4 class="font-bold text-sm text-[#18181B]">{{ selectedAstNode.name }}</h4>
                  <span class="text-[10px] text-[#D96B27] bg-[#D96B27]/10 px-1.5 py-0.2 rounded font-mono">{{ selectedAstNode.type }}</span>
                </div>
              </div>
              <div>
                <span class="font-bold text-[#71717A]">源文件位置</span>
                <p class="font-mono text-[11px] text-[#18181B] mt-1 bg-[#FAF8F5] p-2 rounded border border-black/[0.04]">{{ selectedAstNode.file }}</p>
              </div>
              <div>
                <span class="font-bold text-[#71717A]">拓扑摘要</span>
                <p class="text-[11px] text-[#52525B] leading-relaxed mt-1">{{ selectedAstNode.details }}</p>
              </div>
            </div>

            <button
              v-if="selectedAstNode"
              @click="injectNodeToPrompt"
              class="w-full py-2 rounded-xl bg-[#D96B27] text-white text-xs font-bold shadow-xs hover:bg-[#B8551B] cursor-pointer flex items-center justify-center gap-1.5 mt-4"
            >
              <span>📌</span><span>引用该节点架构约束至对话</span>
            </button>
          </aside>
        </div>
      </div>
    </div>

    <!-- 渠道编辑弹窗 -->
    <div
      v-if="isChannelModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs font-sans"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-5 space-y-4">
        <h4 class="text-sm font-bold text-[#18181B]">渠道配置管理</h4>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-medium text-[#71717A] mb-1">渠道名称</label>
            <input v-model="channelForm.name" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">API Base URL</label>
            <input v-model="channelForm.endpoint" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">API Key</label>
            <input v-model="channelForm.api_key" type="password" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <button @click="fetchModelsAction" class="w-full py-1.5 rounded-lg border border-[#D96B27] text-[#D96B27] text-xs font-bold hover:bg-[#D96B27]/10 cursor-pointer">
            🔄 真实自动获取上游模型 (/v1/models)
          </button>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
          <button @click="isChannelModalOpen = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs">取消</button>
          <button @click="saveChannelAction" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B]">保存至磁盘</button>
        </div>
      </div>
    </div>

    <!-- MCP 导入配置弹窗 -->
    <div
      v-if="isMcpModalOpen"
      @keydown.esc="isMcpModalOpen = false"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs font-sans"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-5 space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-black/[0.06]">
          <h4 class="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
            <span>🧩</span><span>导入 MCP 服务配置</span>
          </h4>
          <button @click="isMcpModalOpen = false" class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md cursor-pointer" title="关闭弹窗 (Esc)">✕</button>
        </div>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-medium text-[#71717A] mb-1">服务名称</label>
            <input v-model="mcpForm.name" placeholder="如 fetch-mcp 或 filesystem" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">通信类型</label>
            <select v-model="mcpForm.type" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
              <option value="stdio">stdio (标准子进程管道)</option>
              <option value="sse">sse (HTTP Server-Sent Events)</option>
            </select>
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">启动命令 (Command)</label>
            <input v-model="mcpForm.command" placeholder="如 npx 或 python" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">启动参数 (以空格隔开)</label>
            <input v-model="mcpArgsInput" placeholder="-y @modelcontextprotocol/server-filesystem D:/workspace" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
          <button @click="isMcpModalOpen = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs cursor-pointer">取消</button>
          <button @click="saveMcpAction" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B] cursor-pointer">保存 MCP 服务</button>
        </div>
      </div>
    </div>

    <!-- Skill 新增弹窗 -->
    <div
      v-if="isSkillModalOpen"
      @keydown.esc="isSkillModalOpen = false"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs font-sans"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-5 space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-black/[0.06]">
          <h4 class="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
            <span>🛠️</span><span>创建 Agent 技能 (Skill)</span>
          </h4>
          <button @click="isSkillModalOpen = false" class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md cursor-pointer" title="关闭弹窗 (Esc)">✕</button>
        </div>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-medium text-[#71717A] mb-1">技能名称</label>
            <input v-model="skillForm.name" placeholder="如 vue3-expert 或 rust-analyzer" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">描述与职责说明</label>
            <input v-model="skillForm.description" placeholder="专有技术栈模式、规约与实现导向" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">提示词与技能正文</label>
            <textarea v-model="skillForm.content" rows="4" placeholder="在此输入注入大模型系统指令的专业技能提示词..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27] resize-none"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
          <button @click="isSkillModalOpen = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs cursor-pointer">取消</button>
          <button @click="saveSkillAction" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B] cursor-pointer">保存技能</button>
        </div>
      </div>
    </div>

    <!-- Rule 新增弹窗 -->
    <div
      v-if="isRuleModalOpen"
      @keydown.esc="isRuleModalOpen = false"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs font-sans"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-5 space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-black/[0.06]">
          <h4 class="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
            <span>📜</span><span>添加工程规约与规则 (Rule)</span>
          </h4>
          <button @click="isRuleModalOpen = false" class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md cursor-pointer" title="关闭弹窗 (Esc)">✕</button>
        </div>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-medium text-[#71717A] mb-1">规则名称</label>
            <input v-model="ruleForm.name" placeholder="如 铁律 0.5 严禁假数据" type="text" class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27]">
          </div>
          <div>
            <label class="block font-medium text-[#71717A] mb-1">规则内容</label>
            <textarea v-model="ruleForm.content" rows="4" placeholder="在此输入强制约束与守卫提示词..." class="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.1] focus:outline-none focus:border-[#D96B27] resize-none"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
          <button @click="isRuleModalOpen = false" class="px-3 py-1 rounded-lg border border-black/[0.1] text-xs cursor-pointer">取消</button>
          <button @click="saveRuleAction" class="px-4 py-1 rounded-lg bg-[#D96B27] text-white text-xs font-semibold hover:bg-[#B8551B] cursor-pointer">保存规则</button>
        </div>
      </div>
    </div>

    <!-- 全局 Toast 提示 -->
    <div
      v-if="toastMessage"
      class="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-xl bg-[#18181B] text-white text-xs font-medium shadow-2xl flex items-center gap-2 border border-white/[0.1] animate-in slide-in-from-bottom-3 duration-200"
    >
      <span>{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  wailsBridge,
  type SessionMeta,
  type ChatSession,
  type FileNode,
  type DiffReport,
  type ChannelConfig,
  type MCPServerConfig,
  type SkillConfig,
  type RuleConfig,
  type GraphNode
} from './core/wailsBridge'
import { renderMarkdown } from './core/markdown'

// 1. 活动栏与工作区状态
const activeActivity = ref('chat')
const isDiffOpen = ref(false)
const activeDiffFile = ref('')
const isSettingsOpen = ref(false)
const isKnowledgeGraphOpen = ref(false)
const isChannelModalOpen = ref(false)
const isMcpModalOpen = ref(false)
const isSkillModalOpen = ref(false)
const isRuleModalOpen = ref(false)
const activeSettingsTab = ref('models')
const isFullAuto = ref(false)
const isStreaming = ref(false)

const isGraphLoading = ref(false)
const isFileTreeLoading = ref(false)
const isGitLoading = ref(false)

const toastMessage = ref('')
function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 2500)
}

// 2. 真实会话管理 (读写 ~/.tcode/sessions/)
const sessions = ref<SessionMeta[]>([])
const activeTag = ref('全部')
const currentSessionId = ref('')
const selectedModel = ref('deepseek-chat')

const currentSession = ref<ChatSession>({
  id: '',
  title: '新工程对话',
  model: 'deepseek-chat',
  tag: '',
  created_at: Date.now(),
  updated_at: Date.now(),
  messages: []
})

const availableTags = computed(() => {
  const set = new Set<string>()
  sessions.value.forEach(s => {
    if (s.tag && s.tag.trim()) set.add(s.tag.trim())
  })
  return ['全部', ...Array.from(set)]
})

const filteredSessions = computed(() => {
  if (activeTag.value === '全部') return sessions.value
  return sessions.value.filter(s => (s.tag || '') === activeTag.value)
})

const upstreamFetchedModels = ref<string[]>([])

const availableModels = computed(() => {
  const set = new Set<string>()
  upstreamFetchedModels.value.forEach(m => {
    if (m && m.trim()) set.add(m.trim())
  })
  channels.value.forEach(c => {
    if (c.model && c.model.trim()) set.add(c.model.trim())
  })
  if (set.size > 0) return Array.from(set)
  return ['deepseek-chat', 'deepseek-reasoner', 'gpt-4o', 'claude-3-7-sonnet']
})

async function loadSessionsList() {
  try {
    const list = await wailsBridge.listSessions()
    sessions.value = list || []
  } catch (err) {
    console.error('Failed to load sessions:', err)
    sessions.value = []
  }
}

async function selectSession(id: string) {
  currentSessionId.value = id
  try {
    const sess = await wailsBridge.getSession(id)
    if (sess) {
      currentSession.value = sess
      if (sess.model) selectedModel.value = sess.model
    }
    showToast(`✓ 已载入会话: ${currentSession.value.title}`)
  } catch (err) {
    console.error('Failed to load session:', err)
  }
}

async function createNewSession() {
  const newId = 'sess_' + Date.now()
  const newSess: ChatSession = {
    id: newId,
    title: '新工程对话',
    model: selectedModel.value || 'deepseek-chat',
    tag: '',
    created_at: Date.now(),
    updated_at: Date.now(),
    messages: []
  }
  await wailsBridge.saveSession(newSess)
  await loadSessionsList()
  await selectSession(newId)
  showToast('✓ 已新建会话并在 ~/.tcode/sessions/ 持久化')
}

async function deleteSession(id: string) {
  if (currentSessionId.value === id && isStreaming.value) {
    await stopGenerationAction()
  }
  await wailsBridge.deleteSession(id)
  await loadSessionsList()
  if (currentSessionId.value === id) {
    if (sessions.value.length > 0) {
      await selectSession(sessions.value[0].id)
    } else {
      currentSessionId.value = ''
      currentSession.value = {
        id: '',
        title: '新工程对话',
        model: selectedModel.value || 'deepseek-chat',
        tag: '',
        created_at: Date.now(),
        updated_at: Date.now(),
        messages: []
      }
    }
  }
  showToast('✓ 会话已从本地磁盘移除')
}

// 3. 真实工作区、文件树与 Git 状态
const workspacePath = ref('')
const workspaceName = computed(() => {
  if (!workspacePath.value) return 'Tcode Studio'
  const normalized = workspacePath.value.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || 'Workspace'
})

async function chooseWorkspace() {
  try {
    const selected = await wailsBridge.openDirectoryDialog()
    if (selected && selected !== workspacePath.value) {
      await wailsBridge.setWorkspace(selected)
      workspacePath.value = selected
      await Promise.all([
        loadFileTree(),
        loadGitStatus(),
        scanASTGraph()
      ])
      showToast(`✓ 已成功切换至工作区: ${workspaceName.value}`)
    }
  } catch (err: any) {
    showToast(`切换工作区失败: ${err}`)
  }
}

const fileTree = ref<FileNode[]>([])
const expandedFolders = reactive<Record<string, boolean>>({ 'frontend': true })
const gitStatus = ref<any>({ branch: 'main', working: [], staged: [] })
const commitMessage = ref('')

async function loadFileTree() {
  fileTree.value = await wailsBridge.getFileTree()
}

async function loadGitStatus() {
  gitStatus.value = await wailsBridge.getGitStatus()
}

function switchToFileActivity() {
  activeActivity.value = 'files'
  loadFileTree()
}

function switchToGitActivity() {
  activeActivity.value = 'git'
  loadGitStatus()
}

function handleFileClick(node: FileNode) {
  if (node.is_dir) {
    expandedFolders[node.path] = !expandedFolders[node.path]
  } else {
    openFileDiff(node.path)
  }
}

async function handleGitCommit() {
  if (!commitMessage.value.trim()) return
  try {
    await wailsBridge.gitCommit(commitMessage.value.trim())
    commitMessage.value = ''
    await loadGitStatus()
    showToast('✓ Git 变更已成功提交本地仓库！')
  } catch (err) {
    showToast('提交异常: ' + err)
  }
}

// 4. 真实物理代码 Diff
const diffReport = ref<DiffReport | null>(null)

async function openFileDiff(filePath: string) {
  activeDiffFile.value = filePath
  isDiffOpen.value = true
  await loadDiff()
}

async function loadDiff() {
  try {
    diffReport.value = await wailsBridge.getStructuredDiff(activeDiffFile.value)
  } catch (err) {
    console.error('Diff error:', err)
  }
}

async function revertFileAction() {
  try {
    await wailsBridge.revertFile(activeDiffFile.value)
    await loadDiff()
    await loadGitStatus()
    showToast(`✓ 已物理撤回 ${activeDiffFile.value} 磁盘改动 (Git Checkout)`)
  } catch (err) {
    showToast('撤回异常: ' + err)
  }
}

async function stageFileAction() {
  try {
    if (!activeDiffFile.value) return
    await wailsBridge.gitStage(activeDiffFile.value)
    showToast(`✓ 已成功采纳并暂存变更: ${activeDiffFile.value}`)
    await loadDiff()
    await loadGitStatus()
    isDiffOpen.value = false
  } catch (err) {
    showToast(`采纳文件变更异常: ${err}`)
  }
}

async function applyHunkAction(hunkIndex: number, stageOnly: boolean = true) {
  try {
    showToast(`⏳ 正在采纳 [${activeDiffFile.value}] 第 #${hunkIndex + 1} 个变更块...`)
    await wailsBridge.applyDiffHunk(activeDiffFile.value, hunkIndex, stageOnly)
    showToast(`✓ 已成功采纳该块变更 (git apply --cached)`)
    await loadDiff()
    await loadGitStatus()
  } catch (err) {
    showToast(`采纳变更块异常: ${err}`)
  }
}

async function discardHunkAction(hunkIndex: number) {
  try {
    showToast(`⏳ 正在丢弃 [${activeDiffFile.value}] 第 #${hunkIndex + 1} 个变更块...`)
    await wailsBridge.discardDiffHunk(activeDiffFile.value, hunkIndex)
    showToast(`✓ 已成功丢弃撤销该块变更 (git apply --reverse)`)
    await loadDiff()
    await loadGitStatus()
  } catch (err) {
    showToast(`丢弃变更块异常: ${err}`)
  }
}

// 5. 对话输入与流式大模型推理
const inputPrompt = ref('')
const attachedFiles = ref<string[]>([])
const messagesContainerRef = ref<HTMLDivElement | null>(null)

async function triggerUpload() {
  try {
    const selected = await wailsBridge.openFileDialog()
    if (selected && selected.length > 0) {
      for (const item of selected) {
        if (!attachedFiles.value.includes(item)) attachedFiles.value.push(item)
      }
    }
  } catch (err) {
    console.error('File dialog error:', err)
  }
}

async function handleSend() {
  const prompt = inputPrompt.value.trim()
  if (!prompt || isStreaming.value) return

  let fullPrompt = prompt
  if (attachedFiles.value.length > 0) {
    fullPrompt = `[附加关联文件]\n${attachedFiles.value.map(f => `- ${f}`).join('\n')}\n\n${prompt}`
    attachedFiles.value = []
  }

  // 保证会话 ID 绝对非空，避免向后端传入空 session_id 生成畸形文件
  if (!currentSessionId.value) {
    const newId = 'sess_' + Date.now()
    currentSessionId.value = newId
    currentSession.value.id = newId
    currentSession.value.title = prompt.slice(0, 15)
    await wailsBridge.saveSession(currentSession.value)
    await loadSessionsList()
  }

  inputPrompt.value = ''
  isStreaming.value = true

  const userMsgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  currentSession.value.messages.push({
    id: userMsgId,
    role: 'user',
    content: fullPrompt,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  const asstMsgId = 'asst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  currentSession.value.messages.push({
    id: asstMsgId,
    role: 'assistant',
    content: '',
    thinking: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  await nextTick()
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }

  try {
    await wailsBridge.sendMessage(
      {
        session_id: currentSessionId.value,
        prompt: fullPrompt,
        model: selectedModel.value,
        is_full_auto: isFullAuto.value
      },
      {
        onThinking(thinking) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          if (target) target.thinking = (target.thinking || '') + thinking
          if (messagesContainerRef.value) messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
        },
        onChunk(delta) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          if (target) target.content += delta
          if (messagesContainerRef.value) messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
        },
        onToolStart(tool, args, tcId) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          let parsedArgs = args
          if (typeof args === 'string') {
            try {
              parsedArgs = JSON.parse(args)
            } catch (_) {
              parsedArgs = args
            }
          }
          if (target) {
            const toolRecord = { id: tcId || 'tool_' + Date.now(), name: tool, args: parsedArgs, output: '正在执行...' }
            target.tool = toolRecord
            if (!target.tools) target.tools = []
            target.tools.push(toolRecord)
          }
        },
        onToolEnd(tool, output, tcId) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          if (target) {
            if (target.tool && target.tool.name === tool) {
              target.tool.output = output
            }
            if (target.tools && target.tools.length > 0) {
              const matched = tcId ? target.tools.find(t => t.id === tcId) : target.tools[target.tools.length - 1]
              if (matched) matched.output = output
            }
          }
        },
        onDone() {
          isStreaming.value = false
          wailsBridge.saveSession(currentSession.value)
          showToast('✓ 智能体推理与持久化完毕')
        }
      }
    )
  } catch (err) {
    isStreaming.value = false
    showToast('请求异常: ' + err)
  }
}

async function stopGenerationAction() {
  await wailsBridge.cancelAgentStream()
  isStreaming.value = false
  showToast('已中断本次推理')
}

// 6. 设置中枢 (渠道、MCP、Skill、Rule)
const channels = ref<ChannelConfig[]>([])
const mcps = ref<MCPServerConfig[]>([])
const skills = ref<SkillConfig[]>([])
const rules = ref<RuleConfig[]>([])
const pingLoadingMap = reactive<Record<string, boolean>>({})

const channelForm = reactive({
  name: '',
  endpoint: '',
  api_key: ''
})

async function loadSettingsData() {
  channels.value = await wailsBridge.listChannels()
  mcps.value = await wailsBridge.listMCPs()
  skills.value = await wailsBridge.listSkills()
  rules.value = await wailsBridge.listRules()

  const primary = channels.value.find(c => c.primary)
  if (primary && primary.model) {
    selectedModel.value = primary.model
  }
}

function openSettingsTab(tab: string) {
  activeSettingsTab.value = tab
  isSettingsOpen.value = true
}

async function executePing(id: string) {
  pingLoadingMap[id] = true
  try {
    const latency = await wailsBridge.pingChannel(id)
    const target = channels.value.find(c => c.id === id)
    if (target) target.latency = latency
    showToast(`✓ 渠道真实网络往返延迟: ${latency}`)
  } catch (err) {
    showToast('测速失败: ' + err)
  } finally {
    pingLoadingMap[id] = false
  }
}

async function pingAllChannels() {
  for (const ch of channels.value) {
    await executePing(ch.id)
  }
}

function setPrimaryChannel(id: string) {
  channels.value.forEach(c => c.primary = (c.id === id))
  const cur = channels.value.find(c => c.id === id)
  if (cur) wailsBridge.saveChannel(cur)
}

function openAddChannelModal() {
  channelForm.name = ''
  channelForm.endpoint = ''
  channelForm.api_key = ''
  isChannelModalOpen.value = true
}

function editChannel(ch: ChannelConfig) {
  channelForm.name = ch.name
  channelForm.endpoint = ch.endpoint
  channelForm.api_key = ch.api_key || ''
  isChannelModalOpen.value = true
}

async function deleteChannel(id: string) {
  await wailsBridge.deleteChannel(id)
  channels.value = channels.value.filter(c => c.id !== id)
  showToast('✓ 渠道已移除')
}

async function fetchModelsAction() {
  try {
    let ep = channelForm.endpoint.trim()
    if (ep && !ep.startsWith('http://') && !ep.startsWith('https://')) {
      ep = (ep.includes('localhost') || ep.includes('127.0.0.1')) ? 'http://' + ep : 'https://' + ep
      channelForm.endpoint = ep
    }
    const models = await wailsBridge.fetchUpstreamModels(channelForm.endpoint, channelForm.api_key)
    if (models && models.length > 0) {
      upstreamFetchedModels.value = models
      showToast(`✓ 成功从上游网关探测到 ${models.length} 个真实在线模型！`)
    } else {
      showToast('未探测到可用模型列表')
    }
  } catch (err) {
    showToast('拉取模型异常: ' + err)
  }
}

async function saveChannelAction() {
  await wailsBridge.saveChannel({
    id: 'ch_' + Date.now(),
    name: channelForm.name,
    primary: false,
    status: 'online',
    auth_type: 'bearer_token',
    endpoint: channelForm.endpoint,
    api_key: channelForm.api_key,
    model: selectedModel.value || 'deepseek-chat',
    latency: '未测速',
    updated_at: Date.now()
  })
  isChannelModalOpen.value = false
  await loadSettingsData()
  showToast('✓ 渠道配置已真实保存至 ~/.tcode/channels.json')
}

async function toggleMcp(mcp: MCPServerConfig) {
  await wailsBridge.saveMCP(mcp)
}

async function toggleSkill(skill: SkillConfig) {
  await wailsBridge.saveSkill(skill)
}

async function toggleRule(rule: RuleConfig) {
  await wailsBridge.saveRule(rule)
}

const mcpForm = reactive({
  name: '',
  type: 'stdio',
  command: '',
  args: [] as string[]
})
const mcpArgsInput = ref('')

const skillForm = reactive({
  name: '',
  description: '',
  content: ''
})

const ruleForm = reactive({
  name: '',
  content: ''
})

async function saveMcpAction() {
  if (!mcpForm.name.trim() || !mcpForm.command.trim()) {
    showToast('请完整填写 MCP 服务名称与启动命令')
    return
  }
  const args = mcpArgsInput.value.trim() ? mcpArgsInput.value.trim().split(/\s+/) : []
  await wailsBridge.saveMCP({
    id: 'mcp_' + Date.now(),
    name: mcpForm.name.trim(),
    type: mcpForm.type,
    command: mcpForm.command.trim(),
    args: args,
    enabled: true,
    updated_at: Date.now()
  })
  isMcpModalOpen.value = false
  mcpForm.name = ''
  mcpForm.command = ''
  mcpArgsInput.value = ''
  await loadSettingsData()
  showToast('✓ MCP 服务已成功注册并保存')
}

async function saveSkillAction() {
  if (!skillForm.name.trim()) {
    showToast('请填写技能名称')
    return
  }
  await wailsBridge.saveSkill({
    id: 'skill_' + Date.now(),
    name: skillForm.name.trim(),
    description: skillForm.description.trim(),
    content: skillForm.content.trim(),
    enabled: true,
    updated_at: Date.now()
  })
  isSkillModalOpen.value = false
  skillForm.name = ''
  skillForm.description = ''
  skillForm.content = ''
  await loadSettingsData()
  showToast('✓ 技能已成功添加至本地技能库')
}

async function deleteSkillAction(id: string) {
  await wailsBridge.deleteSkill(id)
  await loadSettingsData()
  showToast('✓ 技能已从本地技能库移除')
}

async function saveRuleAction() {
  if (!ruleForm.name.trim() || !ruleForm.content.trim()) {
    showToast('请完整填写规则名称与规则内容')
    return
  }
  await wailsBridge.saveRule({
    id: 'rule_' + Date.now(),
    name: ruleForm.name.trim(),
    content: ruleForm.content.trim(),
    enabled: true,
    updated_at: Date.now()
  })
  isRuleModalOpen.value = false
  ruleForm.name = ''
  ruleForm.content = ''
  await loadSettingsData()
  showToast('✓ 工程规约已成功添加')
}

async function deleteRuleAction(id: string) {
  await wailsBridge.deleteRule(id)
  await loadSettingsData()
  showToast('✓ 工程规约已删除')
}

// 7. 真实 AST 代码拓扑知识图谱
const astNodes = ref<GraphNode[]>([])
const selectedAstNode = ref<GraphNode | null>(null)

function openKnowledgeGraphModal() {
  isKnowledgeGraphOpen.value = true
  if (astNodes.value.length === 0 && !isGraphLoading.value) {
    scanASTGraph()
  }
}

async function scanASTGraph() {
  isGraphLoading.value = true
  try {
    const nodes = await wailsBridge.getProjectASTGraph()
    astNodes.value = nodes || []
    if (astNodes.value.length > 0) selectedAstNode.value = astNodes.value[0]
  } catch (err) {
    showToast('AST 扫描失败: ' + err)
  } finally {
    isGraphLoading.value = false
  }
}

function injectNodeToPrompt() {
  if (!selectedAstNode.value) return
  const node = selectedAstNode.value
  const quoteText = `\n> 架构拓扑实体引用: \`${node.name}\` [${node.type}]\n> 声明路径: \`${node.file}\`\n> 关联说明: ${node.details}\n`
  inputPrompt.value = inputPrompt.value ? inputPrompt.value + quoteText : quoteText
  isKnowledgeGraphOpen.value = false
  showToast(`✓ 已引用 AST 节点 [${node.name}] 架构约束至输入框`)
}

// =========================================================================
// 6. 底部集成式可折叠流式终端抽屉 (Terminal Drawer)
// =========================================================================
interface TerminalOutputItem {
  type: 'cmd' | 'output' | 'exit'
  text?: string
  exitCode?: number
  durationMs?: number
}

const isTerminalOpen = ref(false)
const isTerminalMaximized = ref(false)
const terminalHeight = ref(240)
const activeTerminalTab = ref<'shell' | 'logs'>('shell')
const isTerminalRunning = ref(false)
const terminalInputCmd = ref('')
const currentTerminalBuffer = ref('')
const terminalOutputs = ref<TerminalOutputItem[]>([])
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)
const terminalScrollRef = ref<HTMLDivElement | null>(null)

const agentTraceLogs = ref<{ time: string; phase: string; message: string }[]>([])

function toggleTerminalDrawer(forceState?: boolean) {
  isTerminalOpen.value = forceState !== undefined ? forceState : !isTerminalOpen.value
  if (isTerminalOpen.value) {
    scrollToBottomTerminal()
  }
}

function clearTerminalLogs() {
  terminalOutputs.value = []
  currentTerminalBuffer.value = ''
}

function scrollToBottomTerminal() {
  nextTick(() => {
    if (terminalScrollRef.value) {
      terminalScrollRef.value.scrollTop = terminalScrollRef.value.scrollHeight
    }
  })
}

function navigateCommandHistory(direction: number) {
  if (commandHistory.value.length === 0) return
  if (historyIndex.value === -1) {
    historyIndex.value = commandHistory.value.length
  }
  historyIndex.value += direction
  if (historyIndex.value < 0) {
    historyIndex.value = 0
  } else if (historyIndex.value >= commandHistory.value.length) {
    historyIndex.value = commandHistory.value.length
    terminalInputCmd.value = ''
    return
  }
  terminalInputCmd.value = commandHistory.value[historyIndex.value] || ''
}

async function submitTerminalCommand() {
  const cmd = terminalInputCmd.value.trim()
  if (!cmd || isTerminalRunning.value) return

  if (cmd === 'clear' || cmd === 'cls') {
    clearTerminalLogs()
    terminalInputCmd.value = ''
    return
  }

  if (!commandHistory.value.includes(cmd)) {
    commandHistory.value.push(cmd)
  }
  historyIndex.value = -1

  terminalOutputs.value.push({ type: 'cmd', text: cmd })
  terminalInputCmd.value = ''
  currentTerminalBuffer.value = ''
  isTerminalRunning.value = true
  scrollToBottomTerminal()

  try {
    await wailsBridge.execTerminalStream(cmd, {
      onData: (chunk: string) => {
        currentTerminalBuffer.value += chunk
        scrollToBottomTerminal()
      },
      onExit: (data) => {
        if (currentTerminalBuffer.value) {
          terminalOutputs.value.push({ type: 'output', text: currentTerminalBuffer.value })
          currentTerminalBuffer.value = ''
        }
        terminalOutputs.value.push({
          type: 'exit',
          exitCode: data.exit_code,
          durationMs: data.duration_ms
        })
        isTerminalRunning.value = false
        scrollToBottomTerminal()
      }
    })
  } catch (err) {
    terminalOutputs.value.push({ type: 'output', text: `[Execution Error]: ${err}` })
    isTerminalRunning.value = false
    scrollToBottomTerminal()
  }
}

async function cancelTerminalAction() {
  try {
    await wailsBridge.cancelTerminalCommand()
    isTerminalRunning.value = false
  } catch (err) {
    console.error('Cancel terminal error:', err)
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isMcpModalOpen.value) { isMcpModalOpen.value = false; return }
    if (isSkillModalOpen.value) { isSkillModalOpen.value = false; return }
    if (isRuleModalOpen.value) { isRuleModalOpen.value = false; return }
    if (isKnowledgeGraphOpen.value) { isKnowledgeGraphOpen.value = false; return }
    if (isSettingsOpen.value) { isSettingsOpen.value = false; return }
    if (isTerminalOpen.value) { isTerminalOpen.value = false; return }
  }

  if (e.ctrlKey && (e.key === '`' || e.key === '~')) {
    e.preventDefault()
    toggleTerminalDrawer()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)

  // 异步非阻塞平滑载入真实持久化数据
  loadSessionsList()
  loadSettingsData()
  wailsBridge.getWorkspace().then(ws => {
    if (ws) {
      workspacePath.value = ws
      loadFileTree()
      loadGitStatus()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style>
button {
  transition: transform 0.08s ease, background-color 0.15s ease, opacity 0.15s ease;
}
button:active {
  transform: scale(0.96);
}

.markdown-body pre {
  background-color: #18181B;
  color: #F4F4F5;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: 'Fira Code', monospace;
  margin: 0.5rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.markdown-body code {
  font-family: 'Fira Code', monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.markdown-body pre code {
  background-color: transparent;
  padding: 0;
}
.markdown-body p {
  margin-bottom: 0.5rem;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-body ul {
  list-style-type: disc;
}
.markdown-body ol {
  list-style-type: decimal;
}
</style>
