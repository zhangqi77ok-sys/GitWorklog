import { getActiveWorkflow, setActiveWorkflowId, loadSavedWorkflows, ModularWorkflow, NORMAL_WORKFLOW } from '../services/workflowStore';
import { TargetStepProgressCard } from './TargetStepProgressCard';
import { ActionApprovalModal } from './ActionApprovalModal';
import { ShareCardModal } from './ShareCardModal';
import { SwarmWorkbenchModal } from './SwarmWorkbenchModal';
import React, { useState, useEffect } from 'react';
import { MarkdownCard } from './MarkdownCard';
import { agentRuntimeController } from '../services/agentRuntimeController';
import {
  Send,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  ListOrdered,
  Loader2,
  Search,
  RefreshCw,
  Coins,
  Copy,
  Share2,
  Square,
  X,
  Shield,
  AlertTriangle,
  Paperclip,
  ScrollText,
  X as XIcon,

  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Sparkles,
  Cpu,
  Check,
  Compass,
  FileCode,
  GitBranch,
  Leaf,
  Wrench,
  AtSign,
  Pin,
  FolderGit2,
  Terminal,
  CheckCheck,
  Undo2,
  Bot
} from 'lucide-react';
import {
  SessionItem,
  AgentPendingAction,
  AgentSkillItem,
  INITIAL_AGENT_SKILLS,
  loadSavedSkills,
  MODEL_ROUTING_STRATEGIES,
  ModelRoutingStrategy,
  RoutingStrategyId,
  resolveOptimalModel,
  MOCK_TRAJECTORY_STEPS,
  TrajectoryStepSnapshot,
  ChatMessage,
  QueuedPromptItem,
  parseAgentMessage,
  ParsedToolCall,
  AttachedFile,
  RuleItem,
  INITIAL_RULES,
  getActiveRules,

  WorkMode,
  WORK_MODE_CONFIGS,
  PermissionPolicy,
  AIModelOption,
  AVAILABLE_MODELS,
  getAllAvailableModels,
  flattenFileTreeToMentions,
  loadSavedProviders,
  loadSavedChannels,
  saveChannelsToStorage,
  getPresetForChannelType,
  ChannelItem,
  saveProvidersToStorage,
  resolveApiEndpoint,
  MentionContextItem,
  DEFAULT_MENTION_ITEMS,
  searchMentionItems,
  ChangesetReviewPayload,
  INITIAL_CHANGESET,
  acceptChangeset,
  rejectChangeset,
  PinnedFileItem,
  togglePinnedFile,
  SwarmPipelineStage,
  INITIAL_SWARM_STAGES,
  mergeForkSessionToMain,
  MOCK_REPO_GRAPH,
  clampChangesetHeight
} from '../types/contracts';
import { OptionsCard } from './OptionsCard';
import { SemanticCommitModal } from './SemanticCommitModal';
import { PullRequestModal } from './PullRequestModal';
import { TrajectorySnapshotModal } from './TrajectorySnapshotModal';
import { ThinkingBlock } from './ThinkingBlock';
import { SwarmSubagentContainer } from './SwarmSubagentContainer';
import { extractThinkingFromText, SLASH_COMMANDS, SlashCommandItem, loadSavedProfile, DeveloperProfile } from '../types/contracts';
import { GitPullRequest, RotateCcw } from 'lucide-react';
import type { AgentAction } from '../services/agentLoop';
import { ManagedRule } from '../types/contracts';
import { loadSavedRules } from '../services/rulesStore';
import { loadSavedOfficialSkills, getTier2SkillBody, SkillMetadata } from '../services/skillsEngine';
import { getContextBudget, ContextBudget, compressModelContext } from '../services/contextTelemetry';
import {
  createPipelineState,
  selectPipelineMode,
  startPipelineRun,
  savePipelineModeToStorage,
  PipelineMode,
  PipelineState
} from '../services/pipelineMode';
import { RuntimeConfigResolver } from '../services/runtimeConfigResolver';
import { resolveProviderIdForModelTab, assertProviderCredentials } from '../services/modelGateway';
import { taskGraphScheduler } from '../services/taskGraphScheduler';
import { getGatewayModelOptions } from '../services/gateway/gatewayRuntime';

