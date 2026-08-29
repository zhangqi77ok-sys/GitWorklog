import React, { useState } from 'react';
import {
  Send,
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
  Undo2
} from 'lucide-react';
import {
  SessionItem,
  ChatMessage,
  AttachedFile,
  RuleItem,
  INITIAL_RULES,
  getActiveRules,

  WorkMode,
  WORK_MODE_CONFIGS,
  PermissionPolicy,
  AIModelOption,
  AVAILABLE_MODELS,
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
  onSendMessage: (text: string) => void;
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
  onSendMessage,
  onResolveOptions,
  onForkMessage,
  onNavigateDiff
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showRulesPopover, setShowRulesPopover] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeRules = getActiveRules(INITIAL_RULES);

  // DX & PM Power States: Mentions, Changeset, Pinned Files
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<MentionContextItem[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<PinnedFileItem[]>([
    { id: 'pin-1', path: 'src/types/contracts.ts', name: 'contracts.ts', size: 38400 }
  ]);
  const [changeset, setChangeset] = useState<ChangesetReviewPayload>(INITIAL_CHANGESET);
  const [changesetToast, setChangesetToast] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<'harness' | 'swarm'>('swarm');
  const [isForkedSession, setIsForkedSession] = useState<boolean>(true);
  const [swarmStages, setSwarmStages] = useState<SwarmPipelineStage[]>(INITIAL_SWARM_STAGES);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [experienceLearned, setExperienceLearned] = useState<boolean>(false);
  const [showLessonConfirm, setShowLessonConfirm] = useState<boolean>(false);
  const [lessonTitle, setLessonTitle] = useState('禁止直接 new Store 实例');
  const [lessonPrompt, setLessonPrompt] = useState('必须通过 StoreFactory 单例方法获取全局 Store，保持单状态源');
  const [activeRuleCount, setActiveRuleCount] = useState<number>(3);
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
    onSendMessage(inputText);
    setInputText('');
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
            agent-learning <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ main</span>
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
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>🐝 Swarm 协同:</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontSize: '9.5px', fontWeight: 600 }}>
                🧭 R1 ✓
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(217, 107, 39, 0.15)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '9.5px', fontWeight: 700 }}>
                ⚡ Sonnet (50%)
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>➔</span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '9.5px' }}>
                🧪 GLM
              </span>
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

      {/* Task Plan Breathing Capsule */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        transition: 'all 0.2s ease'
      }}>
        <div
          onClick={() => setPlanExpanded(!planExpanded)}
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            cursor: 'pointer',
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
            <span>📋 2/4 正在执行: 编写 Store 契约与前置测试 (50%)</span>
          </div>
          {planExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>

        {planExpanded && (
          <div style={{ padding: '6px 12px 10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A' }}>
              <CheckCircle size={13} />
              <span style={{ textDecoration: 'line-through' }}>1. 扫描项目 AST 符号依赖关系并生成雷达</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600 }}>
              <Clock size={13} />
              <span>2. 编写 Store 契约与前置失败测试 (Red Testing)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>3. 生成原子级 Unified Patch 并执行落盘</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>4. 执行全套测试治具验证 (Green Passed)</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Stream Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
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
              {msg.role === 'assistant' && onForkMessage && (
                <button
                  onClick={() => onForkMessage(msg.id)}
                  title="Harness 事件溯源: 从该思考节点分叉出独立会话分支"
                  style={{
                    marginLeft: 'auto',
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
                  <span>分叉分支 (Fork)</span>
                </button>
              )}
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: msg.role === 'user' ? 'var(--bg-surface)' : 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              lineHeight: 1.6
            }}>
              {msg.content}
            </div>

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
          {!experienceLearned && !showLessonConfirm && (
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

              {/* Model Switcher Pill */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowModelMenu(!showModelMenu);
                    setShowModeMenu(false);
                    setShowRulesPopover(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Cpu size={11} color="var(--accent)" />
                  <span>{currentModel.name}</span>
                  <ChevronDown size={10} color="var(--text-muted)" />
                </button>

                {/* Model Dropdown */}
                {showModelMenu && (
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
                    zIndex: 100,
                    maxHeight: '320px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 600 }}>
                      选择底层推理模型 (自动无缝热切)
                    </div>
                    {AVAILABLE_MODELS.map(model => {
                      const isSelected = model.id === currentModel.id;
                      return (
                        <div
                          key={model.id}
                          onClick={() => { onSelectModel(model); setShowModelMenu(false); }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '2px'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '11px', color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                                {model.name}
                              </span>
                              {model.badge && (
                                <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.06)', color: isSelected ? '#FFF' : 'var(--text-muted)' }}>
                                  {model.badge}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {model.description} · 上限 {Math.round(model.contextLimit / 1000)}k tokens
                            </div>
                          </div>
                          {isSelected && <Check size={14} color="var(--accent)" />}
                        </div>
                      );
                    })}
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
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 8px 6px', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
                      @ 即时上下文引用 (文件 / AST 符号 / Git Diff / 终端)
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      {searchMentionItems(mentionQuery).map(item => (
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

              {/* Primary Send Button */}
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
