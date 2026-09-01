import { RuntimeConfigResolver } from './services/runtimeConfigResolver';
import { taskGraphScheduler } from './services/taskGraphScheduler';
import { loadSavedExecutionMode, saveExecutionModeToStorage, migratePipelineMode, executionModeFromShortcut, buildModePromptSnippet, loadSessionExecutionMode, saveSessionExecutionMode, type ExecutionMode } from './services/executionMode';
import { createGateSuspensionFromBlock, createGateSuspension, resolveGateDecision, extractTaskBreakdown, extractSpecPath, shouldSuspendDynamicGraphPlanning, type GateSuspension, type StageGateDecision } from './services/stageGate';
import { sessionActorManager } from './services/sessionActorManager';
import { enqueueItem, withdrawItem, editItem, moveItem } from './services/promptQueueStore';
import { assembleCacheOptimizedMessages, recordCacheHitTelemetry, extractFileSymbols, buildCompactRepoMap, buildRepoMapFromTree, buildRepoMapFromFileContents, prioritizeActiveFiles, recordActiveFile, getActiveFiles } from './services/cacheEngine';
import { hostGateway } from './services/hostGateway';
import { requestSystemNotification, isWindowHidden, type SystemNotifyPayload } from './services/systemNotify';
import { SystemTaskNotification, type TaskNotificationData } from './components/SystemTaskNotification';
import { runSwarmChat } from './services/swarmChatExecutor';
import { createGatewayStreamChat } from './services/swarmGatewayStream';
import type { SwarmChatState } from './types/contracts';
import { parseAgentMessage } from './types/contracts';
import { getContextBudget, getContextTelemetry, compressModelContext } from './services/contextTelemetry';
// ────────────────────────────────────────────────────────────
// 🧠 CONTEXT TELEMETRY & SMART AUTO-COMPRESSION ENGINE
// ────────────────────────────────────────────────────────────

interface ContextBreakdown {
  totalRatio: number; // 0.0 - 1.0 (e.g., 0.42 = 42%)
  conversationPercent: number;
  toolsPercent: number;
  steeringPercent: number;
  statusLevel: 'normal' | 'suggest_compress' | 'auto_compress' | 'force_compress';
}

function calculateContextBreakdown(messages: ChatMessage[], maxContextTokens = 128000): ContextBreakdown {
  const rawChars = messages.reduce((acc, m) => acc + (m.content || '').length, 0);
  const estimatedTokens = Math.ceil(rawChars / 3.5);
  const totalRatio = Math.min(1.0, Math.max(0.01, estimatedTokens / maxContextTokens));
  const totalPercent = Math.round(totalRatio * 100);

  const conversationPercent = Math.max(1, Math.round(totalPercent * 0.95));
  const steeringPercent = 1;
  const toolsPercent = Math.max(0, totalPercent - conversationPercent - steeringPercent);

  let statusLevel: 'normal' | 'suggest_compress' | 'auto_compress' | 'force_compress' = 'normal';
  if (totalPercent >= 90) statusLevel = 'force_compress';
  else if (totalPercent >= 75) statusLevel = 'auto_compress';
  else if (totalPercent >= 60) statusLevel = 'suggest_compress';

  return { totalRatio, conversationPercent, toolsPercent, steeringPercent, statusLevel };
}

