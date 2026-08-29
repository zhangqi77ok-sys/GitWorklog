import { SettingsModal } from './components/SettingsModal';
import { LiveLogsModal } from './components/LiveLogsModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { TokenAnalyticsModal } from './components/TokenAnalyticsModal';
import React, { useState } from 'react';
import './styles/theme.css';
import { Titlebar } from './components/Titlebar';
import { ActivityBar } from './components/ActivityBar';
import { LeftPanel } from './components/LeftPanel';
import { ChatColumn } from './components/ChatColumn';
import { EditorWorkspace } from './components/EditorWorkspace';
import {
  calculateKVCacheMetrics,
  SessionTier1Type,
  SessionItem,
  ChatMessage,
  QueuedPromptItem,
  TokenStats,
  WorkMode,
  PermissionPolicy,
  ProjectGroup,
  addTagToSession,
  removeTagFromSession,
  renameSession,
  addProjectToWorkspace,
  removeProjectFromWorkspace,
  AIModelOption,
  AVAILABLE_MODELS,
  getAllAvailableModels,
  forkSessionFromMessage,
  clampLeftPanelWidth,
  clampWorkbenchWidth,
  clampLeftPanelWithCollapse,
  DiffNavigationTarget,
  loadSavedProviders,
  loadSavedProjects,
  saveProjectsToStorage,
  resolveApiEndpoint,
  loadSavedSessions,
  saveSessionsToStorage,
  loadSavedSessionMessages,
  saveSessionMessagesToStorage,
  loadFromDiskStorageAsync,
  STORAGE_KEYS,
  MentionContextItem,
  LiveLogItem,
  appendLiveLog,
  loadSavedAccentColor
} from './types/contracts';

