<template>
  <div class="h-full w-full bg-[#FAF8F5] text-[#18181B] flex flex-col font-sans select-none overflow-hidden antialiased">
    <!-- ========================================================================= -->
    <!-- 1. 沉浸式无边框标题栏 (Titlebar) -->
    <!-- ========================================================================= -->
    <header class="h-[38px] min-h-[38px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-3 z-30 select-none">
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-bold text-xs shadow-xs">T</div>
        <span class="text-xs font-semibold tracking-tight text-[#18181B]">Tcode Studio</span>
        <span class="text-[#A1A1AA] text-xs">/</span>
        <span class="text-xs font-medium text-[#27272A] flex items-center gap-1.5">
          agent-learning
          <span class="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono">{{ gitStatus.branch || 'main' }}</span>
        </span>
        <div class="h-3 w-[1px] bg-black/[0.08] mx-1"></div>
        <div class="flex items-center gap-1.5 text-[11px] text-[#10A37F] font-medium bg-[#10A37F]/10 px-2 py-0.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-[#10A37F]" :class="{ 'animate-pulse': isStreaming }"></span>
          <span>{{ selectedModel }} · {{ isStreaming ? '推理中' : '就绪' }}</span>
        </div>
      </div>

      <div class="hidden md:flex items-center gap-2 text-[11px] text-[#A1A1AA]">
        <span>按 <kbd class="px-1.5 py-0.5 rounded bg-black/[0.04] border border-black/[0.08] font-mono text-[10px] text-[#52525B]">Ctrl+K</kbd> 快速检索分支、文件与算子</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="openKnowledgeGraphModal"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <span class="text-[#D96B27]">🕸️</span><span>项目知识图谱</span>
        </button>
        <button
          @click="isSettingsOpen = true"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <span class="text-[#D96B27]">⚙️</span><span>设置</span>
        </button>
        <div class="flex items-center gap-1 border-l border-black/[0.08] pl-2">
          <button class="w-6 h-6 rounded flex items-center justify-center hover:bg-black/[0.05] text-[#71717A]">-</button>
          <button class="w-6 h-6 rounded flex items-center justify-center hover:bg-black/[0.05] text-[#71717A]">□</button>
          <button class="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500 hover:text-white text-[#71717A]">✕</button>
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

          <!-- 真实会话卡片列表 (从 ~/.tcode/sessions/ 动态读取) -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
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
                <span class="bg-[#D96B27]/10 text-[#D96B27] px-1.5 py-0.2 rounded font-medium">#{{ sess.tag || '核心架构' }}</span>
                <span class="font-mono text-[#A1A1AA]">{{ sess.time }}</span>
              </div>
              <div class="text-[11px] text-[#71717A] truncate mt-0.5">{{ sess.desc }}</div>
            </div>
          </div>
        </div>

        <!-- 抽屉视图 2: 真实工程文件树 (File Explorer) -->
        <div v-else-if="activeActivity === 'files'" class="flex flex-col h-full overflow-hidden">
          <div class="p-3 border-b border-black/[0.06] flex items-center justify-between">
            <span class="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
              <span>📁</span><span>工程资源管理器</span>
            </span>
            <button @click="loadFileTree" class="text-xs text-[#71717A] hover:text-[#D96B27] cursor-pointer" title="刷新文件树">🔄</button>
          </div>

          <div class="flex-1 overflow-y-auto p-2 text-xs space-y-1 font-mono">
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
            <div>
              <div class="text-[10px] font-bold text-[#71717A] uppercase mb-1">变更文件 (WORKING TREE)</div>
              <div class="space-y-1">
                <div
                  v-for="file in (gitStatus.working || ['main.go', 'app.go'])"
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
              <option value="deepseek-v4-flash">⚡ deepseek-v4-flash (深度心智思考)</option>
              <option value="gpt-5.6-sol">🧠 gpt-5.6-sol (OpenAI 架构旗舰)</option>
              <option value="claude-opus-4-8">👑 claude-opus-4-8 (Claude 顶级推理)</option>
              <option value="glm-5.3">🌐 glm-5.3 (多语言通用模型)</option>
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
        <div ref="messagesContainerRef" class="flex-1 overflow-y-auto p-4 space-y-4">
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

              <!-- Tool Call 算子执行卡片 -->
              <div v-if="msg.tool" class="w-full space-y-2">
                <div class="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden">
                  <div class="p-2 flex items-center justify-between bg-black/[0.02] text-xs font-mono">
                    <span class="font-bold text-[#18181B]">$_ {{ msg.tool.name }} {{ typeof msg.tool.args === 'string' ? msg.tool.args : JSON.stringify(msg.tool.args) }}</span>
                    <span class="text-[10px] text-[#10A37F]">● 执行成功</span>
                  </div>
                  <div class="p-2.5 bg-[#18181B] text-emerald-400 font-mono text-[11px] whitespace-pre-wrap">
                    {{ msg.tool.output }}
                  </div>
                </div>
              </div>

              <!-- Sub-Agent 协同委派展示 -->
              <div v-if="msg.id === 'msg_2'" class="w-full rounded-2xl border border-black/[0.08] bg-white shadow-2xs p-3 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-[#18181B]">
                  <div class="flex items-center gap-1.5">
                    <span>🔬</span><span>Sub-Agent 子智能体多代理协同委派</span>
                  </div>
                  <span class="text-[10px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-2 py-0.5 rounded-full font-bold">2 智能体在线</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="p-2 rounded-xl bg-[#FAF8F5] border border-black/[0.06] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span>🧪</span>
                      <div>
                        <div class="font-bold text-[11px]">TDD 单测自愈智能体</div>
                        <div class="text-[10px] text-[#71717A]">测试驱动闭环</div>
                      </div>
                    </div>
                    <span class="text-[9px] text-[#10A37F] font-mono font-bold">就绪</span>
                  </div>
                  <div class="p-2 rounded-xl bg-[#FAF8F5] border border-black/[0.06] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span>🛡️</span>
                      <div>
                        <div class="font-bold text-[11px]">安全沙箱审查智能体</div>
                        <div class="text-[10px] text-[#71717A]">高危指令拦截</div>
                      </div>
                    </div>
                    <span class="text-[9px] text-[#10A37F] font-mono font-bold">已守护</span>
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
                  @click="handleSend"
                  :disabled="isStreaming"
                  :class="[
                    'w-7 h-7 rounded-xl flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer',
                    isStreaming ? 'bg-[#A1A1AA] text-white cursor-not-allowed' : 'bg-[#D96B27] hover:bg-[#B8551B] text-white'
                  ]"
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
              @click="isDiffOpen = false"
              class="flex items-center gap-1 px-2.5 py-0.8 rounded-md bg-[#10A37F] hover:bg-[#0D8C6D] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="确认采纳文件修改"
            >
              <span>✓</span><span>采纳变更</span>
            </button>
            <button @click="isDiffOpen = false" class="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-black/[0.05] cursor-pointer ml-1">✕</button>
          </div>
        </header>

        <!-- 真实物理行级 Diff (Red / Green) -->
        <div class="flex-1 overflow-y-auto bg-[#18181B] text-[#F4F4F5] font-mono text-[11px] p-2 space-y-0.5 select-text">
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
        </div>

        <footer class="h-6 bg-[#FAF8F5] border-t border-black/[0.08] px-3 flex items-center justify-between text-[10px] text-[#71717A] font-mono select-none shrink-0">
          <span>{{ diffReport?.lang || 'Go · UTF-8' }}</span>
          <span class="text-emerald-700 font-bold">● Git 磁盘实时同步</span>
        </footer>
      </section>
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
                <div v-for="skill in skills" :key="skill.id" class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] flex items-center justify-between shadow-2xs">
                  <div>
                    <span class="text-xs font-bold text-[#18181B]">{{ skill.name }}</span>
                    <div class="text-[11px] text-[#71717A] mt-0.5">{{ skill.description }}</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="skill.enabled" @change="toggleSkill(skill)" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10A37F]"></div>
                  </label>
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
                <div v-for="rule in rules" :key="rule.id" class="p-3 rounded-xl border border-black/[0.08] bg-[#FAF8F5] space-y-1 shadow-2xs">
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
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
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
const isDiffOpen = ref(true)
const activeDiffFile = ref('app.go')
const isSettingsOpen = ref(false)
const isKnowledgeGraphOpen = ref(false)
const isChannelModalOpen = ref(false)
const isMcpModalOpen = ref(false)
const isSkillModalOpen = ref(false)
const isRuleModalOpen = ref(false)
const activeSettingsTab = ref('models')
const isFullAuto = ref(false)
const isStreaming = ref(false)

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
const currentSessionId = ref('sess1')
const selectedModel = ref('deepseek-v4-flash')