function smartCompressMessages(messages: ChatMessage[]): { compressed: ChatMessage[]; beforeTokens: number; afterTokens: number } {
  const beforeChars = messages.reduce((acc, m) => acc + (m.content || '').length, 0);
  const beforeTokens = Math.ceil(beforeChars / 3.5);

  // Strategy:
  // - Retain: System prompt, Initial User Goal, Most recent Agent Run & Verification, Unfinished items
  // - Compress: Strip heavy thinking text from older turns, prune intermediate repetitive feedback
  const compressed: ChatMessage[] = messages.map((m, idx) => {
    // Keep last 3 messages intact
    if (idx >= messages.length - 3) return m;

    let clean = m.content;
    // Strip <thinking> tags from historical turns
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    // Compress giant write_file blocks in historical messages
    clean = clean.replace(/```write_file:([^\n]+)\n([\s\S]{300,})```/gi, (_match, file) => {
      return `\`\`\`write_file:${file}\n// [历史执行已落盘代码，已智能压缩以节约上下文]\n\`\`\``;
    });

    return {
      ...m,
      content: clean.trim()
    };
  });

  const afterChars = compressed.reduce((acc, m) => acc + (m.content || '').length, 0);
  const afterTokens = Math.ceil(afterChars / 3.5);

  return { compressed, beforeTokens, afterTokens };
}

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
  AgentRoundItem,
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
  getAllAvailableModels,
  resolveInitialModel,
  forkSessionFromMessage,
  clampLeftPanelWidth,
  clampWorkbenchWidth,
  clampLeftPanelWithCollapse,
  DiffNavigationTarget,
  loadSavedProviders,
  loadSavedChannels,
  saveChannelsToStorage,
  loadSavedProjects,
  saveProjectsToStorage,
  resolveApiEndpoint,
  resolveCanonicalChannelEndpoint,
  loadSavedSessions,
  saveSessionsToStorage,
  loadSavedSessionMessages,
  saveSessionMessagesToStorage,
  saveCurrentModelToStorage,
  loadFromDiskStorageAsync,
  saveToDiskStorageAsync,
  STORAGE_KEYS,
  MentionContextItem,
  LiveLogItem,
  appendLiveLog,
  loadSavedAccentColor,
  AgentPendingAction,
  ActionResult,
  ProjectProfile,
  DEFAULT_PROJECT_PROFILE
} from './types/contracts';
import {
  detectProjectProfile,
  formatProfileForSystemPrompt,
  formatProfileBadge,
  getCachedProjectProfile
} from './services/projectProfiler';
import {
  buildMemoryPromptSnippet,
  extractMemoriesFromConversation,
  saveMemory
} from './services/memoryStore';
import {
  runFileDiagnostics,
  formatDiagnosticFeedback
} from './services/compilerDiagnostics';
import {
  AgentAction,
  ActionScopeTrust,
  createActionResult,
  formatExecutionFeedback as formatAgentExecutionFeedback,
  parseAgentActions,
  extractThinkingFallbackActions,
  hasIncompleteActionBlock,
  autoRepairIncompleteFences,
  shouldRequireActionApproval,
  parseAcceptanceCriteria,
  mergeAcceptanceCriteria,
  normalizeCriteriaKey,
  verifyTargetAcceptance,
  resolveNoActionLoopStatus,
  parseNativeToolCalls,
  TargetAcceptanceItem,
  ProgressVector,
  InternalStepTag,
  LoopTerminationStatus,
  isActualTestRunnerCommand,
  executeSandboxAction,
  resolveAllowedTools
} from './services/agentLoop';
import { buildPromptRulesSnapshot } from './services/rulesStore';
import { extractInteractiveOptions } from './services/interactiveOptions';
import { classifyUserIntent, buildDynamicSystemPrompt } from './services/intentClassifier';
import { buildTier1SkillsSystemPrompt } from './services/skillsEngine';
import { buildMcpToolsModelPrompt, loadSavedMcpConfigs, initializeMcpServer } from './services/mcpGateway';
import { classifyStreamTermination, describeStreamTermination } from './services/streamProtocol';
import { gatewayRuntime, platformForProvider, hasGatewayAccountsFor } from './services/gateway/gatewayRuntime';
import type { PreparedGatewayRequest } from './services/gateway/gateway';
import { estimateTokens, type GatewayMessage } from './services/gateway/transform';
import { addUsage } from './services/gateway/usage';
import type { TokenUsage } from './services/gateway/types';
import {
  buildGatewayRequestBody,
  buildModelCatalogEntry,
  parseGatewayEvent,
  resolveModelRoute,
  accumulateStreamedToolCalls,
  finalizeAccumulatedToolCalls
} from './services/modelGateway';

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
  // Apply saved theme accent color on launch & listen for open settings event
  React.useEffect(() => {
    const savedAccent = loadSavedAccentColor();
    if (savedAccent) {
      document.documentElement.style.setProperty('--accent', savedAccent);
      document.documentElement.style.setProperty('--accent-subtle', savedAccent + '1F');
    }
    const savedTheme = localStorage.getItem('tcode_theme_mode') || 'cream';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const handleThemeUpdate = (e: any) => {
      if (e.detail) {
        document.documentElement.setAttribute('data-theme', e.detail);
      }
    };
    window.addEventListener('tcode_theme_mode_updated', handleThemeUpdate);
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('tcode_open_settings', handleOpenSettings);
    return () => window.removeEventListener('tcode_open_settings', handleOpenSettings);
  }, []);

  // 💾 Disk Storage Hydration on launch (Restores Channels, API Keys, Sessions, Messages, Selected Model & Mode)
  React.useEffect(() => {
    async function hydrateAllFromDisk() {
      try {
        const [diskChannels, diskSessions, diskMessages, diskModelObj, diskPipelineMode, diskCurrentSessionId, diskProjects] = await Promise.all([
          loadFromDiskStorageAsync('tcode_channels_v2'),
          loadFromDiskStorageAsync(STORAGE_KEYS.SESSIONS),
          loadFromDiskStorageAsync(STORAGE_KEYS.SESSION_MESSAGES),
          loadFromDiskStorageAsync('codemind_current_model_obj'),
          loadFromDiskStorageAsync('tcode_pipeline_mode'),
          loadFromDiskStorageAsync('codemind_current_session_id'),
          loadFromDiskStorageAsync(STORAGE_KEYS.PROJECTS)
        ]);

        if (diskChannels && Array.isArray(diskChannels) && diskChannels.length > 0) {
          saveChannelsToStorage(diskChannels);
        }
        if (diskProjects && Array.isArray(diskProjects) && diskProjects.length > 0) {
          setProjects(diskProjects);
          localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(diskProjects));
        }
        if (diskSessions && Array.isArray(diskSessions) && diskSessions.length > 0) {
          setSessions(diskSessions);
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(diskSessions));
        }
        if (diskMessages && typeof diskMessages === 'object' && Object.keys(diskMessages).length > 0) {
          setSessionMessages(diskMessages);
          localStorage.setItem(STORAGE_KEYS.SESSION_MESSAGES, JSON.stringify(diskMessages));
        }
        if (diskModelObj && diskModelObj.id) {
          setCurrentModel(diskModelObj);
          localStorage.setItem('codemind_current_model_obj', JSON.stringify(diskModelObj));
          localStorage.setItem(STORAGE_KEYS.CURRENT_MODEL, JSON.stringify(diskModelObj));
        }
        if (diskPipelineMode && diskPipelineMode.mode) {
          localStorage.setItem('tcode_pipeline_mode', diskPipelineMode.mode);
          const migrated = migratePipelineMode(diskPipelineMode.mode);
          setExecutionMode(migrated);
          saveExecutionModeToStorage(migrated);
        }
        if (diskCurrentSessionId && typeof diskCurrentSessionId === 'string') {
          setCurrentSessionId(diskCurrentSessionId);
          localStorage.setItem('codemind_current_session_id', diskCurrentSessionId);
        }
      } catch (e) {
        console.warn('[DiskHydration] Failed to hydrate disk storage:', e);
      }
    }
    hydrateAllFromDisk();
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
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setRightWorkspaceOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Alt+1 / Alt+2 → execution mode switch (WP-B 模块一)
  React.useEffect(() => {
    const handleModeShortcut = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const next = executionModeFromShortcut(e.key, 'act');
      if (next) {
        e.preventDefault();
        setExecutionMode(next);
        saveExecutionModeToStorage(next);
        saveSessionExecutionMode(currentSessionId, next);
      }
    };
    window.addEventListener('keydown', handleModeShortcut);
    return () => window.removeEventListener('keydown', handleModeShortcut);
  }, []);

  // Keep App executionMode in sync with external dispatches (Capsule / settings)
  React.useEffect(() => {
    const handleModeEvent = (e: any) => {
      if (e.detail === 'act' || e.detail === 'graph') {
        setExecutionMode(e.detail);
      }
    };
    window.addEventListener('tcode_execution_mode_updated', handleModeEvent);
    return () => window.removeEventListener('tcode_execution_mode_updated', handleModeEvent);
  }, []);

  const [accentHex, setAccentHex] = useState('#D96B27');

  const handleSelectAccentHex = (hex: string) => {
    setAccentHex(hex);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-subtle', `${hex}1F`);
  };

  const [activeNav, setActiveNav] = useState('sessions');
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const savedSessionId = localStorage.getItem('codemind_current_session_id');
      const initialSessions = loadSavedSessions();
      if (savedSessionId && initialSessions.some(s => s.id === savedSessionId)) {
        return savedSessionId;
      }
      return initialSessions[0]?.id || 'session-1';
    } catch (e) {
      return 'session-1';
    }
  });

  React.useEffect(() => {
    if (currentSessionId) {
      try {
        localStorage.setItem('codemind_current_session_id', currentSessionId);
        saveToDiskStorageAsync('codemind_current_session_id', currentSessionId);
      } catch (e) {}
    }
    // 模块一 SessionExecutionState：切换会话时恢复该会话的执行模式。
    setExecutionMode(loadSessionExecutionMode(currentSessionId));
  }, [currentSessionId]);
  const [rightWorkspaceOpen, setRightWorkspaceOpen] = useState<boolean>(false);
  const [workMode, setWorkMode] = useState<WorkMode>('act');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => loadSavedExecutionMode());
  const [, setActorTick] = React.useState(0);
  const [swarmRunId, setSwarmRunId] = useState<string | undefined>(undefined);
  // WP-C: per-session runtime single source of truth -> re-render App on any actor change.
  React.useEffect(() => sessionActorManager.subscribe(() => setActorTick(t => t + 1)), []);
  const [sessionModelMap, setSessionModelMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('codemind_session_models_map');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const [currentModel, setCurrentModel] = useState<AIModelOption>(() =>
    resolveInitialModel(getAllAvailableModels())
  );
  React.useEffect(() => {
    const syncAvailableModel = () => {
      const all = getAllAvailableModels();
      setCurrentModel(previous => {
        const same = all.find(model => model.uniqueKey === previous.uniqueKey)
          || all.find(model => model.providerId === previous.providerId && model.id === previous.id);
        const next = same || all[0] || previous;
        if (next.contextLimit !== previous.contextLimit) {
          setTokenStats(stats => ({ ...stats, contextMaxTokens: next.contextLimit }));
        }
        return next;
      });
    };
    window.addEventListener('tcode_providers_updated', syncAvailableModel);
    window.addEventListener('storage', syncAvailableModel);
    return () => {
      window.removeEventListener('tcode_providers_updated', syncAvailableModel);
      window.removeEventListener('storage', syncAvailableModel);
    };
  }, []);

  const [permissionPolicy, setPermissionPolicy] = useState<PermissionPolicy>('autonomous_agent');

  // Agent Loop: Promise-based batch approval modal state & Scoped Trust map
  const [pendingApproval, setPendingApproval] = useState<{
    actions: AgentAction[];
    resolve: (decision: { approvedIds: string[]; trustGlob?: string }) => void;
  } | null>(null);
  const [scopedTrusts, setScopedTrusts] = useState<ActionScopeTrust[]>([]);
  const [activeAutoExecutedToast, setActiveAutoExecutedToast] = useState<{ count: number; glob: string } | null>(null);

  // 📐 Percentage & Pixel Synchronized Fluid Three-Column Layout (Left 20% | Chat 1fr | Workbench 30%)
  const [isLeftDrawerCollapsed, setIsLeftDrawerCollapsed] = useState<boolean>(false);
  const [leftPercent, setLeftPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('codemind_layout_left_percent');
      const val = saved ? parseFloat(saved) : 18;
      return (val >= 10 && val <= 35) ? val : 18;
    } catch (e) {
      return 18;
    }
  });

  const [workbenchPercent, setWorkbenchPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('codemind_layout_wb_percent');
      const val = saved ? parseFloat(saved) : 32;
      return (val >= 20 && val <= 50) ? val : 32;
    } catch (e) {
      return 32;
    }
  });

  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [activeDiffTarget, setActiveDiffTarget] = useState<DiffNavigationTarget | null>(null);
  const [activeFile, setActiveFile] = useState<{ path: string; name: string; line?: number } | null>(null);
  const [activeTaskNotification, setActiveTaskNotification] = useState<TaskNotificationData | null>(null);

  // Global window pointermove & pointerup listeners for 100% reliable dragging across Monaco/Iframe/Terminals
  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const totalWidth = window.innerWidth - 42; // exclude 42px ActivityBar
      if (totalWidth <= 0) return;

      if (isDraggingLeft) {
        const mouseX = e.clientX - 42;
        const rawPercent = (mouseX / totalWidth) * 100;
        if (rawPercent < 7) {
          setIsLeftDrawerCollapsed(true);
        } else {
          setIsLeftDrawerCollapsed(false);
          const clamped = Math.max(12, Math.min(35, Math.round(rawPercent * 10) / 10));
          setLeftPercent(clamped);
          try { localStorage.setItem('codemind_layout_left_percent', clamped.toString()); } catch (err) {}
        }
      } else if (isDraggingRight) {
        const rightPx = window.innerWidth - e.clientX;
        const rawPercent = (rightPx / totalWidth) * 100;
        const clamped = Math.max(20, Math.min(50, Math.round(rawPercent * 10) / 10));
        setWorkbenchPercent(clamped);
        try { localStorage.setItem('codemind_layout_wb_percent', clamped.toString()); } catch (err) {}
      }
    };

    const onPointerUp = () => {
      if (isDraggingLeft) setIsDraggingLeft(false);
      if (isDraggingRight) setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  // OS 原生通知点击唤醒会话（宿主 evaluate_js 分发 tcode_activate_session）
  React.useEffect(() => {
    const handleActivateSession = (e: any) => {
      const sessionId = e?.detail?.sessionId;
      if (sessionId) {
        setCurrentSessionId(sessionId);
      }
    };
    window.addEventListener('tcode_activate_session', handleActivateSession);
    return () => window.removeEventListener('tcode_activate_session', handleActivateSession);
  }, []);

  const handleLeftPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLeft(true);
  };

  const handleRightPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRight(true);
  };

  const handleResetLayout = () => {
    setLeftPercent(18);
    setWorkbenchPercent(32);
    setIsLeftDrawerCollapsed(false);
    try {
      localStorage.setItem('codemind_layout_left_percent', '18');
      localStorage.setItem('codemind_layout_wb_percent', '32');
    } catch (err) {}
    setActiveAutoExecutedToast({ count: 1, glob: '已恢复默认三栏比例：左侧 18% ｜ 对话 50% ｜ 工作台 32%' });
    setTimeout(() => setActiveAutoExecutedToast(null), 3000);
  };

  // Multi-Project Groups (Clean initial state, loaded from local storage)
  const [projects, setProjects] = useState<ProjectGroup[]>(loadSavedProjects());

  // Dynamically register workspace roots with desktop host path sandbox
  const syncWorkspaceRootsToHost = React.useCallback((targetProjects?: ProjectGroup[]) => {
    const projs = targetProjects || projects;
    const paths = (projs || []).map(p => p.path).filter(Boolean) as string[];
    if (paths.length > 0 && typeof window !== 'undefined' && window.location.protocol === 'http:') {
      import('../src/services/hostClient').then(({ hostFetch }) =>
        hostFetch('/api/workspace/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths })
        }).catch(() => {})
      );
    }
  }, [projects]);

  // Register persisted workspace roots with the desktop host (path sandbox)
  React.useEffect(() => {
    syncWorkspaceRootsToHost(projects);
  }, [projects, syncWorkspaceRootsToHost]);


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

  // Context Epoch Lifecycle Map (Archived message IDs, summary tokens, epoch index per session)
  const [contextEpochMap, setContextEpochMap] = useState<Record<string, { epochIndex: number; archivedMessageIds: string[]; summaryTokens: number }>>(() => {
    try {
      const raw = localStorage.getItem('codemind_context_epochs');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  // 🧠 Single Source of Truth: Synchronize real Token telemetry and context percentage dynamically
  React.useEffect(() => {
    const curMsgs = sessionMessages[currentSessionId] || [];
    const limit = currentModel?.contextLimit || 131072;
    const activeEpoch = contextEpochMap[currentSessionId];
    const budget = getContextBudget(curMsgs, limit, 16384, 4096, activeEpoch);

    setTokenStats(prev => ({
      ...prev,
      contextCurrentTokens: (activeEpoch && activeEpoch.epochIndex > 1) ? budget.epochTurnTokens : budget.effectiveInputTokens,
      contextMaxTokens: budget.availableInputTokens,
      promptTokens: Math.max(prev.promptTokens, budget.breakdown.conversationTokens),
      completionTokens: Math.max(prev.completionTokens, budget.breakdown.toolsTokens)
    }));
  }, [sessionMessages, currentSessionId, currentModel, contextEpochMap]);
  const [promptQueues, setPromptQueues] = useState<Record<string, QueuedPromptItem[]>>({});
  const promptQueuesRef = React.useRef<Record<string, QueuedPromptItem[]>>({});
  promptQueuesRef.current = promptQueues;

  const handleExecutionModeChange = (mode: ExecutionMode) => {
    setExecutionMode(mode);
    saveExecutionModeToStorage(mode);
    saveSessionExecutionMode(currentSessionId, mode);
  };

  const handleGateDecision = (decision: StageGateDecision) => {
    sessionActorManager.resolveGate(currentSessionId, decision);
  };

  // WP-C: stop targets only the active session (aborts its stream + resolves pending gate as terminate).
  const handleStopGeneration = () => {
    sessionActorManager.abortSession(currentSessionId);
    if (pendingApproval) {
      pendingApproval.resolve({ approvedIds: [] });
      setPendingApproval(null);
    }
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
    const totalTokens = promptTokens + completionTokens + kv.totalCacheHitTokens;
    
    const costUsd = Number(((promptTokens * 0.0000008) + (completionTokens * 0.000002) - (kv.totalCacheHitTokens * 0.00000072)).toFixed(4));
    
    setTokenStats({
      totalTokens: Math.max(totalTokens, kv.prefixTokens),
      promptTokens: Math.max(promptTokens, kv.prefixTokens),
      completionTokens: completionTokens,
      cacheHitTokens: kv.totalCacheHitTokens,
      cacheWriteTokens: kv.prefixTokens,
      estimatedCostUsd: Math.max(0.001, costUsd),
      // Keep overflow visible in the titlebar analytics; do not flatten it to the model limit.
      contextCurrentTokens: promptTokens + completionTokens,
      contextMaxTokens: currentModel.contextLimit || 128000
    });
  }, [messages, currentModel]);

  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  // Active session's stage gate (per-session via SessionActorManager).
  const activeGate = sessionActorManager.getSessionRuntime(activeSession?.id)?.gate ?? null;

  // Autonomous Project & Host Environment Profile State
  const [projectProfile, setProjectProfile] = useState<ProjectProfile>(DEFAULT_PROJECT_PROFILE);
  React.useEffect(() => {
    const wsPath = activeSession?.projectPath || '';
    detectProjectProfile(wsPath).then(prof => {
      setProjectProfile(prof);
    });
  }, [activeSession?.projectPath]);

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
    syncWorkspaceRootsToHost(updatedProjects);

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
      syncWorkspaceRootsToHost(updated);
      return updated;
    });
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    try {
      localStorage.setItem('codemind_current_session_id', id);
      const raw = localStorage.getItem('codemind_session_models_map');
      const map = raw ? JSON.parse(raw) : {};
      const boundModelId = map[id] || localStorage.getItem('codemind_current_model_id');
      if (boundModelId) {
        const all = getAllAvailableModels();
        let targetModel = all.find((m: AIModelOption) => m.uniqueKey === boundModelId || m.id === boundModelId);
        // Fallback: try partial id match or name match
        if (!targetModel) {
          targetModel = all.find((m: AIModelOption) => m.id.includes(boundModelId) || boundModelId.includes(m.id));
        }
        if (targetModel) {
          setCurrentModel(targetModel);
          localStorage.setItem('codemind_current_model_obj', JSON.stringify(targetModel));
          setTokenStats(prev => ({
            ...prev,
            contextMaxTokens: targetModel!.contextLimit
          }));
        }
      }
    } catch (e) {}
  };

  const handleSelectModel = (model: AIModelOption) => {
    setCurrentModel(model);
    try {
      saveCurrentModelToStorage(model);
      setSessionModelMap(prev => {
        const updated = { ...prev, [currentSessionId]: model.uniqueKey || model.id };
        localStorage.setItem('codemind_session_models_map', JSON.stringify(updated));
        saveToDiskStorageAsync('codemind_session_models_map', updated);
        return updated;
      });
    } catch (e) {}

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

  const handleOpenFile = (filePath: string, fileName?: string, line?: number) => {
    const derivedName = fileName || filePath.split(/[/\\]/).pop() || filePath;
    setActiveFile({ path: filePath, name: derivedName, line });
    if (!rightWorkspaceOpen) {
      setRightWorkspaceOpen(true);
    }
    setActiveAutoExecutedToast({
      count: 1,
      glob: `已在右侧工作台打开：${derivedName}${line ? ` · 第 ${line} 行` : ''}`
    });
    setTimeout(() => setActiveAutoExecutedToast(null), 3000);
    addLog('INFO', 'Workspace', `[文件直达] 已在工作台打开 ${filePath} (目标行: ${line || 1})`);
  };

  const handleEnqueuePrompt = (sessionId: string, text: string, mentions?: MentionContextItem[]) => {
    const newItem: QueuedPromptItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: Date.now(),
      selectedMentions: mentions
    };
    setPromptQueues(prev => ({ ...prev, [sessionId]: enqueueItem(prev[sessionId] || [], newItem) }));
    addLog('INFO', 'QueueBus', `[队列注入] 会话 ${sessionId} 新增等待问答任务: ${text.slice(0, 30)}...`);
  };

  const handleWithdrawQueuedPrompt = (sessionId: string, id: string) => {
    setPromptQueues(prev => ({ ...prev, [sessionId]: withdrawItem(prev[sessionId] || [], id) }));
    addLog('INFO', 'QueueBus', `[队列撤回] 成功撤回任务 [${id}]`);
  };

  const handleEditQueuedPrompt = (sessionId: string, id: string, newText: string) => {
    setPromptQueues(prev => ({ ...prev, [sessionId]: editItem(prev[sessionId] || [], id, newText) }));
    addLog('INFO', 'QueueBus', `[队列更新] 任务 [${id}] 内容已更新`);
  };

  const handleMoveQueuedPrompt = (sessionId: string, index: number, direction: -1 | 1) => {
    setPromptQueues(prev => ({ ...prev, [sessionId]: moveItem(prev[sessionId] || [], index, direction) }));
  };

  const handlePreemptQueuedPrompt = (sessionId: string, id: string) => {
    const queue = promptQueuesRef.current[sessionId] || [];
    const item = queue.find(q => q.id === id);
    if (!item) return;
    addLog('WARN', 'QueueBus', `[队列顶替] 立即打断当前问答，强行置顶执行任务: ${item.text.slice(0, 30)}...`);
    handleStopGeneration();
    setPromptQueues(prev => ({ ...prev, [sessionId]: withdrawItem(prev[sessionId] || [], id) }));
    setTimeout(() => {
      handleSendMessage(item.text, item.selectedMentions);
    }, 150);
  };


  // ══════════════════════════════════════════════════════════════════
  // Agent Loop Engine — Think → Execute → Observe → Continue
  // ══════════════════════════════════════════════════════════════════

  const parseActionsFromContent = parseAgentActions;

  // Execute one parsed action on the host via unified HostGateway with Mode Policy, SandboxGuard & SecurityShield.
  const executeActionOnHost = async (action: AgentAction, runMode: WorkMode = 'act'): Promise<ActionResult> => {
    const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
    const cwd = activeSession?.projectPath;

    if (action.target) {
      recordActiveFile(action.target);
    }
    if (action.type === 'read_file') {
      const res = await hostGateway.readFile(action.target, { cwd });
      return res.success && res.content !== undefined
        ? createActionResult(action, 'success', { output: res.content, fileSize: res.content.length })
        : createActionResult(action, 'failed', { error: res.error || '读取文件失败' });
    }

    if (action.type === 'write_file') {
      const res = await hostGateway.writeFile(action.target, action.code, { mode: runMode, cwd });
      return res.success
        ? createActionResult(action, 'success', { fileSize: res.size })
        : createActionResult(action, 'failed', { error: res.error || '写入失败' });
    }

    const execRes = await hostGateway.executeCommand(action.code, { cwd, mode: runMode });
    return createActionResult(action, execRes.success ? 'success' : 'failed', {
      output: execRes.stdout,
      error: execRes.stderr || execRes.error,
      exitCode: execRes.exitCode
    });
  };

  const formatExecutionFeedback = formatAgentExecutionFeedback;

  // Batch approval for all actions in current Agent Loop turn
  const requestBatchApproval = (actions: AgentAction[]): Promise<{ approvedIds: string[]; trustGlob?: string }> => {
    return new Promise((resolve) => {
      setPendingApproval({
        actions,
        resolve
      });
    });
  };

  const handleBatchApprovalDecision = (decision: { approvedIds: string[]; trustGlob?: string }) => {
    if (pendingApproval) {
      if (decision.trustGlob) {
        setScopedTrusts(prev => [...prev, { actionType: '*', pathGlob: decision.trustGlob! }]);
      }
      pendingApproval.resolve(decision);
      setPendingApproval(null);
    }
  };

  const handleRollbackToCheckpoint = async (checkpointRef: string, messageId: string) => {
    const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
    try {
      addLog('INFO', 'GitPlumbing', `正在回滚到快照 ${checkpointRef}...`);
      const res = await fetch('/api/git/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeSession.projectPath, ref: checkpointRef })
      });
      const data = await res.json();
      if (data.success) {
        // Rollback conversation state to this message
        setSessionMessages(prev => {
          const list = prev[currentSessionId] || [];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            const truncated = list.slice(0, idx + 1);
            saveSessionMessagesToStorage({ ...prev, [currentSessionId]: truncated });
            return { ...prev, [currentSessionId]: truncated };
          }
          return prev;
        });
        addLog('INFO', 'GitPlumbing', `✓ 成功回滚到 ${checkpointRef}，共恢复 ${data.restoredFiles?.length || 0} 个文件`);
      }
    } catch (e: any) {
      addLog('ERROR', 'GitPlumbing', `回滚失败: ${e.message}`);
    }
  };


  const handleSendMessage = async (
    text: string,
    mentions?: MentionContextItem[],
    images?: Array<{ id: string; name: string; dataUrl: string; sizeBytes?: number }>
  ) => {
    if (!text.trim() && (!images || images.length === 0)) return;
    if (sessionActorManager.isSessionRunning(currentSessionId)) {
      handleEnqueuePrompt(currentSessionId, text, mentions);
      return;
    }

    // Model Gateway v2 state (hoisted for the shared error handler)
    let gatewayPrepared: PreparedGatewayRequest | null = null;
    let streamedUsage: TokenUsage | undefined;
    let controller: AbortController | null = null;

    // 🎯 Target-Driven Agent Loop State
    let loopCount = 0;
    let completedWithTarget = false;
    sessionActorManager.startSession(currentSessionId);
    const allowLowRiskInSession = false;

    // Track active target acceptance criteria, step tags & progress history
    let activeAcceptanceItems: TargetAcceptanceItem[] = [];
    const stepTags: InternalStepTag[] = [];
    const progressHistory: ProgressVector[] = [];
    let currentLoopStatus: LoopTerminationStatus = 'running';
    let terminationSummaryText = '';

    const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
    let createdCheckpointRef: string | undefined = undefined;

    // Create Git Plumbing Shadow Snapshot before conversational turn begins
    if (activeSession.projectPath) {
      try {
        const turnIdx = (sessionMessages[currentSessionId] || []).filter(m => m.role === 'user').length + 1;
        const cpRes = await fetch('/api/git/checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath: activeSession.projectPath,
            sessionId: currentSessionId,
            turnIndex: turnIdx,
            summary: text.slice(0, 40)
          })
        });
        const cpData = await cpRes.json();
        if (cpData.success && cpData.ref) {
          createdCheckpointRef = cpData.ref;
          addLog('INFO', 'GitPlumbing', `[Checkpoint] 建立快照: ${cpData.ref}`);
        }
      } catch (e) {}
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      images,
      timestamp: Date.now(),
      permissionPolicy,
      checkpointRef: createdCheckpointRef,
      turnIndex: (sessionMessages[currentSessionId] || []).filter(m => m.role === 'user').length + 1
    };

    const streamingModel = { ...currentModel };
    const frozenRunMode = workMode; // ❄️ Freeze mode for this entire Agent Run

    // Keep a synchronous loop-local history; React state is display/persistence only.
    const conversationSnapshot: ChatMessage[] = [...(sessionMessages[currentSessionId] || []), userMsg];
    setSessionMessages(prev => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), userMsg]
    }));

    const callStartTime = performance.now();

    // Build contextualized user content (mentions + auto-inspection)
    let contextualizedUserContent = text;
    try {
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

      // Auto Project Context Inspection
      const isAskingAboutProject = /项目|工程|架构|代码|优化|审查|文件|分析/i.test(text);
      let autoInspectedFiles = '';
      if (isAskingAboutProject && activeSession.projectPath) {
        try {
          const treeRes = await fetch(`/api/fs/tree?path=${encodeURIComponent(activeSession.projectPath)}`);
          const treeData = await treeRes.json();
          if (treeData.success && treeData.tree) {
            autoInspectedFiles += `\n[工程实时目录拓扑]:\n${JSON.stringify(treeData.tree.map((n: any) => ({ name: n.name, type: n.type })), null, 2)}`;
          }
          const pkgRes = await fetch(`/api/fs/read?path=${encodeURIComponent(activeSession.projectPath + '/package.json')}`);
          const pkgData = await pkgRes.json();
          if (pkgData.success && pkgData.content) {
            autoInspectedFiles += `\n\n[工程核心配置 package.json]:\n\`\`\`json\n${pkgData.content.slice(0, 3000)}\n\`\`\``;
          }
          const readmeRes = await fetch(`/api/fs/read?path=${encodeURIComponent(activeSession.projectPath + '/README.md')}`);
          const readmeData = await readmeRes.json();
          if (readmeData.success && readmeData.content) {
            autoInspectedFiles += `\n\n[工程简介 README.md]:\n\`\`\`markdown\n${readmeData.content.slice(0, 3000)}\n\`\`\``;
          }
        } catch (e) {}
      }
      if (autoInspectedFiles && !contextualizedUserContent.includes('--- 上下文工程数据 ---')) {
        contextualizedUserContent = `${text}\n\n--- 自动探查的本地工程上下文 ---${autoInspectedFiles}`;
      }
    } catch (e) {}

    // WP-D 模块七：RepoMap 骨架注入（<2k tokens，前缀字节级稳定，KV-Cache 命中保障）
    let repoMapText = '';
    if (activeSession.projectPath) {
      try {
        const treeRes = await fetch(`/api/fs/tree?path=${encodeURIComponent(activeSession.projectPath)}`);
        const treeData = await treeRes.json();
        if (treeData.success && Array.isArray(treeData.tree)) {
          const selected = prioritizeActiveFiles(buildRepoMapFromTree(treeData.tree, 40), getActiveFiles(), 40).slice(0, 12);
          const contents: Array<{ filePath: string; content: string }> = [];
          for (const f of selected) {
            try {
              const fr = await fetch(`/api/fs/read?path=${encodeURIComponent(activeSession.projectPath + '/' + f.filePath)}`);
              const fd = await fr.json();
              if (fd.success && typeof fd.content === 'string') {
                contents.push({ filePath: f.filePath, content: fd.content.slice(0, 8000) });
              }
            } catch (e) {}
          }
          repoMapText = buildRepoMapFromFileContents(contents);
          if (repoMapText) {
            addLog('INFO', 'RepoMap', `[Cache] 注入工程骨架图谱 ${selected.length} 文件 / ${Math.round(repoMapText.length / 4)} tokens`);
          }
        }
      } catch (e) {}
    }

    // 📜 Build active rules snapshot to inject into system prompt
    const { rulesSnapshotText, activeCount, snapshotId } = buildPromptRulesSnapshot();

    // 📦 Tier 1 Skills Progressive Disclosure (name + description only)
    const skillsPromptSnippet = buildTier1SkillsSystemPrompt();

    // 🔌 Active MCP Tools Model Function Schema
    const mcpConfigs = loadSavedMcpConfigs();
    const activeMcpRuntimes = await Promise.all(mcpConfigs.filter(c => c.enabled).map(c => initializeMcpServer(c)));
    const mcpToolsPromptSnippet = buildMcpToolsModelPrompt(activeMcpRuntimes);

    const modePromptSnippet = buildModePromptSnippet(executionMode);

    // 🖥️ Autonomous Host Environment & Project Stack Fingerprint
    const profile = await detectProjectProfile(activeSession.projectPath);
    setProjectProfile(profile);
    const profilePromptSnippet = formatProfileForSystemPrompt(profile);
    const memoryPromptSnippet = buildMemoryPromptSnippet();
    // 🎯 Dynamic User Intent Classification & Prompt Optimization
    const userIntent = classifyUserIntent(text, executionMode);
    addLog('INFO', 'IntentEngine', `[意图分析] 用户意图识别为: ${userIntent.summary} (类型: ${userIntent.type}, 模式: ${executionMode})`);
    const systemPrompt = buildDynamicSystemPrompt({
      intent: userIntent,
      projectName: activeSession.projectName,
      projectPath: activeSession.projectPath,
      gitBranch: activeSession.gitBranch,
      workMode,
      executionMode,
      profileSnippet: profilePromptSnippet,
      memorySnippet: memoryPromptSnippet,
      rulesSnippet: rulesSnapshotText,
      skillsSnippet: skillsPromptSnippet,
      mcpSnippet: mcpToolsPromptSnippet
    });

    try {
      // ── Single Agent Run Card ID (All turns & steps aggregate into one Card) ──
      const singleRunCardId = `agent-run-${Date.now()}`;
      let accumulatedActionResults: ActionResult[] = [];
      let lastAssistantContent = '';
      let consecutiveEmptyActionCount = 0;

      // Initial single assistant message container with rounds[]
      let accumulatedRounds: AgentRoundItem[] = [];
      const isSwarmRun = executionMode === 'swarm';
      // 角色由 Master 拆解后动态决定，初始为空（UI 显示拆解中状态）
      const initialSwarm: SwarmChatState = {
        phase: 'planning',
        masterPlanning: '',
        roles: [],
        masterSummary: '',
      };
      const runCardMsg: ChatMessage = {
        id: singleRunCardId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        auditTag: isSwarmRun
          ? '🐝 Swarm 团队协同 (多角色并发)'
          : userIntent.type === 'greeting'
          ? '👋 智能问候'
          : userIntent.type === 'chat_qa'
          ? '💬 问答咨询'
          : `⚡ Agent Loop · 极速执行 (${frozenRunMode})`,
        permissionPolicy,
        stepTags: [],
        acceptanceItems: [],
        rounds: [],
        activeRoundId: 1,
        ...(isSwarmRun ? { swarm: initialSwarm } : {})
      };

      conversationSnapshot.push(runCardMsg);
      setSessionMessages(prev => ({
        ...prev,
        [currentSessionId]: [...(prev[currentSessionId] || []), runCardMsg]
      }));

      // ── Swarm 真并发多角色分支（结构化协议：Master 拆解 -> 4 角色并发 -> Master 终审） ──
      if (isSwarmRun) {
        let swarmState: SwarmChatState = {
          phase: 'planning',
          masterPlanning: '',
          roles: [],
          masterSummary: '',
        };
        // 每次增量同步到会话卡片（不可变更新，保证 React 重新渲染）
        const syncSwarmCard = () => {
          const cardId = singleRunCardId;
          setSessionMessages(prev => ({
            ...prev,
            [currentSessionId]: (prev[currentSessionId] || []).map(m =>
              m.id === cardId ? { ...m, swarm: { ...swarmState, roles: swarmState.roles.map(r => ({ ...r })) } } : m
            ),
          }));
        };
        controller = new AbortController();
        sessionActorManager.setAbortController(currentSessionId, controller);
        const streamChat = createGatewayStreamChat({
          streamingModel,
          sessionKey: currentSessionId,
          gatewayRuntime,
          hasGatewayAccountsFor,
          platformForProvider,
          loadSavedProviders,
          loadSavedChannels,
          buildModelCatalogEntry,
          resolveModelRoute,
          buildGatewayRequestBody,
          parseGatewayEvent,
          resolveApiEndpoint,
          addLog,
        });
        const finalState = await runSwarmChat(
          {
            userGoal: contextualizedUserContent,
            contextSnapshotMarkdown: activeSession.projectPath
              ? `项目: ${activeSession.projectName} (${activeSession.projectPath})\n分支: ${activeSession.gitBranch || 'main'}`
              : '',
            modelId: streamingModel.id,
            signal: controller?.signal,
            streamChat,
            sessionId: currentSessionId,
            runId: singleRunCardId,
          },
          {
            onMasterPlanning: (planning) => {
              swarmState = { ...swarmState, phase: 'planning', masterPlanning: planning };
              syncSwarmCard();
            },
            onMasterPlanningDelta: (delta) => {
              // Master 拆解逐字流式上屏
              swarmState = { ...swarmState, phase: 'planning', masterPlanning: swarmState.masterPlanning + delta };
              syncSwarmCard();
            },
            onRolesSelected: (roles) => {
              // Master 已按任务动态组队：进入角色并发阶段，投影实际选中角色卡片
              swarmState = { ...swarmState, phase: 'roles', roles };
              syncSwarmCard();
            },
            onRoleStatus: (roleId, status, error) => {
              swarmState = { ...swarmState, roles: swarmState.roles.map(r => (r.id === roleId ? { ...r, status, error } : r)) };
              syncSwarmCard();
            },
            onRoleDelta: (roleId, delta) => {
              swarmState = { ...swarmState, roles: swarmState.roles.map(r => (r.id === roleId ? { ...r, content: r.content + delta } : r)) };
              syncSwarmCard();
            },
            onRoleIntervention: () => {
              // Master 已更新角色的 revisions/interventions，仅需重新同步卡片
              syncSwarmCard();
            },
            onMasterSummary: (summary) => {
              swarmState = { ...swarmState, phase: 'summary', masterSummary: summary };
              syncSwarmCard();
            },
            onMasterSummaryDelta: (delta) => {
              // Master 终审逐字流式上屏
              swarmState = { ...swarmState, phase: 'summary', masterSummary: swarmState.masterSummary + delta };
              syncSwarmCard();
            },
          },
        );
        lastAssistantContent = finalState.masterSummary || finalState.masterPlanning || '';
        // 最终状态落盘（持久化到磁盘）
        setSessionMessages(prev => {
          const list = prev[currentSessionId] || [];
          const next = list.map(m => (m.id === singleRunCardId ? { ...m, swarm: finalState } : m));
          saveSessionMessagesToStorage({ ...prev, [currentSessionId]: next });
          return { ...prev, [currentSessionId]: next };
        });
      }

      // ── Target-Driven Agent Loop: Understand → Breakdown → Act → Verify → Closed-loop Done ──
      while (!isSwarmRun && sessionActorManager.isSessionRunning(currentSessionId)) {
        loopCount++;
        sessionActorManager.bumpLoop(currentSessionId);
        const assistantId = singleRunCardId;

        // Initialize incremental streaming round for loopCount
        const currentStreamingRound: AgentRoundItem = {
          roundId: loopCount,
          // 创建时不确定本轮动作，使用中性标题；轮次结束后依据真实 actions 动态更新
          title: `第 ${loopCount} 轮`,
          status: 'running',
          phase: loopCount === 1 ? 'inspect' : 'modify',
          content: '',
          thinkingText: '',
          timestamp: Date.now()
        };
        accumulatedRounds = [...accumulatedRounds.filter(r => r.roundId !== loopCount), currentStreamingRound];

        // 🧠 Unified Context Budget Check (Using actual currentModel.contextLimit)
        const limit = streamingModel.contextLimit || 131072;
        const activeEpoch = contextEpochMap[currentSessionId];
        const budgetBefore = getContextBudget(conversationSnapshot, limit, 16384, 4096, activeEpoch);
        let modelFeedMessages = conversationSnapshot;

        if (budgetBefore.isCompressed || budgetBefore.usagePercent >= 85) {
          const compressRes = compressModelContext(conversationSnapshot, limit);
          modelFeedMessages = compressRes.compressed;

          const rawK = (compressRes.rawTokens / 1000).toFixed(1);
          const effK = (compressRes.effectiveTokens / 1000).toFixed(1);
          const savedK = (compressRes.savedTokens / 1000).toFixed(1);
          const nextEpochIndex = (activeEpoch?.epochIndex || 1) + 1;

          // Establish new Context Epoch with 0% baseline
          const newEpochData = {
            epochIndex: nextEpochIndex,
            archivedMessageIds: conversationSnapshot.slice(0, -2).map(m => m.id),
            summaryTokens: compressRes.effectiveTokens
          };

          setContextEpochMap(prev => {
            const updated = { ...prev, [currentSessionId]: newEpochData };
            try { localStorage.setItem('codemind_context_epochs', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });

          setActiveAutoExecutedToast({
            count: 1,
            glob: `🍃 上下文已重新建立 (Epoch #${nextEpochIndex}) · 旧历史已归档，新上下文从 0% 起步`
          });
          setTimeout(() => setActiveAutoExecutedToast(null), 4000);
          addLog('INFO', 'ContextEngine', `[Context Epoch #${nextEpochIndex}] 旧上下文归档 (${rawK}k ➔ 摘要 ${effK}k)，新上下文以 0% 重新起步计算，UI 完整历史永久保留。`);
        }

        const historicalTurns = modelFeedMessages
          .filter(m => m.content && m.content.trim() && m.id !== assistantId && !m.isAgentFeedback)
          .slice(-8)
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.id === userMsg.id && loopCount === 1 ? contextualizedUserContent : m.content
          }));

        // Include all previous completed rounds within this current Run card:
        const currentRunRoundsHistory: { role: 'user' | 'assistant'; content: string }[] = [];
        accumulatedRounds.forEach(r => {
          if (r.roundId < loopCount && r.content) {
            currentRunRoundsHistory.push({ role: 'assistant', content: r.content });
            const matchingFeedback = conversationSnapshot.find(m => m.isAgentFeedback && m.auditTag?.includes(`Step #${r.roundId}`));
            if (matchingFeedback) {
              currentRunRoundsHistory.push({ role: 'user', content: matchingFeedback.content });
            }
          }
        });

        const cleanHistory = [
          ...historicalTurns,
          ...currentRunRoundsHistory
        ];

        const dynamicSystemPrompt = systemPrompt;

        const apiMessages = assembleCacheOptimizedMessages({
          baseSystemPrompt: dynamicSystemPrompt,
          staticRulesText: '',
          repoMapText,
          immutableHistory: cleanHistory
        });

        let requestUrl: string;
        let requestHeaders: Record<string, string>;
        let requestBody: string;
        let route: any;

        // ── Priority 1: New-API Channels routing (Highest precedence, uses user-configured API Keys) ──
        const savedChannels = loadSavedChannels().filter(c => c.status === 'active' || c.status === 'untested');
        const channel = savedChannels.find(c => c.id === streamingModel.providerId)
          || savedChannels.find(c => c.models?.includes(streamingModel.id))
          || (streamingModel.uniqueKey ? savedChannels.find(c => streamingModel.uniqueKey?.startsWith(c.id + ':')) : undefined)
          || savedChannels[0];

        if (channel) {
          const baseUrl = channel.baseUrl.trim();
          const targetModel = channel.modelMapping?.[streamingModel.id] || streamingModel.id;
          const fullEndpoint = resolveCanonicalChannelEndpoint(baseUrl, channel.type);
          const { url, headers } = resolveApiEndpoint(fullEndpoint);
          requestUrl = url;
          requestHeaders = {
            'Content-Type': 'application/json',
            ...headers
          };
          if (channel.key?.trim()) {
            const firstKey = channel.key.trim().split('\n')[0].trim();
            requestHeaders['Authorization'] = `Bearer ${firstKey}`;
          } else if (channel.type !== 4) {
            throw new Error(`渠道 [${channel.name}] 尚未填写 API Key 凭据。请点击左下角 ⚙️ 首选项 ➔「模型服务商」编辑该渠道，填入您的 API Key 即可开始对话。`);
          }
          if (channel.headerOverride) {
            Object.assign(requestHeaders, channel.headerOverride);
          }
          route = {
            adapter: (channel.type === 14 ? 'anthropic-messages' : 'openai-compatible-chat') as any,
            endpointUrl: fullEndpoint,
            targetModel,
            authHeader: channel.key ? `Bearer ${channel.key.trim().split('\n')[0]}` : '',
            headers: requestHeaders,
            contextLimit: streamingModel.contextLimit || 128000
          };
          const standardTools = [
            {
              type: 'function',
              function: {
                name: 'run_command',
                description: '在用户 Windows 宿主电脑真实执行终端指令（PowerShell/CMD）。可用于探索目录 (Get-ChildItem -Path "..." -Force)、运行测试、查看文件等。',
                parameters: {
                  type: 'object',
                  properties: {
                    command: {
                      type: 'string',
                      description: '具体的终端指令，例如: Get-ChildItem -Path "D:\\weihu\\new-api" -Force'
                    }
                  },
                  required: ['command']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'read_file',
                description: '读取用户本地文件的文本内容。',
                parameters: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: '文件相对路径或绝对路径' }
                  },
                  required: ['path']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'write_file',
                description: '创建或覆写用户本地文件内容。',
                parameters: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: '目标文件相对路径或绝对路径' },
                    content: { type: 'string', description: '完整代码内容' }
                  },
                  required: ['path', 'content']
                }
              }
            }
          ];

          requestBody = JSON.stringify({
            model: targetModel,
            messages: apiMessages,
            stream: true,
            ...(executionMode === 'act' ? { tools: standardTools } : {}),
            ...(channel.paramOverride || {})
          });
          addLog('INFO', 'ChannelRouter', `[渠道调度] ${streamingModel.name} → 渠道 [${channel.name}] (Base URL: ${channel.baseUrl}, Key已注入) · ${fullEndpoint}`);
        } else {
          // ── Fallback 2: Model Gateway v2 multi-account / v1 fallback ──
          const gatewayPlatform = platformForProvider(streamingModel.providerId, streamingModel.id);
          gatewayPrepared = hasGatewayAccountsFor(gatewayPlatform)
            ? gatewayRuntime.facade.prepare({
                model: streamingModel.id,
                platform: gatewayPlatform,
                sessionKey: currentSessionId,
                messages: cleanHistory as GatewayMessage[],
                systemPrompt,
                contextLimit: streamingModel.contextLimit || 128000,
                defaultMaxOutputTokens: 8192
              })
            : null;

          if (gatewayPrepared) {
            requestUrl = gatewayPrepared.url;
            requestHeaders = gatewayPrepared.headers;
            requestBody = JSON.stringify(gatewayPrepared.body);
            route = {
              adapter: gatewayPrepared.adapter,
              endpointUrl: gatewayPrepared.url,
              apiKey: '',
              providerId: gatewayPlatform,
              modelId: streamingModel.id
            };
            addLog('INFO', 'GatewayV2', `[多账号调度] ${streamingModel.name} → 账号 ${gatewayPrepared.accountId} (${gatewayPrepared.decision.reason}) · ${gatewayPrepared.url}`);
          } else {
            const savedProviders = loadSavedProviders();
            const provider = savedProviders.find(p => p.id === streamingModel.providerId)
              || savedProviders.find(p => p.enabled && p.models?.some(m => m.id === streamingModel.id))
              || savedProviders.find(p => p.enabled && p.apiKey && p.baseUrl)
              || savedProviders[0];
            if (!provider) throw new Error('没有可用的模型服务商渠道');

            const targetModel = streamingModel.id;
            const catalogModel = provider.models?.find((model: any) => model.id === targetModel) || {
              id: targetModel,
              name: streamingModel.name,
              enabled: true,
              contextLimit: streamingModel.contextLimit,
              adapter: streamingModel.adapter,
              endpointPath: streamingModel.endpointPath,
              protocol: streamingModel.protocol,
              capabilities: []
            };
            const catalogEntry = buildModelCatalogEntry(provider, catalogModel);
            route = resolveModelRoute(provider, catalogEntry);
            const { url, headers } = resolveApiEndpoint(route.endpointUrl);
            requestUrl = url;
            requestHeaders = headers;
            requestBody = JSON.stringify(buildGatewayRequestBody(
              route,
              apiMessages as Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>
            ));
          }
        }

        controller = new AbortController();
        sessionActorManager.setAbortController(currentSessionId, controller);

        addLog('INFO', 'AgentLoop', `[Loop #${loopCount}] 调度模型 [${streamingModel.name}] · ${route.adapter} · ${route.endpointUrl}`);

        // ── Stream LLM Response with 429 Retry ──
        let accumulatedContent = '';
        let accumulatedThinking = '';
        let firstTokenAt: number | null = null;
        const roundStartTime = performance.now();
        const nativeToolCalls: Array<{ id: string; name?: string; arguments?: string }> = [];

        let response: Response | null = null;
        let retryCount = 0;
        while (retryCount < 3) {
          response = await fetch(requestUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...requestHeaders
            },
            body: requestBody
          });

          if (response.status === 429 && retryCount < 2) {
            addLog('WARN', 'RateLimiter', `[中转站频控熔断] 收到 429 Too Many Requests，正在等待 ${1000 * (retryCount + 1)}ms 后自动重试 (#${retryCount + 1})...`);
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            retryCount++;
            continue;
          }
          break;
        }

        if (!response || !response.ok) {
          let detail = `HTTP ${response?.status || 500}: ${response?.statusText || 'Fetch Failed'}`;
          try {
            const errJson = await response?.json();
            if (errJson?.error?.message) detail = `HTTP ${response?.status}: ${errJson.error.message}`;
            else if (errJson?.msg) detail = `HTTP ${response?.status}: ${errJson.msg}`;
            else if (errJson?.message) detail = `HTTP ${response?.status}: ${errJson.message}`;
          } catch (_) {}
          throw new Error(detail);
        }

        const reader = response.body?.getReader();

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let isFirstChunk = true;
        let streamFinished = false;
        let sawDoneSentinel = false;
        let sawFinishReason = false;
        let readerDone = false;
        let receivedAnyBytes = false;
        let toolProtocolError = false;
        const streamedToolCallsAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

        if (reader) {
          while (!streamFinished) {
            const { done, value } = await reader.read();
            if (done) {
              readerDone = true;
              break;
            }
            if (value && value.length > 0) {
              receivedAnyBytes = true;
            }
            buffer += decoder.decode(value, { stream: true });

            if (isFirstChunk && buffer.trim()) {
              isFirstChunk = false;
              if (!buffer.includes('data: ') && !buffer.includes('{')) {
                const upstreamError = buffer.trim();
                addLog('ERROR', 'GatewayBus', `上游模型网关错误: "${upstreamError}"`);
                throw new Error(`上游大模型服务商提示: "${upstreamError}"。当前模型通道不可用。`);
              }
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') {
                sawDoneSentinel = true;
                streamFinished = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const normalized = parseGatewayEvent(route.adapter, parsed);
                if (gatewayPrepared && parsed.usage) {
                  const u = parsed.usage;
                  streamedUsage = addUsage(streamedUsage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, {
                    inputTokens: Number(u.prompt_tokens ?? u.input_tokens ?? 0),
                    outputTokens: Number(u.completion_tokens ?? u.output_tokens ?? 0),
                    cacheReadTokens: Number(u.prompt_tokens_details?.cached_tokens ?? 0),
                    cacheWriteTokens: 0
                  });
                }
                if (normalized.toolCalls.length > 0) {
                  accumulateStreamedToolCalls(streamedToolCallsAccumulator, normalized.toolCalls);
                }
                if (normalized.reasoning) accumulatedThinking += normalized.reasoning;
                if (normalized.content) accumulatedContent += normalized.content;
                if (normalized.finished) {
                  sawFinishReason = true;
                  streamFinished = true;
                }

                if (normalized.reasoning || normalized.content) {
                  if (firstTokenAt === null) firstTokenAt = performance.now();
                  let currentDisplay = '';
                  if (accumulatedThinking && !accumulatedContent) {
                    currentDisplay = `<think>\n${accumulatedThinking}\n</think>\n\n*正在深入推演与分析代码架构...*`;
                  } else if (accumulatedThinking && accumulatedContent) {
                    currentDisplay = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
                  } else {
                    currentDisplay = accumulatedContent;
                  }

                  const streamingRounds = accumulatedRounds.map(r => r.roundId === loopCount ? {
                    ...r,
                    content: currentDisplay,
                    thinkingText: accumulatedThinking
                  } : r);
                  accumulatedRounds = streamingRounds;

                  setSessionMessages(prev => {
                    const list = prev[currentSessionId] || [];
                    const updated = list.map(m => m.id === assistantId ? {
                      ...m,
                      content: currentDisplay,
                      rounds: [...streamingRounds],
                      activeRoundId: loopCount
                    } : m);
                    return { ...prev, [currentSessionId]: updated };
                  });
                }
              } catch (error) {
                // P0: unparseable tool protocol must be surfaced, never silently swallowed.
                toolProtocolError = true;
                streamFinished = true;
                addLog('ERROR', 'StreamParser', `工具协议解析失败: ${error instanceof Error ? error.message : String(error)}`);
                break;
              }
            }
          }

          const termination = classifyStreamTermination({
            readerDone,
            sawDoneSentinel,
            sawFinishReason,
            aborted: controller.signal.aborted,
            emptyResponse: readerDone && !receivedAnyBytes,
            toolProtocolError
          });
          if (termination !== 'completed') {
            if (termination === 'cancelled') {
              throw new Error('用户已取消本次模型响应');
            }
            if (termination === 'stream_interrupted') {
              if (accumulatedContent.trim().length > 0 || accumulatedThinking.trim().length > 0) {
                if (hasIncompleteActionBlock(accumulatedContent)) {
                  accumulatedContent = autoRepairIncompleteFences(accumulatedContent);
                }
                addLog('WARN', 'StreamProtocol', `上游中转未发送[DONE]终止标头即关闭连接，已自动平滑修复代码块并保全已收到的回复。`);
              } else {
                throw new Error(`模型流异常: ${describeStreamTermination(termination)}`);
              }
            } else {
              throw new Error(`模型流异常: ${describeStreamTermination(termination)}`);
            }
          }
        } else {
          throw new Error(`模型流异常: ${describeStreamTermination('provider_empty_response')}`);
        }

        // Finalize streamed tool calls
        const finalizedToolCalls = finalizeAccumulatedToolCalls(streamedToolCallsAccumulator);
        if (finalizedToolCalls.length > 0) {
          nativeToolCalls.push(...finalizedToolCalls);
          addLog('INFO', 'ToolEngine', `[原生工具调用捕获] 成功拼接并识别到 ${finalizedToolCalls.length} 个流式工具调用: ${finalizedToolCalls.map(t => t.name).join(', ')}`);
        }

        // Finalize content
        let finalContent = '';
        if (accumulatedThinking && !accumulatedContent) {
          finalContent = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedThinking}`;
        } else if (accumulatedThinking && accumulatedContent) {
          finalContent = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
        } else {
          finalContent = accumulatedContent;
        }

        const roundDurationSec = parseFloat(((performance.now() - roundStartTime) / 1000).toFixed(1));
        addLog('NET', 'Gateway', `[Round #${loopCount}] 模型流式推理完成 -> 耗时: ${roundDurationSec}s, 正文: ${finalContent.length} 字符, 思维链: ${accumulatedThinking.length} 字符`);

        const cleanCheck = (accumulatedContent || accumulatedThinking || '').trim();
        const isServerBusyMessage = cleanCheck.length > 0 && cleanCheck.length < 150 && /server is busy|server is overloaded|服务器繁忙|服务繁忙|系统繁忙|try again later/i.test(cleanCheck);
        if (isServerBusyMessage) {
          addLog('WARN', 'Gateway', `[上游算力高峰排队] 检测到上游服务商返回: "${cleanCheck}"`);
          throw new Error(`上游模型服务商当前负载过高提示: "${cleanCheck}"。请直接按回车重新发送，或切换其他模型通道。`);
        }

        if (!finalContent.trim()) {
          finalContent = '已完成分析。请继续提出具体指令。';
        }

        runCardMsg.content = finalContent;

        if (firstTokenAt !== null) {
          const roundTtftMs = Math.max(0, Math.round(firstTokenAt - roundStartTime));
          setTokenStats(prev => ({ ...prev, ttftMs: roundTtftMs }));
        }

        // ── Gateway v2: token-level usage & billing ledger ──
        if (gatewayPrepared) {
          const usage = streamedUsage ?? {
            inputTokens: estimateTokens(accumulatedContent),
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0
          };
          gatewayRuntime.facade.recordCompletion({
            accountId: gatewayPrepared.accountId,
            downstreamKeyId: gatewayRuntime.keys.list()[0]?.key ?? '',
            model: streamingModel.id,
            sessionKey: currentSessionId,
            usage,
            status: 'ok'
          });
          gatewayRuntime.persist();
          if (streamedUsage) {
            recordCacheHitTelemetry(streamedUsage.inputTokens || 12000, streamedUsage.cacheReadTokens || Math.round((streamedUsage.inputTokens || 12000) * 0.88));
          }
        }

        // ── Parse target acceptance criteria and deduplicate/merge at Run level ──
        lastAssistantContent = finalContent;
        const incomingCriteria = parseAcceptanceCriteria(finalContent);
        // Preserve whether the model explicitly declared acceptance criteria before adding defaults.
        const hadExplicitAcceptanceCriteria = incomingCriteria.length > 0 || activeAcceptanceItems.length > 0;
        if (incomingCriteria.length > 0) {
          activeAcceptanceItems = mergeAcceptanceCriteria(activeAcceptanceItems, incomingCriteria);
        } else if (activeAcceptanceItems.length === 0) {
          // Default baseline criteria if model did not output explicit checklist on initial turn
          activeAcceptanceItems = [
            { id: 'crit-1', description: `实现并验证: ${text.slice(0, 30)}`, status: 'pending', evidenceDetails: [] },
            { id: 'crit-2', description: '单元测试与类型检查通过', status: 'pending', evidenceDetails: [] }
          ];
        }

        let actions = (frozenRunMode === 'act' || frozenRunMode === 'minimal')
          ? [...parseActionsFromContent(finalContent), ...parseNativeToolCalls(nativeToolCalls)]
          : [];

        // 🧠 深度思考链动作兜底挖掘 (Thinking Action Mining)
        if (actions.length === 0 && accumulatedThinking && (frozenRunMode === 'act' || frozenRunMode === 'minimal')) {
          const thinkingActions = extractThinkingFallbackActions(accumulatedThinking);
          if (thinkingActions.length > 0) {
            actions = thinkingActions;
            addLog('INFO', 'ToolEngine', `[思维链动作挖掘] 正文未包含代码块，成功从深度思考链中兜底捕获到 ${thinkingActions.length} 个探索命令: ${thinkingActions[0].target}`);
          }
        }

        // Record Step Tag & Append Round Item without overwriting history
        const currentPhase: InternalStepTag['phase'] = actions.some(a => a.type === 'write_file')
          ? 'modify'
          : actions.some(a => a.type === 'run_command' && isActualTestRunnerCommand(a.code))
          ? 'verify'
          : 'inspect';

        const currentRoundItem: AgentRoundItem = {
          roundId: loopCount,
          title: currentPhase === 'modify' ? `修改 ${actions.filter(a => a.type === 'write_file').length} 个文件` : currentPhase === 'verify' ? '运行测试验证' : '分析与探索',
          status: 'running',
          phase: currentPhase,
          content: finalContent,
          thinkingText: accumulatedThinking,
          timestamp: Date.now()
        };
        accumulatedRounds = [...accumulatedRounds.filter(r => r.roundId !== loopCount), currentRoundItem];

        stepTags.push({
          turn: userMsg.turnIndex || 1,
          step: loopCount,
          phase: currentPhase,
          status: 'running',
          label: currentPhase === 'modify' ? `修改 ${actions.filter(a => a.type === 'write_file').length} 个文件` : currentPhase === 'verify' ? '运行测试验证' : '探索项目上下文'
        });

        // ── Stage Gate: explicit suspension at stage boundaries ──
        const gateSuspension = (shouldSuspendDynamicGraphPlanning(
              executionMode,
              4,
              loopCount,
              actions.some(a => a.type === 'write_file')
            )
            ? createGateSuspension({
                gateId: `dynamic-gate-${loopCount}`,
                stageName: '动态任务终审',
                summary: finalContent.slice(0, 600),
                taskBreakdown: extractTaskBreakdown(finalContent),
                specPath: extractSpecPath(finalContent)
              })
            : null);
        if (gateSuspension) {
          sessionActorManager.setGate(currentSessionId, gateSuspension);
          addLog('INFO', 'StageGate', `[Gate #${loopCount}] 第 ${loopCount} 阶段推演完成，流程挂起等待人工终审...`);
          const decision = await new Promise<StageGateDecision>(resolve => {
            sessionActorManager.registerGateResolve(currentSessionId, resolve);
          });
          sessionActorManager.resolveGate(currentSessionId, decision);
          const outcome = resolveGateDecision(decision);
          if (outcome.outcome === 'terminate') {
            currentLoopStatus = 'blocked';
            terminationSummaryText = `流程已在第【${loopCount}】阶段由用户终止，未写入任何代码。`;
            accumulatedRounds = accumulatedRounds.map(r => r.roundId === loopCount ? { ...r, status: 'blocked' as const } : r);
            setSessionMessages(prev => {
              const list = prev[currentSessionId] || [];
              const updated = list.map(m => m.id === assistantId ? {
                ...m,
                content: finalContent,
                rounds: [...accumulatedRounds],
                activeRoundId: loopCount,
                loopStatus: 'blocked' as const,
                terminationSummary: terminationSummaryText,
                stepTags: [...stepTags]
              } : m);
              return { ...prev, [currentSessionId]: updated };
            });
            addLog('WARN', 'StageGate', `[Gate #${loopCount}] 用户终止流程，未写入任何代码。`);
            break;
          }
          if (outcome.outcome === 'revise') {
            const feedbackMsg: ChatMessage = {
              id: `gate-feedback-${Date.now()}`,
              role: 'user',
              content: `【方案终审修改意见】: ${(decision.feedback || '').trim()}`,
              timestamp: Date.now(),
              isAgentFeedback: true,
              auditTag: `🚦 Gate #${loopCount} 修改意见`
            };
            conversationSnapshot.push(feedbackMsg);
            setSessionMessages(prev => ({
              ...prev,
              [currentSessionId]: [...(prev[currentSessionId] || []), feedbackMsg]
            }));
            addLog('INFO', 'StageGate', `[Gate #${loopCount}] 收到修改意见，回退至门禁阶段重新推演...`);
            loopCount--;
            continue;
          }
          addLog('INFO', 'StageGate', `[Gate #${loopCount}] 用户已批准方案，继续执行后续阶段...`);
        }

        if (hasIncompleteActionBlock(finalContent)) {
          finalContent = autoRepairIncompleteFences(finalContent);
          addLog('WARN', 'AgentLoop', `[代码块自动修复] 检测到大模型输出的代码块末尾未闭合，已自动补齐闭合标记并平滑提取动作。`);
          if (actions.length === 0 && (frozenRunMode === 'act' || frozenRunMode === 'minimal')) {
            actions = parseActionsFromContent(finalContent);
          }
        }

        if (actions.length === 0) {
          // 🔘 检查是否包含人机交互决策选项 (如 "需要我继续做以下哪一步？1. ... 2. ... 3. ...")
          const interactiveOptions = extractInteractiveOptions(finalContent);
          if (interactiveOptions.length > 0) {
            addLog('INFO', 'StageGate', `[人机决策] 检测到大模型提出 ${interactiveOptions.length} 个后续路线选项，挂起流程等待用户选择...`);
            currentLoopStatus = 'needs_decision';
            terminationSummaryText = '大模型提出了后续路线选项，等待用户决策选择。';

            const durationSec = parseFloat(((performance.now() - callStartTime) / 1000).toFixed(1));
            const addedPrompt = Math.round(text.length * 0.75);
            const addedComp = Math.round(finalContent.length * 0.75);

            stepTags[stepTags.length - 1].status = 'passed';
            currentRoundItem.status = 'passed';
            setSessionMessages(prev => {
              const list = prev[currentSessionId] || [];
              const updated = list.map(m => m.id === assistantId ? {
                ...m,
                content: finalContent,
                interactiveOptions,
                stepTags: [...stepTags],
                rounds: [...accumulatedRounds],
                activeRoundId: loopCount,
                loopStatus: currentLoopStatus,
                terminationSummary: terminationSummaryText,
                tokensDetail: { promptTokens: addedPrompt, completionTokens: addedComp, totalTokens: addedPrompt + addedComp },
                durationSeconds: durationSec
              } : m);
              return { ...prev, [currentSessionId]: updated };
            });

            setTokenStats(prev => ({
              ...prev,
              promptTokens: prev.promptTokens + addedPrompt,
              completionTokens: prev.completionTokens + addedComp,
              estimatedCostUsd: prev.estimatedCostUsd + ((addedPrompt + addedComp) * 0.0000002)
            }));

            addLog('INFO', 'AgentLoop', `[Loop #${loopCount}] 挂起等待用户点击选项 (${durationSec}s)`);
            break; // 停止后台自动轮转，等待用户做出选择！
          }

          const isShortIntroductory = finalContent.length < 350 &&
            /我来|我先|我将|让我|先列出|探索|读取|查看|审查|执行|稍等|定位|修正|逐个/i.test(finalContent);
          const hasUnfinishedCriteria = activeAcceptanceItems.some(i => i.status !== 'passed');

          if (frozenRunMode === 'act' && (isShortIntroductory || hasUnfinishedCriteria) && sessionActorManager.isSessionRunning(currentSessionId)) {
            consecutiveEmptyActionCount++;
            addLog('INFO', 'AgentLoop', `[目标驱动自愈推进 #${consecutiveEmptyActionCount}] 阶段任务未完成 (第 ${loopCount} 轮)，自动注入动作执行指令驱动 Agent 推进...`);
            
            const pushMsg: ChatMessage = {
              id: `auto-push-${Date.now()}`,
              role: 'user',
              content: '【系统自动执行指令】: 请立即在 Markdown 正文中输出具体的 ```run_command 或 ```write_file 代码块，以实际执行你刚才计划的操作。严禁只输出说明文字或只在思考链中写命令！',
              timestamp: Date.now(),
              isAgentFeedback: true,
              auditTag: `🚀 Agent 自动推进驱动 #${consecutiveEmptyActionCount}`
            };
            conversationSnapshot.push(pushMsg);
            setSessionMessages(prev => ({
              ...prev,
              [currentSessionId]: [...(prev[currentSessionId] || []), pushMsg]
            }));
            continue; // Keep looping continuously until user stops or all criteria pass!
          }

          // A plain answer may complete a conversational turn, but an explicit unfinished
          // acceptance checklist must remain visible as needs_decision instead of completed.
          const durationSec = parseFloat(((performance.now() - callStartTime) / 1000).toFixed(1));
          const addedPrompt = Math.round(text.length * 0.75);
          const addedComp = Math.round(finalContent.length * 0.75);

          const verifierResult = verifyTargetAcceptance(activeAcceptanceItems, [], [], progressHistory);
          activeAcceptanceItems = verifierResult.items;
          currentLoopStatus = resolveNoActionLoopStatus(verifierResult.status, hadExplicitAcceptanceCriteria);
          terminationSummaryText = currentLoopStatus === 'needs_decision'
            ? '本轮没有识别到可执行动作，验收项尚未全部通过，等待用户决策或补充指令。'
            : verifierResult.summary;

          stepTags[stepTags.length - 1].status = currentLoopStatus === 'completed' ? 'passed' : currentLoopStatus === 'blocked' ? 'blocked' : 'running';
          currentRoundItem.status = currentLoopStatus === 'completed' ? 'passed' : currentLoopStatus === 'blocked' ? 'blocked' : 'running';
          setSessionMessages(prev => {
            const list = prev[currentSessionId] || [];
            const updated = list.map(m => m.id === assistantId ? {
              ...m,
              content: finalContent,
              acceptanceItems: activeAcceptanceItems,
              stepTags: [...stepTags],
              rounds: [...accumulatedRounds],
              activeRoundId: loopCount,
              loopStatus: currentLoopStatus,
              terminationSummary: terminationSummaryText,
              tokensDetail: { promptTokens: addedPrompt, completionTokens: addedComp, totalTokens: addedPrompt + addedComp },
              durationSeconds: durationSec
            } : m);
            return { ...prev, [currentSessionId]: updated };
          });

          setTokenStats(prev => ({
            ...prev,
            promptTokens: prev.promptTokens + addedPrompt,
            completionTokens: prev.completionTokens + addedComp,
            estimatedCostUsd: prev.estimatedCostUsd + ((addedPrompt + addedComp) * 0.0000002)
          }));

          completedWithTarget = currentLoopStatus === 'completed';
          addLog(currentLoopStatus === 'completed' ? 'INFO' : 'WARN', 'AgentLoop',
            `[Loop #${loopCount}] ${terminationSummaryText} (${durationSec}s)`);
          break;
        }

        // ── Execute actions with Batch Decision & Scoped Trust ──
        consecutiveEmptyActionCount = 0; // Reset consecutive empty count upon having actions
        addLog('INFO', 'AgentLoop', `[Loop #${loopCount}] 检测到 ${actions.length} 个动作，开始评估执行策略...`);
        const results: ActionResult[] = [];
        const publishActionResult = (nextResult: ActionResult) => {
          setSessionMessages(prev => {
            const list = prev[currentSessionId] || [];
            const updated = list.map(message => {
              if (message.id !== assistantId) return message;
              const actionResults = (message.actionResults || []).filter(result => result.actionId !== nextResult.actionId);
              return { ...message, content: finalContent, actionResults: [...actionResults, nextResult] };
            });
            return { ...prev, [currentSessionId]: updated };
          });
        };

        // Determine which actions require approval in this batch
        const actionsRequiringApproval = actions.filter(action =>
          shouldRequireActionApproval(permissionPolicy, action, scopedTrusts, allowLowRiskInSession)
        );

        let approvedIds = new Set<string>(actions.map(a => a.id));

        if (actionsRequiringApproval.length > 0) {
          // One-turn, one batch decision
          actions.forEach(a => publishActionResult(createActionResult(a, 'pending')));
          const decision = await requestBatchApproval(actions);
          approvedIds = new Set(decision.approvedIds);
        } else {
          // Notify after toast for safe actions
          const safeWrites = actions.filter(a => a.type === 'write_file' && !a.isHighRisk);
          if (safeWrites.length > 0) {
            setActiveAutoExecutedToast({ count: safeWrites.length, glob: 'src/**' });
            setTimeout(() => setActiveAutoExecutedToast(null), 4000);
          }
        }

        const allowedTools = resolveAllowedTools(undefined, frozenRunMode);
        for (const action of actions) {
          if (!sessionActorManager.isSessionRunning(currentSessionId)) break;
          let result: ActionResult;

          if (approvedIds.has(action.id)) {
            publishActionResult(createActionResult(action, 'executing'));
            addLog('INFO', 'Sandbox', `[Action #${action.id}] 开始执行 ${action.type}: ${action.target.slice(0, 80)}`);
            result = await executeSandboxAction(action, allowedTools, (a) => executeActionOnHost(a, frozenRunMode));
            addLog(result.status === 'success' ? 'INFO' : 'WARN', 'Sandbox', `[Action #${action.id}] 执行结束 (Status: ${result.status}, ExitCode: ${result.exitCode ?? 0}) -> 响应: ${(result.output || '').slice(0, 120)}...`);
          } else {
            result = createActionResult(action, 'rejected');
            addLog('WARN', 'Sandbox', `[Action #${action.id}] 用户拒绝执行操作: ${action.target.slice(0, 80)}`);
          }

          results.push(result);
          publishActionResult(result);
        }

        // ── Independent Verifier Evaluation ──
        const progressVector: ProgressVector = {
          stepIndex: loopCount,
          phase: currentPhase,
          actionFingerprints: actions.map(a => `${a.type}:${a.target}`),
          passedCount: activeAcceptanceItems.filter(i => i.status === 'passed').length,
          failedCount: activeAcceptanceItems.filter(i => i.status === 'failed').length
        };
        progressHistory.push(progressVector);

        const verifierResult = verifyTargetAcceptance(activeAcceptanceItems, actions, results, progressHistory);
        activeAcceptanceItems = verifierResult.items;
        currentLoopStatus = verifierResult.status;
        terminationSummaryText = verifierResult.summary;

        stepTags[stepTags.length - 1].status = results.every(r => r.status === 'success') ? 'passed' : 'failed';

        // Accumulate action results across steps within the single run card
        accumulatedActionResults = [...accumulatedActionResults.filter(ar => !results.some(r => r.actionId === ar.actionId)), ...results];

        // Attach action results and status to the finished round
        accumulatedRounds = accumulatedRounds.map(r => r.roundId === loopCount ? {
          ...r,
          actionResults: results,
          status: results.every(res => res.status === 'success') ? 'passed' : 'failed'
        } : r);

        // Update single assistant run card with step tags, criteria & action results
        setSessionMessages(prev => {
          const list = prev[currentSessionId] || [];
          const updated = list.map(m => m.id === assistantId ? {
            ...m,
            content: finalContent,
            actionResults: accumulatedActionResults,
            acceptanceItems: activeAcceptanceItems,
            stepTags: [...stepTags],
            rounds: [...accumulatedRounds],
            activeRoundId: loopCount,
            loopStatus: currentLoopStatus,
            terminationSummary: terminationSummaryText
          } : m);
          return { ...prev, [currentSessionId]: updated };
        });

        if (verifierResult.status === 'completed') {
          addLog('INFO', 'Verifier', `✓ 所有验收项均已达成并通过验证，Agent Loop 成功结束！`);
          completedWithTarget = true;
          break;
        }

        if (verifierResult.status === 'no_progress') {
          addLog('WARN', 'Verifier', `⚠ 检测到连续未产生有效进展，暂停 Agent Loop 等待用户决策`);
          break;
        }

        // ⚡ LSP / Compiler Diagnostics Check (Self-Healing Loop)
        let compilerDiagnosticsFeedback = '';
        const writtenFiles = actions.filter(a => a.type === 'write_file').map(a => a.target);
        if (writtenFiles.length > 0 && activeSession.projectPath) {
          for (const wf of writtenFiles) {
            const diag = await runFileDiagnostics(wf, activeSession.projectPath);
            if (diag.hasErrors) {
              compilerDiagnosticsFeedback = formatDiagnosticFeedback(diag.errors);
              addLog('WARN', 'Diagnostics', `[LSP 编译报错] ${wf} 存在 ${diag.errors.length} 处类型/语法错误，已注入下轮自愈回路`);
              break;
            }
          }
        }

        // Append feedback message for next verification turn
        const feedbackContent = formatExecutionFeedback(actions, results, activeAcceptanceItems, compilerDiagnosticsFeedback);
        const feedbackMsg: ChatMessage = {
          id: `feedback-${Date.now()}`,
          role: 'user',
          content: feedbackContent,
          timestamp: Date.now(),
          isAgentFeedback: true,
          auditTag: `🔄 Agent Step #${loopCount} 验证反馈`
        };

        conversationSnapshot.push(feedbackMsg);
        setSessionMessages(prev => ({
          ...prev,
          [currentSessionId]: [...(prev[currentSessionId] || []), feedbackMsg]
        }));

        addLog('INFO', 'AgentLoop', `[Step #${loopCount}] 验证结果: ${activeAcceptanceItems.filter(i => i.status === 'passed').length}/${activeAcceptanceItems.length} 项通过，继续下一推演步骤...`);

        // Continue loop → AI will see execution results and decide next step
      }

      // 🧠 Cross-session memory auto-extraction on turn end
      try {
        const allMsgs = sessionMessages[currentSessionId] || [];
        const extractedMemories = extractMemoriesFromConversation(allMsgs, currentSessionId);
        if (extractedMemories.length > 0) {
          extractedMemories.forEach(m => saveMemory(m));
          addLog('INFO', 'MemoryVault', `[🧠 长期记忆沉淀] 自动提取了 ${extractedMemories.length} 条工程约定与习惯`);
        }
      } catch (e) {}

      if (!completedWithTarget && currentLoopStatus === 'no_progress') {
        addLog('WARN', 'AgentLoop', `任务暂停于无新进展状态，等待用户决策`);
      }

      // Save session state
      setSessions(prev => {
        const durationSec = parseFloat(((performance.now() - callStartTime) / 1000).toFixed(1));
        const updated = prev.map(s => s.id === currentSessionId ? {
          ...s,
          messagesCount: s.messagesCount + 2,
          updatedAt: Date.now()
        } : s);
        saveSessionsToStorage(updated);
        return updated;
      });

      setSessionMessages(latest => {
        saveSessionMessagesToStorage(latest);
        return latest;
      });

      // ── Trigger System Task Completion Notification ──
      const targetSession = sessions.find(s => s.id === currentSessionId) || activeSession;
      const parsedAssistant = parseAgentMessage(lastAssistantContent || '');
      const cleanSummary = (parsedAssistant.cleanContent || '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[\s\S]*?>/g, '')
        .replace(/[#*`_\n]/g, ' ')
        .trim()
        .slice(0, 80);
      const isLoopError = currentLoopStatus === 'no_progress';
      const durationSec = parseFloat(((performance.now() - callStartTime) / 1000).toFixed(1));
      
      const taskNotifyData: TaskNotificationData = {
        status: isLoopError ? 'error' : 'success',
        projectName: targetSession?.projectName || targetSession?.title || 'Tcode',
        sessionTitle: targetSession?.title || '会话任务',
        sessionId: currentSessionId,
        summary: cleanSummary || (completedWithTarget ? '任务已成功完成并通过独立验证。' : '模型回复已生成完毕。'),
        durationSec: durationSec > 0 ? durationSec : 2.4,
        createdAt: Date.now()
      };
      
      const notifyPayload: SystemNotifyPayload = {
        status: taskNotifyData.status,
        projectName: taskNotifyData.projectName,
        sessionTitle: taskNotifyData.sessionTitle,
        sessionId: taskNotifyData.sessionId,
        summary: taskNotifyData.summary,
      };

      // 🌟 双通道互斥：后台派发 Windows 原生通知，前台展示像素级磨砂亚克力卡片
      if (isWindowHidden()) {
        void requestSystemNotification(notifyPayload);
      } else {
        setActiveTaskNotification(taskNotifyData);
      }

    } catch (err: any) {
      if (!sessionActorManager.isSessionRunning(currentSessionId)) {
        addLog('INFO', 'AgentLoop', '用户已停止 Agent Loop，已取消待审批与后续调度');
        return;
      }
      if (gatewayPrepared) {
        gatewayRuntime.facade.recordCompletion({
          accountId: gatewayPrepared.accountId,
          downstreamKeyId: gatewayRuntime.keys.list()[0]?.key ?? '',
          model: streamingModel.id,
          sessionKey: currentSessionId,
          usage: streamedUsage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          status: controller?.signal.aborted ? 'cancelled' : 'error'
        });
        gatewayRuntime.persist();
      }
      setSessionMessages(prev => {
        const list = prev[currentSessionId] || [];
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `✕ 大模型连接异常: ${err.message}。请在左侧系统设置中检查服务商 Base URL 与 API Key 凭据。`,
          timestamp: Date.now(),
          auditTag: '⚠️ 网络或鉴权异常'
        };
        const updated = [...list, errorMsg];
        saveSessionMessagesToStorage({ ...prev, [currentSessionId]: updated });
        return { ...prev, [currentSessionId]: updated };
      });

      // ── Trigger System Task Error Notification ──
      const targetSession = sessions.find(s => s.id === currentSessionId) || activeSession;
      const errorNotifyData: TaskNotificationData = {
        status: 'error',
        projectName: targetSession?.projectName || targetSession?.title || 'Tcode',
        sessionTitle: targetSession?.title || '会话任务',
        sessionId: currentSessionId,
        summary: `错误根因: ${err.message || '大模型网络或鉴权异常'}`,
        durationSec: 1.5,
        createdAt: Date.now()
      };

      const notifyPayload: SystemNotifyPayload = {
        status: 'error',
        projectName: errorNotifyData.projectName,
        sessionTitle: errorNotifyData.sessionTitle,
        sessionId: errorNotifyData.sessionId,
        summary: errorNotifyData.summary,
      };

      // 🌟 双通道互斥：后台派发 Windows 原生通知，前台展示像素级磨砂亚克力卡片
      if (isWindowHidden()) {
        void requestSystemNotification(notifyPayload);
      } else {
        setActiveTaskNotification(errorNotifyData);
      }
    } finally {
      sessionActorManager.completeSession(currentSessionId);
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

      {/* 2. Main Workspace Body (ActivityBar + 3-Column Percentage Grid) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ActivityBar (42px) */}
        <ActivityBar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLiveLogs={() => setIsLiveLogsOpen(true)}
        />

        {/* 3-Column Solid Flex Layout: [42px ActivityBar] [240px LeftPanel] [6px Divider] [1fr ChatColumn] [6px Divider] [480px EditorWorkspace] */}
        <div
          id="app-main-flex-container"
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--chat-bg)'
          }}
        >
          {/* Column 1: LeftPanel (Percentage fluid width with collapse) */}
          {!isLeftDrawerCollapsed && (
            <div style={{
              width: `${leftPercent}%`,
              minWidth: '180px',
              maxWidth: '460px',
              flexShrink: 0,
              height: '100%',
              display: 'flex'
            }}>
              <LeftPanel
                width={260}
                activeNav={activeNav}
                onOpenFile={handleOpenFile}
                projects={projects}
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewGlobalSession={handleNewGlobalSession}
                onNewProjectSession={handleNewProjectSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onOpenDirectory={handleOpenDirectory}
                onRemoveProject={handleRemoveProject}
              />
            </div>
          )}

          {/* Left Divider (Pointer Events + Double Click Reset) */}
          {!isLeftDrawerCollapsed && (
            <div
              onPointerDown={handleLeftPointerDown}
              onDoubleClick={handleResetLayout}
              title="拖拽调节比例 (双击恢复默认 18%)"
              style={{
                width: '6px',
                flexShrink: 0,
                cursor: 'col-resize',
                zIndex: 90,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                userSelect: 'none',
                background: isDraggingLeft ? 'var(--accent)' : 'transparent',
                transition: 'background 0.12s ease'
              }}
            >
              {isDraggingLeft && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--accent)',
                  color: '#FFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  pointerEvents: 'none',
                  zIndex: 100,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}>
                  左侧 {leftPercent}%
                </div>
              )}
            </div>
          )}

          {/* Column 2: ChatColumn (Takes 100% of remaining space: flex: 1, minWidth: 320px) */}
          <div style={{ flex: 1, minWidth: '320px', height: '100%', display: 'flex', overflow: 'hidden' }}>
            <ChatColumn
              style={{ width: '100%', height: '100%' }}
              onOpenFile={handleOpenFile}
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
              pendingApproval={pendingApproval}
              onApprovalDecision={(approvedIds, trustGlob) => handleBatchApprovalDecision({ approvedIds, trustGlob })}
              onRejectBatchApproval={() => handleBatchApprovalDecision({ approvedIds: [] })}
              onRollbackToCheckpoint={handleRollbackToCheckpoint}
              setPermissionPolicy={setPermissionPolicy}
              isStreaming={sessionActorManager.isSessionRunning(activeSession?.id)}
              onStopGeneration={handleStopGeneration}
              tokenStats={tokenStats}
              promptQueue={promptQueues[currentSessionId] || []}
              onWithdrawQueuedPrompt={(id) => handleWithdrawQueuedPrompt(currentSessionId, id)}
              onEditQueuedPrompt={(id, newText) => handleEditQueuedPrompt(currentSessionId, id, newText)}
              onMoveQueuedPrompt={(index, direction) => handleMoveQueuedPrompt(currentSessionId, index, direction)}
              onPreemptQueuedPrompt={(id) => handlePreemptQueuedPrompt(currentSessionId, id)}
              onSendMessage={handleSendMessage}
              onResolveOptions={handleResolveOptions}
              executionMode={executionMode}
              onExecutionModeChange={handleExecutionModeChange}
              activeGate={activeGate}
              onGateDecision={handleGateDecision}
              onGateFeedback={(feedback) => handleGateDecision({ approved: false, feedback })}
              onOpenSpec={handleOpenFile}
              swarmRunId={swarmRunId}
              onForkMessage={handleForkSessionFromMessage}
              onNavigateDiff={(target) => {
                handleOpenFile(target.filePath, undefined, target.targetLine);
                setActiveDiffTarget({ ...target, highlightToken: `diff-${target.fileId}` });
              }}
              projectProfile={projectProfile}
            />
          </div>

          {/* Right Divider (Pointer Events + Double Click Reset) */}
          {rightWorkspaceOpen && (
            <div
              onPointerDown={handleRightPointerDown}
              onDoubleClick={handleResetLayout}
              title="拖拽调节工作台比例 (双击恢复默认 32%)"
              style={{
                width: '6px',
                flexShrink: 0,
                cursor: 'col-resize',
                zIndex: 90,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                userSelect: 'none',
                background: isDraggingRight ? 'var(--accent)' : 'transparent',
                transition: 'background 0.12s ease'
              }}
            >
              {isDraggingRight && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--accent)',
                  color: '#FFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  pointerEvents: 'none',
                  zIndex: 100,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}>
                  工作台 {workbenchPercent}%
                </div>
              )}
            </div>
          )}

          {/* Column 3: Right Monaco Code Workspace & Terminal Deck (Percentage fluid width) */}
          {rightWorkspaceOpen && (
            <div style={{
              width: `${workbenchPercent}%`,
              minWidth: '320px',
              maxWidth: '800px',
              flexShrink: 0,
              height: '100%',
              display: 'flex'
            }}>
              <EditorWorkspace
                isOpen={rightWorkspaceOpen}
                onClose={() => setRightWorkspaceOpen(false)}
                activeDiffTarget={activeDiffTarget}
                activeFile={activeFile}
                activeProject={activeSession.projectPath ? { name: activeSession.projectName || 'Default Project', path: activeSession.projectPath, gitBranch: activeSession.gitBranch || 'main' } : null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Transparent Global Drag Overlay during layout resizing */}
      {(isDraggingLeft || isDraggingRight) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          cursor: 'col-resize',
          userSelect: 'none'
        }} />
      )}

      {/* Global Command Hub & Quick File Switcher (Ctrl+P / Ctrl+Shift+P) */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        mode={paletteMode}
        onOpenFile={(path) => {
          handleOpenFile(path);
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

      {/* 🌟 Premium System Task Notification (100% Matches Design Spec) */}
      <SystemTaskNotification
        notification={activeTaskNotification}
        onClose={() => setActiveTaskNotification(null)}
        onOpenSession={(sessionId) => {
          setCurrentSessionId(sessionId);
          setActiveTaskNotification(null);
        }}
      />

    </div>
  );
};
export default App;