export const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLiveLogsOpen, setIsLiveLogsOpen] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LiveLogItem[]>([
    { id: 'log-init', timestamp: Date.now(), level: 'INFO', module: 'GatewayBus', message: '网关总线核心已启动，正在监听本地与远程大模型通信' }
  ]);

  const addLog = (level: 'INFO' | 'WARN' | 'ERROR' | 'NET', module: string, message: string) => {
    const item = appendLiveLog(level, module, message);
    setLiveLogs(prev => [item, ...prev.slice(0, 199)]);
  };
  const [isTokenAnalyticsOpen, setIsTokenAnalyticsOpen] = useState(false);
  // Apply saved theme accent color on launch
  React.useEffect(() => {
    const savedAccent = loadSavedAccentColor();
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent', savedAccent);
      document.documentElement.style.setProperty('--accent-subtle', savedAccent + '1F');
    }
  }, []);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'files' | 'commands'>('files');

  // Global Keyboard Navigation (Ctrl+P, Ctrl+Shift+P, Alt+1/2/3)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsLeftDrawerCollapsed(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setPaletteMode('files');
        setIsPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'P' && e.shiftKey) {
        e.preventDefault();
        setPaletteMode('commands');
        setIsPaletteOpen(true);
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveNav('sessions');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setRightWorkspaceOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [accentHex, setAccentHex] = useState('#D96B27');

  const handleSelectAccentHex = (hex: string) => {
    setAccentHex(hex);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-subtle', `${hex}1F`);
  };

  const [activeNav, setActiveNav] = useState('sessions');
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const initialSessions = loadSavedSessions();
    return initialSessions[0]?.id || 'session-1';
  });
  const [rightWorkspaceOpen, setRightWorkspaceOpen] = useState<boolean>(false);
  const [workMode, setWorkMode] = useState<WorkMode>('act');
  const [currentModel, setCurrentModel] = useState<AIModelOption>(() => {
    const all = getAllAvailableModels();
    return all.find((m: AIModelOption) => m.id === 'mimo-v2.5-free') || all[0] || AVAILABLE_MODELS[0];
  });
  const [permissionPolicy, setPermissionPolicy] = useState<PermissionPolicy>('autonomous_agent');

  // Resizable Layout & Collapse States
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(260);
  const [isLeftDrawerCollapsed, setIsLeftDrawerCollapsed] = useState<boolean>(false);
  const [workbenchWidth, setWorkbenchWidth] = useState<number>(560);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [activeDiffTarget, setActiveDiffTarget] = useState<DiffNavigationTarget | null>(null);
  const [activeFile, setActiveFile] = useState<{ path: string; name: string } | null>(null);

  // Global Drag Listeners
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const snapped = clampLeftPanelWithCollapse(e.clientX - 44);
        if (snapped === 0) {
          setIsLeftDrawerCollapsed(true);
          setLeftPanelWidth(260);
        } else {
          setIsLeftDrawerCollapsed(false);
          setLeftPanelWidth(snapped);
        }
      } else if (isDraggingRight) {
        const newWbWidth = window.innerWidth - e.clientX;
        setWorkbenchWidth(clampWorkbenchWidth(newWbWidth, window.innerWidth));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  // Multi-Project Groups (Clean initial state, loaded from local storage)
  const [projects, setProjects] = useState<ProjectGroup[]>(loadSavedProjects());

  // Token Stats (Clean initial state: 0 tokens until conversation starts)
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    promptTokens: 0,
    completionTokens: 0,
    cacheHitTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0.000,
    contextCurrentTokens: 0,
    contextMaxTokens: 128000
  });

  // Hierarchical Sessions with Local Persistence
  const [sessions, setSessions] = useState<SessionItem[]>(loadSavedSessions());

  // Per-Session Message Map (100% Isolated: each session has its own message stream)
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>(loadSavedSessionMessages());
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [promptQueue, setPromptQueue] = useState<QueuedPromptItem[]>([]);
  const promptQueueRef = React.useRef<QueuedPromptItem[]>([]);
  promptQueueRef.current = promptQueue;

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Messages for active session
  const messages = sessionMessages[currentSessionId] || [];
  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessionMessages(prevMap => {
      const prevList = prevMap[currentSessionId] || [];
      const newList = typeof updater === 'function' ? updater(prevList) : updater;
      const updatedMap = { ...prevMap, [currentSessionId]: newList };
      saveSessionMessagesToStorage(updatedMap);
      return updatedMap;
    });
  };

  // Real-time Dynamic Token & KV Cache Caching Calculator
  React.useEffect(() => {
    const totalMsgCount = messages.length;
    const kv = calculateKVCacheMetrics(totalMsgCount);
    
    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const contentTokens = Math.round(totalChars * 0.75);
    const promptTokens = Math.round(contentTokens * 0.45) + kv.prefixTokens;
    const completionTokens = Math.round(contentTokens * 0.55);
    const totalTokens = promptTokens + completionTokens;
    
    const costUsd = Number(((promptTokens * 0.0000008) + (completionTokens * 0.000002) - (kv.totalCacheHitTokens * 0.00000072)).toFixed(4));
    
    setTokenStats({
      totalTokens: Math.max(totalTokens, kv.prefixTokens),
      promptTokens: Math.max(promptTokens, kv.prefixTokens),
      completionTokens: completionTokens,
      cacheHitTokens: kv.totalCacheHitTokens,
      cacheWriteTokens: kv.prefixTokens,
      estimatedCostUsd: Math.max(0.001, costUsd),
      contextCurrentTokens: Math.min(currentModel.contextLimit || 128000, totalTokens),
      contextMaxTokens: currentModel.contextLimit || 128000
    });
  }, [messages, currentModel]);

  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  // Session Tree Operations
  const handleNewGlobalSession = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: SessionItem = {
      id: newSessionId,
      tier1: 'global',
      title: '新的全局自由会话',
      tags: ['docs'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      saveSessionsToStorage(updated);
      return updated;
    });
    setSessionMessages(prev => {
      const updated = { ...prev, [newSessionId]: [] };
      saveSessionMessagesToStorage(updated);
      return updated;
    });
    setCurrentSessionId(newSessionId);
  };

  const handleNewProjectSession = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    const newSessionId = `session-proj-${Date.now()}`;
    const newSession: SessionItem = {
      id: newSessionId,
      tier1: 'project',
      projectId: projectId,
      projectName: proj?.name || 'project',
      projectPath: proj?.path,
      gitBranch: proj?.gitBranch || 'main',
      title: `新工程会话 (${proj?.name || 'project'})`,
      tags: ['feat'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      saveSessionsToStorage(updated);
      return updated;
    });
    setSessionMessages(prev => {
      const updated = { ...prev, [newSessionId]: [] };
      saveSessionMessagesToStorage(updated);
      return updated;
    });
    setCurrentSessionId(newSessionId);
  };


  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      saveSessionsToStorage(remaining);
      if (currentSessionId === id && remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      }
      return remaining;
    });
    setSessionMessages(prev => {
      const copy = { ...prev };
      delete copy[id];
      saveSessionMessagesToStorage(copy);
      return copy;
    });
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? renameSession(s, newTitle) : s))
    );
  };

  const handleAddTag = (sessionId: string, tag: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? addTagToSession(s, tag) : s))
    );
  };

  const handleRemoveTag = (sessionId: string, tag: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? removeTagFromSession(s, tag) : s))
    );
  };


  const handleOpenDirectory = (folderPath: string) => {
    const { projects: updatedProjects, newProject } = addProjectToWorkspace(projects, folderPath, 'main');
    setProjects(updatedProjects);
    saveProjectsToStorage(updatedProjects);

    // Create a dedicated clean initial session under this new project (0 messages, completely isolated)
    const newSessionId = `session-proj-${Date.now()}`;
    const newSession: SessionItem = {
      id: newSessionId,
      tier1: 'project',
      projectId: newProject.id,
      projectName: newProject.name,
      projectPath: newProject.path,
      gitBranch: newProject.gitBranch || 'main',
      title: `${newProject.name} (主工程会话)`,
      tags: ['project'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      saveSessionsToStorage(updated);
      return updated;
    });

    // Initialize clean empty message stream for the new project session
    setSessionMessages(prev => {
      const updated = { ...prev, [newSessionId]: [] };
      saveSessionMessagesToStorage(updated);
      return updated;
    });

    setCurrentSessionId(newSessionId);
  };

  const handleRemoveProject = (projectId: string) => {
    setProjects(prev => {
      const updated = removeProjectFromWorkspace(prev, projectId);
      saveProjectsToStorage(updated);
      return updated;
    });
  };

  const handleSelectModel = (model: AIModelOption) => {
    setCurrentModel(model);
    // Update Token stats context window max
    setTokenStats(prev => ({
      ...prev,
      contextMaxTokens: model.contextLimit
    }));
    // Insert system notification message in chat
    const switchMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: `✨ 模型已无缝切换至: **${model.name}** (${model.badge || model.provider}) · 上下文上限自动调整为 ${Math.round(model.contextLimit / 1000)}k tokens · 网关子线已激活`,
      timestamp: Date.now(),
      auditTag: '⚡ 模型热切完成'
    };
    setMessages(prev => [...prev, switchMsg]);
  };


  const handleForkSessionFromMessage = (fromMessageId: string) => {
    const { updatedSessions, newSession, forkedMessages } = forkSessionFromMessage(
      sessions,
      messages,
      currentSessionId,
      fromMessageId
    );
    setSessions(updatedSessions);
    setCurrentSessionId(newSession.id);
    setMessages(forkedMessages);

    // Toast notification
    const toastMsg: ChatMessage = {
      id: `toast-${Date.now()}`,
      role: 'assistant',
      content: `✨ **已成功从该历史事件节点分叉出会话分支**: [${newSession.title}]。旧分支会话已完整归档保护，您可在此分支独立开展试错与重构。`,
      timestamp: Date.now(),
      auditTag: '⑂ Harness 会话时光机分叉'
    };
    setMessages(prev => [...prev, toastMsg]);
  };

  const handleOpenFile = (filePath: string, fileName: string, line?: number) => {
    setActiveFile({ path: filePath, name: fileName });
    if (!rightWorkspaceOpen) {
      setRightWorkspaceOpen(true);
    }
  };

    const handleEnqueuePrompt = (text: string, mentions?: MentionContextItem[]) => {
    const newItem: QueuedPromptItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: Date.now(),
      selectedMentions: mentions
    };
    setPromptQueue(prev => [...prev, newItem]);
    addLog('INFO', 'QueueBus', `[队列注入] 新增等待问答任务 #${promptQueue.length + 1}: ${text.slice(0, 30)}...`);
  };

  const handleWithdrawQueuedPrompt = (id: string) => {
    setPromptQueue(prev => prev.filter(q => q.id !== id));
    addLog('INFO', 'QueueBus', `[队列撤回] 成功撤回任务 [${id}]`);
  };

  const handleEditQueuedPrompt = (id: string, newText: string) => {
    setPromptQueue(prev => prev.map(q => q.id === id ? { ...q, text: newText } : q));
    addLog('INFO', 'QueueBus', `[队列更新] 任务 [${id}] 内容已更新`);
  };

  const handleMoveQueuedPrompt = (index: number, direction: -1 | 1) => {
    setPromptQueue(prev => {
      const nextIdx = index + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIdx];
      copy[nextIdx] = temp;
      return copy;
    });
  };

  const handlePreemptQueuedPrompt = (id: string) => {
    const item = promptQueue.find(q => q.id === id);
    if (!item) return;
    addLog('WARN', 'QueueBus', `[队列顶替] 立即打断当前问答，强行置顶执行任务: ${item.text.slice(0, 30)}...`);
    handleStopGeneration();
    setPromptQueue(prev => prev.filter(q => q.id !== id));
    setTimeout(() => {
      handleSendMessage(item.text, item.selectedMentions);
    }, 150);
  };

  const handleSendMessage = async (text: string, mentions?: MentionContextItem[]) => {
    if (!text.trim()) return;
    if (isStreaming) {
      handleEnqueuePrompt(text, mentions);
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    // Snapshot active model at call initiation to guarantee immunity against concurrent model switching
    const streamingModel = { ...currentModel };
    const assistantId = `reply-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      auditTag: `⚡ ${streamingModel.name} 真实流式响应`
    };

    // Append both to current session in memory
    setSessionMessages(prev => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), userMsg, assistantMsg]
    }));
    setIsStreaming(true);

    const callStartTime = performance.now();
    try {
      addLog('INFO', 'GatewayBus', `[发送指令] 正在调度模型 [${streamingModel.name}] (${streamingModel.id})`);
      const savedProviders = loadSavedProviders();
      // Intelligent Provider matching for selected model
      let provider = savedProviders.find(p => p.enabled && p.models?.some(m => m.id === streamingModel.id));
      if (!provider && (streamingModel.id.includes('mimo') || streamingModel.name.includes('OpenCode') || streamingModel.id.includes('free'))) {
        provider = savedProviders.find(p => p.id === 'provider-opencode');
      }
      if (!provider) {
        provider = savedProviders.find(p => p.enabled && p.apiKey && p.baseUrl) || savedProviders[0];
      }

      let baseUrl = provider?.baseUrl?.trim() || 'https://opencode.ai/zen/v1';
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      const apiKey = provider?.apiKey?.trim() || 'sk-REVOKED_PLACEHOLDER';
      // Use the exact model ID selected by user without hardcoding
      const targetModel = streamingModel.id;

      // Pack Agent Workspace & Mentioned Files Context
      let contextualizedUserContent = text;
      if (mentions && mentions.length > 0) {
        let mentionContextStr = '';
        for (const item of mentions) {
          if (item.type === 'file' && item.path) {
            try {
              const res = await fetch(`/api/fs/read?path=${encodeURIComponent(item.path)}`);
              const data = await res.json();
              if (data.success && typeof data.content === 'string') {
                mentionContextStr += `\n\n[引用的文件 @${item.name} (${item.path})]:\n\`\`\`\n${data.content.slice(0, 12000)}\n\`\`\``;
              }
            } catch (e) {}
          } else if (item.name === '@工程目录全貌' && activeSession.projectPath) {
            try {
              const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(activeSession.projectPath)}`);
              const data = await res.json();
              if (data.success && data.tree) {
                mentionContextStr += `\n\n[工作区工程完整目录拓扑]:\n\`\`\`json\n${JSON.stringify(data.tree, null, 2).slice(0, 5000)}\n\`\`\``;
              }
            } catch (e) {}
          }
        }
        if (mentionContextStr) {
          contextualizedUserContent = `${text}\n\n--- 上下文工程数据 ---${mentionContextStr}`;
        }
      }

      // Auto Project Context Inspection: Read real files from disk if user asks about project/architecture
      const isAskingAboutProject = /项目|工程|架构|代码|优化|审查|文件|分析/i.test(text);
      let autoInspectedFiles = '';
      if (isAskingAboutProject && activeSession.projectPath) {
        try {
          // 1. Fetch file tree
          const treeRes = await fetch(`/api/fs/tree?path=${encodeURIComponent(activeSession.projectPath)}`);
          const treeData = await treeRes.json();
          if (treeData.success && treeData.tree) {
            autoInspectedFiles += `\n[工程实时目录拓扑]:\n${JSON.stringify(treeData.tree.map((n: any) => ({ name: n.name, type: n.type })), null, 2)}`;
          }

          // 2. Fetch package.json if available
          const pkgRes = await fetch(`/api/fs/read?path=${encodeURIComponent(activeSession.projectPath + '/package.json')}`);
          const pkgData = await pkgRes.json();
          if (pkgData.success && pkgData.content) {
            autoInspectedFiles += `\n\n[工程核心配置 package.json]:\n\`\`\`json\n${pkgData.content.slice(0, 3000)}\n\`\`\``;
          }

          // 3. Fetch README.md if available
          const readmeRes = await fetch(`/api/fs/read?path=${encodeURIComponent(activeSession.projectPath + '/README.md')}`);
          const readmeData = await readmeRes.json();
          if (readmeData.success && readmeData.content) {
            autoInspectedFiles += `\n\n[工程简介 README.md]:\n\`\`\`markdown\n${readmeData.content.slice(0, 3000)}\n\`\`\``;
          }
        } catch (e) {}
      }

      const systemPrompt = `你是 Tcode (AI Agentic Desktop IDE) 接入的生产级自主 AI Agent 架构师。
${activeSession.projectPath ? `【本地物理工程已挂载】
- 项目名称: ${activeSession.projectName}
- 物理路径: ${activeSession.projectPath}
- Git活跃分支: ${activeSession.gitBranch || 'main'}
Tcode 已通过宿主磁盘与终端桥接将工程提供给你。` : '当前处于全局自由会话模式。'}

【当前工作模式】: ${workMode === 'act' ? 'Act 落地模式 (自主执行模式)' : 'Plan 规划模式'}
【当前权限策略 (Permission Policy)】: ${
  permissionPolicy === 'strict_approval'
    ? '🛡️ 逐次审核模式：开发者要求逐一审核。你输出的 write_file 与 run_command 必须等待开发者手动点击确认，不可假定已自动执行。'
    : permissionPolicy === 'autonomous_agent'
    ? '⚡ 智能自决模式：你具备全自主落地的执行权，你的 write_file 与 run_command 将由系统在本地自动执行落盘，请直接生成修改方案并自主闭环。'
    : '⚠️ 风险熔断模式：常规文件变更与测试命令将自动执行；但涉及删除 (rm/del)、强制重置 (git reset --hard)、或远端推送 (git push) 等高危动作系统将触发安全熔断拦截，需开发者二次确认。'
}

【Tcode 本地文件修改与终端执行工具协议 (Tool Action Protocols)】:
你深度接入了宿主操作系统的真实文件系统与 PowerShell 终端。

🚨【核心铁律：严格根据开发者意图区分“只读咨询/分析”与“物理落地修改”】:
1. 💡【只读分析与咨询场景】（必须严格遵守）:
   - 当开发者向你提问、咨询优化建议、探讨方案、代码审查、探讨概念，或询问“有哪些可以优化的/怎么看/分析一下”时：
   - 你必须且只能输出纯 Markdown 文本、分析论述、架构解释或普通只读代码块供用户预览！
   - 严禁擅自使用 \`\`\`write_file:... 或 \`\`\`run_command 指令块！严禁在用户未明确要求修改时自作主张创建/修改文件或执行命令！

2. ⚡【明确落地与写盘场景】:
   - 只有当开发者明确发出落地指令（例如：“帮我修改/创建 xxx 文件”、“重构并应用代码”、“运行测试/执行 git commit/push”）时：
   - 你才可以输出以下结构化动作块，Tcode 宿主执行引擎将为你落地：

   - 写入或修改文件:
   \`\`\`write_file:相对路径或绝对路径
   文件完整内容
   \`\`\`

   - 执行系统终端命令 (PowerShell / Git / npm / cargo 等):
   \`\`\`run_command
   具体的终端指令
   \`\`\`

【总结铁律】: 问答/咨询时纯文字分析，绝不输出 write_file/run_command；明确要求修改/执行时才输出 write_file/run_command！`;

      if (autoInspectedFiles && !contextualizedUserContent.includes('--- 上下文工程数据 ---')) {
        contextualizedUserContent = `${text}\n\n--- 自动探查的本地工程上下文 ---${autoInspectedFiles}`;
      }

      // Filter clean history without empty placeholders or self
      const cleanHistory = (sessionMessages[currentSessionId] || [])
        .filter(m => m.content && m.content.trim() && m.id !== assistantId && m.id !== userMsg.id)
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...cleanHistory,
        { role: 'user', content: contextualizedUserContent }
      ];

      const { url: requestUrl, headers: proxyHeaders } = resolveApiEndpoint(`${baseUrl}/chat/completions`);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(requestUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...proxyHeaders
        },
        body: JSON.stringify({
          model: targetModel,
          messages: apiMessages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';
      let accumulatedThinking = '';
      let buffer = '';

      if (reader) {
        let isFirstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // GatewayBus: Inspect first chunk for upstream plain-text errors (e.g. 'no channel is currently available')
          if (isFirstChunk && buffer.trim()) {
            isFirstChunk = false;
            if (!buffer.includes('data: ') && !buffer.includes('{')) {
              const upstreamError = buffer.trim();
              addLog('ERROR', 'GatewayBus', `上游模型网关错误: "${upstreamError}"`);
              throw new Error(`上游大模型服务商提示: "${upstreamError}"。当前模型通道不可用，请切换至 DeepSeek V4 Flash 等可用模型。`);
            }
          }

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                const choice = parsed.choices?.[0];
                const deltaContent = choice?.delta?.content || '';
                const deltaReasoning = choice?.delta?.reasoning_content || '';

                if (deltaReasoning) {
                  accumulatedThinking += deltaReasoning;
                }
                if (deltaContent) {
                  accumulatedContent += deltaContent;
                }

                if (deltaReasoning || deltaContent) {
                  let currentDisplay = '';
                  if (accumulatedThinking && !accumulatedContent) {
                    currentDisplay = `<think>\n${accumulatedThinking}\n</think>\n\n*正在深入推演与分析代码架构...*`;
                  } else if (accumulatedThinking && accumulatedContent) {
                    currentDisplay = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
                  } else {
                    currentDisplay = accumulatedContent;
                  }

                  setSessionMessages(prev => {
                    const list = prev[currentSessionId] || [];
                    const updated = list.map(m => m.id === assistantId ? { ...m, content: currentDisplay } : m);
                    return { ...prev, [currentSessionId]: updated };
                  });
                }
              } catch (e) {}
            }
          }
        }
      }

      let finalAccumulated = '';
      if (accumulatedThinking && !accumulatedContent) {
        finalAccumulated = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedThinking}`;
      } else if (accumulatedThinking && accumulatedContent) {
        finalAccumulated = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
      } else {
        finalAccumulated = accumulatedContent;
      }

      if (!finalAccumulated.trim()) {
        finalAccumulated = '已完成对当前工程上下文的推演与分析。请继续提出具体修改或重构指令。';
      }

      const durationSec = parseFloat(((performance.now() - callStartTime) / 1000).toFixed(1));
      const addedPrompt = Math.round(text.length * 0.75);
      const addedComp = Math.round(finalAccumulated.length * 0.75);
      const tokenDetail = {
        promptTokens: addedPrompt,
        completionTokens: addedComp,
        totalTokens: addedPrompt + addedComp
      };

      addLog('NET', 'GatewayBus', `[调用完成] 模型: ${streamingModel.name} · 耗时: ${durationSec}s · Token消耗: ${tokenDetail.totalTokens}`);

      setSessionMessages(prev => {
        const list = prev[currentSessionId] || [];
        const updated = list.map(m => m.id === assistantId ? {
          ...m,
          content: finalAccumulated,
          tokensDetail: tokenDetail,
          durationSeconds: durationSec
        } : m);
        return { ...prev, [currentSessionId]: updated };
      });

      // Realistic Token increment
      setTokenStats(prev => ({
        ...prev,
        promptTokens: prev.promptTokens + addedPrompt,
        completionTokens: prev.completionTokens + addedComp,
        estimatedCostUsd: prev.estimatedCostUsd + ((addedPrompt + addedComp) * 0.0000002)
      }));

      // Update session messageCount and tokens
      setSessions(prev => {
        const updated = prev.map(s => s.id === currentSessionId ? {
          ...s,
          messagesCount: s.messagesCount + 2,
          totalTokens: s.totalTokens + addedPrompt + addedComp,
          updatedAt: Date.now()
        } : s);
        saveSessionsToStorage(updated);
        return updated;
      });

      // Save complete session messages to localStorage ONCE at end of stream
      setSessionMessages(latest => {
        saveSessionMessagesToStorage(latest);
        return latest;
      });

    } catch (err: any) {
      setSessionMessages(prev => {
        const list = prev[currentSessionId] || [];
        const updated = list.map(m => m.id === assistantId ? {
          ...m,
          content: `✕ 大模型连接异常: ${err.message}。请在左侧系统设置中检查服务商 Base URL 与 API Key 凭据。`,
          auditTag: '⚠️ 网络或鉴权异常'
        } : m);
        saveSessionMessagesToStorage({ ...prev, [currentSessionId]: updated });
        return { ...prev, [currentSessionId]: updated };
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // Native Frameless Window Edge Drag Resize
  const handleWindowEdgeResize = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = window.innerWidth;
    const startH = window.innerHeight;

    let lastSent = Date.now();
    const onMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (direction.includes('e')) newW = startW + deltaX;
      if (direction.includes('w')) newW = startW - deltaX;
      if (direction.includes('s')) newH = startH + deltaY;
      if (direction.includes('n')) newH = startH - deltaY;

      if (Date.now() - lastSent > 40) {
        lastSent = Date.now();
        fetch('/api/window/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ width: Math.round(newW), height: Math.round(newH) })
        }).catch(() => {});
      }
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (direction.includes('e')) newW = startW + deltaX;
      if (direction.includes('w')) newW = startW - deltaX;
      if (direction.includes('s')) newH = startH + deltaY;
      if (direction.includes('n')) newH = startH - deltaY;

      fetch('/api/window/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: Math.round(newW), height: Math.round(newH) })
      }).catch(() => {});
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResolveOptions = (messageId: string, selectedIds: string[], customInput?: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === messageId && m.optionsPayload) {
          return {
            ...m,
            optionsPayload: {
              ...m.optionsPayload,
              status: 'resolved',
              resolvedSelection: selectedIds,
              customInput
            }
          };
        }
        return m;
      })
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 8-Directional Draggable Window Edge Resize Grippers */}
      <div onMouseDown={handleWindowEdgeResize('n')} style={{ position: 'fixed', top: 0, left: 6, right: 6, height: '4px', cursor: 'ns-resize', zIndex: 9999 }} />
      <div onMouseDown={handleWindowEdgeResize('s')} style={{ position: 'fixed', bottom: 0, left: 6, right: 6, height: '4px', cursor: 'ns-resize', zIndex: 9999 }} />
      <div onMouseDown={handleWindowEdgeResize('w')} style={{ position: 'fixed', top: 6, bottom: 6, left: 0, width: '4px', cursor: 'ew-resize', zIndex: 9999 }} />
      <div onMouseDown={handleWindowEdgeResize('e')} style={{ position: 'fixed', top: 6, bottom: 6, right: 0, width: '4px', cursor: 'ew-resize', zIndex: 9999 }} />
      <div onMouseDown={handleWindowEdgeResize('nw')} style={{ position: 'fixed', top: 0, left: 0, width: '8px', height: '8px', cursor: 'nwse-resize', zIndex: 10000 }} />
      <div onMouseDown={handleWindowEdgeResize('ne')} style={{ position: 'fixed', top: 0, right: 0, width: '8px', height: '8px', cursor: 'nesw-resize', zIndex: 10000 }} />
      <div onMouseDown={handleWindowEdgeResize('sw')} style={{ position: 'fixed', bottom: 0, left: 0, width: '8px', height: '8px', cursor: 'nesw-resize', zIndex: 10000 }} />
      <div onMouseDown={handleWindowEdgeResize('se')} style={{ position: 'fixed', bottom: 0, right: 0, width: '8px', height: '8px', cursor: 'nwse-resize', zIndex: 10000 }} />

      {/* 1. Titlebar */}
      <Titlebar
        currentProject={activeSession.projectName || (projects.length > 0 ? projects[0].name : '')}
        gitBranch={activeSession.gitBranch || (projects.length > 0 ? projects[0].gitBranch : '')}
        sessionTitle={activeSession.title}
        tokenStats={tokenStats}
        onOpenTokenAnalytics={() => setIsTokenAnalyticsOpen(true)}
      />

      {/* 2. Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ActivityBar (42px) */}
        <ActivityBar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLiveLogs={() => setIsLiveLogsOpen(true)}
        />

        {/* LeftPanel: Dynamic Modules with Dynamic Resizable Width & Ctrl+B Collapse */}
        {!isLeftDrawerCollapsed && (
          <LeftPanel
            width={leftPanelWidth}
            activeNav={activeNav}
            onOpenFile={handleOpenFile}
            projects={projects}
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={setCurrentSessionId}
            onNewGlobalSession={handleNewGlobalSession}
            onNewProjectSession={handleNewProjectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenDirectory={handleOpenDirectory}
            onRemoveProject={handleRemoveProject}
          />
        )}

        {/* Left Divider (Draggable, when not collapsed) */}
        {!isLeftDrawerCollapsed && (
          <div
            onMouseDown={() => setIsDraggingLeft(true)}
            onDoubleClick={() => setIsLeftDrawerCollapsed(true)}
            title="拖拽调节宽度，双击一键折叠 (Ctrl+B)"
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: isDraggingLeft ? 'var(--accent)' : 'transparent',
              zIndex: 40,
              transition: 'background 0.15s ease',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '1px',
              width: '1px',
              background: 'var(--border-subtle)'
            }} />
          </div>
        )}

        {/* ChatColumn (自适应宽幅: 填满剩余空间) */}
        <ChatColumn
          style={{ flex: 1, minWidth: '360px' }}
          rightWorkspaceOpen={rightWorkspaceOpen}
          onToggleWorkspace={() => setRightWorkspaceOpen(!rightWorkspaceOpen)}
          session={activeSession}
          sessions={sessions}
          sessionMessagesMap={sessionMessages}
          messages={messages}
          workMode={workMode}
          setWorkMode={setWorkMode}
          currentModel={currentModel}
          onSelectModel={handleSelectModel}
          permissionPolicy={permissionPolicy}
          setPermissionPolicy={setPermissionPolicy}
          isStreaming={isStreaming}
          onStopGeneration={handleStopGeneration}
          promptQueue={promptQueue}
          onWithdrawQueuedPrompt={handleWithdrawQueuedPrompt}
          onEditQueuedPrompt={handleEditQueuedPrompt}
          onMoveQueuedPrompt={handleMoveQueuedPrompt}
          onPreemptQueuedPrompt={handlePreemptQueuedPrompt}
          onSendMessage={handleSendMessage}
          onResolveOptions={handleResolveOptions}
          onForkMessage={handleForkSessionFromMessage}
          onNavigateDiff={(target) => {
            setRightWorkspaceOpen(true);
            setActiveDiffTarget({ ...target, highlightToken: `diff-${target.fileId}` });
          }}
        />

        {/* Right Divider (Draggable, when workbench open) */}
        {rightWorkspaceOpen && (
          <div
            onMouseDown={() => setIsDraggingRight(true)}
            onDoubleClick={() => setWorkbenchWidth(560)}
            title="双击恢复默认宽度，拖拽调节工作台宽度"
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: isDraggingRight ? 'var(--accent)' : 'transparent',
              zIndex: 40,
              transition: 'background 0.15s ease',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '1px',
              width: '1px',
              background: 'var(--border-subtle)'
            }} />
          </div>
        )}

        {/* EditorWorkspace (Dynamic Resizable Width & Diff Navigation) */}
        {rightWorkspaceOpen && (
          <div style={{ width: `${workbenchWidth}px`, flexShrink: 0, height: '100%', display: 'flex' }}>
            <EditorWorkspace
              isOpen={rightWorkspaceOpen}
              onClose={() => setRightWorkspaceOpen(false)}
              activeDiffTarget={activeDiffTarget}
            />
          </div>
        )}
      </div>

      {/* Global Command Hub & Quick File Switcher (Ctrl+P / Ctrl+Shift+P) */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        mode={paletteMode}
        onOpenFile={(path) => {
          setRightWorkspaceOpen(true);
        }}
        onRunAction={(actionId) => {
          if (actionId === 'run-ci') {
            setRightWorkspaceOpen(true);
          }
        }}
      />

      {/* Token Financial & ROI Analytics Modal */}
      <TokenAnalyticsModal
        isOpen={isTokenAnalyticsOpen}
        onClose={() => setIsTokenAnalyticsOpen(false)}
        tokenStats={tokenStats}
        currentModel={currentModel}
        messagesCount={messages.length}
      />

      {/* Real-Time Live Logs Drawer Modal */}
      <LiveLogsModal
        isOpen={isLiveLogsOpen}
        onClose={() => setIsLiveLogsOpen(false)}
        logs={liveLogs}
        onClearLogs={() => setLiveLogs([])}
      />

      {/* Global Settings & Preferences Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentAccentHex={accentHex}
        onSelectAccentHex={handleSelectAccentHex}
      />
    </div>
  );
};
export default App;