interface ChatColumnProps {
  rightWorkspaceOpen: boolean;
  onToggleWorkspace: () => void;
  style?: React.CSSProperties;
  session: SessionItem;
  sessions?: SessionItem[];
  sessionMessagesMap?: Record<string, ChatMessage[]>;
  messages: ChatMessage[];
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  currentModel: AIModelOption;
  onSelectModel: (model: AIModelOption) => void;
  permissionPolicy: PermissionPolicy;
  setPermissionPolicy: (p: PermissionPolicy) => void;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  promptQueue?: QueuedPromptItem[];
  onWithdrawQueuedPrompt?: (id: string) => void;
  onEditQueuedPrompt?: (id: string, newText: string) => void;
  onMoveQueuedPrompt?: (index: number, direction: -1 | 1) => void;
  onPreemptQueuedPrompt?: (id: string) => void;
  onSendMessage: (text: string, mentions?: MentionContextItem[]) => void;
  onResolveOptions: (messageId: string, selectedIds: string[], customInput?: string) => void;
  onForkMessage?: (fromMessageId: string) => void;
  onNavigateDiff?: (target: { fileId: string; filePath: string; targetLine: number }) => void;
  onOpenFile?: (filePath: string) => void;
  pendingApproval?: {
    actions: AgentAction[];
  } | null;
  onApprovalDecision?: (approvedActionIds: string[], trustGlob?: string) => void;
  onRejectBatchApproval?: () => void;
  onRollbackToCheckpoint?: (checkpointRef: string, messageId: string) => void;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  rightWorkspaceOpen,
  onToggleWorkspace,
  style,
  session,
  sessions = [],
  sessionMessagesMap = {},
  messages,
  workMode,
  setWorkMode,
  currentModel,
  onSelectModel,
  permissionPolicy,
  setPermissionPolicy,
  isStreaming = false,
  onStopGeneration,
  promptQueue = [],
  onWithdrawQueuedPrompt,
  onEditQueuedPrompt,
  onMoveQueuedPrompt,
  onPreemptQueuedPrompt,
  onSendMessage,
  onResolveOptions,
  onForkMessage,
  onNavigateDiff,
  onOpenFile,
  pendingApproval,
  onApprovalDecision,
  onRejectBatchApproval,
  onRollbackToCheckpoint
}) => {
  const [inputText, setInputText] = useState(() => {
    try {
      return localStorage.getItem(`codemind_draft_${session.id}`) || '';
    } catch (e) {
      return '';
    }
  });

  // L1 Input Draft 300ms Debounce Persistence per Session
  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        if (inputText.trim()) {
          localStorage.setItem(`codemind_draft_${session.id}`, inputText);
        } else {
          localStorage.removeItem(`codemind_draft_${session.id}`);
        }
      } catch (e) {}
    }, 300);
    return () => clearTimeout(handler);
  }, [inputText, session.id]);

  // Restore draft when switching session
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`codemind_draft_${session.id}`) || '';
      setInputText(draft);
    } catch (e) {}
  }, [session.id]);
  const [pendingActionQueue, setPendingActionQueue] = useState<AgentPendingAction[]>([]);
  const [sessionAutoAllowed, setSessionAutoAllowed] = useState<boolean>(false);
  const [processedActionIds, setProcessedActionIds] = useState<Set<string>>(new Set());

  // Slash Commands & Session References
  const [devProfile, setDevProfile] = useState<DeveloperProfile>(loadSavedProfile());
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [sessionQuery, setSessionQuery] = useState('');
  const [referencedSession, setReferencedSession] = useState<SessionItem | null>(null);

  // Real-time synchronization of Developer Profile
  React.useEffect(() => {
    const syncProfile = () => {
      setDevProfile(loadSavedProfile());
    };
    window.addEventListener('storage', syncProfile);
    window.addEventListener('focus', syncProfile);
    window.addEventListener('codemind_profile_updated', syncProfile);
    return () => {
      window.removeEventListener('storage', syncProfile);
      window.removeEventListener('focus', syncProfile);
      window.removeEventListener('codemind_profile_updated', syncProfile);
    };
  }, []);

  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueText, setEditingQueueText] = useState<string>('');
  const [isQueueCollapsed, setIsQueueCollapsed] = useState<boolean>(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showRulesPopover, setShowRulesPopover] = useState(false);
  const [selectedRoundByMsgId, setSelectedRoundByMsgId] = useState<Record<string, number>>({});
  const [userToggledRounds, setUserToggledRounds] = useState<Record<string, boolean>>({});
  const [isSwarmModalOpen, setIsSwarmModalOpen] = useState(false);
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Slash command detection
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashQuery(val.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }

    // @ Session mention detection
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowSessionMenu(true);
      setSessionQuery('');
    } else if (lastAt !== -1 && showSessionMenu) {
      setSessionQuery(val.slice(lastAt + 1).toLowerCase());
    } else {
      setShowSessionMenu(false);
    }
  };
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(68);
  const [isDraggingInputHeight, setIsDraggingInputHeight] = useState<boolean>(false);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingInputHeight) {
        const windowHeight = window.innerHeight;
        const newH = windowHeight - e.clientY - 90;
        setInputHeight(Math.max(48, Math.min(420, newH)));
      }
    };
    const handleMouseUp = () => {
      if (isDraggingInputHeight) {
        setIsDraggingInputHeight(false);
      }
    };

    if (isDraggingInputHeight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingInputHeight]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [allRules, setAllRules] = useState<ManagedRule[]>(() => loadSavedRules());

  // Sync rules across Settings, RulesMemoryPanel and ChatColumn dynamically
  React.useEffect(() => {
    const handleRulesUpdate = (e: any) => {
      if (e.detail) {
        setAllRules(e.detail);
      }
    };
    window.addEventListener('codemind_rules_updated', handleRulesUpdate);
    window.addEventListener('storage', () => {
      setAllRules(loadSavedRules());
    });
    return () => {
      window.removeEventListener('codemind_rules_updated', handleRulesUpdate);
    };
  }, []);

  const activeRules = allRules.filter(r => r.enabled);

  // DX & PM Power States: Mentions, Changeset, Pinned Files
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  // Universal ESC key support for ALL popovers & menus in ChatColumn
  React.useEffect(() => {
    const handleChatEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWorkflowMenu(false);
        setShowSkillMenu(false);
        setShowRulesPopover(false);
        setShowModelMenu(false);
        setShowSlashMenu(false);
        setShowSessionMenu(false);
        setIsShareModalOpen(false);
        setIsCommitModalOpen(false);
        setIsPrModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleChatEsc);
    return () => window.removeEventListener('keydown', handleChatEsc);
  }, []);

  const [skillQuery, setSkillQuery] = useState('');
  const [officialSkillsList, setOfficialSkillsList] = useState<SkillMetadata[]>(() => loadSavedOfficialSkills());
  const [selectedSkill, setSelectedSkill] = useState<SkillMetadata | null>(null);
  const [activeModularWorkflow, setActiveModularWorkflow] = useState<ModularWorkflow>(() => getActiveWorkflow());
  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState('');
  const [savedWorkflowsList, setSavedWorkflowsList] = useState<ModularWorkflow[]>(() => loadSavedWorkflows());

  useEffect(() => {
    const handleWfChange = () => {
      setActiveModularWorkflow(getActiveWorkflow());
      setSavedWorkflowsList(loadSavedWorkflows());
    };
    window.addEventListener('tcode_active_workflow_changed', handleWfChange);
    window.addEventListener('tcode_workflows_updated', handleWfChange);
    return () => {
      window.removeEventListener('tcode_active_workflow_changed', handleWfChange);
      window.removeEventListener('tcode_workflows_updated', handleWfChange);
    };
  }, []);

  const [shareTargetMessage, setShareTargetMessage] = useState<ChatMessage | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Sync official skills updates
  React.useEffect(() => {
    const handleSkillsUpdate = (e: any) => {
      if (e.detail) {
        setOfficialSkillsList(e.detail);
      }
    };
    window.addEventListener('tcode_skills_updated', handleSkillsUpdate);
    return () => window.removeEventListener('tcode_skills_updated', handleSkillsUpdate);
  }, []);

  // Smart auto-scroll: only scroll to bottom when user is near the bottom
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  };

  // Track user scroll position to determine if near bottom
  const handleScrollContainer = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 150;
    setIsUserNearBottom(nearBottom);
    setShowScrollToBottom(!nearBottom && el.scrollHeight > el.clientHeight + 300);
  }, []);

  // Auto-scroll when switching sessions (instant, always go to bottom)
  React.useEffect(() => {
    setIsUserNearBottom(true);
    setShowScrollToBottom(false);
    setTimeout(() => scrollToBottom(false), 50);
  }, [session.id]);

  // Auto-scroll on new messages & streaming tokens — ONLY if user is near the bottom
  React.useEffect(() => {
    if (isUserNearBottom) {
      scrollToBottom(true);
    }
  }, [messages, isStreaming, promptQueue]);
  const [availableModelList, setAvailableModelList] = useState<AIModelOption[]>(() => [...getAllAvailableModels(), ...getGatewayModelOptions()]);
  const [activeProviderTab, setActiveProviderTab] = useState<string>(() => loadSavedChannels()[0]?.id || 'chan-opencode-go');
  const [scenarioFilter, setScenarioFilter] = useState<'all' | 'code' | 'thinking' | 'offline'>('all');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isSyncingModels, setIsSyncingModels] = useState(false);

  // Global Alt+M shortcut to toggle model switcher dropdown
  React.useEffect(() => {
    const handleModelShortcut = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setShowModelMenu(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleModelShortcut);
    return () => window.removeEventListener('keydown', handleModelShortcut);
  }, []);

  // Reactive synchronization of available models when Channels or Settings change
  React.useEffect(() => {
    const handleChannelsUpdated = () => {
      setAvailableModelList([...getAllAvailableModels(), ...getGatewayModelOptions()]);
    };
    window.addEventListener('tcode_channels_updated', handleChannelsUpdated);
    window.addEventListener('tcode_providers_updated', handleChannelsUpdated);
    window.addEventListener('storage', handleChannelsUpdated);
    window.addEventListener('focus', handleChannelsUpdated);
    return () => {
      window.removeEventListener('tcode_channels_updated', handleChannelsUpdated);
      window.removeEventListener('tcode_providers_updated', handleChannelsUpdated);
      window.removeEventListener('storage', handleChannelsUpdated);
      window.removeEventListener('focus', handleChannelsUpdated);
    };
  }, []);



  const handleSyncOnlineModels = async () => {
    setIsSyncingModels(true);
    try {
      const savedChannels = loadSavedChannels();
      const channel = savedChannels.find(c => c.id === activeProviderTab) || savedChannels[0];
      if (!channel) throw new Error(`当前渠道未配置: ${activeProviderTab}`);

      let base = channel.baseUrl.trim();
      if (base.endsWith('/')) base = base.slice(0, -1);
      const urlWithEndpoint = base.endsWith('/models') ? base : `${base}/models`;
      const { url: requestUrl, headers: proxyHeaders } = resolveApiEndpoint(urlWithEndpoint);
      const headers: Record<string, string> = { ...proxyHeaders };
      if (channel.key?.trim()) {
        headers['Authorization'] = `Bearer ${channel.key.trim().split('\n')[0].trim()}`;
      }

      const res = await fetch(requestUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const list: any[] = data.data || data.models || (Array.isArray(data) ? data : []);
      if (list.length > 0) {
        const fetchedIds: string[] = list.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        const mergedModels = Array.from(new Set([...channel.models, ...fetchedIds]));
        const updatedChannels = savedChannels.map(c => (c.id === channel.id ? { ...c, models: mergedModels } : c));
        saveChannelsToStorage(updatedChannels);
        setAvailableModelList([...getAllAvailableModels(), ...getGatewayModelOptions()]);
        setChangesetToast(`✓ 成功从渠道 [${channel.name}] 同步并写入 ${fetchedIds.length} 个模型；对话框模型列表已刷新`);
        setTimeout(() => setChangesetToast(null), 3000);
      } else {
        setChangesetToast(`✓ 接口连通正常，但返回模型列表为空`);
        setTimeout(() => setChangesetToast(null), 3000);
      }
    } catch (e: any) {
      setChangesetToast(`✕ 同步失败: ${e.message}`);
      setTimeout(() => setChangesetToast(null), 3000);
    } finally {
      setIsSyncingModels(false);
    }
  };
  const [pinnedFiles, setPinnedFiles] = useState<PinnedFileItem[]>([
    { id: 'pin-1', path: 'src/types/contracts.ts', name: 'contracts.ts', size: 38400 }
  ]);
  const [changeset, setChangeset] = useState<ChangesetReviewPayload | null>(null);
  const [changesetToast, setChangesetToast] = useState<string | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>(() => createPipelineState());
  const pipelineMode: PipelineMode = pipelineState.mode;

  useEffect(() => {
    const handleModeUpdate = (e: any) => {
      if (e.detail === 'swarm' || e.detail === 'harness') {
        setPipelineState(prev => ({ ...prev, mode: e.detail }));
      }
    };
    window.addEventListener('tcode_pipeline_mode_updated', handleModeUpdate);
    return () => window.removeEventListener('tcode_pipeline_mode_updated', handleModeUpdate);
  }, []);
  const [swarmGoal, setSwarmGoal] = useState<string>('');
  const [activeRunId, setActiveRunId] = useState<string | undefined>(undefined);
  const [swarmStartError, setSwarmStartError] = useState<string | null>(null);
  const [isStartingSwarm, setIsStartingSwarm] = useState<boolean>(false);
  const [isForkedSession, setIsForkedSession] = useState<boolean>(false);
  const [swarmStages, setSwarmStages] = useState<SwarmPipelineStage[]>(INITIAL_SWARM_STAGES);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [isPrModalOpen, setIsPrModalOpen] = useState<boolean>(false);
  const [experienceLearned, setExperienceLearned] = useState<boolean>(false);
  const [showLessonConfirm, setShowLessonConfirm] = useState<boolean>(false);
  const [lessonTitle, setLessonTitle] = useState('禁止直接 new Store 实例');
  const [lessonPrompt, setLessonPrompt] = useState('必须通过 StoreFactory 单例方法获取全局 Store，保持单状态源');
  const [activeRuleCount, setActiveRuleCount] = useState<number>(3);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategyId>('auto');
  const [isAutoRouting, setIsAutoRouting] = useState<boolean>(false);
  const [showStrategyMenu, setShowStrategyMenu] = useState<boolean>(false);
  const [selectedTrajectoryStep, setSelectedTrajectoryStep] = useState<TrajectoryStepSnapshot | null>(null);
  const [isChangesetCollapsed, setIsChangesetCollapsed] = useState<boolean>(false);
  const [changesetHeight, setChangesetHeight] = useState<number>(135);
  const [isDraggingChangesetHeight, setIsDraggingChangesetHeight] = useState<boolean>(false);

  // Global mouse drag listener for Changeset Card height
  React.useEffect(() => {
    const handleChangesetMove = (e: MouseEvent) => {
      if (isDraggingChangesetHeight) {
        const container = document.getElementById('changeset-review-card');
        if (container) {
          const rect = container.getBoundingClientRect();
          const newH = e.clientY - rect.top;
          setChangesetHeight(Math.min(480, Math.max(80, newH)));
        }
      }
    };
    const handleChangesetUp = () => {
      setIsDraggingChangesetHeight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (isDraggingChangesetHeight) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleChangesetMove);
      window.addEventListener('mouseup', handleChangesetUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleChangesetMove);
      window.removeEventListener('mouseup', handleChangesetUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingChangesetHeight]);



  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const files = Array.from(e.clipboardData.files);
      const newItems: AttachedFile[] = files.map(f => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: f.name || 'clipboard-file',
        size: f.size,
        type: f.type
      }));
      setAttachedFiles(prev => [...prev, ...newItems]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: AttachedFile[] = files.map(f => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: f.name,
        size: f.size,
        type: f.type
      }));
      setAttachedFiles(prev => [...prev, ...newItems]);
    }
  };

  const [planExpanded, setPlanExpanded] = useState(workMode === 'plan');

  // Popover states for unified model selector button
  const [showModelMenu, setShowModelMenu] = useState(false);


  // Action parsing, authorization, and host execution are owned by App's Agent Loop controller.


  // Scan messages to detect newly generated actions that require approval
  React.useEffect(() => {
    if (sessionAutoAllowed || permissionPolicy === 'autonomous_agent') {
      return;
    }

    const latestMsg = messages[messages.length - 1];
    if (!latestMsg || latestMsg.role !== 'assistant') return;

    const content = latestMsg.content || '';
    if (!content.includes('```write_file:') && !content.includes('```file:') && !content.includes('```create_file:') && !content.includes('```run_command') && !content.includes('```bash') && !content.includes('```sh')) {
      return;
    }

    const newActions: AgentPendingAction[] = [];
    const lines = content.split('\n');
    let inCode = false;
    let codeLang = '';
    let currentCode: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      if (trimmed.startsWith('```')) {
        if (inCode) {
          const fullCode = currentCode.join('\n');
          const cleanLang = codeLang.trim();
          const isWrite = cleanLang.startsWith('write_file:') || cleanLang.startsWith('file:') || cleanLang.startsWith('create_file:');
          const targetPath = isWrite ? cleanLang.replace(/^(write_file:|file:|create_file:)/, '').trim() : '';
          const isCmd = ['run_command', 'bash', 'sh', 'powershell', 'cmd'].includes(cleanLang.toLowerCase()) || (cleanLang === '' && (fullCode.startsWith('git ') || fullCode.startsWith('npm ')));

          if (isWrite && targetPath) {
            const actId = `act-${latestMsg.id}-${targetPath}`;
            if (!processedActionIds.has(actId)) {
              const isHighRisk = targetPath.includes('package.json') || targetPath.includes('.env') || targetPath.includes('.git');
              newActions.push({
                id: actId,
                type: 'write_file',
                target: targetPath,
                code: fullCode,
                linesCount: currentCode.length,
                isHighRisk,
                messageId: latestMsg.id,
                status: 'pending'
              });
            }
          } else if (isCmd && fullCode.trim()) {
            const actId = `act-${latestMsg.id}-cmd-${i}`;
            if (!processedActionIds.has(actId)) {
              const isHighRisk = /(\b(git\s+push|git\s+reset\s+--hard|git\s+clean|rm\s+-rf|Remove-Item|del\s+\/f)\b)/i.test(fullCode);
              newActions.push({
                id: actId,
                type: 'run_command',
                target: fullCode.split('\n')[0].slice(0, 50),
                code: fullCode,
                linesCount: currentCode.length,
                isHighRisk,
                messageId: latestMsg.id,
                status: 'pending'
              });
            }
          }
          inCode = false;
          codeLang = '';
          currentCode = [];
        } else {
          inCode = true;
          codeLang = trimmed.slice(3).trim();
          currentCode = [];
        }
      } else if (inCode) {
        currentCode.push(line);
      }
    }

    if (newActions.length > 0) {
      setPendingActionQueue(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const toAdd = newActions.filter(a => !existingIds.has(a.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [messages, sessionAutoAllowed, permissionPolicy, processedActionIds]);

  // Execute a single action through unified AgentRuntimeController
  const executePendingAction = async (action: AgentPendingAction) => {
    try {
      const intent = {
        runId: `run-manual-${Date.now()}`,
        roundId: `round-manual-${Date.now()}`,
        source: 'builtin' as const,
        toolName: action.type,
        input: action.type === 'write_file'
          ? { path: action.target, content: action.code }
          : { command: action.code }
      };

      const { toolCall } = await agentRuntimeController.requestToolExecution(intent, 'allow_all');
      const result = await agentRuntimeController.executeApprovedTool(toolCall);

      if (result.status === 'succeeded') {
        setChangesetToast(`✨ 动作执行成功: ${action.target || action.code.slice(0, 30)}`);
      } else {
        setChangesetToast(`❌ 动作执行失败: ${result.error || result.stderr}`);
      }
    } catch (e: any) {
      setChangesetToast(`❌ 动作执行异常: ${e.message}`);
    }
    setTimeout(() => setChangesetToast(null), 3500);
  };

  // 1. Allow Once: execute this action and pop next if any
  const handleAllowOnce = async (action: AgentPendingAction) => {
    await executePendingAction(action);
    setProcessedActionIds(prev => new Set(prev).add(action.id));
    setPendingActionQueue(prev => prev.filter(a => a.id !== action.id));
  };

  // 2. Reject Once: skip this action and pop next
  const handleRejectOnce = (action: AgentPendingAction) => {
    setProcessedActionIds(prev => new Set(prev).add(action.id));
    setPendingActionQueue(prev => prev.filter(a => a.id !== action.id));
    setChangesetToast(`🛑 已拒绝并跳过执行: ${action.target}`);
    setTimeout(() => setChangesetToast(null), 2500);
  };

  // 3. Allow All in Session: execute all remaining actions and enable session auto-execution
  const handleAllowAllInSession = async (action: AgentPendingAction) => {
    setSessionAutoAllowed(true);
    setPermissionPolicy('autonomous_agent');
    const queueToRun = [...pendingActionQueue];
    setPendingActionQueue([]);

    for (const act of queueToRun) {
      await executePendingAction(act);
      setProcessedActionIds(prev => new Set(prev).add(act.id));
    }
    setChangesetToast(`⚡ 已允许当前会话全部执行！共自动落地 ${queueToRun.length} 项操作。`);
    setTimeout(() => setChangesetToast(null), 3500);
  };

  const handlePipelineModeSelect = (mode: PipelineMode) => {
    setPipelineState(current => selectPipelineMode(current, mode));
    savePipelineModeToStorage(mode);
    setSwarmStartError(null);
    if (mode === 'harness') {
      setChangesetToast('🛡️ 已选择 Harness：下一条消息将沿主 Agent Loop 执行');
    } else {
      setChangesetToast('🐝 已选择 Swarm：尚未启动，请先确认目标并点击“启动 Swarm Run”');
    }
    setTimeout(() => setChangesetToast(null), 3000);
  };

  const handleStartSwarm = async () => {
    if (!swarmGoal.trim() || isStartingSwarm || activeRunId) return;

    setIsStartingSwarm(true);
    setSwarmStartError(null);

    try {
      const configSnapshot = await RuntimeConfigResolver.resolveCurrentConfig(
        currentModel.provider,
        currentModel.id,
        workMode,
        permissionPolicy,
        session.projectPath || ''
      );
      const run = await taskGraphScheduler.startSwarmRun({
        sessionId: session.id,
        userMessageId: `user-${Date.now()}`,
        goal: swarmGoal,
        configSnapshot
      });
      setActiveRunId(run.id);
      setPipelineState(current => startPipelineRun(current, { accepted: true, runId: run.id }));
      setChangesetToast(`🐝 Swarm Run 已启动：${run.id}`);
      setTimeout(() => setChangesetToast(null), 3500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知启动错误';
      setSwarmStartError(message);
      setPipelineState(current => startPipelineRun(current, { accepted: false }));
      setChangesetToast('⚠️ Swarm 未启动，当前没有运行中的任务');
      setTimeout(() => setChangesetToast(null), 3500);
    } finally {
      setIsStartingSwarm(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    let fullPrompt = inputText;

    // 1. Inject Referenced Session Context if present
    if (referencedSession) {
      const refMsgs = sessionMessagesMap[referencedSession.id] || [];
      const historySummary = refMsgs.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).slice(-4).join('\n\n');
      fullPrompt = `[已关联前序会话: ${referencedSession.title}]\n--- 前序会话历史对话上下文 ---\n${historySummary || '(前序会话暂无消息)'}\n--- 基于以上背景的继续提问 ---\n${fullPrompt}`;
    }

    // 2. Inject Active Skill Directive if present (Progressive Disclosure Tier 2)
    if (selectedSkill) {
      const fullSkillBody = getTier2SkillBody(selectedSkill.name);
      fullPrompt = `[用户显式激活 Skill: @${selectedSkill.name}]\n${fullSkillBody || selectedSkill.description}\n\n${fullPrompt}`;
    }

    if (activeModularWorkflow && activeModularWorkflow.id !== 'normal') {
      const currentBlock = activeModularWorkflow.blocks[0];
      const executionNote = `【当前生效工作流】: 【${activeModularWorkflow.name}】(${activeModularWorkflow.blocks.length} 阶段积木)\n【阶段 1 初始约束】: ${currentBlock ? currentBlock.promptTemplate : ''}`;
      fullPrompt = `[用户已确认启用积木工作流: ${activeModularWorkflow.name}]\n${executionNote}\n\n${fullPrompt}`;
    }

    if (pipelineMode === 'swarm') {
      fullPrompt = `[Swarm 协同多智能体模式]\n${fullPrompt}`;
    } else {
      fullPrompt = `[Harness 闭环模式]\n${fullPrompt}`;
    }

    onSendMessage(fullPrompt);
    setInputText('');
    setSelectedSkill(null);
    setReferencedSession(null);
    setShowSlashMenu(false);
    setShowSessionMenu(false);
  };

  return (
    <div style={{
      flex: 1,
      minWidth: '320px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-surface-elevated)',
      borderRight: rightWorkspaceOpen ? '1px solid var(--border-subtle)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      transition: 'all 0.2s ease',
      ...style
    }}>
      {/* 1. SINGLE-LINE FLUID GLASS RIBBON (Seamless Integration of Breadcrumb, Fork, Swarm & Actions) */}
      <div style={{
        height: '36px',
        padding: '0 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--chat-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        fontSize: '11.5px',
        gap: '8px'
      }}>
        {/* Left: Scope Breadcrumb & Fork Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <FolderGit2 size={13} color="var(--accent)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {session?.projectName ? `${session.projectName} / ${session.gitBranch || 'main'}` : '全局自由对话'}
          </span>

          {isForkedSession && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'rgba(147, 51, 234, 0.1)',
              border: '1px solid rgba(147, 51, 234, 0.25)',
              color: '#9333EA',
              fontSize: '10px',
              fontWeight: 600
            }}>
              <GitBranch size={10} />
              <span>#fork-refactor-store</span>
            </div>
          )}
        </div>

        {/* Center: Interactive Mode Switch (Harness Single Agent vs Swarm Multi-Agent) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', padding: '0 4px' }}>
          {/* Mode Switcher Segmented Control */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-base, #181818)',
              border: '1px solid var(--border-subtle, #333)',
              borderRadius: '6px',
              padding: '2px',
              gap: '2px'
            }}
          >
            <button
              onClick={() => {
                setPipelineState(prev => ({ ...prev, mode: 'harness' }));
                savePipelineModeToStorage('harness');
                setChangesetToast('🛡️ 已切换至 Harness 单智能体闭环模式');
                setTimeout(() => setChangesetToast(null), 2500);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                background: pipelineMode === 'harness' ? 'var(--accent, #D96B27)' : 'transparent',
                color: pipelineMode === 'harness' ? '#FFF' : 'var(--text-muted)',
                fontSize: '10px',
                fontWeight: pipelineMode === 'harness' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              title="Harness 模式：单模型 Think-Act-Verify 多轮自主闭环"
            >
              <span>🛡️ Harness 闭环</span>
            </button>

            <button
              onClick={() => {
                setPipelineState(prev => ({ ...prev, mode: 'swarm' }));
                savePipelineModeToStorage('swarm');
                setChangesetToast('🐝 已切换至 Swarm 多智能体异构协同模式');
                setTimeout(() => setChangesetToast(null), 2500);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                background: pipelineMode === 'swarm' ? 'var(--accent, #D96B27)' : 'transparent',
                color: pipelineMode === 'swarm' ? '#FFF' : 'var(--text-muted)',
                fontSize: '10px',
                fontWeight: pipelineMode === 'swarm' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              title="Swarm 模式：Master 动态调度 11 大专业角色 (PM/UI/Architect/Coder/DBA/Tester/Reviewer)"
            >
              <span>🐝 Swarm 协同</span>
            </button>
          </div>

          {/* Dynamic Pipeline Flow Display */}
          {pipelineMode === 'harness' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                📜 规则({activeRules.length})
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(234, 179, 8, 0.12)', color: '#CA8A04', fontWeight: 600 }}>
                🧠 推演
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', fontWeight: 600 }}>
                ⚡ 宿主执行
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontWeight: 600 }}>
                🎯 验收验证
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(217, 107, 39, 0.12)', color: 'var(--accent)', fontWeight: 600 }}>
                👑 Master 编排
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', fontWeight: 600 }}>
                📊 DAG 分工
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontWeight: 600 }}>
                📦 共享产物
              </span>
              <span style={{ color: 'var(--text-muted)' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.1)', color: '#A855F7', fontWeight: 600 }}>
                ⚖️ 终审裁决
              </span>
            </div>
          )}

          {/* Workbench Trigger Button */}
          <button
            onClick={() => setIsSwarmModalOpen(true)}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(217, 107, 39, 0.12)',
              border: '1px solid rgba(217, 107, 39, 0.3)',
              color: 'var(--accent, #D96B27)',
              fontSize: '10px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="点击打开 Swarm 多智能体异构协同工作台 (查看 11 大角色与产物库)"
          >
            <span>工作台 ▾</span>
          </button>
        </div>

        {/* Right: Merge to Main Pill & Toggle Workbench */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isForkedSession && (
            <button
              onClick={() => {
                setIsForkedSession(false);
                setChangesetToast('🔀 已将分叉分支成果合并回主会话！');
                setTimeout(() => setChangesetToast(null), 3000);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(147, 51, 234, 0.12)',
                border: '1px solid #9333EA',
                color: '#9333EA',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="将当前分叉的决策与代码合并回主会话"
            >
              <CheckCheck size={11} />
              <span>🔀 一键合并</span>
            </button>
          )}

          {/* Context Telemetry HUD Capsule (Industry Standard Context Budget Model with Context Epoch) */}
          {(() => {
            const limit = currentModel?.contextLimit || 131072;
            let activeEpoch = undefined;
            try {
              const raw = localStorage.getItem('codemind_context_epochs');
              if (raw) {
                const map = JSON.parse(raw);
                activeEpoch = map[session.id];
              }
            } catch (e) {}

            const budget = getContextBudget(messages, limit, 16384, 4096, activeEpoch);
            
            const totalPercent = budget.usagePercent;
            const convRatio = budget.breakdown.convRatio;
            const toolRatio = budget.breakdown.toolRatio;
            const sysRatio = budget.breakdown.sysRatio;

            const statusColor = totalPercent >= 100 ? '#DC2626' : totalPercent >= 95 ? '#EA580C' : totalPercent >= 85 ? '#D97706' : '#16A34A';
            const statusLabel = totalPercent >= 100 ? '已达上限 (已暂停)' : totalPercent >= 95 ? '强制压缩' : totalPercent >= 85 ? '自动压缩' : totalPercent >= 70 ? '接近上限' : '容量充裕';

            const rawK = (budget.rawHistoryTokens / 1000).toFixed(1);
            const effK = (budget.effectiveInputTokens / 1000).toFixed(1);
            const availK = (budget.availableInputTokens / 1000).toFixed(1);
            const limitK = (budget.modelContextLimit / 1000).toFixed(0);

            const detailedTooltip = `模型上下文预算看板：${totalPercent}% (${statusLabel})
• 当前模型：${currentModel?.name || '默认模型'} (总窗口 ${limitK}k)
• 当前周期：Context Epoch #${budget.epochIndex || 1} ${budget.epochIndex > 1 ? `(旧历史已归档，基底摘要 ${(budget.epochSummaryTokens / 1000).toFixed(1)}k)` : ''}
• 本轮有效输入：${(budget.epochTurnTokens / 1000).toFixed(1)}k / 可用预算 ${availK}k
• 原始会话历史：${rawK}k ${budget.isCompressed ? `(UI 完整保留)` : ''}
• 负载构成：对话 ${convRatio}% · 工具/代码 ${toolRatio}% · 规则 ${sysRatio}%
• 状态：${budget.epochIndex > 1 ? `🍃 Epoch #${budget.epochIndex} 新上下文周期 (从 0% 起步)` : budget.isCompressed ? '🍃 已启用非破坏性智能压缩' : '完整原始上下文'}`;

            return (
              <div
                title={detailedTooltip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'var(--chat-user-bg)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  cursor: 'default'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} />
                <span style={{ fontWeight: 700 }}>上下文 {totalPercent}%</span>
                {budget.epochIndex > 1 ? (
                  <span style={{ fontSize: '9px', color: '#16A34A', fontWeight: 600 }}>🍃Epoch #{budget.epochIndex}</span>
                ) : budget.isCompressed ? (
                  <span style={{ fontSize: '9px', color: '#16A34A', fontWeight: 600 }}>🍃已压缩</span>
                ) : null}
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>({convRatio}% / {toolRatio}% / {sysRatio}%)</span>
              </div>
            );
          })()}

          {workMode === 'minimal' && (
            <span style={{ padding: '1px 6px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', fontSize: '9.5px', fontWeight: 600 }}>
              🍃 -82%
            </span>
          )}

          <button
            onClick={onToggleWorkspace}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: rightWorkspaceOpen ? 'var(--accent)' : 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              color: rightWorkspaceOpen ? '#FFF' : 'var(--text-secondary)',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>{rightWorkspaceOpen ? '收起工作台' : '打开工作台'}</span>
          </button>
        </div>
      </div>

      {/* Task Plan Breathing Capsule: Dynamic lifecycle (Only shown during active generation) */}
      {isStreaming && (
        <div style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(217, 107, 39, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent)'
              }} />
              <span style={{ color: 'var(--accent)' }}>⚡ 正在实时流式生成: {currentModel.name} ...</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SSE 流式通道已连通</span>
          </div>
        </div>
      )}

      {/* Messages Stream Area */}
      <div ref={scrollContainerRef} onScroll={handleScrollContainer} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--chat-bg)', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '960px', display: 'flex', flexDirection: 'column' }}>
        {/* Real Product Onboarding / Zero-State Welcome Screen */}
        {messages.length === 0 && (
          <div style={{
            margin: 'auto',
            maxWidth: '680px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(217, 107, 39, 0.1)',
              border: '1px solid rgba(217, 107, 39, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Sparkles size={26} color="var(--accent)" />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              欢迎使用 Tcode
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6, maxWidth: '520px' }}>
              生产级 Agentic AI 智能编码工作台 · 支持 Monaco 画布、AST 依赖拓扑感知与实时流式大模型生成
            </p>

            {/* Quick Prompt Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              width: '100%',
              marginBottom: '24px'
            }}>
              {[
                {
                  title: '⚡ 审查工程代码架构',
                  desc: '基于 AST 语法树扫描潜在缺陷、类型违规与冗余依赖',
                  prompt: '请全面审查当前工程的代码架构，指出潜在的坏味道与重构建议。'
                },
                {
                  title: '🧪 编写高覆盖率单测',
                  desc: '遵循 SDD-TDD 规范，为核心契约生成自动化单元测试',
                  prompt: '请为当前核心业务逻辑编写高覆盖率的自动化单测，确保测试先行。'
                },
                {
                  title: '📐 设计模块重构方案',
                  desc: '推演依赖变更影响面（Blast Radius）并输出详细方案',
                  prompt: '我想优化当前模块的设计模式与状态流转，请先输出只读设计方案。'
                },
                {
                  title: '🛡️ 敏感凭据离线脱敏',
                  desc: '离线扫描 API Key、数据库连接密码与私钥，保障数据安全',
                  prompt: '请执行离线安全扫描，检测并脱敏工程中的敏感信息与连接凭据。'
                }
              ].map((card, idx) => (
                <div
                  key={idx}
                  onClick={() => setInputText(card.prompt)}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:border-orange-500 hover:shadow-sm"
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>💡 当前已就绪模型: <strong style={{ color: 'var(--accent)' }}>{currentModel.name}</strong></span>
              <span>·</span>
              <span>输入需求按 <strong style={{ color: 'var(--text-primary)' }}>Enter</strong> 直接开始真实编码</span>
            </div>
          </div>
        )}

        {messages.filter(m => !m.isAgentFeedback).map(msg => (
          <div key={msg.id} style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontWeight: 600, color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--accent)' }}>
                {msg.role === 'user' ? `${devProfile.name || '开发者'} (You)` : 'Tcode 智能体'}
              </span>
              <span>· {new Date(msg.timestamp).toLocaleTimeString()}</span>

              {/* Git Plumbing Shadow Checkpoint Rollback Anchor */}
              {msg.role === 'user' && msg.checkpointRef && onRollbackToCheckpoint && (
                <button
                  onClick={() => onRollbackToCheckpoint(msg.checkpointRef!, msg.id)}
                  title={`点击无损回滚代码与对话至本轮发起前 (快照: ${msg.checkpointRef})`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(217, 107, 39, 0.1)',
                    border: '1px solid rgba(217, 107, 39, 0.3)',
                    color: 'var(--accent)',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginLeft: '4px'
                  }}
                >
                  <RotateCcw size={10} />
                  <span>↩ 回到这里</span>
                </button>
              )}
              {msg.auditTag && (
                <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '10px' }}>
                  {msg.auditTag}
                </span>
              )}

              {/* Per-Turn Token & Duration Gauge */}
              {msg.role === 'assistant' && msg.tokensDetail && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(217, 107, 39, 0.08)',
                  border: '1px solid rgba(217, 107, 39, 0.2)',
                  color: 'var(--accent)',
                  fontSize: '9.5px',
                  fontWeight: 600
                }}>
                  <Coins size={10} />
                  <span>{msg.tokensDetail.totalTokens} tokens (输入 {msg.tokensDetail.promptTokens} · 输出 {msg.tokensDetail.completionTokens})</span>
                  {msg.durationSeconds && <span style={{ color: 'var(--text-muted)' }}>· {msg.durationSeconds}s</span>}
                </span>
              )}


            </div>

            {/* 🎯 Target-Driven Acceptance Criteria & Step Chain Card */}
            {(msg.acceptanceItems?.length || msg.stepTags?.length || msg.rounds?.length) ? (
              <TargetStepProgressCard
                items={msg.acceptanceItems}
                stepTags={msg.stepTags}
                rounds={msg.rounds}
                activeRoundId={selectedRoundByMsgId[msg.id] || msg.activeRoundId || (msg.rounds?.length ? msg.rounds[msg.rounds.length - 1].roundId : undefined)}
                loopStatus={msg.loopStatus}
                terminationSummary={msg.terminationSummary}
                onSelectRound={(roundId) => {
                  setSelectedRoundByMsgId(prev => ({ ...prev, [msg.id]: roundId }));
                }}
                onSelectAction={(actionId) => {
                  if (actionId === 'try_new_approach') {
                    onSendMessage('请换一种全新架构思路重新设计并实施修复。');
                  } else if (actionId === 'continue_anyway') {
                    onSendMessage('请继续深入推演修复，重点解决当前失败的验收项。');
                  }
                }}
              />
            ) : null}

            {/* Message Body with Tag Folding, ThinkingBlock & Tool Calls */}
            {(() => {
              const isLastAssistant = isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id;
              const hasRounds = msg.rounds && msg.rounds.length > 0;

              // When rounds exist, render ALL rounds sequentially (no overwriting)
              if (hasRounds) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', userSelect: 'text', WebkitUserSelect: 'text' }}>
                    {msg.rounds!.map((round, roundIdx) => {
                      const isLatestRound = roundIdx === msg.rounds!.length - 1;
                      // Default state: latest round expanded, historical rounds collapsed
                      const roundKey = `${msg.id}-round-${round.roundId}`;
                      const isManuallyToggled = userToggledRounds[roundKey] !== undefined;
                      const isRoundExpanded = isManuallyToggled ? userToggledRounds[roundKey] : true;

                      const roundParsed = parseAgentMessage(round.content || '');
                      const isCurrentlyStreaming = isLastAssistant && isLatestRound;
                      const phaseLabels: Record<string, string> = {
                        understand: '🔍 探索分析', plan: '📋 任务规划', inspect: '🔎 扫描工程',
                        modify: '✏️ 修改代码', verify: '🧪 运行验证', fix: '🔧 修复代码', done: '✅ 验收完成'
                      };
                      const statusColors: Record<string, string> = {
                        running: 'var(--accent)', passed: '#16A34A', failed: '#DC2626', blocked: '#9333EA'
                      };
                      const statusIcons: Record<string, string> = {
                        running: '●', passed: '✓', failed: '✕', blocked: '⊘'
                      };

                      return (
                        <div key={round.roundId} style={{
                          border: `1px solid ${isLatestRound ? 'var(--accent)' : 'var(--border-subtle)'}`,
                          borderRadius: '8px',
                          background: isLatestRound ? 'var(--bg-surface-elevated)' : 'var(--bg-base)',
                          boxShadow: isLatestRound ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                          overflow: 'hidden',
                          transition: 'all 0.15s ease'
                        }}>
                          {/* Collapsible Round Header */}
                          <div
                            onClick={() => setUserToggledRounds(prev => ({ ...prev, [roundKey]: !isRoundExpanded }))}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: isLatestRound ? 'rgba(217, 107, 39, 0.06)' : 'rgba(0,0,0,0.02)',
                              borderBottom: isRoundExpanded ? '1px solid var(--border-subtle)' : 'none',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '1px 8px',
                                borderRadius: '10px',
                                background: `${statusColors[round.status] || 'var(--accent)'}15`,
                                border: `1px solid ${statusColors[round.status] || 'var(--accent)'}40`,
                                color: statusColors[round.status] || 'var(--accent)',
                                fontSize: '10.5px',
                                fontWeight: 700
                              }}>
                                <span>{statusIcons[round.status] || '●'}</span>
                                <span>第 {round.roundId} 轮</span>
                              </span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '11px' }}>
                                {phaseLabels[round.phase] || round.phase} · {round.title}
                              </span>
                              {!isRoundExpanded && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                  (已收起 · 点击展开详情)
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>
                                {new Date(round.timestamp).toLocaleTimeString()}
                              </span>
                              {isRoundExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                            </div>
                          </div>

                          {/* Round Body (Only rendered when expanded) */}
                          {isRoundExpanded && (
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Round Thinking Block */}
                              {roundParsed.thinkingText && (
                                <ThinkingBlock
                                  payload={{
                                    thinkingText: roundParsed.thinkingText,
                                    contentText: roundParsed.cleanContent,
                                    isThinkingFinished: !isCurrentlyStreaming,
                                    durationSeconds: 6.5,
                                    tokensCount: Math.ceil(roundParsed.thinkingText.length / 4)
                                  }}
                                  defaultExpanded={isLatestRound}
                                />
                              )}

                              {/* Round Tool Calls */}
                              {roundParsed.toolCalls.length > 0 && (
                                <div style={{
                                  borderRadius: '6px',
                                  border: '1px solid rgba(217, 107, 39, 0.3)',
                                  background: 'rgba(217, 107, 39, 0.04)',
                                  overflow: 'hidden'
                                }}>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCollapsedTools(prev => ({ ...prev, [`${msg.id}-r${round.roundId}`]: !prev[`${msg.id}-r${round.roundId}`] }));
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      background: 'rgba(217, 107, 39, 0.08)',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      color: 'var(--accent)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Wrench size={12} />
                                      <span>🛠️ 工具调度: {roundParsed.toolCalls.length} 个函数 ({roundParsed.toolCalls.map((t: ParsedToolCall) => t.name).join(', ')})</span>
                                    </div>
                                    {collapsedTools[`${msg.id}-r${round.roundId}`] ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                                  </div>
                                  {!collapsedTools[`${msg.id}-r${round.roundId}`] && (
                                    <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
                                      {roundParsed.toolCalls.map((tc: ParsedToolCall, idx: number) => (
                                        <div key={idx} style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-base)' }}>
                                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>▶ {tc.name}</span>
                                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{JSON.stringify(tc.parameters)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Round Content */}
                              {(roundParsed.cleanContent || (!roundParsed.thinkingText && roundParsed.toolCalls.length === 0)) && (
                                <div style={{
                                  padding: '2px 0',
                                  fontSize: '12.5px',
                                  lineHeight: 1.65,
                                  wordBreak: 'break-word',
                                  userSelect: 'text',
                                  WebkitUserSelect: 'text',
                                  cursor: 'text'
                                }}>
                                  <MarkdownCard
                                    content={roundParsed.cleanContent || (isCurrentlyStreaming ? '正在推演并分析工程结构...' : round.content)}
                                    isStreaming={isCurrentlyStreaming && isStreaming}
                                    actionResults={round.actionResults}
                                    onOpenFile={(path) => {
                                      if (onOpenFile) onOpenFile(path);
                                      else if (onNavigateDiff) onNavigateDiff({ fileId: path, filePath: path, targetLine: 1 });
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Bottom-Left Message Action Toolbar: Copy, Export, Fork */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '2px',
                      alignSelf: 'flex-start'
                    }}>
                      <button
                        onClick={() => {
                          const allContent = msg.rounds!.map(r => `[Round ${r.roundId}] ${r.title}\n${r.content}`).join('\n\n---\n\n');
                          navigator.clipboard.writeText(allContent);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 2000);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px',
                          borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                          color: copiedMsgId === msg.id ? '#16A34A' : 'var(--text-muted)', fontSize: '10.5px',
                          cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        title="复制全部轮次回答内容"
                      >
                        {copiedMsgId === msg.id ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                        <span>{copiedMsgId === msg.id ? '已复制' : '复制全部'}</span>
                      </button>
                      <button
                        onClick={() => { setShareTargetMessage(msg); setIsShareModalOpen(true); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px',
                          borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                          color: 'var(--accent)', fontSize: '10.5px', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        title="生成精美图片卡片并分享"
                      >
                        <Share2 size={11} color="var(--accent)" />
                        <span>分享</span>
                      </button>
                      {onForkMessage && (
                        <button
                          onClick={() => onForkMessage(msg.id)}
                          title="从该回答节点分叉出独立会话分支"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px',
                            borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                            color: 'var(--accent)', fontSize: '10.5px', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                        >
                          <GitBranch size={11} color="var(--accent)" />
                          <span>分叉分支</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // Fallback: non-round messages (user messages, single-turn assistant responses)
              const parsed = parseAgentMessage(msg.content);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {/* Collapsible Thinking Process */}
                  {parsed.thinkingText && (
                    <ThinkingBlock
                      payload={{
                        thinkingText: parsed.thinkingText,
                        contentText: parsed.cleanContent,
                        isThinkingFinished: !isStreaming || !isLastAssistant,
                        durationSeconds: 6.5,
                        tokensCount: Math.ceil(parsed.thinkingText.length / 4)
                      }}
                      defaultExpanded={isLastAssistant}
                    />
                  )}

                  {/* Collapsible Agent DSML Tool Calls Badge */}
                  {parsed.toolCalls.length > 0 && (
                    <div style={{
                      borderRadius: '6px',
                      border: '1px solid rgba(217, 107, 39, 0.3)',
                      background: 'rgba(217, 107, 39, 0.04)',
                      overflow: 'hidden'
                    }}>
                      <div
                        onClick={() => setCollapsedTools(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                        style={{
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(217, 107, 39, 0.08)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--accent)'
                        }}
                        title="点击折叠/展开工具调用细节"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Wrench size={13} />
                          <span>🛠️ Agent 工具调度: 已调用 {parsed.toolCalls.length} 个函数 ({parsed.toolCalls.map((t: ParsedToolCall) => t.name).join(', ')})</span>
                        </div>
                        {collapsedTools[msg.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      </div>

                      {!collapsedTools[msg.id] && (
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          {parsed.toolCalls.map((tc: ParsedToolCall, idx: number) => (
                            <div key={idx} style={{ padding: '3px 6px', borderRadius: '4px', background: 'var(--bg-base)' }}>
                              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>▶ {tc.name}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{JSON.stringify(tc.parameters)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cardified Markdown Content Text (User message: light surface layer #F4EFEA; Agent message: seamless on #FAF8F5) */}
                  {(parsed.cleanContent || (!parsed.thinkingText && parsed.toolCalls.length === 0)) && (
                    <div style={{
                      padding: msg.role === 'user' ? '10px 14px' : '6px 0',
                      borderRadius: '8px',
                      background: msg.role === 'user' ? 'var(--chat-user-bg)' : 'transparent',
                      boxShadow: msg.role === 'user' ? '0 1px 4px rgba(0,0,0,0.03)' : 'none',
                      border: msg.role === 'user' ? '1px solid var(--border-strong)' : 'none',
                      fontSize: '12.5px',
                      lineHeight: 1.65,
                      wordBreak: 'break-word',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      cursor: 'text'
                    }}>
                      {msg.role === 'assistant' ? (
                        (msg.auditTag?.includes('Swarm') || pipelineMode === 'swarm') ? (
                          <SwarmSubagentContainer
                            content={parsed.cleanContent || (isLastAssistant ? '正在推演并分析工程结构...' : msg.content)}
                            isStreaming={isLastAssistant && isStreaming}
                            actionResults={msg.actionResults}
                            onOpenFile={(path) => {
                              if (onOpenFile) onOpenFile(path);
                              else if (onNavigateDiff) onNavigateDiff({ fileId: path, filePath: path, targetLine: 1 });
                            }}
                          />
                        ) : (
                          <MarkdownCard
                            content={parsed.cleanContent || (isLastAssistant ? '正在推演并分析工程结构...' : msg.content)}
                            isStreaming={isLastAssistant && isStreaming}
                            actionResults={msg.actionResults}
                            onOpenFile={(path) => {
                              if (onOpenFile) onOpenFile(path);
                              else if (onNavigateDiff) onNavigateDiff({ fileId: path, filePath: path, targetLine: 1 });
                            }}
                          />
                        )
                      ) : (
                        <MarkdownCard
                          content={parsed.cleanContent || msg.content}
                          isStreaming={false}
                          actionResults={msg.actionResults}
                          onOpenFile={(path) => {
                            if (onOpenFile) onOpenFile(path);
                            else if (onNavigateDiff) onNavigateDiff({ fileId: path, filePath: path, targetLine: 1 });
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Bottom-Left Message Action Toolbar: Copy, Export, Fork */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '2px',
                    alignSelf: 'flex-start'
                  }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedMsgId(msg.id);
                        setTimeout(() => setCopiedMsgId(null), 2000);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: copiedMsgId === msg.id ? '#16A34A' : 'var(--text-muted)',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="复制回答内容"
                    >
                      {copiedMsgId === msg.id ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                      <span>{copiedMsgId === msg.id ? '已复制' : '复制'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShareTargetMessage(msg);
                        setIsShareModalOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent)',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="生成精美图片卡片并分享"
                    >
                      <Share2 size={11} color="var(--accent)" />
                      <span>分享</span>
                    </button>

                    {msg.role === 'assistant' && onForkMessage && (
                      <button
                        onClick={() => onForkMessage(msg.id)}
                        title="从该回答节点分叉出独立会话分支"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <GitBranch size={11} color="var(--accent)" />
                        <span>分叉分支</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {msg.optionsPayload && (
              <OptionsCard
                payload={msg.optionsPayload}
                onConfirm={(selectedIds, customInput) => onResolveOptions(msg.id, selectedIds, customInput)}
              />
            )}

            {/* Changeset Review Card (for latest assistant response) */}
            {msg.role === 'assistant' && changeset && (
              <div
                id="changeset-review-card"
                style={{
                  marginTop: '10px',
                  borderRadius: '6px',
                  border: changeset.status === 'accepted' ? '1px solid #16A34A' : changeset.status === 'rejected' ? '1px solid #DC2626' : '1px solid var(--accent)',
                  background: 'var(--bg-surface)',
                  overflow: 'hidden',
                  userSelect: isDraggingChangesetHeight ? 'none' : 'auto'
                }}
              >
                {/* Changeset Header (Clickable to Collapse / Expand) */}
                <div
                  onClick={() => setIsChangesetCollapsed(!isChangesetCollapsed)}
                  style={{
                    padding: '8px 12px',
                    background: changeset.status === 'accepted' ? 'rgba(22, 163, 74, 0.08)' : changeset.status === 'rejected' ? 'rgba(220, 38, 38, 0.08)' : 'var(--accent-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  title="点击折叠/展开变更集列表"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderGit2 size={13} color="var(--accent)" />
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>
                      📦 多文件变更集审阅 ({changeset.files.length} 个文件)
                    </span>
                    <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600 }}>+{changeset.totalAdditions}</span>
                    <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 600 }}>-{changeset.totalDeletions}</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: '#16A34A', color: '#FFF', fontWeight: 600 }}>
                      ✓ AST 校验通过
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {changeset.status === 'pending' ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCommitModalOpen(true);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="按意图拆分为多个原子提交"
                        >
                          <Zap size={11} />
                          <span>📦 意图拆分</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPrModalOpen(true);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            background: 'rgba(37, 99, 235, 0.1)',
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                            color: '#2563EB',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="生成标准化 PR 简报并 Push"
                        >
                          <GitPullRequest size={11} />
                          <span>🚀 生成 PR 简报</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChangeset(acceptChangeset(changeset));
                            setChangesetToast('✓ 已成功接受并合并全部变更');
                            setTimeout(() => setChangesetToast(null), 3000);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            background: '#16A34A',
                            border: 'none',
                            color: '#FFF',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <CheckCheck size={11} />
                          <span>全部接受</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChangeset(rejectChangeset(changeset));
                            setChangesetToast('↩️ 已通过 Git 影子快照回滚全部变更');
                            setTimeout(() => setChangesetToast(null), 3000);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-subtle)',
                            color: '#DC2626',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Undo2 size={11} />
                          <span>一键回滚</span>
                        </button>
                      </>
                    ) : (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: changeset.status === 'accepted' ? '#16A34A' : '#DC2626'
                      }}>
                        {changeset.status === 'accepted' ? '● 已全量接受' : '○ 已全量回滚'}
                      </span>
                    )}

                    {/* Collapse / Expand Toggle Icon */}
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                      {isChangesetCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </div>

                {/* Changed Files List (Scrollable within Constrained Height) */}
                {!isChangesetCollapsed && (
                  <>
                    <div style={{
                      height: `${changesetHeight}px`,
                      overflowY: 'auto',
                      padding: '6px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {changeset.files.map(f => (
                        <div
                          key={f.path}
                          onClick={() => onNavigateDiff && onNavigateDiff({ fileId: f.path.includes('contracts') ? 'file-contracts' : 'file-options', filePath: f.path, targetLine: 13 })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-base)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '10.5px',
                            cursor: 'pointer'
                          }}
                          title="点击在右侧工作台平滑定位 Diff"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCode size={11} color="var(--accent)" />
                            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{f.path}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#16A34A', fontWeight: 600 }}>+{f.additions}</span>
                            <span style={{ color: '#DC2626', fontWeight: 600 }}>-{f.deletions}</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>查看 Diff →</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Draggable Height Resizer Bar */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsDraggingChangesetHeight(true);
                      }}
                      onDoubleClick={() => setChangesetHeight(135)}
                      title="按住上下拖拽调节卡片高度，双击重置默认高度"
                      style={{
                        height: '6px',
                        background: isDraggingChangesetHeight ? 'var(--accent)' : 'var(--bg-surface)',
                        borderTop: '1px solid var(--border-subtle)',
                        cursor: 'row-resize',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ width: '28px', height: '2px', borderRadius: '1px', background: 'var(--text-muted)', opacity: 0.4 }} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} />
        </div>

        {/* Floating "Scroll to Bottom" button — appears when user scrolls up */}
        {showScrollToBottom && (
          <button
            onClick={() => {
              scrollToBottom(true);
              setIsUserNearBottom(true);
              setShowScrollToBottom(false);
            }}
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 50,
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)'
            }}
            title="回到最新消息"
          >
            <ChevronDown size={14} />
            <span>↓ 回到底部</span>
          </button>
        )}
      </div>

      {/* INPUT AREA: UNIFIED COMMAND DECK (Cursor Composer / Claude Desktop Grade) */}
      <div style={{
        padding: '12px 20px 14px 20px',
        borderTop: '1px solid var(--border-subtle)',
        position: 'relative',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* UNIFIED ELEVATED COMMAND CARD */}
        <div style={{
          background: 'var(--bg-surface-elevated)',
          borderRadius: '10px',
          border: isInputFocused ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          boxShadow: isInputFocused
            ? '0 6px 24px rgba(217, 107, 39, 0.14), 0 0 0 1px rgba(217, 107, 39, 0.2)'
            : '0 2px 8px rgba(0,0,0,0.04)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          position: 'relative'
        }}>
          {/* Self-Learning Lessons Pill & Confirmation Card (feature toggle) */}
          {// eslint-disable-next-line no-constant-binary-expression
          false && (
            <div style={{
              position: 'absolute',
              top: '-28px',
              left: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(217, 107, 39, 0.12)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: '10.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              zIndex: 25,
              boxShadow: '0 2px 8px rgba(217, 107, 39, 0.1)'
            }}
            onClick={() => setShowLessonConfirm(true)}
            title="点击展开确认/微调规约 Prompt 并固化至项目记忆库"
            >
              <span>💡 检测到架构纠正: 点击一键沉淀为工程经验 (.codemind/lessons.md)</span>
              <span style={{ textDecoration: 'underline' }}>确认沉淀</span>
            </div>
          )}

          {/* Inline Transparent Lesson Confirmation Card */}
          {showLessonConfirm && !experienceLearned && (
            <div style={{
              position: 'absolute',
              top: '-92px',
              left: '4px',
              right: '4px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 35
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--accent)' }}>
                  💡 沉淀工程经验确认 (.codemind/lessons.md)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>同工程未来所有会话永久遵守</span>
              </div>
              <input
                type="text"
                value={lessonTitle}
                onChange={e => setLessonTitle(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10.5px',
                  color: 'var(--text-primary)'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  约束: {lessonPrompt}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setShowLessonConfirm(false)}
                    style={{ padding: '1px 6px', borderRadius: '3px', background: 'transparent', border: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setExperienceLearned(true);
                      setShowLessonConfirm(false);
                      setActiveRuleCount(prev => prev + 1);
                      setChangesetToast('✓ 已将规则固化至 .codemind/lessons.md！');
                      setTimeout(() => setChangesetToast(null), 3000);
                    }}
                    style={{ padding: '1px 8px', borderRadius: '3px', background: 'var(--accent)', border: 'none', color: '#FFF', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    确认固化
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. ATTACHED FILES CHIPS (Inside Top of Card) */}
          {attachedFiles.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '8px 12px 0 12px'
            }}>
              {attachedFiles.map(f => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-subtle)',
                    border: '1px solid rgba(217, 107, 39, 0.3)',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontWeight: 500
                  }}
                >
                  <Paperclip size={11} />
                  <span>{f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                  <XIcon
                    size={12}
                    style={{ cursor: 'pointer', marginLeft: '2px' }}
                    onClick={() => setAttachedFiles(prev => prev.filter(item => item.id !== f.id))}
                  />
                </div>
              ))}
            </div>
          )}



                    {/* Floating Slash Command Autocomplete Menu */}
          {showSlashMenu && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              maxHeight: '260px',
              overflowY: 'auto',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
              padding: '6px',
              zIndex: 250
            }}>
              <div style={{ padding: '3px 8px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <span>⚡ 快捷指令 (Slash Commands)</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>点击或回车填入模版</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {SLASH_COMMANDS
                  .filter(cmd => !slashQuery || cmd.command.toLowerCase().includes(slashQuery) || cmd.name.toLowerCase().includes(slashQuery))
                  .map(cmd => (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        if (cmd.command === '/clear') {
                          setInputText('');
                          setShowSlashMenu(false);
                        } else {
                          setInputText(cmd.promptTemplate + ' ');
                          setShowSlashMenu(false);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{cmd.icon}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11.5px', color: 'var(--accent)' }}>
                          {cmd.command}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                          {cmd.description}
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', background: 'var(--bg-base)', padding: '1px 5px', borderRadius: '3px' }}>
                        {cmd.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Floating Session Mention Menu */}
          {showSessionMenu && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              maxHeight: '260px',
              overflowY: 'auto',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
              padding: '6px',
              zIndex: 250
            }}>
              <div style={{ padding: '3px 8px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <span>💬 引用历史会话继续问答 (Session Mention)</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>点击关联前序上下文</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {sessions
                  .filter(s => s.id !== session.id)
                  .filter(s => !sessionQuery || s.title.toLowerCase().includes(sessionQuery))
                  .map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setReferencedSession(s);
                        setInputText(prev => {
                          const atIdx = prev.lastIndexOf('@');
                          return atIdx !== -1 ? prev.slice(0, atIdx) : prev;
                        });
                        setShowSessionMenu(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💬</span>
                        <span style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                          {s.title}
                        </span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                          ({s.projectName || '全局会话'})
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: 'var(--accent)' }}>
                        关联此会话
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* Draggable Top Handle to resize input box height */}
          <div
            onMouseDown={() => setIsDraggingInputHeight(true)}
            title="上下拖拽可自由调节输入框高度"
            style={{
              height: '6px',
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDraggingInputHeight ? 'var(--accent)' : 'transparent',
              transition: 'background 0.15s ease',
              userSelect: 'none'
            }}
          >
            <div style={{ width: '28px', height: '2px', background: 'var(--border-subtle)', borderRadius: '1px' }} />
          </div>

          {/* 2. BORDERLESS RESIZABLE TEXTAREA (Supports File/Snippet DnD Drop) */}
          <div
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={e => {
              e.preventDefault();
              const fileData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
              if (fileData) {
                setInputText(prev => prev ? `${prev} @${fileData}` : `@${fileData} `);
              }
            }}
            style={{ width: '100%' }}
          >
          <textarea
            placeholder={
              workMode === 'plan'
                ? `[${currentModel.name} · Plan 模式] 描述你的架构设计或分析意图，AI 将推演方案并制定计划（只读，不改写代码）...`
                : `[${currentModel.name} · Act 模式] 描述你的开发需求，AI 将直接落地修改代码并运行测试自纠（回车发送）...`
            }
            value={inputText}
            onChange={handleInputChange}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{
              width: '100%',
              height: `${inputHeight}px`,
              minHeight: '48px',
              maxHeight: '420px',
              padding: '8px 12px 6px 12px',
              border: 'none',
              background: 'transparent',
              fontSize: '12.5px',
              lineHeight: 1.55,
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              overflowY: 'auto'
            }}
          />
          </div>

          {/* 3. INTEGRATED COMMAND DECK (Bottom Control Bar Inside Card) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 8px 10px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.015)'
          }}>
            {/* Left Tools Group: Model, Attachments, Rules */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Model Selector & Smart Router Pill */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowModelMenu(!showModelMenu);
                    setShowSkillMenu(false);
                    setShowRulesPopover(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: isAutoRouting ? 'rgba(217, 107, 39, 0.1)' : 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: isAutoRouting ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="点击切换大模型或开启意图自适应调度"
                >
                  {isAutoRouting ? (
                    <>
                      <Sparkles size={11} color="var(--accent)" />
                      <span>🧠 自动调度: {resolveOptimalModel(inputText, routingStrategy).modelName}</span>
                    </>
                  ) : (
                    <>
                      <Bot size={12} color="var(--accent)" />
                      <span>{currentModel.name}</span>
                      {currentModel.badge && (
                        <span style={{
                          fontSize: '9px',
                          padding: '0 4px',
                          borderRadius: '3px',
                          background: 'var(--accent-subtle)',
                          color: 'var(--accent)',
                          fontWeight: 500
                        }}>
                          {currentModel.badge}
                        </span>
                      )}
                    </>
                  )}
                  <ChevronDown size={10} color="var(--text-muted)" />
                </button>

                {/* Unified Model & Router Dropdown Menu */}
                {showModelMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '36px',
                    left: 0,
                    width: 'min(580px, calc(100vw - 48px))',
                    maxWidth: 'calc(100vw - 48px)',
                    height: '380px',
                    maxHeight: 'min(560px, 80vh)',
                    resize: 'both',
                    minWidth: '400px',
                    minHeight: '260px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Top Bar: Search Input, Scenario Filter & Sync Action */}
                    <div style={{
                      padding: '8px 12px 6px 12px',
                      background: 'var(--bg-surface)',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            placeholder="过滤模型名称、厂商或 ID (例如: mimo, flash, r1, claude)..."
                            value={modelSearchQuery}
                            onChange={e => setModelSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px 4px 26px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleSyncOnlineModels(); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'var(--accent)',
                            color: '#FFF',
                            border: 'none',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                          title="立即从网关实时拉取所有在线模型"
                        >
                          <RefreshCw size={11} className={isSyncingModels ? 'animate-spin' : ''} />
                          <span>{isSyncingModels ? '同步中...' : '同步网关'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowModelMenu(false)}
                          aria-label="关闭模型选择器"
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-base)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                          title="关闭 (ESC)"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Scenario Quick Filter Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {[
                          { id: 'all', label: '全部' },
                          { id: 'code', label: '💻 极速代码' },
                          { id: 'thinking', label: '🧠 深度思考' },
                          { id: 'offline', label: '🛡️ 纯离线' }
                        ].map(sc => {
                          const isActive = scenarioFilter === sc.id;
                          return (
                            <button
                              key={sc.id}
                              onClick={() => setScenarioFilter(sc.id as any)}
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: isActive ? 700 : 500,
                                background: isActive ? 'var(--accent)' : 'var(--bg-base)',
                                color: isActive ? '#FFF' : 'var(--text-secondary)',
                                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                transition: 'all 0.12s ease'
                              }}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Master-Detail Body: Left (Channels) + Right (Models) */}
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      {/* Left Column: Channels List from New-API */}
                      <div style={{
                        width: '180px',
                        background: 'var(--bg-surface)',
                        borderRight: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        padding: '4px'
                      }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 700 }}>
                          模型服务商渠道 (New-API)
                        </div>
                        {(() => {
                          const activeChannels = loadSavedChannels().filter(c => c.status !== 'disabled');
                          const channelTabs = [
                            ...activeChannels.map(c => {
                              const preset = getPresetForChannelType(c.type);
                              const count = availableModelList.filter(m => m.providerId === c.id || (m as any).uniqueKey?.startsWith(`${c.id}:`)).length;
                              return { id: c.id, name: c.name, icon: preset.icon, count, priority: c.priority };
                            }),
                            { id: 'auto-router', name: '智能自适应路由', icon: '🧠', count: 4, priority: 999 }
                          ];

                          return channelTabs.map(prov => {
                            const isActive = activeProviderTab === prov.id;
                            return (
                              <div
                                key={prov.id}
                                onClick={() => setActiveProviderTab(prov.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  margin: '1px 0',
                                  cursor: 'pointer',
                                  background: isActive ? 'var(--accent-subtle)' : 'transparent',
                                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                                  fontSize: '11px',
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? 'var(--accent)' : 'var(--text-primary)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span>{prov.icon}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{prov.name.split(' ')[0]}</span>
                                </div>
                                <span style={{
                                  fontSize: '9px',
                                  padding: '1px 4px',
                                  borderRadius: '8px',
                                  background: isActive ? 'var(--accent)' : 'var(--border-subtle)',
                                  color: isActive ? '#FFF' : 'var(--text-muted)'
                                }}>
                                  {prov.count}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Right Column: Model List for Selected Channel */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {activeProviderTab === 'auto-router' ? (
                          <>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                              🧠 意图驱动智能自适应调度模式
                            </div>
                            {MODEL_ROUTING_STRATEGIES.map(st => {
                              const isSelected = isAutoRouting && routingStrategy === st.id;
                              return (
                                <div
                                  key={st.id}
                                  onClick={() => {
                                    setRoutingStrategy(st.id);
                                    setIsAutoRouting(true);
                                    setShowModelMenu(false);
                                  }}
                                  style={{
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '11.5px', color: isSelected ? 'var(--accent)' : 'var(--text-strong)' }}>
                                      {st.name}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {st.desc}
                                    </div>
                                  </div>
                                  {isSelected && <Check size={14} color="var(--accent)" />}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>
                                {(() => {
                                  const c = loadSavedChannels().find(item => item.id === activeProviderTab);
                                  if (!c) return '渠道模型列表';
                                  const preset = getPresetForChannelType(c.type);
                                  return `${preset.icon} ${c.name} · P${c.priority}`;
                                })()}
                              </span>
                              <span>共 {
                                availableModelList.filter(m => {
                                  if (modelSearchQuery) {
                                    const q = modelSearchQuery.toLowerCase();
                                    const matchText = (m.name + ' ' + m.id + ' ' + (m.badge || '') + ' ' + (m.description || '')).toLowerCase();
                                    if (!matchText.includes(q)) return false;
                                  }
                                  if (scenarioFilter !== 'all') {
                                    const text = (m.name + ' ' + m.id + ' ' + (m.badge || '') + ' ' + (m.description || '')).toLowerCase();
                                    if (scenarioFilter === 'code' && !text.includes('code') && !text.includes('flash') && !text.includes('coder') && !text.includes('lightning') && !text.includes('fast')) return false;
                                    if (scenarioFilter === 'thinking' && !text.includes('r1') && !text.includes('reasoner') && !text.includes('thinking') && !text.includes('sonnet') && !text.includes('mimo') && !text.includes('推理')) return false;
                                    if (scenarioFilter === 'offline' && !text.includes('local') && !text.includes('ollama') && !text.includes('lmstudio') && m.provider !== 'Local' && !m.providerId?.includes('ollama')) return false;
                                  }
                                  return m.providerId === activeProviderTab || (m as any).uniqueKey?.startsWith(`${activeProviderTab}:`);
                                }).length
                              } 个</span>
                            </div>

                            {availableModelList
                              .filter(m => {
                                if (modelSearchQuery) {
                                  const q = modelSearchQuery.toLowerCase();
                                  const matchText = (m.name + ' ' + m.id + ' ' + (m.badge || '') + ' ' + (m.description || '')).toLowerCase();
                                  if (!matchText.includes(q)) return false;
                                }
                                if (scenarioFilter !== 'all') {
                                  const text = (m.name + ' ' + m.id + ' ' + (m.badge || '') + ' ' + (m.description || '')).toLowerCase();
                                  if (scenarioFilter === 'code' && !text.includes('code') && !text.includes('flash') && !text.includes('coder') && !text.includes('lightning') && !text.includes('fast')) return false;
                                  if (scenarioFilter === 'thinking' && !text.includes('r1') && !text.includes('reasoner') && !text.includes('thinking') && !text.includes('sonnet') && !text.includes('mimo') && !text.includes('推理')) return false;
                                  if (scenarioFilter === 'offline' && !text.includes('local') && !text.includes('ollama') && !text.includes('lmstudio') && m.provider !== 'Local' && !m.providerId?.includes('ollama')) return false;
                                }
                                return m.providerId === activeProviderTab || (m as any).uniqueKey?.startsWith(`${activeProviderTab}:`);
                              })
                              .map(m => {
                                const currentKey = (currentModel as any).uniqueKey || ((currentModel as any).providerId ? `${(currentModel as any).providerId}:${currentModel.id}` : currentModel.id);
                                const itemKey = (m as any).uniqueKey || ((m as any).providerId ? `${(m as any).providerId}:${m.id}` : m.id);
                                const isSelected = !isAutoRouting && (currentKey === itemKey || (currentModel.id === m.id && (!m.providerId || !(currentModel as any).providerId || m.providerId === (currentModel as any).providerId)));
                                return (
                                  <div
                                    key={itemKey}
                                    onClick={() => {
                                      onSelectModel(m);
                                      setIsAutoRouting(false);
                                      setShowModelMenu(false);
                                    }}
                                    style={{
                                      padding: '7px 10px',
                                      borderRadius: '6px',
                                      background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      transition: 'all 0.12s ease'
                                    }}
                                    onMouseEnter={e => {
                                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                                    }}
                                  >
                                    <div style={{ flex: 1, paddingRight: '6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '11.5px', color: isSelected ? 'var(--accent)' : 'var(--text-strong)' }}>
                                          {m.name}
                                        </span>
                                        {m.badge && (
                                          <span style={{
                                            fontSize: '9px',
                                            padding: '1px 5px',
                                            borderRadius: '3px',
                                            background: isSelected ? 'var(--accent)' : 'rgba(234, 88, 12, 0.1)',
                                            color: isSelected ? '#FFF' : '#EA580C',
                                            fontWeight: 600
                                          }}>
                                            {m.badge}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {m.id} · {Math.round((m.contextLimit || 128000) / 1000)}k 上下文 · {m.description || '真实网关大模型'}
                                      </div>
                                    </div>
                                    {isSelected && <Check size={14} color="var(--accent)" />}
                                  </div>
                                );
                              })}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bottom Footer: Protocol Notice & Settings Entry */}
                    <div style={{
                      padding: '6px 12px',
                      background: 'var(--bg-surface)',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '10px'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        🛡️ 复合主键单选消歧已开启 · 绝不多选 (Alt+M)
                      </span>
                      <button
                        onClick={() => {
                          setShowModelMenu(false);
                          window.dispatchEvent(new CustomEvent('tcode_open_settings'));
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        前往服务商设置 ⚙️
                      </button>
                    </div>
                  </div>
                )}
              </div>

                            {/* Active Modular Workflow Interactive Capsule + Popover Modal */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => setShowWorkflowMenu(!showWorkflowMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: activeModularWorkflow.id !== 'normal'
                      ? (showWorkflowMenu ? 'rgba(249, 115, 22, 0.22)' : 'rgba(249, 115, 22, 0.12)')
                      : (showWorkflowMenu ? 'var(--bg-surface-elevated)' : 'var(--bg-base)'),
                    border: `1px solid ${
                      activeModularWorkflow.id !== 'normal'
                        ? (showWorkflowMenu ? 'var(--accent, #F97316)' : 'rgba(249, 115, 22, 0.3)')
                        : 'var(--border-subtle)'
                    }`,
                    color: activeModularWorkflow.id !== 'normal' ? 'var(--accent, #F97316)' : 'var(--text-secondary)',
                    fontSize: '10.5px',
                    fontWeight: activeModularWorkflow.id !== 'normal' ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  title={activeModularWorkflow.id !== 'normal' ? '已启用工作流 (点击可切换或再次点击取消选中)' : '未启用工作流 (点击可选择工作流)'}
                >
                  <span>{activeModularWorkflow.id !== 'normal' ? `${activeModularWorkflow.icon} ${activeModularWorkflow.name}` : '💬 普通任务模式'}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {activeModularWorkflow.id !== 'normal' ? `(${activeModularWorkflow.blocks.length} 阶段)` : '(未指定)'}
                  </span>
                  <ChevronDown size={11} style={{ transform: showWorkflowMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </div>

                {/* Workflow Quick-Selection Popover Modal */}
                {showWorkflowMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '36px',
                    left: '0',
                    width: 'min(420px, calc(100vw - 48px))',
                    maxHeight: 'min(500px, 68vh)',
                    background: 'var(--bg-surface-elevated, #1A1D24)',
                    border: '1px solid var(--border-strong, rgba(255,255,255,0.18))',
                    borderRadius: '10px',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
                    padding: '12px',
                    zIndex: 350,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {/* Header with Title and explicit Close [X] button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>🧩</span>
                        <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>选择会话工作流 (单选即生效)</strong>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>ESC 可关闭</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWorkflowMenu(false)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="关闭 (ESC)"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                      <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '7px' }} />
                      <input
                        type="text"
                        placeholder="搜索工作流 (如 SDD, TDD, SpecKit)..."
                        value={workflowSearchQuery}
                        onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 8px 5px 26px',
                          borderRadius: '6px',
                          background: 'var(--bg-base, #101216)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                        autoFocus
                      />
                    </div>

                    {/* Workflows List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '280px', paddingRight: '2px' }}>
                      {savedWorkflowsList
                        .filter(w => !workflowSearchQuery || w.name.toLowerCase().includes(workflowSearchQuery.toLowerCase()) || w.description.toLowerCase().includes(workflowSearchQuery.toLowerCase()))
                        .map(w => {
                          const isSelected = w.id === activeModularWorkflow.id;
                          return (
                            <div
                              key={w.id}
                              onClick={() => {
                                if (isSelected) {
                                  // Click again to deselect back to normal/none mode!
                                  setActiveWorkflowId('normal');
                                  setActiveModularWorkflow(NORMAL_WORKFLOW);
                                } else {
                                  setActiveWorkflowId(w.id);
                                  setActiveModularWorkflow(w);
                                }
                                setShowWorkflowMenu(false);
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'var(--bg-surface, #14161C)',
                                border: isSelected ? '1.5px solid var(--accent, #F97316)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'all 0.15s'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px' }}>{w.icon}</span>
                                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{w.name}</span>
                                  <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                    {w.blocks.length} 阶段
                                  </span>
                                </div>
                                {isSelected ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent, #F97316)', fontSize: '11px', fontWeight: 700 }} title="再次点击即可取消选中">
                                    <Check size={12} />
                                    <span>生效中 (再点取消)</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>点击选中</span>
                                )}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                                {w.description}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Footer: Jump to Block Studio */}
                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        📁 独立存储: .codemind/workflows.json
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWorkflowMenu(false);
                          window.dispatchEvent(new CustomEvent('tcode_open_settings_tab', { detail: 'workflows' }));
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--accent, #F97316)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>🧩 积木拼装工作台 (深度编排) ➔</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>



              {/* @ Agent Skills Reference Trigger Button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowSkillMenu(!showSkillMenu);
                    setShowModelMenu(false);
                    setShowRulesPopover(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: selectedSkill ? 'var(--accent-subtle)' : 'var(--bg-base)',
                    border: selectedSkill ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: selectedSkill ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                  title="引用应用配置的 Agent 专精能力与技能 (Skills)"
                >
                  <Sparkles size={12} color="var(--accent)" />
                  <span>{selectedSkill ? `@ ${selectedSkill.name}` : '@ 技能引用'}</span>
                </button>

                {showSkillMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '36px',
                    right: 0,
                    left: 'auto',
                    width: 'min(480px, calc(100vw - 48px))',
                    maxWidth: 'calc(100vw - 48px)',
                    height: '380px',
                    maxHeight: 'min(500px, 75vh)',
                    resize: 'both',
                    minWidth: '340px',
                    minHeight: '260px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
                    padding: '8px',
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Top Header with Close Button */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '2px 4px 6px',
                      borderBottom: '1px solid var(--border-subtle)',
                      marginBottom: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={13} color="var(--accent)" />
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-strong)' }}>
                          引用 Agent 专精能力与技能
                        </span>
                      </div>
                      <button
                        onClick={() => setShowSkillMenu(false)}
                        title="关闭 (ESC)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px',
                          borderRadius: '3px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Search Input */}
                    <div style={{ padding: '2px 2px 6px' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="搜索 Agent 技能 (如: sdd-tdd-workflow, build-installer)..."
                          value={skillQuery}
                          onChange={e => setSkillQuery(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '4px 8px 4px 26px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Official Skill List (Single Select Only & Close on Click) */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {officialSkillsList
                        .filter(s => s.enabled)
                        .filter(s => !skillQuery || s.name.toLowerCase().includes(skillQuery.toLowerCase()) || s.description.toLowerCase().includes(skillQuery.toLowerCase()))
                        .map(skill => {
                          const isSelected = selectedSkill?.name === skill.name;
                          return (
                            <div
                              key={skill.name}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedSkill(null);
                                } else {
                                  setSelectedSkill(skill);
                                }
                                setShowSkillMenu(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                transition: 'all 0.12s ease'
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ fontSize: '15px' }}>{skill.icon || '📦'}</span>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '11.5px', color: isSelected ? 'var(--accent)' : 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
                                      @{skill.name}
                                    </span>
                                    <span style={{ fontSize: '9px', padding: '0 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>
                                      {skill.path}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {skill.description}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check size={14} color="var(--accent)" />}
                            </div>
                          );
                        })}
                    </div>

                    {/* Footer Tip with Explicit Close Button */}
                    <div style={{ padding: '6px 4px 2px', borderTop: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>💡 单选模式：点击任一能力立即装载并关闭</span>
                      <button
                        onClick={() => setShowSkillMenu(false)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ 关闭 (ESC)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload File Button */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="上传文件或剪贴板粘贴 (Ctrl+V)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                <Paperclip size={11} color="var(--accent)" />
                <span>附件</span>
              </button>

              {/* Rules Preload Indicator Pill */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowRulesPopover(!showRulesPopover)}
                  title="查看已前置注入的顶层规则"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(217, 107, 39, 0.08)',
                    border: '1px solid rgba(217, 107, 39, 0.25)',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <ScrollText size={11} />
                  <span>📜 {activeRules.length} 条规则已注入 ▾</span>
                </button>

                {/* Rules Popover */}
                {showRulesPopover && (
                  <div style={{
                    position: 'absolute',
                    bottom: '34px',
                    right: 0,
                    left: 'auto',
                    width: 'min(360px, calc(100vw - 48px))',
                    maxWidth: 'calc(100vw - 48px)',
                    maxHeight: 'min(360px, 60vh)',
                    overflowY: 'auto',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
                    padding: '10px',
                    zIndex: 200,
                    fontSize: '11px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ScrollText size={12} color="var(--accent)" />
                        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>已注入生效规则</span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>实时快照</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRulesPopover(false)}
                        aria-label="关闭规则列表"
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="关闭 (ESC)"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeRules.map(r => (
                        <div key={r.id} style={{ padding: '6px 8px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '11px' }}>
                              ● {r.title}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {r.sourceFile}
                            </span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {r.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Tools Group: Permission, Shortcut Hint, Send Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>


                            {/* 3-State Dynamic Permission Policy Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: permissionPolicy === 'strict_approval'
                    ? 'rgba(100, 116, 139, 0.12)'
                    : permissionPolicy === 'autonomous_agent'
                    ? 'rgba(217, 107, 39, 0.14)'
                    : 'rgba(234, 88, 12, 0.14)',
                  border: permissionPolicy === 'strict_approval'
                    ? '1px solid rgba(100, 116, 139, 0.3)'
                    : permissionPolicy === 'autonomous_agent'
                    ? '1px solid var(--accent)'
                    : '1px solid #EA580C',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: permissionPolicy === 'strict_approval'
                    ? '#64748B'
                    : permissionPolicy === 'autonomous_agent'
                    ? 'var(--accent)'
                    : '#EA580C',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  if (permissionPolicy === 'strict_approval') {
                    setPermissionPolicy('autonomous_agent');
                    setChangesetToast('⚡ 已切换至: 智能自决模式 (生成完毕自动写盘与执行)');
                  } else if (permissionPolicy === 'autonomous_agent') {
                    setPermissionPolicy('risk_adaptive');
                    setChangesetToast('⚠️ 已切换至: 风险熔断模式 (常规自决，高危动作强制拦截)');
                  } else {
                    setPermissionPolicy('strict_approval');
                    setChangesetToast('🛡️ 已切换至: 逐次审核模式 (所有写盘与命令需人工确认)');
                  }
                  setTimeout(() => setChangesetToast(null), 3000);
                }}
                title="点击切换 AI 动作权限策略：逐次审核 / 智能自决 / 风险熔断"
              >
                {permissionPolicy === 'strict_approval' && <Shield size={12} color="#64748B" />}
                {permissionPolicy === 'autonomous_agent' && <Shield size={12} color="var(--accent)" />}
                {permissionPolicy === 'risk_adaptive' && <AlertTriangle size={12} color="#EA580C" />}
                <span>
                  {permissionPolicy === 'strict_approval' && '逐次审核'}
                  {permissionPolicy === 'autonomous_agent' && '智能自决'}
                  {permissionPolicy === 'risk_adaptive' && '风险熔断'}
                </span>
              </div>

              {/* Keyboard Shortcut Hint */}
              <span style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                padding: '1px 4px',
                borderRadius: '3px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)'
              }}>
                Ctrl+↵
              </span>

              {/* Primary Send or Spinning Red Circle Stop Button */}
              {isStreaming ? (
                <button
                  onClick={onStopGeneration}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#DC2626',
                    border: 'none',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px rgba(220, 38, 38, 0.6)',
                    transition: 'all 0.15s ease'
                  }}
                  title="正在实时流式生成中，点击中断问答 (Esc)"
                >
                  <Loader2 size={16} color="#FFF" className="animate-spin" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() && attachedFiles.length === 0}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: (inputText.trim() || attachedFiles.length > 0) ? 'var(--accent)' : 'var(--bg-base)',
                    border: (inputText.trim() || attachedFiles.length > 0) ? 'none' : '1px solid var(--border-subtle)',
                    color: (inputText.trim() || attachedFiles.length > 0) ? '#FFF' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (inputText.trim() || attachedFiles.length > 0) ? 'pointer' : 'not-allowed',
                    boxShadow: (inputText.trim() || attachedFiles.length > 0) ? '0 2px 8px rgba(217, 107, 39, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. BOTTOM INTERACTION HELPER STREAM (极简提示流) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 4px 0 4px',
          fontSize: '10px',
          color: 'var(--text-muted)'
        }}>
          <span>💡 提示：按 <strong>Enter</strong> 发送，<strong>Shift+Enter</strong> 换行 · 剪贴板文件或截图支持 <strong>Ctrl+V</strong> 粘贴挂载</span>
          <span>已自动先行注入项目级三大铁律与活跃 Rule 规则</span>
        </div>
        </div>
        {/* Trajectory Snapshot Time Travel Modal */}
        <TrajectorySnapshotModal
          isOpen={!!selectedTrajectoryStep}
          onClose={() => setSelectedTrajectoryStep(null)}
          step={selectedTrajectoryStep}
          onForkStep={(stepIdx) => {
            if (onForkMessage) onForkMessage('msg-2');
            setChangesetToast(`🌿 已从 Step ${stepIdx} 派生出新探索分支会话！`);
            setTimeout(() => setChangesetToast(null), 3500);
          }}
          onRollbackStep={(stepIdx) => {
            setChangesetToast(`↩️ 工作区代码已成功回滚至 Step ${stepIdx} 历史快照点！`);
            setTimeout(() => setChangesetToast(null), 3500);
          }}
        />

        <PullRequestModal
          isOpen={isPrModalOpen}
          onClose={() => setIsPrModalOpen(false)}
          branchName="fork-refactor-store"
          sessionTitle="重构三栏自适应流体布局"
          onSuccess={() => {
            setChangesetToast('🎉 PR 创建成功并已推送到远端仓库！');
            setTimeout(() => setChangesetToast(null), 4000);
          }}
        />
        <SemanticCommitModal
          isOpen={isCommitModalOpen}
          onClose={() => setIsCommitModalOpen(false)}
          files={[
            { path: 'src/types/contracts.ts' },
            { path: 'src/components/OptionsCard.tsx' },
            { path: 'tests/contracts.test.ts' }
          ]}
          onExecuteCommits={() => {
            setChangesetToast('✓ 3 条 Conventional Commits 均已顺序提交至 Git 树！');
            setTimeout(() => setChangesetToast(null), 3500);
          }}
        />
      </div>
      {/* 4. Share Preview Card Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareTargetMessage(null);
        }}
        message={shareTargetMessage}
        session={session}
      />

      {/* 🛡️ Human-in-the-Loop Batch Action Approval Checklist Modal */}
      <ActionApprovalModal
        isOpen={!!pendingApproval && !!pendingApproval.actions && pendingApproval.actions.length > 0}
        actions={pendingApproval?.actions || []}
        onApproveAll={(approvedIds, trustGlob) => onApprovalDecision?.(approvedIds, trustGlob)}
        onRejectAll={() => onRejectBatchApproval?.()}
        onOpenFile={(path) => {
          if (onOpenFile) onOpenFile(path);
          else if (onNavigateDiff) onNavigateDiff({ fileId: path, filePath: path, targetLine: 1 });
        }}
      />

      {/* 🐝 Swarm Multi-Agent Workbench Modal */}
      <SwarmWorkbenchModal
        isOpen={isSwarmModalOpen}
        onClose={() => setIsSwarmModalOpen(false)}
      />
    </div>
  );
};
