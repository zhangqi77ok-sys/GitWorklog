import React, { useState } from 'react';
import {
  Send,
  Coins,
  Copy,
  Share2,
  Square,
  X,
  Shield,
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
  MODEL_ROUTING_STRATEGIES,
  ModelRoutingStrategy,
  RoutingStrategyId,
  resolveOptimalModel,
  MOCK_TRAJECTORY_STEPS,
  TrajectoryStepSnapshot,
  ChatMessage,
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
import { extractThinkingFromText } from '../types/contracts';
import { GitPullRequest } from 'lucide-react';

interface ChatColumnProps {
  rightWorkspaceOpen: boolean;
  onToggleWorkspace: () => void;
  style?: React.CSSProperties;
  session: SessionItem;
  messages: ChatMessage[];
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  currentModel: AIModelOption;
  onSelectModel: (model: AIModelOption) => void;
  permissionPolicy: PermissionPolicy;
  setPermissionPolicy: (p: PermissionPolicy) => void;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  onSendMessage: (text: string, mentions?: MentionContextItem[]) => void;
  onResolveOptions: (messageId: string, selectedIds: string[], customInput?: string) => void;
  onForkMessage?: (fromMessageId: string) => void;
  onNavigateDiff?: (target: { fileId: string; filePath: string; targetLine: number }) => void;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  rightWorkspaceOpen,
  onToggleWorkspace,
  style,
  session,
  messages,
  workMode,
  setWorkMode,
  currentModel,
  onSelectModel,
  permissionPolicy,
  setPermissionPolicy,
  isStreaming = false,
  onStopGeneration,
  onSendMessage,
  onResolveOptions,
  onForkMessage,
  onNavigateDiff
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showRulesPopover, setShowRulesPopover] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeRules = getActiveRules(INITIAL_RULES);

  // DX & PM Power States: Mentions, Changeset, Pinned Files
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<MentionContextItem[]>([]);
  // Real Workspace Mentions State
  const [workspaceMentionItems, setWorkspaceMentionItems] = useState<MentionContextItem[]>([]);
  const [availableModelList, setAvailableModelList] = useState<AIModelOption[]>(getAllAvailableModels());
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isSyncingModels, setIsSyncingModels] = useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const loadMentions = async () => {
      const projPath = session?.projectPath;
      if (!projPath) return;
      try {
        const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(projPath)}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.tree)) {
          const files = flattenFileTreeToMentions(data.tree);
          const specials: MentionContextItem[] = [
            { id: 'm-workspace-tree', type: 'file', name: '@工程目录全貌', path: projPath, detail: '扫描并向 Agent 注入完整工程目录结构与依赖拓扑' },
            { id: 'm-git-diff', type: 'git-diff', name: '@git-diff', detail: '注入当前 Git 未暂存代码变更' }
          ];
          setWorkspaceMentionItems([...specials, ...files]);
        }
      } catch (e) {}
    };
    loadMentions();
    return () => { isMounted = false; };
  }, [session?.projectPath]);

  const handleSyncOnlineModels = async () => {
    setIsSyncingModels(true);
    try {
      const savedProviders = loadSavedProviders();
      const p = savedProviders.find((item: any) => item.enabled && item.apiKey && item.baseUrl) || savedProviders[0];
      if (!p) throw new Error('未配置服务商');
      let base = p.baseUrl.trim();
      if (base.endsWith('/')) base = base.slice(0, -1);
      const { url: requestUrl, headers: proxyHeaders } = resolveApiEndpoint(`${base}/models`);
      const res = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${p.apiKey.trim()}`,
          ...proxyHeaders
        }
      });
      const data = await res.json();
      const list = data.data || [];
      if (Array.isArray(list) && list.length > 0) {
        const synched: AIModelOption[] = list.map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: (p.name.includes('Anthropic') ? 'Anthropic' : p.name.includes('OpenAI') ? 'OpenAI' : 'DeepSeek') as any,
          contextLimit: 128000,
          inputPricePerM: 0.1,
          outputPricePerM: 0.2,
          badge: '已同步',
          description: `在线网关可用模型 (${m.id})`
        }));
        setAvailableModelList(synched);
        setChangesetToast(`✓ 成功同步 ${synched.length} 个真实大模型！`);
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
  const [pipelineMode, setPipelineMode] = useState<'harness' | 'swarm'>('swarm');
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
          setChangesetHeight(clampChangesetHeight(newH));
        }
      }
    };
    const handleChangesetUp = () => {
      setIsDraggingChangesetHeight(false);
    };
    if (isDraggingChangesetHeight) {
      window.addEventListener('mousemove', handleChangesetMove);
      window.addEventListener('mouseup', handleChangesetUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleChangesetMove);
      window.removeEventListener('mouseup', handleChangesetUp);
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

  // Popover states for unified mode button and model selector button
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, selectedMentions);
    setInputText('');
    setSelectedMentions([]);
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
        padding: '0 12px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
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

        {/* Center: Ultra-Sleek Swarm Relay Indicator & Mode Switcher Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '0 4px' }}>
          {pipelineMode === 'swarm' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>🐝 调度拓扑:</span>
              {isStreaming ? (
                <span style={{
                  padding: '1px 8px',
                  borderRadius: '10px',
                  background: 'rgba(217, 107, 39, 0.15)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <span>⚡ {currentModel.name} 实时流式响应中...</span>
                </span>
              ) : (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(22, 163, 74, 0.08)',
                  color: '#16A34A',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>● 待命中 (就绪)</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {currentModel.name}</span>
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 700, color: '#2563EB' }}>🛡️ Harness 管道:</span>
              <span style={{ padding: '1px 4px', borderRadius: '3px', background: 'var(--bg-base)' }}>📜 规则(3)</span>
              <span>➔</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>🛡️ AST</span>
              <span>➔</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🧠 {currentModel.name.split(' ')[0]}</span>
              <span>➔</span>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>🔌 MCP</span>
            </div>
          )}

          {/* Explicit Mode Switch Button */}
          <button
            onClick={() => {
              const nextMode = pipelineMode === 'swarm' ? 'harness' : 'swarm';
              setPipelineMode(nextMode);
              setChangesetToast(nextMode === 'swarm' ? '🐝 已切换至多智能体异构协同蜂群 (Swarm)' : '🛡️ 已切换至轻量 Harness 串行执行管道');
              setTimeout(() => setChangesetToast(null), 3000);
            }}
            style={{
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.15s ease'
            }}
            title="点击在 Swarm 蜂群与 Harness 管道之间切换"
          >
            <span style={{ color: 'var(--accent)' }}>⇄</span>
            <span>{pipelineMode === 'swarm' ? '切为 Harness' : '切为 Swarm'}</span>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
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
              欢迎使用 CodeMind-Hub
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

        {messages.map(msg => (
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
                {msg.role === 'user' ? '开发者 (You)' : 'CodeMind 智能体'}
              </span>
              <span>· {new Date(msg.timestamp).toLocaleTimeString()}</span>
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

              {/* Action Buttons: Copy, Share, Fork */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: copiedMsgId === msg.id ? '#16A34A' : 'var(--text-muted)',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                  title="复制回答文本到剪贴板"
                >
                  {copiedMsgId === msg.id ? <Check size={10} color="#16A34A" /> : <Copy size={10} />}
                  <span>{copiedMsgId === msg.id ? '已复制' : '复制'}</span>
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([msg.content], { type: 'text/markdown;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `codemind-${msg.id}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                  title="导出为 Markdown 文件"
                >
                  <Share2 size={10} />
                  <span>导出</span>
                </button>

                {msg.role === 'assistant' && onForkMessage && (
                  <button
                    onClick={() => onForkMessage(msg.id)}
                    title="Harness 事件溯源: 从该思考节点分叉出独立会话分支"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 7px',
                      borderRadius: '3px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <GitBranch size={10} color="var(--accent)" />
                    <span>分叉分支</span>
                  </button>
                )}
              </div>
            </div>

            {/* Message Body with Tag Folding, ThinkingBlock & Tool Calls */}
            {(() => {
              const parsed = parseAgentMessage(msg.content);
              const isLastAssistant = isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id;

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

                  {/* Clean Content Text */}
                  {(parsed.cleanContent || (!parsed.thinkingText && parsed.toolCalls.length === 0)) && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: msg.role === 'user' ? 'var(--bg-surface)' : 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      cursor: 'text'
                    }}>
                      {parsed.cleanContent || (isLastAssistant ? '正在推演并分析工程结构...' : msg.content)}
                      {isLastAssistant && (
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '14px',
                          background: 'var(--accent)',
                          marginLeft: '3px',
                          verticalAlign: 'middle'
                        }} />
                      )}
                    </div>
                  )}
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
      </div>

      {/* INPUT AREA: UNIFIED COMMAND DECK (Cursor Composer / Claude Desktop Grade) */}
      <div style={{
        padding: '10px 16px 12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
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
          {/* Self-Learning Lessons Pill & Confirmation Card */}
          {false && (
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

          {/* Active @ Mention Context Badges */}
          {selectedMentions.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '6px 12px 2px 12px',
              background: 'rgba(37, 99, 235, 0.04)',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              {selectedMentions.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid #2563EB',
                    color: '#2563EB',
                    fontSize: '10.5px',
                    fontWeight: 600
                  }}
                >
                  <AtSign size={11} />
                  <span>{m.name}</span>
                  <X
                    size={11}
                    style={{ cursor: 'pointer', marginLeft: '2px' }}
                    onClick={() => setSelectedMentions(prev => prev.filter(item => item.id !== m.id))}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 2. BORDERLESS AUTO-EXPANDING TEXTAREA */}
          <textarea
            placeholder={
              workMode === 'plan'
                ? `[${currentModel.name} · Plan 模式] 描述你的架构设计或分析意图，AI 将推演方案并制定计划（只读，不改写代码）...`
                : `[${currentModel.name} · Act 模式] 描述你的开发需求，AI 将直接落地修改代码并运行测试自纠（回车发送）...`
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px 6px 12px',
              border: 'none',
              background: 'transparent',
              fontSize: '12.5px',
              lineHeight: 1.55,
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />

          {/* 3. INTEGRATED COMMAND DECK (Bottom Control Bar Inside Card) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 8px 10px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.015)'
          }}>
            {/* Left Tools Group: Mode, Model, Attachments, Rules */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Mode Switcher Pill (DeepSeek Harness 4 Modes) */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowModeMenu(!showModeMenu);
                    setShowModelMenu(false);
                    setShowRulesPopover(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: workMode === 'act'
                      ? 'rgba(217, 107, 39, 0.12)'
                      : workMode === 'plan'
                      ? 'rgba(147, 51, 234, 0.12)'
                      : workMode === 'minimal'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(37, 99, 235, 0.12)',
                    color: workMode === 'act'
                      ? 'var(--accent)'
                      : workMode === 'plan'
                      ? '#9333EA'
                      : workMode === 'minimal'
                      ? '#10B981'
                      : '#2563EB',
                    border: workMode === 'act'
                      ? '1px solid rgba(217, 107, 39, 0.3)'
                      : workMode === 'plan'
                      ? '1px solid rgba(147, 51, 234, 0.3)'
                      : workMode === 'minimal'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(37, 99, 235, 0.3)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {workMode === 'act' && <Zap size={11} />}
                  {workMode === 'plan' && <Compass size={11} />}
                  {workMode === 'minimal' && <Leaf size={11} />}
                  {workMode === 'creator' && <Wrench size={11} />}
                  <span>{WORK_MODE_CONFIGS[workMode].label}</span>
                  <ChevronDown size={10} />
                </button>

                {/* Mode Dropdown Popover (DeepSeek Harness 4 Modes Matrix) */}
                {showModeMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '0',
                    width: '280px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: '6px',
                    zIndex: 100
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 8px 6px', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                      DeepSeek Harness 运行时模态矩阵 (Runtime Modes)
                    </div>

                    {[
                      { id: 'act', name: '⚡ Act 落地执行', color: 'var(--accent)', desc: '全功能工具链 + AST 校验 + 代码落盘与测试自纠', tag: '生产落地' },
                      { id: 'plan', name: '📐 Plan 架构推演', color: '#9333EA', desc: '只读探索 + 任务依赖拓扑生成，严禁越权写盘', tag: '只读设计' },
                      { id: 'minimal', name: '🍃 Minimal 极简低噪', color: '#10B981', desc: '过滤 80% 冗余转轮与废话，立省 75% Token 成本', tag: '极限低噪' },
                      { id: 'creator', name: '🛠️ Creator 技能造物', color: '#2563EB', desc: '用于现场调试 Prompt、编写 Rule 与测试 MCP 插件', tag: '生态开发' }
                    ].map(modeItem => (
                      <div
                        key={modeItem.id}
                        onClick={() => { setWorkMode(modeItem.id as WorkMode); setShowModeMenu(false); }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: workMode === modeItem.id ? 'var(--accent-subtle)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          marginBottom: '2px'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600, fontSize: '11px', color: modeItem.color }}>{modeItem.name}</span>
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{modeItem.tag}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{modeItem.desc}</div>
                        </div>
                        {workMode === modeItem.id && <Check size={12} color="var(--accent)" style={{ marginTop: '2px' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Selector & Smart Router Pill */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowModelMenu(!showModelMenu);
                    setShowModeMenu(false);
                    setShowMentionMenu(false);
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
                    bottom: '30px',
                    left: 0,
                    width: '300px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: '8px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '380px',
                    overflowY: 'auto'
                  }}>
                    {/* Section 1: Direct Model Selection */}
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🌟 选择指定大模型 ({availableModelList.length} 个可用)</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleSyncOnlineModels(); }}
                        style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: 'var(--accent)',
                          color: '#FFF',
                          border: 'none',
                          fontSize: '9.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="立即从网关实时拉取所有 47+ 个在线模型"
                      >
                        {isSyncingModels ? '同步中...' : '🔄 同步网关模型'}
                      </button>
                    </div>

                    <div style={{ padding: '2px 4px 4px' }}>
                      <input
                        type="text"
                        placeholder="过滤模型名称或 ID..."
                        value={modelSearchQuery}
                        onChange={e => setModelSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '3px 6px',
                          fontSize: '10.5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '220px', overflowY: 'auto' }}>
                      {availableModelList
                        .filter(m => !modelSearchQuery || m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                        .map(m => {
                        const isSelected = !isAutoRouting && currentModel.id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              onSelectModel(m);
                              setIsAutoRouting(false);
                              setShowModelMenu(false);
                            }}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                              border: isSelected ? '1px solid rgba(217, 107, 39, 0.3)' : '1px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11px'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{m.name}</span>
                                {m.badge && (
                                  <span style={{ fontSize: '9px', padding: '0 3px', borderRadius: '3px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                                    {m.badge}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                {m.provider} · {Math.round(m.contextLimit / 1000)}k · {m.description}
                              </div>
                            </div>
                            {isSelected && <Check size={12} color="var(--accent)" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Section 2: Intent-Driven Auto Router */}
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '6px 6px 2px', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                      🧠 意图驱动智能自适应调度
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                              padding: '5px 8px',
                              borderRadius: '4px',
                              background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                              border: isSelected ? '1px solid rgba(217, 107, 39, 0.3)' : '1px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11px'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{st.name}</div>
                              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{st.desc}</div>
                            </div>
                            {isSelected && <Check size={12} color="var(--accent)" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* @ Mention Popover Trigger Button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowMentionMenu(!showMentionMenu);
                    setShowModeMenu(false);
                    setShowModelMenu(false);
                    setShowRulesPopover(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: showMentionMenu ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-base)',
                    border: showMentionMenu ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
                    color: showMentionMenu ? '#2563EB' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="@ 符号即时索引文件、AST 符号与 Git Diff"
                >
                  <AtSign size={11} />
                  <span>@引用</span>
                </button>

                {/* @ Mention Floating Dropdown */}
                {showMentionMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '0',
                    width: '320px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: '6px',
                    zIndex: 100
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 8px 6px', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>@ 即时上下文引用 (工程文件/目录/Git)</span>
                      <span style={{ color: 'var(--accent)' }}>{workspaceMentionItems.length > 0 ? `${workspaceMentionItems.length} 个文件` : '默认预置'}</span>
                    </div>
                    <div style={{ padding: '4px 6px' }}>
                      <input
                        type="text"
                        placeholder="搜索文件或符号 (例如 package.json, contracts...)"
                        value={mentionQuery}
                        onChange={e => setMentionQuery(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      {(workspaceMentionItems.length > 0 ? workspaceMentionItems.filter(i => !mentionQuery || i.name.toLowerCase().includes(mentionQuery.toLowerCase()) || (i.path && i.path.toLowerCase().includes(mentionQuery.toLowerCase()))) : searchMentionItems(mentionQuery)).slice(0, 15).map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!selectedMentions.some(m => m.id === item.id)) {
                              setSelectedMentions(prev => [...prev, item]);
                            }
                            setShowMentionMenu(false);
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '4px',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.type === 'file' && <FileCode size={12} color="var(--accent)" />}
                            {item.type === 'symbol' && <Sparkles size={12} color="#9333EA" />}
                            {item.type === 'git-diff' && <FolderGit2 size={12} color="#10B981" />}
                            {item.type === 'terminal' && <Terminal size={12} color="#2563EB" />}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{item.detail}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.type}</span>
                        </div>
                      ))}
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
                  <span>📜 {activeRules.length}条规则生效 ▾</span>
                </button>

                {/* Rules Popover */}
                {showRulesPopover && (
                  <div style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: 0,
                    width: '320px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: '10px',
                    zIndex: 80,
                    fontSize: '11px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>已生效的顶层 System Rules</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>先行注入 Prompt</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeRules.map(r => (
                        <div key={r.id} style={{ padding: '4px 6px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            ● {r.title}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {r.content}
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
              {/* Dual-Track Permission Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
                onClick={() => {
                  if (permissionPolicy === 'strict_approval') setPermissionPolicy('autonomous_agent');
                  else if (permissionPolicy === 'autonomous_agent') setPermissionPolicy('risk_adaptive');
                  else setPermissionPolicy('strict_approval');
                }}
                title="切换 AI 动作自主决策模式"
              >
                <Shield size={11} color="var(--accent)" />
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

              {/* Primary Send or Stop Generation Button */}
              {isStreaming ? (
                <button
                  onClick={onStopGeneration}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#DC2626',
                    color: '#FFF',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)'
                  }}
                  title="中断大模型当前输出 (Esc)"
                >
                  <Square size={10} fill="#FFF" />
                  <span>停止</span>
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
          padding: '0 4px',
          fontSize: '10px',
          color: 'var(--text-muted)'
        }}>
          <span>💡 提示：按 <strong>Enter</strong> 发送，<strong>Shift+Enter</strong> 换行 · 剪贴板文件或截图支持 <strong>Ctrl+V</strong> 粘贴挂载</span>
          <span>已自动先行注入项目级三大铁律与活跃 Rule 规则</span>
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
    </div>
  );
};