const currentSession = ref<ChatSession>({
  id: 'sess1',
  title: '架构重构与执行流设计',
  model: 'deepseek-v4-flash',
  tag: '核心架构',
  created_at: Date.now(),
  updated_at: Date.now(),
  messages: [
    {
      id: 'msg_1',
      role: 'user',
      content: '1. 原型设计上，厂商不仅支持自动获取模型，还要支持手动添加。\n2. 还缺skill管理、MCP管理、软件规则管理。\n3. 主页面应该还要有一个最左侧的活动导航栏。',
      time: '14:20'
    },
    {
      id: 'msg_2',
      role: 'assistant',
      thinking: '1. 引入 48px 最左侧活动栏，支持工作台秒切；\n2. 补齐自动抓取与手动模型录入；\n3. 落地 MCP、Skill、Rules 设置管理。',
      content: '已成功按照原型与技术规范重构为纯原生 Go 1.22 + Wails v2 + Vue 3.4 架构。\n所有 Python 与旧 React 遗留已全部清理，系统已接通原生 IPC 通信管道与 ReAct 自主算子循环。',
      tool: {
        name: 'exec_command',
        args: { command: 'go test -v ./...' },
        output: 'PASS ok tcode/internal/core/sandbox (0.01s)\nWails v2.9.2 Native Compiler Packaged bin/tcode.exe'
      },
      time: '14:21'
    }
  ]
})

const filteredSessions = computed(() => {
  if (activeTag.value === '全部') return sessions.value
  return sessions.value.filter(s => (s.tag || '核心架构') === activeTag.value)
})

async function loadSessionsList() {
  try {
    const list = await wailsBridge.listSessions()
    if (list && list.length > 0) {
      sessions.value = list
    }
  } catch (err) {
    console.error('Failed to load sessions:', err)
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
    title: '新建工程探索会话',
    model: selectedModel.value,
    tag: '核心架构',
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
  await wailsBridge.deleteSession(id)
  await loadSessionsList()
  if (currentSessionId.value === id && sessions.value.length > 0) {
    await selectSession(sessions.value[0].id)
  }
  showToast('✓ 会话已从本地磁盘移除')
}

// 3. 真实文件树与 Git 状态
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
    showToast(`✓ 已物理撤回 ${activeDiffFile.value} 磁盘改动 (Git Checkout)`)
  } catch (err) {
    showToast('撤回异常: ' + err)
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

  inputPrompt.value = ''
  isStreaming.value = true

  const userMsgId = 'msg_' + Date.now()
  currentSession.value.messages.push({
    id: userMsgId,
    role: 'user',
    content: prompt,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  const asstMsgId = 'asst_' + Date.now()
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
        prompt: prompt,
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
        onToolStart(tool, args) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          if (target) target.tool = { name: tool, args: typeof args === 'string' ? JSON.parse(args) : args, output: '正在执行...' }
        },
        onToolEnd(tool, output) {
          const target = currentSession.value.messages.find(m => m.id === asstMsgId)
          if (target && target.tool) target.tool.output = output
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

// 6. 设置中枢 (渠道、MCP、Skill、Rule)
const channels = ref<ChannelConfig[]>([])
const mcps = ref<MCPServerConfig[]>([])
const skills = ref<SkillConfig[]>([])
const rules = ref<RuleConfig[]>([])
const pingLoadingMap = reactive<Record<string, boolean>>({})

const channelForm = reactive({
  name: 'AgentRouter 主通道',
  endpoint: 'https://agentrouter.org/v1',
  api_key: 'sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ'
})

async function loadSettingsData() {
  channels.value = await wailsBridge.listChannels()
  mcps.value = await wailsBridge.listMCPs()
  skills.value = await wailsBridge.listSkills()
  rules.value = await wailsBridge.listRules()
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
    const models = await wailsBridge.fetchUpstreamModels(channelForm.endpoint, channelForm.api_key)
    showToast(`✓ 成功从上游网关探测到 ${models.length} 个真实在线模型！`)
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
    model: 'deepseek-v4-flash',
    latency: '82ms',
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

// 7. 真实 AST 代码拓扑知识图谱
const astNodes = ref<GraphNode[]>([])
const selectedAstNode = ref<GraphNode | null>(null)

async function openKnowledgeGraphModal() {
  isKnowledgeGraphOpen.value = true
  if (astNodes.value.length === 0) {
    await scanASTGraph()
  }
}

async function scanASTGraph() {
  try {
    const nodes = await wailsBridge.getProjectASTGraph()
    astNodes.value = nodes
    if (nodes.length > 0) selectedAstNode.value = nodes[0]
    showToast(`✓ 成功完成 Go AST 语法树解析：提取 ${nodes.length} 个代码实体！`)
  } catch (err) {
    showToast('AST 扫描失败: ' + err)
  }
}

function injectNodeToPrompt() {
  if (!selectedAstNode.value) return
  isKnowledgeGraphOpen.value = false
  inputPrompt.value += `请参考代码拓扑中【${selectedAstNode.value.name}】(${selectedAstNode.value.file}) 的架构定义：`
}

onMounted(async () => {
  await Promise.all([
    loadSessionsList(),
    loadFileTree(),
    loadGitStatus(),
    loadDiff(),
    loadSettingsData()
  ])
})
</script>

<style>
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
